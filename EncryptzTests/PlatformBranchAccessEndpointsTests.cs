using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformBranchAccessEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetBranchAccess", "GET")]
        [InlineData("SetBranchAccess", "POST")]
        public void The_branch_access_endpoints_exist_behind_the_platform_unlock(string action, string verb)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal("companies/{companyId}/branch-access", http.Template);
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
        }

        [Theory]
        [InlineData("GetBranchAccess")]
        [InlineData("SetBranchAccess")]
        public void The_company_comes_from_the_route(string action)
        {
            var companyId = Action(action).GetParameters().Single(p => p.Name == "companyId");

            Assert.Equal(typeof(int), companyId.ParameterType);
            Assert.Null(companyId.GetCustomAttribute<FromBodyAttribute>());
            Assert.Null(companyId.GetCustomAttribute<FromQueryAttribute>());
        }

        [Fact]
        public void The_request_names_no_company()
        {
            Assert.DoesNotContain(typeof(EncryptzBL.DTO_s.SetBranchAccessRequest).GetProperties(),
                p => p.Name.Contains("Company", StringComparison.OrdinalIgnoreCase));
        }
    }
}
