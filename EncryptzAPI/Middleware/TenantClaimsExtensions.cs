using System.Security.Claims;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Identity helpers for business (project DB) controllers.
    ///
    /// ClaimTypes.NameIdentifier is the MainDB UserId. Business procs and their FKs work
    /// with the user's ids INSIDE the project DB, which set-scope resolves and bakes into
    /// the token as TenantUserId / TechnicianId.
    /// </summary>
    public static class TenantClaimsExtensions
    {
        /// <summary>
        /// The caller's Users.UserId in the project DB. Tokens issued by the project DB
        /// itself (customer login) carry no TenantUserId; their NameIdentifier already is it.
        /// </summary>
        public static int GetTenantUserId(this ClaimsPrincipal user)
        {
            if (int.TryParse(user.FindFirst("TenantUserId")?.Value, out var tenantUserId) && tenantUserId > 0)
                return tenantUserId;

            return int.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        }

        /// <summary>The caller's Technicians.TechnicianId in the project DB (0 when not a technician).</summary>
        public static int GetTechnicianId(this ClaimsPrincipal user)
            => int.TryParse(user.FindFirst("TechnicianId")?.Value, out var id) ? id : 0;
    }
}
