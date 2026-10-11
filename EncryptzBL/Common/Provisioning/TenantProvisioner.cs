using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Builds the database of one company and makes the company Ready, or cleans up
    /// and marks it Failed. Rules it guards:
    ///   - it works only on a job it claimed: two runs never build for one company;
    ///   - the database name comes from the company id only;
    ///   - a database that already exists is never dropped and never reused;
    ///   - only a database THIS attempt created is dropped when the attempt fails;
    ///   - a company that was given up meanwhile does not become Ready;
    ///   - a database a Ready company points to is never dropped, also when the
    ///     answer of the main database was lost.
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
                string status;
                try
                {
                    status = await _store.GetStatusAsync(companyId) ?? "";
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

                if (string.Equals(status.Trim(), "Ready", StringComparison.Ordinal))
                {
                    _logger.LogInformation("Provisioning of company {CompanyId}: database ready (the answer was lost, the status confirmed it)", companyId);
                    return ProvisionOutcome.Ready;
                }

                return await CleanUpAndFailAsync(job, databaseName, true, ex, null);
            }

            if (!completed)
                return await CleanUpAndFailAsync(job, databaseName, true,
                    new InvalidOperationException("The set-up was given up before it finished."), null);

            _logger.LogInformation("Provisioning of company {CompanyId}: database ready", job.CompanyId);
            return ProvisionOutcome.Ready;
        }

        /// <summary>Drops the database when this attempt created it, then records the failure.</summary>
        private async Task<ProvisionOutcome> CleanUpAndFailAsync(
            ProvisionJob job, string databaseName, bool created, Exception ex, string? note)
        {
            var reason = ex is OperationCanceledException
                ? "The set-up was cancelled or timed out."
                : ex.Message;

            if (created)
            {
                try
                {
                    await _server.DropDatabaseAsync(job, databaseName);
                }
                catch (Exception dropEx)
                {
                    _logger.LogError("Provisioning of company {CompanyId}: the database {DatabaseName} of the failed attempt could not be removed ({ErrorType})",
                        job.CompanyId, databaseName, dropEx.GetType().Name);
                    note = $" The database {databaseName} could not be removed and was left on the server: remove it before retrying.";
                }
            }

            _logger.LogError("Provisioning of company {CompanyId} failed ({ErrorType}): {Reason}",
                job.CompanyId, ex.GetType().Name, Scrub(reason, job));

            return await FailAsync(job, reason, note);
        }

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
