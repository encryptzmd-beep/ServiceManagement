using System.Data;
using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public sealed record UserMenuRights(bool FullAccess, IReadOnlyDictionary<string, MenuRightRow> Rows);

    public interface IMenuRightsService
    {
        /// <summary>Read on every call: a right an administrator removes stops working at once.</summary>
        Task<UserMenuRights> GetRights(int userId, int companyId, string moduleKey, bool isPlatformAdmin);
    }

    public sealed class MenuRightsService : BaseRepository, IMenuRightsService
    {
        private static readonly UserMenuRights None = new(false, new Dictionary<string, MenuRightRow>());

        public MenuRightsService(MainDbHelper db) : base(db) { }

        public async Task<UserMenuRights> GetRights(int userId, int companyId, string moduleKey, bool isPlatformAdmin)
        {
            if (isPlatformAdmin) return new UserMenuRights(true, None.Rows);
            if (userId <= 0 || companyId <= 0) return None;

            var actor = await GetDataTableAsync("sp_CompanyAccess_GetActor", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@UserId", userId)
            });
            if (actor == null || actor.Rows.Count == 0) return None;   // not an active member
            if (Convert.ToBoolean(actor.Rows[0]["IsTenantAdmin"])) return new UserMenuRights(true, None.Rows);

            var menus = await GetDataTableAsync("sp_User_GetMenusForCompany", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", moduleKey)
            });

            var rows = new Dictionary<string, MenuRightRow>();
            foreach (DataRow r in menus?.Rows.Cast<DataRow>() ?? Enumerable.Empty<DataRow>())
            {
                var path = MenuRightRules.NormalizePath(r["MenuPath"]?.ToString());
                if (path.Length == 0) continue;
                rows[path] = new MenuRightRow(path, Flag(r, "CanView"), Flag(r, "CanCreate"), Flag(r, "CanEdit"), Flag(r, "CanDelete"));
            }
            return new UserMenuRights(false, rows);
        }

        private static bool Flag(DataRow r, string column) => r[column] != DBNull.Value && Convert.ToBoolean(r[column]);
    }
}
