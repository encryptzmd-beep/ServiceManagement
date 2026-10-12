using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
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

            // why a set-up failed and where the database is: platform administrators only
            PlatformCompanyDto.HideDatabaseDetail(list, actor.IsPlatformAdmin);

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

        private const string CompanyLacksModule = "The company does not have this module";

        private async Task<bool> CompanyHasModuleAsync(int companyId, string moduleKey)
        {
            var modules = await GetListAsync<CompanyModuleDto>("sp_Platform_GetCompanyModules", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });
            return ModuleAdminRules.HasModule(modules, moduleKey);
        }

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

            if (result.Success)
                _logger.LogInformation("Module {ModuleKey} switched {State} for company {CompanyId} by user {UserId}",
                    moduleKey, req!.IsEnabled ? "on" : "off", companyId, actor.UserId);

            // Service module switched ON: the company's users must be in its database again.
            // Switched OFF: nothing is synchronised (the procedure behind the sync
            // returns no company), so nobody in the tenant database changes.
            // Any other module: the company database mirrors Service users only.
            if (result.Success && req.IsEnabled && moduleKey == ModuleAccess.ServiceModuleKey)
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

            if (!await CompanyHasModuleAsync(companyId, key))
                return ApiResponse<List<ProjectAccessDto>>.Fail(CompanyLacksModule);

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

            if (!await CompanyHasModuleAsync(companyId, key))
                return ApiResponse<bool>.Fail(CompanyLacksModule);

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

        // ============================================
        // BRANCH ACCESS (rows live in the company's own database)
        // ============================================

        /// <summary>The active members of the company, with their role in it.</summary>
        private Task<List<ProjectAccessDto>> GetMembersAsync(int companyId)
            => GetListAsync<ProjectAccessDto>("sp_Platform_GetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", ModuleAccess.ServiceModuleKey)
            });

        public async Task<ApiResponse<BranchAccessDto>> GetBranchAccess(int companyId, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<BranchAccessDto>.Fail(NotAllowed);

            var project = await GetManagedProject(companyId, actor);
            if (project == null)
                return ApiResponse<BranchAccessDto>.Fail(NotAllowed);

            var members = await GetMembersAsync(companyId);

            try
            {
                var db = await OpenProjectDb(project.Value.ProjectKey);
                var scope = new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
                };

                var branches = (await db.ExecuteDataTableAsync("sp_Location_GetAll", scope)).ToList<BranchDto>();

                // members who were never given branches get every active one now (once),
                // so the screen shows what they would get at their first login
                await db.ExecuteNonQueryAsync("sp_Branch_EnsureInitialised", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
                    SqlParameterHelper.Input("@MainUserIdsJson", System.Text.Json.JsonSerializer.Serialize(BranchAccessRules.MemberIdsToInitialise(members)))
                });

                var granted = await db.ExecuteDataTableAsync("sp_Branch_GetAccess", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
                });

                var pairs = granted.Rows.Cast<DataRow>()
                    .Select(r => (Convert.ToInt32(r["MainUserId"]), Convert.ToInt32(r["LocationId"])));

                return ApiResponse<BranchAccessDto>.Ok(BranchAccessRules.Build(members, branches, pairs));
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                return ApiResponse<BranchAccessDto>.Fail(BranchAccessRules.NotInstalledMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", companyId);
                return ApiResponse<BranchAccessDto>.Fail("Could not read the company database");
            }
        }

        public async Task<ApiResponse<bool>> SetBranchAccess(int companyId, SetBranchAccessRequest req, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<bool>.Fail(NotAllowed);

            if (req == null || req.UserId <= 0 || req.LocationId <= 0)
                return ApiResponse<bool>.Fail("Branch or user not found");

            var project = await GetManagedProject(companyId, actor);
            if (project == null)
                return ApiResponse<bool>.Fail(NotAllowed);

            // the member list is the main database's: a user of another company is not in it
            var member = (await GetMembersAsync(companyId)).FirstOrDefault(m => m.UserId == req.UserId);
            var refusal = BranchAccessRules.ChangeRefusal(member, actor.UserId);
            if (refusal != null)
                return ApiResponse<bool>.Fail(refusal);

            try
            {
                var db = await OpenProjectDb(project.Value.ProjectKey);
                var dt = await db.ExecuteDataTableAsync("sp_Branch_SetAccess", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
                    SqlParameterHelper.Input("@MainUserId", req.UserId),
                    SqlParameterHelper.Input("@LocationId", req.LocationId),
                    SqlParameterHelper.Input("@HasAccess", req.HasAccess),
                    SqlParameterHelper.Input("@GrantedBy", actor.UserId)
                });

                return ToFlag(dt);
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                return ApiResponse<bool>.Fail(BranchAccessRules.NotInstalledMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", companyId);
                return ApiResponse<bool>.Fail("Could not save to the company database");
            }
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
        // DATABASE SERVERS + PLATFORM SETTINGS (platform administrators only)
        // ============================================

        public async Task<ApiResponse<List<DbServerDto>>> GetDbServers(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<List<DbServerDto>>.Fail(NotAllowed);

            return ApiResponse<List<DbServerDto>>.Ok(await GetListAsync<DbServerDto>("sp_Platform_GetDbServers"));
        }

        public async Task<ApiResponse<int>> SaveDbServer(SaveDbServerRequest req, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<int>.Fail(NotAllowed);

            if (req == null || string.IsNullOrWhiteSpace(req.ServerName) || string.IsNullOrWhiteSpace(req.AdminUser))
                return ApiResponse<int>.Fail("Server and login are required");

            if (req.ServerName.Trim().Length > 200 || req.AdminUser.Trim().Length > 100 || (req.ExtraOptions?.Length ?? 0) > 400)
                return ApiResponse<int>.Fail("One of the values is too long");

            // the options end up, as typed, in the connection string of every company created
            // on this server: they must not say where to connect or as whom
            var (options, optionsError) = PlatformSettingRules.ValidateServerOptions(req.ExtraOptions);
            if (options == null)
                return ApiResponse<int>.Fail(optionsError ?? "The options are not valid connection options");

            var passwordProblem = DbServerRules.PasswordProblem(req.AdminPassword);
            if (passwordProblem != null)
                return ApiResponse<int>.Fail(passwordProblem);

            // The stored password belongs to the stored server and login: when one of them
            // changes, it must be typed again, or it would be sent to the new place.
            if (req.DbServerId > 0)
            {
                var stored = await GetStoredDbServer(req.DbServerId);
                if (stored == null)
                    return ApiResponse<int>.Fail("Server not found");

                var saveProblem = DbServerRules.SaveProblem(
                    stored.ServerName, stored.AdminUser, req.ServerName, req.AdminUser,
                    passwordTyped: !string.IsNullOrEmpty(req.AdminPassword));
                if (saveProblem != null)
                    return ApiResponse<int>.Fail(saveProblem);
            }

            // stored encrypted; empty on an edit keeps the stored one
            var encrypted = string.IsNullOrEmpty(req.AdminPassword) ? null : _protector.Protect(req.AdminPassword);

            var dt = await GetDataTableAsync("sp_Platform_SaveDbServer", new[]
            {
                SqlParameterHelper.Input("@DbServerId", req.DbServerId),
                SqlParameterHelper.Input("@ServerName", req.ServerName.Trim()),
                SqlParameterHelper.Input("@AdminUser", req.AdminUser.Trim()),
                SqlParameterHelper.Input("@AdminPasswordEnc", (object?)encrypted ?? DBNull.Value),
                SqlParameterHelper.Input("@ExtraOptions", Nullable(options)),
                SqlParameterHelper.Input("@IsDefault", req.IsDefault),
                SqlParameterHelper.Input("@IsActive", req.IsActive)
            });

            var result = ToResult(dt, "DbServerId");
            if (result.Success)
                _logger.LogInformation("Database server {DbServerId} saved by user {UserId} (default: {IsDefault})",
                    result.Data, actor.UserId, req.IsDefault);

            return result;
        }

        /// <summary>A server row as stored, with its encrypted password. Never leaves this class.</summary>
        private sealed record StoredDbServer(string ServerName, string AdminUser, string AdminPasswordEnc, string ExtraOptions);

        private async Task<StoredDbServer?> GetStoredDbServer(int dbServerId)
        {
            var dt = await GetDataTableAsync("sp_Platform_GetDbServerSecret", new[]
            {
                SqlParameterHelper.Input("@DbServerId", dbServerId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var row = dt.Rows[0];

            return new StoredDbServer(
                row["ServerName"]?.ToString() ?? "",
                row["AdminUser"]?.ToString() ?? "",
                row["AdminPasswordEnc"]?.ToString() ?? "",
                row["ExtraOptions"]?.ToString() ?? "");
        }

        /// <summary>Can the API log in, and may that login create databases?</summary>
        public async Task<ApiResponse<ConnectionTestResult>> TestDbServer(SaveDbServerRequest req, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<ConnectionTestResult>.Fail(NotAllowed);

            if (req == null || string.IsNullOrWhiteSpace(req.ServerName) || string.IsNullOrWhiteSpace(req.AdminUser))
                return ApiResponse<ConnectionTestResult>.Fail("Server and login are required");

            var passwordProblem = DbServerRules.PasswordProblem(req.AdminPassword);
            if (passwordProblem != null)
                return ApiResponse<ConnectionTestResult>.Fail(passwordProblem);

            // what is tested: the request's values with a typed password ...
            var serverName = req.ServerName;
            var adminUser = req.AdminUser;
            var extraOptions = req.ExtraOptions;
            var password = req.AdminPassword;

            // ... but without one (editing without retyping it) ONLY the stored server, login
            // and options, with the stored password: the stored password is never sent to a
            // server, or used for a login, that the caller names.
            if (string.IsNullOrEmpty(password) && req.DbServerId > 0)
            {
                var stored = await GetStoredDbServer(req.DbServerId);

                if (stored != null)
                {
                    var testProblem = DbServerRules.TestWithStoredPasswordProblem(
                        stored.ServerName, stored.AdminUser, req.ServerName, req.AdminUser);
                    if (testProblem != null)
                        return ApiResponse<ConnectionTestResult>.Fail(testProblem);

                    serverName = stored.ServerName;
                    adminUser = stored.AdminUser;
                    extraOptions = stored.ExtraOptions;

                    try { password = _protector.Unprotect(stored.AdminPasswordEnc); }
                    catch { password = null; }
                }
            }

            if (string.IsNullOrEmpty(password))
                return ApiResponse<ConnectionTestResult>.Fail("Enter the password to test the connection");

            var (options, optionsError) = PlatformSettingRules.ValidateServerOptions(extraOptions);
            if (options == null)
                return ApiResponse<ConnectionTestResult>.Fail(optionsError ?? "The options are not valid connection options");

            var result = new ConnectionTestResult();

            try
            {
                var connectionString = new SqlConnectionStringBuilder(
                    TenantConnectionString.Build(serverName, "master", adminUser, password, options))
                { ConnectTimeout = 10, Pooling = false }.ConnectionString;

                var master = new ExplicitDbHelper(connectionString);
                var dt = await master.ExecuteQueryDataTableAsync(
                    "SELECT CASE WHEN IS_SRVROLEMEMBER('dbcreator') = 1 OR IS_SRVROLEMEMBER('sysadmin') = 1 THEN 1 ELSE 0 END AS CanCreate");

                result.Connected = true;
                result.SchemaReady = dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["CanCreate"]) == 1;
                result.Message = result.SchemaReady
                    ? "Connected. This login can create databases"
                    : "Connected, but this login cannot create databases. Give it the dbcreator server role";
            }
            catch (Exception ex) when (ex is SqlException || ex is ArgumentException || ex is FormatException)
            {
                // never the exception text: it can name the server and the login, and a bad
                // connection string can quote the password
                _logger.LogWarning("Connection test of a database server failed ({ExceptionType}, user {UserId})",
                    ex.GetType().Name, actor.UserId);
                result.Message = "Could not connect. Check the server, login, password and options";
            }

            return ApiResponse<ConnectionTestResult>.Ok(result, result.Message);
        }

        public async Task<ApiResponse<List<PlatformSettingDto>>> GetSettings(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<List<PlatformSettingDto>>.Fail(NotAllowed);

            return ApiResponse<List<PlatformSettingDto>>.Ok(await GetListAsync<PlatformSettingDto>("sp_Platform_GetSettings"));
        }

        public async Task<ApiResponse<bool>> SaveSetting(SavePlatformSettingRequest req, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<bool>.Fail(NotAllowed);

            var (value, error) = PlatformSettingRules.Validate(req?.SettingKey, req?.SettingValue);
            if (value == null)
                return ApiResponse<bool>.Fail(error ?? "Unknown setting");

            var dt = await GetDataTableAsync("sp_Platform_SaveSetting", new[]
            {
                SqlParameterHelper.Input("@SettingKey", req!.SettingKey),
                SqlParameterHelper.Input("@SettingValue", value),
                SqlParameterHelper.Input("@UpdatedBy", actor.UserId)
            });

            var result = ToFlag(dt);
            if (result.Success)
                _logger.LogInformation("Platform setting {SettingKey} changed by user {UserId}", req.SettingKey, actor.UserId);

            return result;
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
