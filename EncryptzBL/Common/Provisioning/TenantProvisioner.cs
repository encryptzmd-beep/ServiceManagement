using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Builds the database of one company and makes the company Ready, or cleans up
    /// and marks it Failed. Rules it guards:
    ///   - it works only on a job it claimed: two runs never build for one company;
    ///   - the database name comes from the company id only;
    ///   - a database that already exists is never dropped and never reused;
    ///   - only a database THIS attempt created is dropped when the attempt fails,
    ///     and only after the main database confirmed, just before the drop, that the
    ///     attempt still owns the job and that the company does not name this database
    ///     (the drop goes by NAME: see DropIfStillOursAsync);
    ///   - a company that was given up meanwhile does not become Ready;
    ///   - a database a company points to is never dropped, also when the answer of
    ///     the main database was lost;
    ///   - recording the failure (which releases the job for a retry) is the last
    ///     thing an attempt does, after its clean-up.
    /// It never throws: the worker must survive every job.
    /// </summary>
    public sealed class TenantProvisioner
    {
        private const int MaxErrorLength = 2000;   // Companies.ProvisionError

        private readonly IProvisionStore _store;
        private readonly ITenantDatabaseServer _server;
        private readonly ILogger<TenantProvisioner> _logger;

        public TenantProvisioner(IProvisionStore store, ITenantDatabaseServer server, ILogger<TenantProvisioner> logger)
        {
            _store = store;
            _server = server;
            _logger = logger;
        }

        public async Task<ProvisionOutcome> RunAsync(int companyId, CancellationToken ct)
        {
            // Exceptions are never handed to the logger and their text is logged only after
            // scrubbing: a message can carry a connection string.
            ProvisionJob? job;
            try
            {
                job = await _store.BeginAsync(companyId);
            }
            catch (Exception ex)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the job could not be claimed ({ErrorType})",
                    companyId, ex.GetType().Name);
                return ProvisionOutcome.Failed;
            }

            if (job == null)
                return ProvisionOutcome.Skipped;

            if (job.CompanyId != companyId)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the job that came back belongs to company {OtherCompanyId}. Nothing was done.",
                    companyId, job.CompanyId);
                return ProvisionOutcome.Failed;
            }

            if (string.IsNullOrWhiteSpace(job.ServerName) || string.IsNullOrWhiteSpace(job.AdminUser)
                || string.IsNullOrEmpty(job.AdminPassword))
                return await FailAsync(job, "No usable database server is set for this company.", null);

            var databaseName = TenantDatabaseName.For(job.CompanyId);
            var createStarted = false;
            var created = false;

            try
            {
                // before anything exists: a script that cannot be read or used must not
                // leave a database behind
                _server.EnsureReady();

                if (await _server.DatabaseExistsAsync(job, databaseName, ct))
                    return await FailAsync(job,
                        $"A database named {databaseName} already exists on the server. It was not touched. Remove or rename it, then retry.", null);

                createStarted = true;
                await _server.CreateDatabaseAsync(job, databaseName, ct);
                created = true;

                await _server.BuildTenantAsync(job, databaseName, ct);
            }
            catch (Exception ex)
            {
                // A create that failed or was cut off may still have happened on the server.
                // It is not dropped (it was never seen to be ours), so say that someone must look.
                var note = createStarted && !created
                    ? $" The database {databaseName} may have been created; check the server before retrying."
                    : null;

                return await CleanUpAndFailAsync(job, databaseName, created, ex, note);
            }

            bool completed;
            try
            {
                completed = await _store.CompleteAsync(job, databaseName);
            }
            catch (Exception ex)
            {
                // The answer was lost: the main database may or may not have made the company Ready.
                ProvisionState? state;
                try
                {
                    state = await _store.GetStateAsync(companyId);
                }
                catch (Exception statusEx)
                {
                    // Nobody knows. The database stays (a Ready company may point to it), nothing
                    // is recorded; the stuck-job sweeper marks the row, a person decides.
                    _logger.LogError("Provisioning of company {CompanyId}: marking it ready failed ({ErrorType}) and its status could not be read ({StatusErrorType}). "
                        + "The database {DatabaseName} was left on the server: check whether the company uses it before removing it.",
                        companyId, ex.GetType().Name, statusEx.GetType().Name, databaseName);
                    return ProvisionOutcome.Failed;
                }

                if (state != null && string.Equals(state.Status.Trim(), "Ready", StringComparison.OrdinalIgnoreCase))
                {
                    if (SameDatabase(state.DatabaseName, databaseName))
                    {
                        _logger.LogInformation("Provisioning of company {CompanyId}: database ready (the answer was lost, the status confirmed it)", companyId);
                        return ProvisionOutcome.Ready;
                    }

                    // Ready by other means (a database attached by hand): the company did not
                    // fail, and this attempt has nothing to record. Its own database is not
                    // dropped here either: it stays as an orphan for a person to remove.
                    _logger.LogWarning("Provisioning of company {CompanyId}: marking it ready failed ({ErrorType}), and the company is ready with another database. "
                        + "The database {DatabaseName} this attempt built was left on the server: no company uses it.",
                        companyId, ex.GetType().Name, databaseName);
                    return ProvisionOutcome.Skipped;
                }

                return await CleanUpAndFailAsync(job, databaseName, true, ex, null);
            }

            if (!completed)
                return await CleanUpAndFailAsync(job, databaseName, true,
                    new InvalidOperationException("The set-up was given up before it finished."), null);

            _logger.LogInformation("Provisioning of company {CompanyId}: database ready", job.CompanyId);
            return ProvisionOutcome.Ready;
        }

        /// <summary>
        /// Drops the database when this attempt created it and still may (see
        /// <see cref="DropIfStillOursAsync"/>), then records the failure. Recording comes
        /// last: it releases the job, and only then can the company be retried.
        /// </summary>
        private async Task<ProvisionOutcome> CleanUpAndFailAsync(
            ProvisionJob job, string databaseName, bool created, Exception ex, string? note)
        {
            var reason = ex is OperationCanceledException
                ? "The set-up was cancelled or timed out."
                : ex.Message;

            _logger.LogError("Provisioning of company {CompanyId} failed ({ErrorType}): {Reason}",
                job.CompanyId, ex.GetType().Name, Scrub(reason, job));

            if (created)
            {
                switch (await DropIfStillOursAsync(job, databaseName))
                {
                    case DropResult.Dropped:
                        break;

                    case DropResult.DropFailed:
                        note = $" The database {databaseName} could not be removed and was left on the server: remove it before retrying.";
                        break;

                    case DropResult.CompanyUsesIt:
                        // The company is not waiting for a database any more: there is no
                        // failure to record, and never an instruction to remove this database.
                        return ProvisionOutcome.Failed;

                    default:
                        // not this attempt's job any more, or nobody knows: stored only if the
                        // attempt turns out to own the job after all (sp_Provision_Fail decides)
                        note = $" The database {databaseName} was left on the server.";
                        break;
                }
            }

            return await FailAsync(job, reason, note);
        }

        private enum DropResult { Dropped, DropFailed, NotThisAttempt, CompanyUsesIt, StateUnknown }

        /// <summary>
        /// The ONLY place a database is dropped. The drop goes by name, and a name can come
        /// to mean another database (a later attempt builds the same generated name; a
        /// platform administrator attaches it by hand). So the main database is asked first,
        /// and the drop happens only when all of this holds:
        ///   - the state was read;
        ///   - the job is still this attempt's (ProvisionAttempt is this attempt);
        ///   - the company does not name this database.
        /// While the attempt owns the job no other run can claim it, so nobody else builds
        /// under this name between the question and the drop.
        /// </summary>
        private async Task<DropResult> DropIfStillOursAsync(ProvisionJob job, string databaseName)
        {
            ProvisionState? state;
            try
            {
                state = await _store.GetStateAsync(job.CompanyId);
            }
            catch (Exception stateEx)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: state could not be read ({ErrorType}). "
                    + "Check whether the company uses it before removing it.",
                    job.CompanyId, databaseName, stateEx.GetType().Name);
                return DropResult.StateUnknown;
            }

            if (state != null && SameDatabase(state.DatabaseName, databaseName))
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: the company uses this database.",
                    job.CompanyId, databaseName);
                return DropResult.CompanyUsesIt;
            }

            if (state == null || state.Attempt != job.Attempt)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: no longer this attempt's job. "
                    + "Check whether a company uses it before removing it.",
                    job.CompanyId, databaseName);
                return DropResult.NotThisAttempt;
            }

            try
            {
                await _server.DropDatabaseAsync(job, databaseName);
                return DropResult.Dropped;
            }
            catch (Exception dropEx)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} of the failed attempt could not be removed ({ErrorType})",
                    job.CompanyId, databaseName, dropEx.GetType().Name);
                return DropResult.DropFailed;
            }
        }

        private static bool SameDatabase(string? a, string b)
            => string.Equals((a ?? "").Trim(), b, StringComparison.OrdinalIgnoreCase);

        private async Task<ProvisionOutcome> FailAsync(ProvisionJob job, string reason, string? note)
        {
            // the note about a database on the server must survive the truncation
            var tail = note ?? "";
            var text = Scrub(reason, job);
            var room = Math.Max(0, MaxErrorLength - tail.Length);
            if (text.Length > room)
                text = text.Substring(0, room);

            try
            {
                await _store.FailAsync(job, text + tail);
            }
            catch (Exception ex)
            {
                // the stuck-job sweeper will mark it Failed later
                _logger.LogError("Provisioning of company {CompanyId}: the failure could not be recorded ({ErrorType})",
                    job.CompanyId, ex.GetType().Name);
            }

            return ProvisionOutcome.Failed;
        }

        /// <summary>An error text must never carry the server password.</summary>
        private static string Scrub(string text, ProvisionJob job)
        {
            var result = text ?? "";
            if (!string.IsNullOrEmpty(job.AdminPassword))
                result = result.Replace(job.AdminPassword, "***", StringComparison.Ordinal);
            return result;
        }
    }
}
