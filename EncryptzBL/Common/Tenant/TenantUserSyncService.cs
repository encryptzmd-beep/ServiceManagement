using System.Data;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Tenant
{
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

        public async Task<List<TenantUserMap>> SyncProjectUsersAsync(int projectId, int locationId = 0)
        {
            // 1) Who may enter the project, and with which company role (MainDB)
            var ds = await _mainDb.ExecuteDataSetAsync("sp_Project_GetUsersForSync", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId)
            });

            if (ds == null || ds.Tables.Count < 2 || ds.Tables[0].Rows.Count == 0)
                throw new InvalidOperationException($"Project {projectId} was not found in MainDB.");

            var project = ds.Tables[0].Rows[0];
            var projectKey = project["ProjectKey"]?.ToString() ?? "";
            var companyId = Convert.ToInt32(project["CompanyId"]);

            var users = ds.Tables[1].Rows.Cast<DataRow>().Select(r => new
            {
                userId = Convert.ToInt32(r["UserId"]),
                fullName = r["FullName"]?.ToString() ?? "",
                email = r["Email"] == DBNull.Value ? null : r["Email"]?.ToString(),
                mobileNumber = r["MobileNumber"] == DBNull.Value ? null : r["MobileNumber"]?.ToString(),
                role = r["RoleInCompany"]?.ToString() ?? ""
            }).ToList();

            // 2) Mirror them into the project's own DB
            var connStr = await _connectionResolver.GetServiceConnectionAsync(projectKey);
            var projectDb = new ExplicitDbHelper(connStr);

            var dt = await projectDb.ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", projectId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(users))
            });

            return dt?.ToList<TenantUserMap>() ?? new List<TenantUserMap>();
        }

        public async Task TrySyncProjectUsersAsync(int projectId)
        {
            try
            {
                await SyncProjectUsersAsync(projectId);
            }
            catch (Exception ex)
            {
                // The MainDB change is already committed; the mirror catches up on the next set-scope.
                _logger.LogError(ex, "User sync to the project DB failed for project {ProjectId}", projectId);
            }
        }

        public async Task TrySyncCompanyProjectsAsync(int companyId)
        {
            List<int> projectIds;
            try
            {
                var dt = await _mainDb.ExecuteQueryDataTableAsync(
                    "SELECT ProjectId FROM dbo.Projects WHERE CompanyId = @CompanyId AND IsActive = 1",
                    new[] { SqlParameterHelper.Input("@CompanyId", companyId) });

                projectIds = dt.Rows.Cast<DataRow>().Select(r => Convert.ToInt32(r["ProjectId"])).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not list projects of company {CompanyId} for user sync", companyId);
                return;
            }

            foreach (var projectId in projectIds)
                await TrySyncProjectUsersAsync(projectId);
        }
    }
}
