using System.Data;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>What a user sees for one module of the catalogue inside a company.</summary>
    public enum ModuleState
    {
        /// <summary>The company has the module and the user may open it.</summary>
        Available,
        /// <summary>The company does not have the module.</summary>
        NotSubscribed,
        /// <summary>The company has it, the user was not given it.</summary>
        NoAccess,
        /// <summary>Listed, not built yet: nobody can open it.</summary>
        ComingSoon
    }

    /// <summary>
    /// The one rule for module access. The same rule is written in SQL in
    /// MainDB.dbo.fn_ModuleUsers; change both together.
    /// </summary>
    public static class ModuleAccess
    {
        public const string ServiceModuleKey = "SERVICE";

        private static readonly string[] CompanyAdminRoles = { "Admin", "CompanyAdmin" };

        public static bool IsCompanyAdminRole(string? roleInCompany)
            => !string.IsNullOrWhiteSpace(roleInCompany)
               && CompanyAdminRoles.Contains(roleInCompany.Trim(), StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Why a user may not open a module in a company, or null when they may. The order is
        /// part of the rule: database not ready, then not released, then not subscribed, then not granted.
        /// </summary>
        public static string? Refusal(string? provisionStatus, string? tenantKey,
            bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)
        {
            if (provisionStatus != "Ready" || string.IsNullOrEmpty(tenantKey))
                return "Your company is still being set up. Please try again shortly";

            switch (Evaluate(companyEnabled, userGranted, roleInCompany, isReleased))
            {
                case ModuleState.ComingSoon:
                    return "This application is not available yet";
                case ModuleState.NotSubscribed:
                    return "This module is not part of your company's subscription";
                case ModuleState.NoAccess:
                    return "You don't have access to this module. Ask your administrator";
                default:
                    return null;
            }
        }

        public static ModuleState Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)
        {
            if (!isReleased)
                return ModuleState.ComingSoon;

            if (!companyEnabled)
                return ModuleState.NotSubscribed;

            return userGranted || IsCompanyAdminRole(roleInCompany)
                ? ModuleState.Available
                : ModuleState.NoAccess;
        }

        /// <summary>
        /// The applications a company works with are the commercial ones. Personal applications
        /// are listed before a company is chosen, never inside one, whatever the procedure of the
        /// main database returns (an older form of sp_User_GetModules lists every module).
        /// </summary>
        public static List<T> WithoutPersonal<T>(IEnumerable<T> modules, Func<T, string> keyOf, IEnumerable<string>? personalKeys)
        {
            var personal = new HashSet<string>((personalKeys ?? Enumerable.Empty<string>()).Where(k => !string.IsNullOrWhiteSpace(k)), StringComparer.OrdinalIgnoreCase);
            return modules.Where(m => !personal.Contains(keyOf(m) ?? "")).ToList();
        }

        /// <summary>
        /// The released flag of a module row. A main database without script 21 has no
        /// such column: every module there is built.
        /// </summary>
        public static bool IsReleasedOf(DataRow row)
            => !row.Table.Columns.Contains("IsReleased")
               || row["IsReleased"] == DBNull.Value
               || Convert.ToBoolean(row["IsReleased"]);
    }
}
