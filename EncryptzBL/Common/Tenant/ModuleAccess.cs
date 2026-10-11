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
