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
        NoAccess
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
        /// part of the rule: database not ready, then not subscribed, then not granted.
        /// </summary>
        public static string? Refusal(string? provisionStatus, string? tenantKey,
            bool companyEnabled, bool userGranted, string? roleInCompany)
        {
            if (provisionStatus != "Ready" || string.IsNullOrEmpty(tenantKey))
                return "Your company is still being set up. Please try again shortly";

            switch (Evaluate(companyEnabled, userGranted, roleInCompany))
            {
                case ModuleState.NotSubscribed:
                    return "This module is not part of your company's subscription";
                case ModuleState.NoAccess:
                    return "You don't have access to this module. Ask your administrator";
                default:
                    return null;
            }
        }

        public static ModuleState Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany)
        {
            if (!companyEnabled)
                return ModuleState.NotSubscribed;

            return userGranted || IsCompanyAdminRole(roleInCompany)
                ? ModuleState.Available
                : ModuleState.NoAccess;
        }
    }
}
