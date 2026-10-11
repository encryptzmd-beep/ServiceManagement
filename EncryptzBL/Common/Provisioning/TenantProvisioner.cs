using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Builds the database of one company and makes the company Ready, or cleans up
    /// and marks it Failed. Rules it guards:
    ///   - the database name comes from the company id only;
    ///   - a database that already exists is never dropped and never reused;
    ///   - only a database THIS attempt created is dropped when the attempt fails;
    ///   - a company that was given up meanwhile does not become Ready.
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
            ProvisionJob? job;
            try
            {
                job = await _store.GetJobAsync(companyId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Provisioning of company {CompanyId}: the job could not be read", companyId);
                return ProvisionOutcome.Failed;
            }

            if (job == null || !string.Equals(job.Status, "Provisioning", StringComparison.Ordinal))
                return ProvisionOutcome.Skipped;

            if (string.IsNullOrWhiteSpace(job.ServerName) || string.IsNullOrWhiteSpace(job.AdminUser)
                || string.IsNullOrEmpty(job.AdminPassword))
                return await FailAsync(job, "No usable database server is set for this company.", null);

            var databaseName = TenantDatabaseName.For(job.CompanyId);
            var created = false;

            try
            {
                if (await _server.DatabaseExistsAsync(job, databaseName, ct))
                    return await FailAsync(job,
                        $"A database named {databaseName} already exists on the server. It was not touched. Remove or rename it, then retry.", null);

                await _server.CreateDatabaseAsync(job, databaseName, ct);
                created = true;

                await _server.BuildTenantAsync(job, databaseName, ct);

                if (!await _store.CompleteAsync(job.CompanyId, databaseName))
                    throw new InvalidOperationException("The set-up was given up before it finished.");

                _logger.LogInformation("Provisioning of company {CompanyId}: database ready", job.CompanyId);
                return ProvisionOutcome.Ready;
            }
            catch (Exception ex)
            {
                var reason = ex is OperationCanceledException
                    ? "The set-up timed out."
                    : ex.Message;

                string? leftBehind = null;
                if (created)
                {
                    try
                    {
                        await _server.DropDatabaseAsync(job, databaseName);
                    }
                    catch (Exception dropEx)
                    {
                        _logger.LogError(dropEx, "Provisioning of company {CompanyId}: the database of the failed attempt could not be removed", job.CompanyId);
                        leftBehind = $" The database {databaseName} could not be removed and was left on the server: remove it before retrying.";
                    }
                }

                _logger.LogError(ex, "Provisioning of company {CompanyId} failed", job.CompanyId);
                return await FailAsync(job, reason, leftBehind);
            }
        }

        private async Task<ProvisionOutcome> FailAsync(ProvisionJob job, string reason, string? leftBehind)
        {
            // the note about a database left behind must survive the truncation
            var note = leftBehind ?? "";
            var text = Scrub(reason, job);
            var room = Math.Max(0, MaxErrorLength - note.Length);
            if (text.Length > room)
                text = text.Substring(0, room);

            try
            {
                await _store.FailAsync(job.CompanyId, text + note);
            }
            catch (Exception ex)
            {
                // the stuck-job sweeper will mark it Failed later
                _logger.LogError(ex, "Provisioning of company {CompanyId}: the failure could not be recorded", job.CompanyId);
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
