using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using System.Data;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public class PlatformService : BaseRepository, IPlatformService
    {
        private const string NotAllowed = "You are not allowed to manage this";

        private readonly IConnectionResolver _connectionResolver;
        private readonly ITenantSecretProtector _protector;
        private readonly ITenantUserSyncService _userSync;
        private readonly ILogger<PlatformService> _logger;

        // Control-plane: companies / projects / connections / menus live in MainDB.
        public PlatformService(
            MainDbHelper db,
            IConnectionResolver connectionResolver,
            ITenantSecretProtector protector,
            ITenantUserSyncService userSync,
            ILogger<PlatformService> logger) : base(db)
        {
            _connectionResolver = connectionResolver;
            _protector = protector;
            _userSync = userSync;
            _logger = logger;
        }

        // ============================================
        // COMPANIES
        // ============================================

        public async Task<ApiResponse<List<PlatformCompanyDto>>> GetCompanies(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin && !actor.IsCompanyAdmin)
                return ApiResponse<List<PlatformCompanyDto>>.Fail(NotAllowed);

            // a company admin sees the own company only
            var list = await GetListAsync<PlatformCompanyDto>("sp_Platform_GetCompanies", new[]
            {
                SqlParameterHelper.Input("@CompanyId", actor.IsPlatformAdmin ? 0 : actor.CompanyId)
            });

            return ApiResponse<List<PlatformCompanyDto>>.Ok(list);
        }

        public async Task<ApiResponse<int>> SaveCompany(PlatformCompanyDto dto, PlatformActor actor)
        {
            // creating a company is a platform decision; its own admin may edit it
            var allowed = dto.CompanyId == 0 ? actor.IsPlatformAdmin : actor.CanManageCompany(dto.CompanyId);
            if (!allowed)
                return ApiResponse<int>.Fail(NotAllowed);

            var dt = await GetDataTableAsync("sp_Platform_SaveCompany", new[]
            {
                SqlParameterHelper.Input("@CompanyId", dto.CompanyId),
                SqlParameterHelper.Input("@CompanyName", dto.CompanyName ?? ""),
                SqlParameterHelper.Input("@CompanyCode", dto.CompanyCode ?? ""),
                SqlParameterHelper.Input("@Address", Nullable(dto.Address)),
                SqlParameterHelper.Input("@City", Nullable(dto.City)),
                SqlParameterHelper.Input("@PhoneNumber", Nullable(dto.PhoneNumber)),
                // only the platform can switch a company off
                SqlParameterHelper.Input("@IsActive", actor.IsPlatformAdmin ? dto.IsActive : true),
                SqlParameterHelper.Input("@SavedBy", actor.UserId)
            });

            var result = ToResult(dt, "CompanyId");

            // activating or deactivating a company changes whether its key may route
            if (result.Success)
                await EvictCompanyKey(result.Data > 0 ? result.Data : dto.CompanyId);

            return result;
        }

        // ============================================
        // PROJECTS + THEIR DATABASE
        // ============================================

        public async Task<ApiResponse<List<PlatformProjectDto>>> GetProjects(int companyId, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
            {
                if (!actor.IsCompanyAdmin)
                    return ApiResponse<List<PlatformProjectDto>>.Fail(NotAllowed);
                companyId = actor.CompanyId;
            }

            var list = await GetListAsync<PlatformProjectDto>("sp_Platform_GetProjects", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            // where a company's data is stored is platform information
            if (!actor.IsPlatformAdmin)
                foreach (var p in list)
                    p.ServerName = p.DatabaseName = p.DbUser = p.ExtraOptions = "";

            return ApiResponse<List<PlatformProjectDto>>.Ok(list);
        }

        public async Task<ApiResponse<int>> SaveProject(SaveProjectRequest req, PlatformActor actor)
        {
            // a project decides WHICH DATABASE a company's data goes to: platform only
            if (!actor.IsPlatformAdmin)
                return ApiResponse<int>.Fail("Only a platform administrator can create or change projects");

            // listed = the company already has a database (a migrated company may have a key without one)
            var listed = await GetDataTableAsync("sp_Platform_GetProjects", new[]
            {
                SqlParameterHelper.Input("@CompanyId", req.CompanyId)
            });
            var hasDatabase = req.CompanyId > 0 && listed != null && listed.Rows.Count > 0;

            var refusal = ProjectRefusal(req.ProjectId, req.CompanyId, hasDatabase, await GetCompanyKey(req.CompanyId), req.ProjectKey);
            if (refusal != null)
                return ApiResponse<int>.Fail(refusal);

            var passwordEnc = string.IsNullOrEmpty(req.DbPassword)
                ? (object)DBNull.Value
                : _protector.Protect(req.DbPassword);

            var dt = await GetDataTableAsync("sp_Platform_SaveProject", new[]
            {
                SqlParameterHelper.Input("@ProjectId", req.ProjectId),
                SqlParameterHelper.Input("@CompanyId", req.CompanyId),
                SqlParameterHelper.Input("@ProjectName", req.ProjectName ?? ""),
                SqlParameterHelper.Input("@ProjectKey", req.ProjectKey ?? ""),
                SqlParameterHelper.Input("@IsActive", req.IsActive),
                SqlParameterHelper.Input("@ServerName", req.ServerName ?? ""),
                SqlParameterHelper.Input("@DatabaseName", req.DatabaseName ?? ""),
                SqlParameterHelper.Input("@DbUser", req.DbUser ?? ""),
                SqlParameterHelper.Input("@DbPasswordEnc", passwordEnc),
                SqlParameterHelper.Input("@ExtraOptions", Nullable(req.ExtraOptions)),
                SqlParameterHelper.Input("@SavedBy", actor.UserId)
            });

            var result = ToResult(dt, "ProjectId");

            if (result.Success)
            {
                // routing is cached per key: forget the old target
                await EvictCompanyKey(req.CompanyId);

                if (req.IsActive)
                    await _userSync.TrySyncCompanyUsersAsync(req.CompanyId);
            }

            return result;
        }

        public async Task<ApiResponse<ConnectionTestResult>> TestConnection(SaveProjectRequest req, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<ConnectionTestResult>.Fail(NotAllowed);

            if (string.IsNullOrWhiteSpace(req.ServerName) || string.IsNullOrWhiteSpace(req.DatabaseName)
                || string.IsNullOrWhiteSpace(req.DbUser))
                return ApiResponse<ConnectionTestResult>.Fail("Server, database and database user are required");

            var password = req.DbPassword;

            // editing without retyping the password: test with the stored one
            if (string.IsNullOrEmpty(password) && req.CompanyId > 0)
            {
                var stored = await GetDataTableByQueryAsync(
                    "SELECT DbPasswordEnc FROM dbo.Companies WHERE CompanyId = @CompanyId",
                    new[] { SqlParameterHelper.Input("@CompanyId", req.CompanyId) });

                if (stored.Rows.Count > 0)
                {
                    try { password = _protector.Unprotect(stored.Rows[0]["DbPasswordEnc"]?.ToString() ?? ""); }
                    catch { password = null; }
                }
            }

            if (string.IsNullOrEmpty(password))
                return ApiResponse<ConnectionTestResult>.Fail("Enter the database password to test the connection");

            var builder = new SqlConnectionStringBuilder
            {
                DataSource = req.ServerName.Trim(),
                InitialCatalog = req.DatabaseName.Trim(),
                UserID = req.DbUser.Trim(),
                Password = password,
                TrustServerCertificate = true,
                ConnectTimeout = 10
            };

            var result = new ConnectionTestResult();

            try
            {
                var projectDb = new ExplicitDbHelper(builder.ConnectionString);

                var dt = await projectDb.ExecuteQueryDataTableAsync(
                    @"SELECT
                        CASE WHEN OBJECT_ID('dbo.Locations') IS NOT NULL
                              AND OBJECT_ID('dbo.sp_Project_GetLocations') IS NOT NULL
                              AND OBJECT_ID('dbo.sp_Location_Validate') IS NOT NULL
                              AND OBJECT_ID('dbo.sp_Tenant_SyncUsers') IS NOT NULL
                              AND COL_LENGTH('dbo.Users', 'MainUserId') IS NOT NULL
                             THEN 1 ELSE 0 END AS SchemaReady");

                result.Connected = true;
                result.SchemaReady = dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["SchemaReady"]) == 1;

                if (result.SchemaReady)
                {
                    var loc = await projectDb.ExecuteQueryDataTableAsync(
                        "SELECT COUNT(*) AS N FROM dbo.Locations WHERE IsActive = 1");
                    result.LocationCount = Convert.ToInt32(loc.Rows[0]["N"]);
                }

                result.Message = !result.SchemaReady
                    ? "Connected, but the tenant database scripts (Database/ProjectDB) have not been run on this database"
                    : result.LocationCount == 0
                        ? "Connected. Add at least one branch so users can enter the company"
                        : "Connected";
            }
            catch (SqlException ex)
            {
                _logger.LogWarning(ex, "Connection test failed for company {CompanyId}", req.CompanyId);
                result.Message = "Could not connect. Check the server, database, user and password";
            }

            return ApiResponse<ConnectionTestResult>.Ok(result, result.Message);
        }

        // ============================================
        // LOCATIONS (in the project's own DB)
        // ============================================

        public async Task<ApiResponse<List<PlatformLocationDto>>> GetLocations(int projectId, PlatformActor actor)
        {
            var project = await GetManagedProject(projectId, actor);
            if (project == null)
                return ApiResponse<List<PlatformLocationDto>>.Fail(NotAllowed);

            try
            {
                var projectDb = await OpenProjectDb(project.Value.ProjectKey);
                var dt = await projectDb.ExecuteDataTableAsync("sp_Location_GetAll", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
                });

                return ApiResponse<List<PlatformLocationDto>>.Ok(dt.ToList<PlatformLocationDto>());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", project.Value.CompanyId);
                return ApiResponse<List<PlatformLocationDto>>.Fail("Could not read the company database");
            }
        }

        public async Task<ApiResponse<int>> SaveLocation(int projectId, PlatformLocationDto dto, PlatformActor actor)
        {
            var project = await GetManagedProject(projectId, actor);
            if (project == null)
                return ApiResponse<int>.Fail(NotAllowed);

            try
            {
                var projectDb = await OpenProjectDb(project.Value.ProjectKey);
                var dt = await projectDb.ExecuteDataTableAsync("sp_Location_Save", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
                    SqlParameterHelper.Input("@LocationId", dto.LocationId),
                    SqlParameterHelper.Input("@LocationName", dto.LocationName ?? ""),
                    SqlParameterHelper.Input("@LocationCode", Nullable(dto.LocationCode)),
                    SqlParameterHelper.Input("@Address", Nullable(dto.Address)),
                    SqlParameterHelper.Input("@City", Nullable(dto.City)),
                    SqlParameterHelper.Input("@IsActive", dto.IsActive)
                });

                var result = ToResult(dt, "LocationId");

                // the default location of a project key is cached
                if (result.Success)
                    _connectionResolver.Evict(project.Value.ProjectKey);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", project.Value.CompanyId);
                return ApiResponse<int>.Fail("Could not save to the company database");
            }
        }

        // ============================================
        // PROJECT ACCESS
        // ============================================

        public async Task<ApiResponse<List<ProjectAccessDto>>> GetProjectAccess(int projectId, PlatformActor actor)
        {
            if (await GetManagedProject(projectId, actor) == null)
                return ApiResponse<List<ProjectAccessDto>>.Fail(NotAllowed);

            var list = await GetListAsync<ProjectAccessDto>("sp_Platform_GetProjectAccess", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId)
            });

            return ApiResponse<List<ProjectAccessDto>>.Ok(list);
        }

        public async Task<ApiResponse<bool>> SetProjectAccess(int projectId, SetProjectAccessRequest req, PlatformActor actor)
        {
            if (await GetManagedProject(projectId, actor) == null)
                return ApiResponse<bool>.Fail(NotAllowed);

            var dt = await GetDataTableAsync("sp_Platform_SetProjectAccess", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId),
                SqlParameterHelper.Input("@UserId", req.UserId),
                SqlParameterHelper.Input("@HasAccess", req.HasAccess),
                SqlParameterHelper.Input("@GrantedBy", actor.UserId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Save failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";
            if (Convert.ToInt32(dt.Rows[0]["Success"]) != 1)
                return ApiResponse<bool>.Fail(message);

            // the company DB mirrors who may work in it (users, technicians)
            await _userSync.TrySyncCompanyUsersAsync(projectId);

            return ApiResponse<bool>.Ok(true, message);
        }

        // ============================================
        // MODULES OF A COMPANY + WHO MAY OPEN THEM
        // ============================================

        public async Task<ApiResponse<List<CompanyModuleDto>>> GetCompanyModules(int companyId, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanViewModules(actor, companyId))
                return ApiResponse<List<CompanyModuleDto>>.Fail(NotAllowed);

            var list = await GetListAsync<CompanyModuleDto>("sp_Platform_GetCompanyModules", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            return ApiResponse<List<CompanyModuleDto>>.Ok(list);
        }

        public async Task<ApiResponse<bool>> SetCompanyModule(int companyId, SetCompanyModuleRequest req, PlatformActor actor)
        {
            // which modules a company has is its subscription: platform only
            if (companyId <= 0 || !ModuleAdminRules.CanSwitchModules(actor))
                return ApiResponse<bool>.Fail("Only a platform administrator can switch modules");

            var moduleKey = ModuleAdminRules.NormalizeKey(req?.ModuleKey);
            if (moduleKey == null)
                return ApiResponse<bool>.Fail("Module not found");

            var dt = await GetDataTableAsync("sp_Platform_SetCompanyModule", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", moduleKey),
                SqlParameterHelper.Input("@IsEnabled", req!.IsEnabled),
                SqlParameterHelper.Input("@SavedBy", actor.UserId)
            });

            var result = ToFlag(dt);

            // Switched ON: the company's users must be in its database again.
            // Switched OFF: nothing is synchronised (the procedure behind the sync
            // returns no company), so nobody in the tenant database changes.
            if (result.Success && req.IsEnabled)
                await _userSync.TrySyncCompanyUsersAsync(companyId);

            return result;
        }

        public async Task<ApiResponse<List<ProjectAccessDto>>> GetModuleAccess(int companyId, string moduleKey, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<List<ProjectAccessDto>>.Fail(NotAllowed);

            var key = ModuleAdminRules.NormalizeKey(moduleKey);
            if (key == null)
                return ApiResponse<List<ProjectAccessDto>>.Fail("Module not found");

            var list = await GetListAsync<ProjectAccessDto>("sp_Platform_GetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", key)
            });

            return ApiResponse<List<ProjectAccessDto>>.Ok(list);
        }

        public async Task<ApiResponse<bool>> SetModuleAccess(int companyId, string moduleKey, SetProjectAccessRequest req, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<bool>.Fail(NotAllowed);

            var key = ModuleAdminRules.NormalizeKey(moduleKey);
            if (key == null || req == null || req.UserId <= 0)
                return ApiResponse<bool>.Fail("Module or user not found");

            var dt = await GetDataTableAsync("sp_Platform_SetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", key),
                SqlParameterHelper.Input("@UserId", req.UserId),
                SqlParameterHelper.Input("@HasAccess", req.HasAccess),
                SqlParameterHelper.Input("@GrantedBy", actor.UserId)
            });

            var result = ToFlag(dt);

            // the company DB mirrors who may work in the Service module (users, technicians)
            if (result.Success && key == ModuleAccess.ServiceModuleKey)
                await _userSync.TrySyncCompanyUsersAsync(companyId);

            return result;
        }

        /// <summary>Procs answer with Success and Message.</summary>
        private static ApiResponse<bool> ToFlag(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Save failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";

            return Convert.ToInt32(dt.Rows[0]["Success"]) == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }

        // ============================================
        // MENU TREE
        // ============================================

        public async Task<ApiResponse<List<PlatformMenuDto>>> GetMenus(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<List<PlatformMenuDto>>.Fail(NotAllowed);

            var list = await GetListAsync<PlatformMenuDto>("sp_Platform_GetMenus");
            return ApiResponse<List<PlatformMenuDto>>.Ok(list);
        }

        public async Task<ApiResponse<int>> SaveMenu(PlatformMenuDto dto, PlatformActor actor)
        {
            // the menu tree is shared by every company
            if (!actor.IsPlatformAdmin)
                return ApiResponse<int>.Fail(NotAllowed);

            var dt = await GetDataTableAsync("sp_Platform_SaveMenu", new[]
            {
                SqlParameterHelper.Input("@MenuId", dto.MenuId),
                SqlParameterHelper.Input("@MenuName", dto.MenuName ?? ""),
                SqlParameterHelper.Input("@MenuPath", Nullable(dto.MenuPath)),
                SqlParameterHelper.Input("@Icon", Nullable(dto.Icon)),
                SqlParameterHelper.Input("@ParentMenuId", dto.ParentMenuId ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@SortOrder", dto.SortOrder),
                SqlParameterHelper.Input("@IsActive", dto.IsActive),
                SqlParameterHelper.Input("@Module", Nullable(dto.Module))
            });

            return ToResult(dt, "MenuId");
        }

        // ============================================
        // HELPERS
        // ============================================

        /// <summary>
        /// The company's routing key and tenant scope id, or null when the caller may not
        /// manage it. "projectId" is the CompanyId: a project is the company's Service database.
        /// </summary>
        private async Task<(string ProjectKey, int CompanyId, int ScopeId)?> GetManagedProject(int projectId, PlatformActor actor)
        {
            var dt = await GetDataTableAsync("sp_Platform_GetProject", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var companyId = Convert.ToInt32(dt.Rows[0]["CompanyId"]);
            if (!actor.CanManageCompany(companyId))
                return null;

            return (dt.Rows[0]["ProjectKey"]?.ToString() ?? "", companyId, Convert.ToInt32(dt.Rows[0]["TenantScopeId"]));
        }

        /// <summary>Drops the cached routing entry of the company's tenant key.</summary>
        private async Task EvictCompanyKey(int companyId)
        {
            // the save is already committed: a failed re-read must not turn it into an error
            try
            {
                var key = await GetCompanyKey(companyId);
                if (!string.IsNullOrEmpty(key))
                    _connectionResolver.Evict(key);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not evict the routing cache for company {CompanyId}; restart the API if its connection was changed", companyId);
            }
        }

        /// <summary>The tenant key of the company's database, or null when it has none.</summary>
        private async Task<string?> GetCompanyKey(int companyId)
        {
            var saved = await GetDataTableAsync("sp_Platform_GetProject", new[]
            {
                SqlParameterHelper.Input("@ProjectId", companyId)
            });
            var key = saved != null && saved.Rows.Count > 0 ? saved.Rows[0]["ProjectKey"]?.ToString() : null;
            return string.IsNullOrWhiteSpace(key) ? null : key;
        }

        /// <summary>
        /// Why a "save project" request must be refused, or null when it may proceed.
        /// A "project" is the company's database and its id is the company id.
        /// hasDatabase = the company is listed as having a database (sp_Platform_GetProjects);
        /// a migrated company can have a key without one.
        /// The key of a company that has a database cannot be changed. For a company without a listed
        /// database the key is not compared: the administrator cannot see the real key and the stored
        /// procedure keeps the existing one.
        /// </summary>
        public static string? ProjectRefusal(int requestedProjectId, int companyId, bool hasDatabase, string? existingKey, string? requestedKey)
        {
            if (requestedProjectId != 0 && requestedProjectId != companyId)
                return "Database not found for this company";

            if (requestedProjectId == 0 && hasDatabase)
                return "This company already has a database. Edit it instead";

            if (hasDatabase && !string.IsNullOrWhiteSpace(existingKey) && !string.IsNullOrWhiteSpace(requestedKey)
                && !string.Equals(requestedKey.Trim(), existingKey.Trim(), StringComparison.OrdinalIgnoreCase))
                return "The key of a company cannot be changed";

            return null;
        }

        private async Task<ExplicitDbHelper> OpenProjectDb(string projectKey)
            => new ExplicitDbHelper(await _connectionResolver.GetServiceConnectionAsync(projectKey));

        private static object Nullable(string? value)
            => string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();

        /// <summary>Procs answer with Success, Message and the saved id.</summary>
        private static ApiResponse<int> ToResult(DataTable? dt, string idColumn)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Save failed");

            var row = dt.Rows[0];
            var message = row["Message"]?.ToString() ?? "";

            return Convert.ToInt32(row["Success"]) == 1
                ? ApiResponse<int>.Ok(Convert.ToInt32(row[idColumn]), message)
                : ApiResponse<int>.Fail(message);
        }
    }
}
