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

        public async Task<ProvisionJob?> GetJobAsync(int companyId)
        {
            var dt = await GetDataTableAsync("sp_Provision_GetJob", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var row = dt.Rows[0];
            var encrypted = row["AdminPasswordEnc"]?.ToString() ?? "";

            string password;
            try { password = encrypted.Length == 0 ? "" : _protector.Unprotect(encrypted); }
            catch { password = ""; }   // an unreadable password = no usable server

            return new ProvisionJob
            {
                CompanyId = Convert.ToInt32(row["CompanyId"]),
                TenantScopeId = Convert.ToInt32(row["TenantScopeId"]),
                FirstBranchName = row["FirstBranchName"]?.ToString() ?? "",
                Status = row["ProvisionStatus"]?.ToString() ?? "",
                ServerName = row["ServerName"]?.ToString() ?? "",
                AdminUser = row["AdminUser"]?.ToString() ?? "",
                AdminPassword = password,
                ExtraOptions = row["ExtraOptions"]?.ToString() ?? "",
                LookupSourceDb = row["LookupSourceDb"]?.ToString() ?? ""
            };
        }

        public async Task<bool> CompleteAsync(int companyId, string databaseName)
        {
            var dt = await GetDataTableAsync("sp_Provision_Complete", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@DatabaseName", databaseName)
            });

            return dt != null && dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["Success"]) == 1;
        }

        public async Task FailAsync(int companyId, string error)
        {
            // no result set: the non-query method
            await ExecuteAsync("sp_Provision_Fail", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@Error", error ?? "")
            });
        }

        public async Task<int> FailStuckAsync(int olderThanMinutes)
        {
            var dt = await GetDataTableAsync("sp_Provision_FailStuck", new[]
            {
                SqlParameterHelper.Input("@OlderThanMinutes", olderThanMinutes)
            });

            return dt != null && dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["Failed"]) : 0;
        }
    }
}
