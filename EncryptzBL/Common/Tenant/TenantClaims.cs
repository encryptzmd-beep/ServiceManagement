using System.Security.Claims;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Names and helpers for the routing claims of a staff/customer token.
    /// TenantKey routes the request to the company's database. Tokens issued before
    /// the company-level routing carry the same value as "ProjectKey"; it is still
    /// written and still read so those tokens keep working.
    /// </summary>
    public static class TenantClaims
    {
        public const string TenantKey = "TenantKey";
        public const string LegacyProjectKey = "ProjectKey";
        public const string ModuleKey = "ModuleKey";

        public static string GetTenantKey(ClaimsPrincipal user)
        {
            var key = user.FindFirst(TenantKey)?.Value;
            if (string.IsNullOrEmpty(key))
                key = user.FindFirst(LegacyProjectKey)?.Value;
            return key ?? string.Empty;
        }

        /// <summary>
        /// True for a token issued before TenantKey / ModuleKey existed: it carries a
        /// non-empty ProjectKey and no TenantKey claim at all. An identity or company
        /// token (TenantKey present but empty, or no key claims) is not legacy.
        /// </summary>
        public static bool IsLegacyToken(ClaimsPrincipal user)
            => user.FindFirst(TenantKey) == null
               && !string.IsNullOrEmpty(user.FindFirst(LegacyProjectKey)?.Value);

        public static string GetModuleKey(ClaimsPrincipal user)
            => user.FindFirst(ModuleKey)?.Value ?? string.Empty;

        /// <summary>The scope part of a token: company, routing key, module, branch and tenant-local ids.</summary>
        public static List<Claim> BuildScopeClaims(
            int companyId, string tenantKey, int scopeId, int locationId,
            string moduleKey, int tenantUserId, int technicianId)
        {
            return new List<Claim>
            {
                new Claim("CompanyId", companyId.ToString()),
                new Claim("ClientId", companyId.ToString()),
                new Claim(TenantKey, tenantKey ?? string.Empty),
                new Claim(LegacyProjectKey, tenantKey ?? string.Empty),
                // the value the tenant database knows as ProjectId (Companies.TenantScopeId)
                new Claim("ProjectId", scopeId.ToString()),
                new Claim("LocationId", locationId.ToString()),
                new Claim(ModuleKey, moduleKey ?? string.Empty),
                new Claim("TenantUserId", tenantUserId.ToString()),
                new Claim("TechnicianId", technicianId.ToString())
            };
        }
    }
}
