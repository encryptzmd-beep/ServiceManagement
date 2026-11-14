using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformApplicationEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetApplications", "GET", "applications")]
        [InlineData("SaveApplication", "POST", "applications/save")]
        public void The_application_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("GetApplications")]
        [InlineData("SaveApplication")]
        public void The_application_endpoints_need_a_login_and_the_platform_unlock(string action)
        {
            Assert.NotNull(typeof(PlatformController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void The_application_comes_from_the_body()
        {
            var dto = Action("SaveApplication").GetParameters().Single();

            Assert.Equal(typeof(ApplicationDto), dto.ParameterType);
            Assert.NotNull(dto.GetCustomAttribute<FromBodyAttribute>());
        }

        [Fact]
        public void A_company_module_row_is_released_unless_the_database_says_otherwise()
        {
            Assert.True(new CompanyModuleDto().IsReleased);
            Assert.Equal("", new CompanyModuleDto().Family);
        }
    }
}
