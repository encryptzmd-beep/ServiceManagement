using System.Security.Claims;
using EncryptzBL.Common.Tenant;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// After authentication, reads the tenant claims baked into the JWT at
    /// select-company time (ClientKey, ClientId, LocationId), resolves the client's
    /// ServiceDB connection string, and populates the request-scoped TenantContext.
    ///
    /// Endpoints that run before a client is chosen (login, select-company, etc.)
    /// simply have no ClientKey claim — TenantContext stays unresolved and any
    /// business-data access will fail fast with a clear message.
    ///
    /// The JWT is signed, and the ClientKey/LocationId are only issued for a company
    /// the user was verified to belong to (sp_User_SelectCompany), so the claims are
    /// trusted here for routing.
    /// </summary>
    public class TenantResolutionMiddleware
    {
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

                    // Optional per-request location override header. Narrows scope WITHIN
                    // the same project DB; rows are still guarded by LocationId in every proc.
                    var headerLocation = context.Request.Headers["X-Location-Id"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(headerLocation) && int.TryParse(headerLocation, out var loc))
                        tenant.LocationId = loc;

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(projectKey);
                }
            }

            await _next(context);
        }

        private static int ParseInt(string? value)
            => int.TryParse(value, out var n) ? n : 0;
    }
}
