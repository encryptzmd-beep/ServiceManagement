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
    ///     and only after the main database answered, in one statement that also gives
    ///     the job up, that the attempt still owns the job and that NO company names
    ///     this database (the drop goes by NAME: see CleanUpAndFailAsync);
    ///   - a company that was given up meanwhile does not become Ready;
    ///   - a database a company points to is never dropped, also when the answer of
    ///     the main database was lost or cannot be had;
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
                        $"A database named {databaseName} already exists on the server. It was not touched. Check that no company uses it, remove or rename it, then retry.", null);

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
                // The answer was lost: the main database may or may not have made the company
                // Ready. The clean-up asks it (sp_Provision_Abandon) and then knows.
                return await CleanUpAndFailAsync(job, databaseName, true, ex, null, completeAnswerLost: true);
            }

            if (!completed)
                return await CleanUpAndFailAsync(job, databaseName, true,
                    new InvalidOperationException("The set-up was given up before it finished."), null);

            _logger.LogInformation("Provisioning of company {CompanyId}: database ready", job.CompanyId);
            return ProvisionOutcome.Ready;
        }

        /// <summary>
        /// Gives the job up, drops the database this attempt created when the main database
        /// allows it, then records the failure. Recording comes last: it releases the job,
        /// and only then can the company be retried.
        ///
        /// The drop goes by NAME, and a name can come to mean a database somebody uses (a
        /// platform administrator attaches the generated name to this or to ANOTHER company
        /// by hand). So this is the ONLY place a database is dropped, and only after
        /// <see cref="IProvisionStore.AbandonAsync"/> answered MayDrop: in one statement the
        /// main database checked that the job is this attempt's, that the company still waits
        /// for its first database and that no company names this database, and marked the
        /// company Failed while the attempt keeps the job - nothing can complete or retry it
        /// during the drop. No answer (it threw, or the company is gone) = no drop.
        /// </summary>
        private async Task<ProvisionOutcome> CleanUpAndFailAsync(
            ProvisionJob job, string databaseName, bool created, Exception ex, string? note,
            bool completeAnswerLost = false)
        {
            var reason = ex is OperationCanceledException
                ? "The set-up was cancelled or timed out."
                : ex.Message;

            _logger.LogError("Provisioning of company {CompanyId} failed ({ErrorType}): {Reason}",
                job.CompanyId, ex.GetType().Name, Scrub(reason, job));

            if (!created)
                return await FailAsync(job, reason, note);

            // stored only if the attempt turns out to own the job (sp_Provision_Fail decides)
            var leftNote = $" The database {databaseName} was left on the server.";

            AbandonResult? answer;
            try
            {
                answer = await _store.AbandonAsync(job, databaseName);
            }
            catch (Exception abandonEx)
            {
                // Nobody knows (after a lost answer the company may even be Ready on it).
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: the main database could not be asked ({ErrorType}). "
                    + "Check whether a company uses it before removing it.",
                    job.CompanyId, databaseName, abandonEx.GetType().Name);
                return await FailAsync(job, reason, leftNote);
            }

            if (answer == null)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: the company no longer exists. "
                    + "Check whether a company uses it before removing it.",
                    job.CompanyId, databaseName);
                return await FailAsync(job, reason, leftNote);
            }

            if (answer.MayDrop)
            {
                try
                {
                    await _server.DropDatabaseAsync(job, databaseName);
                }
                catch (Exception dropEx)
                {
                    _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} of the failed attempt could not be removed ({ErrorType})",
                        job.CompanyId, databaseName, dropEx.GetType().Name);
                    return await FailAsync(job, reason,
                        $" The database {databaseName} could not be removed and was left on the server: remove it before retrying.");
                }

                return await FailAsync(job, reason, null);
            }

            // ---- from here on nothing is dropped ----

            var ready = string.Equals(answer.Status.Trim(), "Ready", StringComparison.OrdinalIgnoreCase);

            if (SameDatabase(answer.DatabaseName, databaseName))
            {
                if (ready && completeAnswerLost)
                {
                    _logger.LogInformation("Provisioning of company {CompanyId}: database ready (the answer was lost, the main database confirmed it)", job.CompanyId);
                    return ProvisionOutcome.Ready;
                }

                // The company is not waiting for a database any more: there is no failure
                // to record, and never an instruction to remove this database.
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: the company uses this database.",
                    job.CompanyId, databaseName);
                return ProvisionOutcome.Failed;
            }

            if (ready)
            {
                // Ready by other means (another database attached by hand): the company did
                // not fail, and this attempt has nothing to record. Its own database stays
                // as an orphan for a person to remove.
                _logger.LogWarning("Provisioning of company {CompanyId}: the company is ready with another database. "
                    + "The database {DatabaseName} this attempt built was left on the server: check that no company uses it before removing it.",
                    job.CompanyId, databaseName);
                return ProvisionOutcome.Skipped;
            }

            if (answer.UsedByAnother)
            {
                _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: another company uses this database.",
                    job.CompanyId, databaseName);
                return await FailAsync(job, reason,
                    $" The database {databaseName} was left on the server: another company uses it.");
            }

            _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} was not removed: no longer this attempt's job. "
                + "Check whether a company uses it before removing it.",
                job.CompanyId, databaseName);
            return await FailAsync(job, reason, leftNote);
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
