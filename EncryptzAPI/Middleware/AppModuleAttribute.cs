using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>The module (MainDB.Modules.ModuleKey) a controller's endpoints belong to.</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class AppModuleAttribute : Attribute
    {
        public AppModuleAttribute(string moduleKey) => ModuleKey = moduleKey;

        public string ModuleKey { get; }
    }

    /// <summary>
    /// A staff token is issued for ONE module at set-scope, after the company's
    /// subscription and the user's grant were checked. Endpoints of a module only
    /// accept a token issued for that module. Customers have their own boundary
    /// (CustomerBoundaryFilter); tokens issued before modules existed are let through
    /// until they expire.
    /// </summary>
    public class ModuleBoundaryFilter : IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var required = context.ActionDescriptor.EndpointMetadata.OfType<AppModuleAttribute>().LastOrDefault();
            if (required == null)
                return;

            var user = context.HttpContext.User;
            if (user?.Identity?.IsAuthenticated != true || user.IsInRole("Customer"))
                return;

            if (TenantClaims.IsLegacyToken(user))
                return;

            if (string.Equals(TenantClaims.GetModuleKey(user), required.ModuleKey, StringComparison.OrdinalIgnoreCase))
                return;

            context.Result = new ObjectResult(new { success = false, message = "Open this module from the module list first" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
