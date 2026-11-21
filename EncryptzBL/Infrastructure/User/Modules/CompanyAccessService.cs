using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public class CompanyAccessService : BaseRepository, ICompanyAccessService
    {
        private readonly IPlatformService _platform;
        private readonly ITenantUserSyncService _userSync;
        private readonly ILogger<CompanyAccessService> _logger;

        public CompanyAccessService(
            MainDbHelper db,
            IPlatformService platform,
            ITenantUserSyncService userSync,
            ILogger<CompanyAccessService> logger) : base(db)
        {
            _platform = platform;
            _userSync = userSync;
            _logger = logger;
        }

        private sealed record Rights(bool CanManage, bool CanGrant);

        /// <summary>Read from the database on every call: a removed grant stops working at once.</summary>
        private async Task<Rights> ReadRightsAsync(PlatformActor actor)
        {
            if (actor.CompanyId <= 0 || actor.UserId <= 0)
                return new Rights(false, false);

            var dt = await GetDataTableAsync("sp_CompanyAccess_GetActor", new[]
            {
                SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                SqlParameterHelper.Input("@UserId", actor.UserId)
            });

            var row = dt != null && dt.Rows.Count > 0 ? dt.Rows[0] : null;
            var isTenantAdmin = row != null && Convert.ToBoolean(row["IsTenantAdmin"]);
            var isManager = row != null && Convert.ToBoolean(row["IsManager"]);

            return new Rights(
                CompanyAccessRules.CanManage(actor.IsPlatformAdmin, row != null, isTenantAdmin, isManager),
                CompanyAccessRules.CanGrant(actor.IsPlatformAdmin, row != null, isTenantAdmin));
        }

        /// <summary>The existing branch screens' logic, called after this service checked the rights.</summary>
        private static PlatformActor BranchActor(PlatformActor actor) => new()
        {
            UserId = actor.UserId,
            UserName = actor.UserName,
            CompanyId = actor.CompanyId,
            IsCompanyAdmin = true
        };

        public async Task<ApiResponse<CompanyAccessMeDto>> GetMe(PlatformActor actor)
        {
            try
            {
                var rights = await ReadRightsAsync(actor);
                return ApiResponse<CompanyAccessMeDto>.Ok(new CompanyAccessMeDto { CanManage = rights.CanManage, CanGrant = rights.CanGrant });
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                // before the script the entry is simply not offered
                return ApiResponse<CompanyAccessMeDto>.Ok(new CompanyAccessMeDto());
            }
        }

        public async Task<ApiResponse<CompanyAccessOverviewDto>> GetOverview(PlatformActor actor)
        {
            try
            {
                var rights = await ReadRightsAsync(actor);
                if (!rights.CanManage)
                    return ApiResponse<CompanyAccessOverviewDto>.Fail(CompanyAccessRules.NotAllowed);

                var ds = await GetDataSetAsync("sp_CompanyAccess_GetOverview", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", actor.CompanyId)
                });

                if (ds == null || ds.Tables.Count < 8)
                    return ApiResponse<CompanyAccessOverviewDto>.Fail("Could not read users and roles");

                var overview = Build(ds);
                overview.ActorUserId = actor.UserId;
                overview.CanGrant = rights.CanGrant;
                await AddBranchesAsync(overview, actor);

                return ApiResponse<CompanyAccessOverviewDto>.Ok(overview);
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                return ApiResponse<CompanyAccessOverviewDto>.Fail(CompanyAccessRules.NotInstalled);
            }
        }

        private static CompanyAccessOverviewDto Build(DataSet ds)
        {
            var menusByModule = ds.Tables[1].Rows.Cast<DataRow>()
                .GroupBy(r => Text(r, "ModuleKey"))
                .ToDictionary(g => g.Key, g => g.Select(r => new CompanyAccessMenuDto
                {
                    MenuId = Convert.ToInt32(r["MenuId"]),
                    MenuName = Text(r, "MenuName"),
                    GroupName = Text(r, "GroupName")
                }).ToList());

            var modules = ds.Tables[0].Rows.Cast<DataRow>().Select(r =>
            {
                var key = Text(r, "ModuleKey");
                return new CompanyAccessModuleDto
                {
                    ModuleKey = key,
                    ModuleName = Text(r, "ModuleName"),
                    Icon = Text(r, "Icon"),
                    Menus = menusByModule.TryGetValue(key, out var menus) ? menus : new()
                };
            }).ToList();

            var roleModules = ds.Tables[3].Rows.Cast<DataRow>()
                .GroupBy(r => Convert.ToInt32(r["CompanyRoleId"]))
                .ToDictionary(g => g.Key, g => g.Select(r => Text(r, "ModuleKey")).ToList());

            var roleMenus = ds.Tables[4].Rows.Cast<DataRow>()
                .GroupBy(r => Convert.ToInt32(r["CompanyRoleId"]))
                .ToDictionary(g => g.Key, g => g.Select(r => new CompanyRoleMenuDto
                {
                    MenuId = Convert.ToInt32(r["MenuId"]),
                    CanView = Convert.ToBoolean(r["CanView"]),
                    CanCreate = Convert.ToBoolean(r["CanCreate"]),
                    CanEdit = Convert.ToBoolean(r["CanEdit"]),
                    CanDelete = Convert.ToBoolean(r["CanDelete"])
                }).ToList());

            var roles = ds.Tables[2].Rows.Cast<DataRow>().Select(r =>
            {
                var id = Convert.ToInt32(r["CompanyRoleId"]);
                return new CompanyRoleDto
                {
                    CompanyRoleId = id,
                    RoleName = Text(r, "RoleName"),
                    Description = Text(r, "Description"),
                    AccessLevel = Text(r, "AccessLevel"),
                    UserCount = Convert.ToInt32(r["UserCount"]),
                    ModuleKeys = roleModules.TryGetValue(id, out var keys) ? keys : new(),
                    Menus = roleMenus.TryGetValue(id, out var menus) ? menus : new()
                };
            }).ToList();

            var userRoles = ds.Tables[6].Rows.Cast<DataRow>()
                .GroupBy(r => Convert.ToInt32(r["UserId"]))
                .ToDictionary(g => g.Key, g => g.Select(r => Convert.ToInt32(r["CompanyRoleId"])).ToList());

            var userModules = ds.Tables[7].Rows.Cast<DataRow>()
                .GroupBy(r => Convert.ToInt32(r["UserId"]))
                .ToDictionary(g => g.Key, g => g.Select(r => Text(r, "ModuleKey")).ToList());

            var allKeys = modules.Select(m => m.ModuleKey).ToList();

            var users = ds.Tables[5].Rows.Cast<DataRow>().Select(r =>
            {
                var id = Convert.ToInt32(r["UserId"]);
                var isAdmin = Convert.ToBoolean(r["IsTenantAdmin"]);
                return new CompanyAccessUserDto
                {
                    UserId = id,
                    FullName = Text(r, "FullName"),
                    Email = Text(r, "Email"),
                    MobileNumber = Text(r, "MobileNumber"),
                    RoleInCompany = Text(r, "RoleInCompany").Trim(),
                    IsActive = Convert.ToBoolean(r["IsActive"]),
                    IsTenantAdmin = isAdmin,
                    CanManage = isAdmin || Convert.ToBoolean(r["CanManage"]),
                    RoleIds = userRoles.TryGetValue(id, out var ids) ? ids : new(),
                    ModuleKeys = isAdmin ? allKeys : userModules.TryGetValue(id, out var keys) ? keys : new(),
                    AllBranches = isAdmin
                };
            }).ToList();

            return new CompanyAccessOverviewDto { Modules = modules, Roles = roles, Users = users };
        }

        private async Task AddBranchesAsync(CompanyAccessOverviewDto overview, PlatformActor actor)
        {
            var branches = await _platform.GetBranchAccess(actor.CompanyId, BranchActor(actor));
            if (!branches.Success || branches.Data == null)
            {
                overview.BranchNote = branches.Message ?? "Branches are not available yet";
                return;
            }

            overview.Branches = branches.Data.Branches
                .Select(b => new CompanyAccessBranchDto { LocationId = b.LocationId, LocationName = b.LocationName ?? "" })
                .ToList();

            var byUser = branches.Data.Users.ToDictionary(u => u.UserId);
            foreach (var user in overview.Users)
                if (byUser.TryGetValue(user.UserId, out var access))
                {
                    user.AllBranches = access.AllBranches;
                    user.LocationIds = access.LocationIds;
                }
        }

        public async Task<ApiResponse<int>> SaveRole(SaveCompanyRoleRequest req, PlatformActor actor)
        {
            try
            {
                if (!(await ReadRightsAsync(actor)).CanManage)
                    return ApiResponse<int>.Fail(CompanyAccessRules.NotAllowed);

                var problem = CompanyAccessRules.RoleProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                var menus = (req.Menus ?? new()).Select(m => new
                {
                    menuId = m.MenuId,
                    canView = m.CanView ? 1 : 0,
                    canCreate = m.CanCreate ? 1 : 0,
                    canEdit = m.CanEdit ? 1 : 0,
                    canDelete = m.CanDelete ? 1 : 0
                });

                var dt = await GetDataTableAsync("sp_CompanyAccess_SaveRole", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                    SqlParameterHelper.Input("@CompanyRoleId", req.CompanyRoleId),
                    SqlParameterHelper.Input("@RoleName", req.RoleName!.Trim()),
                    SqlParameterHelper.Input("@Description", (object?)req.Description?.Trim() ?? DBNull.Value),
                    SqlParameterHelper.Input("@AccessLevel", req.AccessLevel!),
                    SqlParameterHelper.Input("@ModulesJson", JsonSerializer.Serialize(req.ModuleKeys)),
                    SqlParameterHelper.Input("@MenusJson", JsonSerializer.Serialize(menus)),
                    SqlParameterHelper.Input("@SavedBy", actor.UserId)
                });

                var result = ToResult(dt, "CompanyRoleId");
                if (result.Success)
                    await _userSync.TrySyncCompanyUsersAsync(actor.CompanyId);
                return result;
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                return ApiResponse<int>.Fail(CompanyAccessRules.NotInstalled);
            }
        }

        public async Task<ApiResponse<bool>> DeleteRole(int companyRoleId, PlatformActor actor)
        {
            try
            {
                if (!(await ReadRightsAsync(actor)).CanManage)
                    return ApiResponse<bool>.Fail(CompanyAccessRules.NotAllowed);

                var dt = await GetDataTableAsync("sp_CompanyAccess_DeleteRole", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                    SqlParameterHelper.Input("@CompanyRoleId", companyRoleId)
                });
                return ToFlag(dt);
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                return ApiResponse<bool>.Fail(CompanyAccessRules.NotInstalled);
            }
        }

        public async Task<ApiResponse<int>> SaveUser(SaveCompanyUserRequest req, PlatformActor actor)
        {
            try
            {
                var rights = await ReadRightsAsync(actor);
                if (!rights.CanManage)
                    return ApiResponse<int>.Fail(CompanyAccessRules.NotAllowed);

                var problem = CompanyAccessRules.UserProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                if (req.UserId > 0)
                {
                    var target = await GetDataTableAsync("sp_CompanyAccess_GetActor", new[]
                    {
                        SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                        SqlParameterHelper.Input("@UserId", req.UserId)
                    });
                    var targetIsAdmin = target != null && target.Rows.Count > 0 && Convert.ToBoolean(target.Rows[0]["IsTenantAdmin"]);
                    var refusal = CompanyAccessRules.TargetRefusal(actor.UserId, req.UserId, rights.CanGrant, targetIsAdmin);
                    if (refusal != null)
                        return ApiResponse<int>.Fail(refusal);
                }

                var hash = req.UserId == 0 && !string.IsNullOrEmpty(req.Password)
                    ? (object)BCrypt.Net.BCrypt.HashPassword(req.Password)
                    : DBNull.Value;

                var dt = await GetDataTableAsync("sp_CompanyAccess_SaveUser", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                    SqlParameterHelper.Input("@UserId", req.UserId),
                    SqlParameterHelper.Input("@FullName", (object?)req.FullName?.Trim() ?? DBNull.Value),
                    SqlParameterHelper.Input("@Email", (object?)req.Email?.Trim() ?? DBNull.Value),
                    SqlParameterHelper.Input("@MobileNumber", (object?)req.MobileNumber?.Trim() ?? DBNull.Value),
                    SqlParameterHelper.Input("@PasswordHash", hash),
                    SqlParameterHelper.Input("@IsActive", req.IsActive),
                    SqlParameterHelper.Input("@RoleIdsJson", JsonSerializer.Serialize(req.RoleIds ?? new List<int>())),
                    SqlParameterHelper.Input("@SavedBy", actor.UserId)
                });

                var result = ToResult(dt, "UserId");
                if (!result.Success)
                    return result;

                var userId = result.Data;
                await _userSync.TrySyncCompanyUsersAsync(actor.CompanyId);

                var warnings = new List<string>();

                if (rights.CanGrant && req.IsActive)
                {
                    var manager = await SetManagerCoreAsync(userId, req.CanManage, actor);
                    if (!manager.Success) warnings.Add(manager.Message ?? "the admin access was not changed");
                }

                if (req.IsActive && req.LocationIds != null)
                {
                    var branchProblem = await ApplyBranchesAsync(userId, req.LocationIds, actor);
                    if (branchProblem != null) warnings.Add(branchProblem);
                }

                return ApiResponse<int>.Ok(userId, warnings.Count == 0 ? "User saved" : "User saved, but " + string.Join("; ", warnings));
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                return ApiResponse<int>.Fail(CompanyAccessRules.NotInstalled);
            }
        }

        /// <summary>Null when the member now has exactly these branches; otherwise what went wrong.</summary>
        private async Task<string?> ApplyBranchesAsync(int userId, List<int> wanted, PlatformActor actor)
        {
            try
            {
                var branchActor = BranchActor(actor);
                var access = await _platform.GetBranchAccess(actor.CompanyId, branchActor);
                if (!access.Success || access.Data == null)
                    return "the branches were not changed: " + (access.Message ?? "they are not available");

                var user = access.Data.Users.FirstOrDefault(u => u.UserId == userId);
                if (user == null || user.AllBranches)
                    return null;

                var (add, remove) = CompanyAccessRules.BranchChanges(
                    user.LocationIds, wanted, access.Data.Branches.Select(b => b.LocationId));

                foreach (var (locationId, hasAccess) in add.Select(id => (id, true)).Concat(remove.Select(id => (id, false))))
                {
                    var saved = await _platform.SetBranchAccess(actor.CompanyId, new SetBranchAccessRequest
                    {
                        UserId = userId,
                        LocationId = locationId,
                        HasAccess = hasAccess
                    }, branchActor);

                    if (!saved.Success)
                        return "the branches were not fully changed: " + saved.Message;
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Saving branches failed for user {UserId}, company {CompanyId}", userId, actor.CompanyId);
                return "the branches could not be changed";
            }
        }

        public async Task<ApiResponse<bool>> SetManager(SetCompanyManagerRequest req, PlatformActor actor)
        {
            try
            {
                if (!(await ReadRightsAsync(actor)).CanGrant)
                    return ApiResponse<bool>.Fail("Only the tenant admin can change this access");

                if (req == null || req.UserId <= 0)
                    return ApiResponse<bool>.Fail("User not found");

                return await SetManagerCoreAsync(req.UserId, req.Enabled, actor);
            }
            catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))
            {
                return ApiResponse<bool>.Fail(CompanyAccessRules.NotInstalled);
            }
        }

        private async Task<ApiResponse<bool>> SetManagerCoreAsync(int userId, bool enabled, PlatformActor actor)
        {
            var dt = await GetDataTableAsync("sp_CompanyAccess_SetManager", new[]
            {
                SqlParameterHelper.Input("@CompanyId", actor.CompanyId),
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@Enabled", enabled),
                SqlParameterHelper.Input("@GrantedBy", actor.UserId)
            });
            return ToFlag(dt);
        }

        private static string Text(DataRow row, string column)
            => row[column] == DBNull.Value ? "" : row[column]?.ToString() ?? "";

        private static ApiResponse<bool> ToFlag(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Save failed");

            var message = Text(dt.Rows[0], "Message");
            return Convert.ToInt32(dt.Rows[0]["Success"]) == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }

        private static ApiResponse<int> ToResult(DataTable? dt, string idColumn)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Save failed");

            var message = Text(dt.Rows[0], "Message");
            return Convert.ToInt32(dt.Rows[0]["Success"]) == 1
                ? ApiResponse<int>.Ok(Convert.ToInt32(dt.Rows[0][idColumn]), message)
                : ApiResponse<int>.Fail(message);
        }
    }
}
