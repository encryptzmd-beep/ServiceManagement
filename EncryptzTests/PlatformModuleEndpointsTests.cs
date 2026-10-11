using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformModuleEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetCompanyModules", "GET", "companies/{companyId}/modules")]
        [InlineData("SetCompanyModule", "POST", "companies/{companyId}/modules")]
        [InlineData("GetModuleAccess", "GET", "companies/{companyId}/modules/{moduleKey}/access")]
        [InlineData("SetModuleAccess", "POST", "companies/{companyId}/modules/{moduleKey}/access")]
        public void The_module_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("GetCompanyModules")]
        [InlineData("SetCompanyModule")]
        [InlineData("GetModuleAccess")]
        [InlineData("SetModuleAccess")]
        public void The_module_endpoints_need_a_login_and_the_platform_unlock(string action)
        {
            Assert.NotNull(typeof(PlatformController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Theory]
        [InlineData("GetCompanyModules")]
        [InlineData("SetCompanyModule")]
        [InlineData("GetModuleAccess")]
        [InlineData("SetModuleAccess")]
        public void The_company_comes_from_the_route(string action)
        {
            var companyId = Action(action).GetParameters().Single(p => p.Name == "companyId");

            Assert.Equal(typeof(int), companyId.ParameterType);
            Assert.Null(companyId.GetCustomAttribute<FromBodyAttribute>());
            Assert.Null(companyId.GetCustomAttribute<FromQueryAttribute>());
        }
    }
}
