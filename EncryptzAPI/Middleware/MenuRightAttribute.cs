using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>The right on a menu this action needs. The tenant admin always has it.</summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class MenuRightAttribute : Attribute
    {
        public MenuRightAttribute(string menuPath, MenuRightKind right)
        {
            MenuPath = menuPath;
            Right = right;
        }

        public string MenuPath { get; }
        public MenuRightKind Right { get; }

        /// <summary>Save: the property of the body holding the id (0 = a new record).</summary>
        public string? IdProperty { get; set; }

        /// <summary>A second menu that also allows this action (a document of a bill: Sales Order or Despatch).</summary>
        public string? OrMenuPath { get; set; }

        /// <summary>A status change to this value voids the transaction, so it needs the Delete right.</summary>
        public string? DeleteWhenStatus { get; set; }

        /// <summary>A technician's own field work (check-in, job status, spare request).</summary>
        public bool AllowTechnician { get; set; }

        /// <summary>A role whose job is this action, whatever is ticked (a Storekeeper issues spare and repaired parts).</summary>
        public string? AllowRole { get; set; }
    }

    /// <summary>Refuses a change the caller has no right for, whatever the screen showed.</summary>
    public sealed class MenuRightFilter : IAsyncActionFilter
    {
        private readonly IMenuRightsService _rights;

        public MenuRightFilter(IMenuRightsService rights) => _rights = rights;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var need = context.ActionDescriptor.EndpointMetadata.OfType<MenuRightAttribute>().LastOrDefault();
            var user = context.HttpContext.User;

            // customers have their own boundary (CustomerBoundaryFilter)
            if (need == null || user?.Identity?.IsAuthenticated != true || user.IsInRole("Customer")
                || (need.AllowTechnician && user.IsInRole("Technician"))
                || (need.AllowRole != null && user.IsInRole(need.AllowRole)))
            {
                await next();
                return;
            }

            var companyId = int.TryParse(user.FindFirst("CompanyId")?.Value, out var id) ? id : 0;
            var rights = await _rights.GetRights(MainIdentity.UserId(user), companyId,
                MenuRightRules.ModuleOf(need.MenuPath), user.FindFirst("PlatformAdmin")?.Value == "true");

            if (rights.FullAccess || Allowed(rights, need.MenuPath, need, context) ||
                (need.OrMenuPath != null && Allowed(rights, need.OrMenuPath, need, context)))
            {
                await next();
                return;
            }

            context.Result = new ObjectResult(new { success = false, message = "You do not have permission for this action. Ask your administrator." })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        private static bool Allowed(UserMenuRights rights, string path, MenuRightAttribute need, ActionExecutingContext context)
        {
            rights.Rows.TryGetValue(MenuRightRules.NormalizePath(path), out var row);
            return MenuRightRules.Has(row, Voids(need, context) ? MenuRightKind.Delete : need.Right, IsNew(need, context));
        }

        private static bool Voids(MenuRightAttribute need, ActionExecutingContext context)
            => need.DeleteWhenStatus != null && context.ActionArguments.Values.Any(argument =>
                string.Equals((argument?.GetType().GetProperty("Status")?.GetValue(argument) as string)?.Trim(),
                    need.DeleteWhenStatus, StringComparison.OrdinalIgnoreCase));

        /// <summary>Null when the id cannot be read: then both Create and Edit are needed.</summary>
        private static bool? IsNew(MenuRightAttribute need, ActionExecutingContext context)
        {
            if (need.Right != MenuRightKind.Save || need.IdProperty == null) return null;
            foreach (var argument in context.ActionArguments.Values)
            {
                var value = argument?.GetType().GetProperty(need.IdProperty)?.GetValue(argument);
                if (value is int number) return number <= 0;
            }
            return null;
        }
    }
}
