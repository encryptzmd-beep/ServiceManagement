using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Who the caller may act as. Most business endpoints are only [Authorize]d and take
    /// the technician / assignment / complaint id from the request, so the id has to be
    /// checked against the token:
    ///
    ///   back office (Admin, CompanyAdmin, Manager and other staff without a technician
    ///   profile)  -> works for any technician, as before
    ///   technician -> only the own TechnicianId / own assignments
    ///   customer   -> customer portal endpoints only (CustomerBoundaryFilter)
    /// </summary>
    public static class AccessBoundaryExtensions
    {
        private static readonly string[] BackofficeRoles = { "Admin", "CompanyAdmin", "Manager" };

        public static bool IsBackoffice(this ClaimsPrincipal user)
            => BackofficeRoles.Any(user.IsInRole);

        /// <summary>
        /// True when the caller is limited to the own technician data: the Technician role,
        /// or any other non-back-office login that has a technician profile.
        /// </summary>
        public static bool IsTechnicianScoped(this ClaimsPrincipal user)
            => !user.IsBackoffice() && (user.IsInRole("Technician") || user.GetTechnicianId() > 0);

        /// <summary>May the caller read / write the data of this technician?</summary>
        public static bool CanActAsTechnician(this ClaimsPrincipal user, int technicianId)
            => !user.IsTechnicianScoped() || (technicianId > 0 && technicianId == user.GetTechnicianId());

        /// <summary>403 with the JSON shape the UI reads ({ success, message }).</summary>
        public static ObjectResult Forbidden(this ControllerBase controller, string message = "You do not have access to this record")
            => controller.StatusCode(StatusCodes.Status403Forbidden, new { success = false, message });
    }

    /// <summary>Marks a controller / action as part of the customer portal.</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class CustomerPortalAttribute : Attribute { }

    /// <summary>
    /// A customer token is a real JWT of the same API, so every endpoint that is only
    /// [Authorize]d would accept it (payments, spare approvals, technician lists ...).
    /// Customers are let through only where the endpoint says so: [CustomerPortal],
    /// [AllowAnonymous], or an [Authorize(Roles = ...)] that names "Customer".
    /// </summary>
    public class CustomerBoundaryFilter : IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;
            if (user?.Identity?.IsAuthenticated != true || !user.IsInRole("Customer"))
                return;

            var metadata = context.ActionDescriptor.EndpointMetadata;

            if (metadata.OfType<IAllowAnonymous>().Any() || metadata.OfType<CustomerPortalAttribute>().Any())
                return;

            var namesCustomer = metadata.OfType<IAuthorizeData>().Any(a =>
                (a.Roles ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Contains("Customer"));
            if (namesCustomer)
                return;

            context.Result = new ObjectResult(new { success = false, message = "Not available in the customer portal" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
