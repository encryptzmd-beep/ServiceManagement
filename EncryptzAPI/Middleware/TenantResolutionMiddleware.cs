using System.Security.Claims;
using EncryptzBL.Common.Tenant;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Resolves the company's database for the request and fills the request-scoped
    /// TenantContext.
    ///
    /// AUTHENTICATED requests: the routing claims of the signed JWT (TenantKey,
    /// CompanyId, ProjectId = tenant scope id, LocationId, ModuleKey). Staff tokens get
    /// them at set-scope, customer tokens at customer login. Tokens issued before the
    /// company-level routing carry the key as ProjectKey; it is accepted as a fallback.
    ///
    /// ANONYMOUS requests (public customer-portal endpoints): the company is named by
    /// the X-Tenant-Key header (X-Project-Key is the old name). The header is ignored
    /// for authenticated requests, so a token can never be pointed at another database.
    ///
    /// The branch always comes from the token: changing it means calling set-scope,
    /// which checks the caller's access and issues a new token.
    ///
    /// Endpoints that run before a scope is chosen (login, select-company, modules)
    /// have neither; TenantContext stays unresolved and business data access is refused.
    /// </summary>
    public class TenantResolutionMiddleware
    {
        public const string TenantKeyHeader = "X-Tenant-Key";
        /// <summary>Old name of <see cref="TenantKeyHeader"/>, still sent by deployed customer pages.</summary>
        public const string ProjectKeyHeader = "X-Project-Key";

        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IConnectionResolver resolver, TenantContext tenant,
            ILogger<TenantResolutionMiddleware> logger)
        {
            var user = context.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                var tenantKey = TenantClaims.GetTenantKey(user);

                if (!string.IsNullOrEmpty(tenantKey))
                {
                    string connection;
                    try
                    {
                        connection = await resolver.GetServiceConnectionAsync(tenantKey);
                    }
                    catch (TenantNotRoutableException)
                    {
                        // The company was deactivated or is not ready any more. Leave the tenant
                        // unresolved: business calls get the usual 403, while the control-plane
                        // calls (user-companies, select-company, set-scope) still work, so the
                        // user can leave this company.
                        logger.LogWarning("Company {CompanyId} has no active database to route to; the request continues without a tenant",
                            user.FindFirst("CompanyId")?.Value ?? user.FindFirst("ClientId")?.Value);
                        await _next(context);
                        return;
                    }

                    tenant.ServiceDbConnectionString = connection;
                    tenant.ProjectKey = tenantKey;
                    tenant.CompanyId = ParseInt(user.FindFirst("CompanyId")?.Value
                                                ?? user.FindFirst("ClientId")?.Value);
                    tenant.ProjectId = ParseInt(user.FindFirst("ProjectId")?.Value);
                    tenant.LocationId = ParseInt(user.FindFirst("LocationId")?.Value);
                    tenant.ModuleKey = TenantClaims.GetModuleKey(user);

                    // Identity: the login lives in MainDB; TenantUserId/TechnicianId are the
                    // caller's ids inside the tenant DB (resolved by the user sync at set-scope).
                    // Customer tokens are issued by the tenant DB itself: their NameIdentifier
                    // already is the local user id.
                    var nameId = ParseInt(user.FindFirst(ClaimTypes.NameIdentifier)?.Value);
                    tenant.TenantUserId = user.GetTenantUserId();
                    tenant.MainUserId = user.FindFirst("TenantUserId") != null ? nameId : 0;
                    tenant.TechnicianId = user.GetTechnicianId();
                }
            }
            else
            {
                var headerKey = context.Request.Headers[TenantKeyHeader].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(headerKey))
                    headerKey = context.Request.Headers[ProjectKeyHeader].FirstOrDefault();

                if (!string.IsNullOrWhiteSpace(headerKey))
                {
                    var scope = await resolver.GetProjectScopeAsync(headerKey.Trim());
                    if (scope == null)
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        await context.Response.WriteAsJsonAsync(new { success = false, message = "Unknown company" });
                        return;
                    }

                    tenant.ProjectKey = scope.ProjectKey;
                    tenant.CompanyId = scope.CompanyId;
                    tenant.ProjectId = scope.ProjectId;
                    tenant.LocationId = scope.DefaultLocationId;

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(scope.ProjectKey);
                }
            }

            await _next(context);
        }

        private static int ParseInt(string? value)
            => int.TryParse(value, out var n) ? n : 0;
    }
}
