using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Guards the paging arguments of every list endpoint:
    ///   - a page / size below 1 is answered with 400 (it used to reach OFFSET / FETCH
    ///     in the stored procedure and come back as HTTP 500),
    ///   - a size above <see cref="MaxPageSize"/> is cut down to it, so one request
    ///     cannot ask for an unbounded result set.
    /// Covers plain arguments (page, pageNumber, size, pageSize) and filter DTOs with
    /// PageNumber / PageSize properties.
    /// </summary>
    public class PagingGuardFilter : IActionFilter
    {
        public const int MaxPageSize = 500;

        private static readonly HashSet<string> PageNames =
            new(StringComparer.OrdinalIgnoreCase) { "page", "pageNumber" };
        private static readonly HashSet<string> SizeNames =
            new(StringComparer.OrdinalIgnoreCase) { "size", "pageSize" };

        public void OnActionExecuting(ActionExecutingContext context)
        {
            foreach (var (name, value) in context.ActionArguments.ToList())
            {
                if (value is int number)
                {
                    if ((PageNames.Contains(name) || SizeNames.Contains(name)) && number < 1)
                    {
                        context.Result = Invalid(name);
                        return;
                    }
                    if (SizeNames.Contains(name) && number > MaxPageSize)
                        context.ActionArguments[name] = MaxPageSize;
                }
                else if (value != null && value is not string && !value.GetType().IsValueType)
                {
                    if (!GuardFilterDto(value))
                    {
                        context.Result = Invalid("pageNumber / pageSize");
                        return;
                    }
                }
            }
        }

        public void OnActionExecuted(ActionExecutedContext context) { }

        // 0 = "not sent" on a DTO (several have no default), so only negatives are refused
        private static bool GuardFilterDto(object dto)
        {
            var type = dto.GetType();

            var page = type.GetProperty("PageNumber");
            if (page?.PropertyType == typeof(int) && (int)page.GetValue(dto)! < 0)
                return false;

            var size = type.GetProperty("PageSize");
            if (size?.PropertyType == typeof(int))
            {
                var value = (int)size.GetValue(dto)!;
                if (value < 0) return false;
                if (value > MaxPageSize && size.CanWrite) size.SetValue(dto, MaxPageSize);
            }

            return true;
        }

        private static BadRequestObjectResult Invalid(string name)
            => new(new { success = false, message = $"{name} must be greater than zero" });
    }
}
