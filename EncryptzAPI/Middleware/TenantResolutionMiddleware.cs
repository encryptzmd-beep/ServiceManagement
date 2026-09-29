using System.Security.Claims;
using EncryptzBL.Common.Tenant;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Resolves the project DB for the request and populates the request-scoped
    /// TenantContext.
    ///
    /// AUTHENTICATED requests: the tenant claims baked into the JWT (ProjectKey,
    /// CompanyId, ProjectId, LocationId) — staff tokens get them at set-scope,
    /// customer tokens at customer login. The JWT is signed and the scope is only
    /// issued after access was verified, so the claims are trusted for routing.
    ///
    /// ANONYMOUS requests (public customer-portal endpoints: register, login,
    /// public complaint): the project is named by the X-Project-Key header. The
    /// header is ignored for authenticated requests, so a token can never be
    /// pointed at another project's DB.
    ///
    /// Endpoints that run before a project is chosen (login, select-company, etc.)
    /// have neither — TenantContext stays unresolved and any business-data access
    /// fails fast with a clear message.
    /// </summary>
    public class TenantResolutionMiddleware
    {
        public const string ProjectKeyHeader = "X-Project-Key";

        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IConnectionResolver resolver, TenantContext tenant)
        {
            var user = context.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                var projectKey = user.FindFirst("ProjectKey")?.Value;

                if (!string.IsNullOrEmpty(projectKey))
                {
                    tenant.ProjectKey = projectKey;
                    tenant.CompanyId = ParseInt(user.FindFirst("CompanyId")?.Value
                                                ?? user.FindFirst("ClientId")?.Value);
                    tenant.ProjectId = ParseInt(user.FindFirst("ProjectId")?.Value);
                    tenant.LocationId = ParseInt(user.FindFirst("LocationId")?.Value);

                    // Identity: the login lives in MainDB; TenantUserId/TechnicianId are the
                    // caller's ids inside the project DB (resolved by the user sync at set-scope).
                    // Customer tokens are issued by the project DB itself: their NameIdentifier
                    // already is the local user id.
                    var nameId = ParseInt(user.FindFirst(ClaimTypes.NameIdentifier)?.Value);
                    tenant.TenantUserId = user.GetTenantUserId();
                    tenant.MainUserId = user.FindFirst("TenantUserId") != null ? nameId : 0;
                    tenant.TechnicianId = user.GetTechnicianId();

                    // Optional per-request location override header. Narrows scope WITHIN
                    // the same project DB; rows are still guarded by LocationId in every proc.
                    ApplyLocationHeader(context, tenant);

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(projectKey);
                }
            }
            else
            {
                var headerKey = context.Request.Headers[ProjectKeyHeader].FirstOrDefault();

                if (!string.IsNullOrWhiteSpace(headerKey))
                {
                    var scope = await resolver.GetProjectScopeAsync(headerKey.Trim());
                    if (scope == null)
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        await context.Response.WriteAsJsonAsync(new { success = false, message = "Unknown project" });
                        return;
                    }

                    tenant.ProjectKey = scope.ProjectKey;
                    tenant.CompanyId = scope.CompanyId;
                    tenant.ProjectId = scope.ProjectId;
                    tenant.LocationId = scope.DefaultLocationId;
                    ApplyLocationHeader(context, tenant);

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(scope.ProjectKey);
                }
            }

            await _next(context);
        }

        private static void ApplyLocationHeader(HttpContext context, TenantContext tenant)
        {
            var headerLocation = context.Request.Headers["X-Location-Id"].FirstOrDefault();
            if (!string.IsNullOrEmpty(headerLocation) && int.TryParse(headerLocation, out var loc) && loc > 0)
                tenant.LocationId = loc;
        }

        private static int ParseInt(string? value)
            => int.TryParse(value, out var n) ? n : 0;
    }
}
