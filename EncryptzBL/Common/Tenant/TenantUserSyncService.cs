using System.Data;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>The company has no ready database to sync to (a normal state until one is attached).</summary>
    public class CompanyDatabaseNotReadyException : InvalidOperationException
    {
        public CompanyDatabaseNotReadyException(int companyId)
            : base($"Company {companyId} has no ready database in MainDB.") { }
    }

    public class TenantUserSyncService : ITenantUserSyncService
    {
        private readonly MainDbHelper _mainDb;
        private readonly IConnectionResolver _connectionResolver;
        private readonly ILogger<TenantUserSyncService> _logger;

        public TenantUserSyncService(
            MainDbHelper mainDb,
            IConnectionResolver connectionResolver,
            ILogger<TenantUserSyncService> logger)
        {
            _mainDb = mainDb;
            _connectionResolver = connectionResolver;
            _logger = logger;
        }

        public async Task<List<TenantUserMap>> SyncCompanyUsersAsync(int companyId, int locationId = 0)
        {
            var (tenantKey, scopeId, users) = await LoadAsync(companyId, null);

            var dt = await (await OpenAsync(tenantKey)).ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scopeId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(users))
            });

            return dt?.ToList<TenantUserMap>() ?? new List<TenantUserMap>();
        }

        public async Task<TenantUserMap?> SyncCompanyUserAsync(int companyId, int locationId, int mainUserId)
        {
            var (tenantKey, scopeId, users) = await LoadAsync(companyId, mainUserId);

            if (users.Count == 0)
                throw new InvalidOperationException("Your user does not have active access to this company.");

            var result = await (await OpenAsync(tenantKey)).ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scopeId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(users)),
                SqlParameterHelper.Input("@SyncSingleUser", true)
            });

            return result?.ToList<TenantUserMap>().FirstOrDefault();
        }

        public async Task TrySyncCompanyUsersAsync(int companyId)
        {
            try
            {
                await SyncCompanyUsersAsync(companyId);
            }
            catch (CompanyDatabaseNotReadyException)
            {
                _logger.LogInformation("No ready database to sync users to for company {CompanyId}", companyId);
            }
            catch (Exception ex)
            {
                // The MainDB change is already committed; the mirror catches up on the next set-scope.
                _logger.LogError(ex, "User sync to the company database failed for company {CompanyId}", companyId);
            }
        }

        /// <summary>The company's routing info and the users to mirror (all, or one).</summary>
        private async Task<(string TenantKey, int ScopeId, List<object> Users)> LoadAsync(int companyId, int? mainUserId)
        {
            var ds = await _mainDb.ExecuteDataSetAsync("sp_Company_GetUsersForSync", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@UserId", mainUserId ?? (object)DBNull.Value)
            });

            if (ds == null || ds.Tables.Count < 2 || ds.Tables[0].Rows.Count == 0)
                throw new CompanyDatabaseNotReadyException(companyId);

            var company = ds.Tables[0].Rows[0];

            var users = ds.Tables[1].Rows.Cast<DataRow>().Select(r => (object)new
            {
                userId = Convert.ToInt32(r["UserId"]),
                fullName = r["FullName"]?.ToString() ?? "",
                email = r["Email"] == DBNull.Value ? null : r["Email"]?.ToString(),
                mobileNumber = r["MobileNumber"] == DBNull.Value ? null : r["MobileNumber"]?.ToString(),
                role = r["RoleInCompany"]?.ToString() ?? ""
            }).ToList();

            return (company["TenantKey"]?.ToString() ?? "", Convert.ToInt32(company["TenantScopeId"]), users);
        }

        private async Task<ExplicitDbHelper> OpenAsync(string tenantKey)
            => new ExplicitDbHelper(await _connectionResolver.GetServiceConnectionAsync(tenantKey));
    }
}
