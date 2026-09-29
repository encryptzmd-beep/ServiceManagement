using System.Security.Claims;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Platform Admin endpoints need, on top of the login, the unlock token that is issued
    /// after the e-mailed access code was entered (header X-Platform-Token).
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class PlatformUnlockedAttribute : Attribute, IAsyncActionFilter
    {
        public const string HeaderName = "X-Platform-Token";

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var http = context.HttpContext;
            var unlock = http.RequestServices.GetRequiredService<IPlatformUnlockService>();

            var userId = int.TryParse(http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var token = http.Request.Headers[HeaderName].FirstOrDefault();

            if (!unlock.IsUnlocked(token, userId))
            {
                context.Result = new ObjectResult(new
                {
                    success = false,
                    code = "PLATFORM_LOCKED",
                    message = "Enter the access code to open Platform Admin"
                })
                { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }

            await next();
        }
    }
}
