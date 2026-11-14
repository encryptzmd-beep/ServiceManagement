using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace EncryptzTests
{
    public class TenantScopeExceptionFilterTests
    {
        private static ExceptionContext Context(Exception ex)
            => new(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
                   new List<IFilterMetadata>()) { Exception = ex };

        [Fact]
        public void Missing_scope_becomes_403_with_a_message()
        {
            var context = Context(new TenantScopeRequiredException());

            new TenantScopeExceptionFilter().OnException(context);

            var result = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
            Assert.True(context.ExceptionHandled);
            Assert.Contains(TenantScopeExceptionFilter.Message, System.Text.Json.JsonSerializer.Serialize(result.Value));
        }

        [Fact]
        public void Other_exceptions_are_left_alone()
        {
            var context = Context(new InvalidOperationException("boom"));

            new TenantScopeExceptionFilter().OnException(context);

            Assert.Null(context.Result);
            Assert.False(context.ExceptionHandled);
        }

        [Fact]
        public async Task The_tenant_executor_refuses_to_run_without_a_resolved_database()
        {
            var db = new DbHelper(new TenantContext());

            await Assert.ThrowsAsync<TenantScopeRequiredException>(
                () => db.ExecuteDataTableAsync("sp_Anything"));
        }
    }
}
