using System.Data;
using EncryptzBL.Common.Tenant;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>The main-database side of a provisioning job (script 20).</summary>
    public sealed class ProvisionStore : BaseRepository, IProvisionStore
    {
        private readonly ITenantSecretProtector _protector;

        public ProvisionStore(MainDbHelper db, ITenantSecretProtector protector) : base(db)
        {
            _protector = protector;
        }

        public async Task<ProvisionJob?> BeginAsync(int companyId)
        {
            // sp_Provision_Begin claims the job in one UPDATE: no row = nothing to do
            var dt = await GetDataTableAsync("sp_Provision_Begin", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var row = dt.Rows[0];
            if (row["ProvisionAttempt"] is not Guid attempt || attempt == Guid.Empty)
                return null;

            var encrypted = row["AdminPasswordEnc"]?.ToString() ?? "";

            string password;
            try { password = encrypted.Length == 0 ? "" : _protector.Unprotect(encrypted); }
            catch { password = ""; }   // an unreadable password = no usable server

            var claimedId = Convert.ToInt32(row["CompanyId"]);

            return new ProvisionJob
            {
                CompanyId = claimedId,
                CompanyCode = await CompanyCodeAsync(row, claimedId),
                Attempt = attempt,
                TenantScopeId = Convert.ToInt32(row["TenantScopeId"]),
                FirstBranchName = row["FirstBranchName"]?.ToString() ?? "",
                ServerName = row["ServerName"]?.ToString() ?? "",
                AdminUser = row["AdminUser"]?.ToString() ?? "",
                AdminPassword = password ?? "",
                ExtraOptions = row["ExtraOptions"]?.ToString() ?? "",
                LookupSourceDb = row["LookupSourceDb"]?.ToString() ?? ""
            };
        }

        /// <summary>
        /// The code of the claimed company. sp_Provision_Begin (script 20) does not return it,
        /// so it is read with sp_Platform_GetCompanies. Never throws: the job is already
        /// claimed, and a job without a code is failed and released at once by the
        /// provisioner, where an error here would leave it claimed until the sweeper.
        /// </summary>
        private async Task<string> CompanyCodeAsync(DataRow claimed, int companyId)
        {
            if (claimed.Table.Columns.Contains("CompanyCode"))
                return claimed["CompanyCode"]?.ToString() ?? "";

            try
            {
                var dt = await GetDataTableAsync("sp_Platform_GetCompanies", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", companyId)
                });

                var row = dt?.Rows.Cast<DataRow>().FirstOrDefault(r => Convert.ToInt32(r["CompanyId"]) == companyId);
                return row?["CompanyCode"]?.ToString() ?? "";
            }
            catch
            {
                return "";
            }
        }

        public async Task<bool> CompleteAsync(ProvisionJob job, string databaseName)
        {
            // the server name and login this run used: the procedure refuses when the
            // server row was edited meanwhile
            var dt = await GetDataTableAsync("sp_Provision_Complete", new[]
            {
                SqlParameterHelper.Input("@CompanyId", job.CompanyId),
                SqlParameterHelper.Input("@Attempt", job.Attempt),
                SqlParameterHelper.Input("@DatabaseName", databaseName),
                SqlParameterHelper.Input("@ServerName", job.ServerName),
                SqlParameterHelper.Input("@AdminUser", job.AdminUser)
            });

            return dt != null && dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["Success"]) == 1;
        }

        public async Task FailAsync(ProvisionJob job, string error)
        {
            // no result set: the non-query method
            await ExecuteAsync("sp_Provision_Fail", new[]
            {
                SqlParameterHelper.Input("@CompanyId", job.CompanyId),
                SqlParameterHelper.Input("@Attempt", job.Attempt),
                SqlParameterHelper.Input("@Error", error ?? "")
            });
        }

        public async Task<AbandonResult?> AbandonAsync(ProvisionJob job, string databaseName)
        {
            // one statement decides and marks: see sp_Provision_Abandon
            var dt = await GetDataTableAsync("sp_Provision_Abandon", new[]
            {
                SqlParameterHelper.Input("@CompanyId", job.CompanyId),
                SqlParameterHelper.Input("@Attempt", job.Attempt),
                SqlParameterHelper.Input("@DatabaseName", databaseName)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var row = dt.Rows[0];

            // NULL while the job is queued or was released
            Guid? attempt = row["ProvisionAttempt"] is Guid value ? value : null;

            return new AbandonResult(
                row["MayDrop"] != DBNull.Value && Convert.ToBoolean(row["MayDrop"]),
                (row["ProvisionStatus"]?.ToString() ?? "").Trim(),
                attempt,
                (row["DatabaseName"]?.ToString() ?? "").Trim(),
                row["UsedByAnother"] != DBNull.Value && Convert.ToBoolean(row["UsedByAnother"]));
        }

        public async Task<int> FailStuckAsync(int olderThanMinutes)
        {
            var dt = await GetDataTableAsync("sp_Provision_FailStuck", new[]
            {
                SqlParameterHelper.Input("@OlderThanMinutes", olderThanMinutes)
            });

            return dt != null && dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["Failed"]) : 0;
        }

        public async Task<IReadOnlyList<int>> GetQueuedAsync()
        {
            var dt = await GetDataTableAsync("sp_Provision_GetQueued");

            var ids = new List<int>();
            if (dt != null)
                foreach (DataRow row in dt.Rows)
                    ids.Add(Convert.ToInt32(row["CompanyId"]));

            return ids;
        }
    }
}
