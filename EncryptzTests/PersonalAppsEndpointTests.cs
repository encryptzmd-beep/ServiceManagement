using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PersonalAppsEndpointTests
    {
        private static MethodInfo Action()
            => typeof(AuthController).GetMethod("GetPersonalApps")
               ?? throw new Xunit.Sdk.XunitException("AuthController.GetPersonalApps does not exist");

        [Fact]
        public void The_endpoint_is_a_GET_on_personal_apps()
        {
            var http = Action().GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains("GET", http.HttpMethods);
            Assert.Equal("personal-apps", http.Template);
        }

        [Fact]
        public void It_needs_a_login_and_no_role()
        {
            var authorize = Action().GetCustomAttribute<AuthorizeAttribute>();

            Assert.NotNull(authorize);
            Assert.Null(authorize!.Roles);
            Assert.Null(Action().GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void It_takes_nothing_from_the_caller()
        {
            // nothing personal is returned: no user id, no company id
            Assert.Empty(Action().GetParameters());
        }

        [Fact]
        public void The_service_lists_personal_applications_without_a_user_or_company()
        {
            var method = typeof(IAuthService).GetMethod("GetPersonalApps");

            Assert.NotNull(method);
            Assert.Empty(method!.GetParameters());
            Assert.Equal(typeof(Task<ApiResponse<List<PersonalAppDto>>>), method.ReturnType);
        }

        [Fact]
        public void A_personal_application_is_not_released_until_the_database_says_so()
        {
            Assert.False(new PersonalAppDto().IsReleased);
            Assert.Equal("", new PersonalAppDto().RoutePath);
        }
    }
}
