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

        public async Task<TenantUserMap?> SyncProjectUserAsync(int projectId, int locationId, int mainUserId)
        {
            var timer = System.Diagnostics.Stopwatch.StartNew();
            _logger.LogInformation("Single-user sync: loading project {ProjectId} and user {UserId} from MainDB", projectId, mainUserId);
            var ds = await _mainDb.ExecuteDataSetAsync("sp_Project_GetUsersForSync", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId),
                SqlParameterHelper.Input("@UserId", mainUserId)
            });
            _logger.LogInformation("Single-user sync: MainDB lookup completed in {ElapsedMilliseconds} ms", timer.ElapsedMilliseconds);

            if (ds == null || ds.Tables.Count < 2 || ds.Tables[0].Rows.Count == 0)
                throw new InvalidOperationException($"Project {projectId} was not found in MainDB.");

            var project = ds.Tables[0].Rows[0];
            var companyId = Convert.ToInt32(project["CompanyId"]);
            var projectKey = project["ProjectKey"]?.ToString() ?? string.Empty;
            var userRow = ds.Tables[1].Rows.Cast<DataRow>()
                .FirstOrDefault(row => Convert.ToInt32(row["UserId"]) == mainUserId);

            if (userRow == null)
                throw new InvalidOperationException("Your user does not have active access to this project.");

            var user = new[]
            {
                new
                {
                    userId = mainUserId,
                    fullName = userRow["FullName"]?.ToString() ?? string.Empty,
                    email = userRow["Email"] == DBNull.Value ? null : userRow["Email"]?.ToString(),
                    mobileNumber = userRow["MobileNumber"] == DBNull.Value ? null : userRow["MobileNumber"]?.ToString(),
                    role = userRow["RoleInCompany"]?.ToString() ?? string.Empty
                }
            };

            timer.Restart();
            var tenantConnection = await _connectionResolver.GetServiceConnectionAsync(projectKey);
            _logger.LogInformation("Single-user sync: tenant connection resolved in {ElapsedMilliseconds} ms", timer.ElapsedMilliseconds);
            var projectDb = new ExplicitDbHelper(tenantConnection);
            timer.Restart();
            _logger.LogInformation("Single-user sync: executing tenant sync procedure for project {ProjectId}", projectId);
            var result = await projectDb.ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", projectId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(user)),
                SqlParameterHelper.Input("@SyncSingleUser", true)
            });
            _logger.LogInformation("Single-user sync: tenant procedure completed in {ElapsedMilliseconds} ms", timer.ElapsedMilliseconds);

            return result?.ToList<TenantUserMap>().FirstOrDefault();
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
