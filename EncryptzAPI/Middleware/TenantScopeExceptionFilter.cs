using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// A caller that is logged in but has not selected a company, module and branch
    /// gets 403 with a message the UI can show, instead of an unhandled 500.
    /// </summary>
    public class TenantScopeExceptionFilter : IExceptionFilter
    {
        public const string Message = "Select a company, module and branch first";

        public void OnException(ExceptionContext context)
        {
            if (context.Exception is not TenantScopeRequiredException)
                return;

            context.Result = new ObjectResult(new { success = false, message = Message })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            context.ExceptionHandled = true;
        }
    }
}
