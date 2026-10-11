using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Provisioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace EncryptzTests
{
    public class CompanyCreationEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(AuthController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"AuthController.{name} does not exist");

        [Theory]
        [InlineData("CreateCompany", "POST", "create-company")]
        [InlineData("RetryProvision", "POST", "companies/{companyId}/retry-provision")]
        [InlineData("GetCompanyCreation", "GET", "company-creation")]
        public void The_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("CreateCompany")]
        [InlineData("RetryProvision")]
        [InlineData("GetCompanyCreation")]
        public void They_need_a_login_but_no_particular_role(string action)
        {
            var authorize = Action(action).GetCustomAttribute<AuthorizeAttribute>();

            Assert.NotNull(authorize);
            Assert.True(string.IsNullOrEmpty(authorize!.Roles));
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Theory]
        [InlineData("CreateCompany")]
        [InlineData("RetryProvision")]
        public void Creating_and_retrying_are_rate_limited(string action)
        {
            var limit = Action(action).GetCustomAttribute<EnableRateLimitingAttribute>();

            Assert.NotNull(limit);
            Assert.Equal(RateLimitPolicies.CompanyCreation, limit!.PolicyName);
        }

        [Fact]
        public void The_old_company_route_is_rate_limited_and_needs_a_login()
        {
            var action = typeof(CompanyController).GetMethod("CreateCompany")!;

            Assert.NotNull(action.GetCustomAttribute<AuthorizeAttribute>());
            Assert.Equal(RateLimitPolicies.CompanyCreation, action.GetCustomAttribute<EnableRateLimitingAttribute>()!.PolicyName);
        }

        [Fact]
        public void The_user_is_never_taken_from_the_request()
        {
            foreach (var action in new[] { "CreateCompany", "RetryProvision", "GetCompanyCreation" })
                Assert.DoesNotContain(Action(action).GetParameters(), p => p.Name!.Contains("user", StringComparison.OrdinalIgnoreCase));

            Assert.DoesNotContain(typeof(EncryptzBL.DTO_s.CreateCompanyRequest).GetProperties(),
                p => p.Name.Contains("User", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("CreatedBy", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void The_disabled_stub_is_gone()
        {
            Assert.Null(typeof(EncryptzBL.Infrastructure.User.Modules.IAuthService).GetMethod("CreateCompany"));
        }

        [Fact]
        public void Without_a_server_nobody_can_create_a_company()
        {
            Assert.Equal("Company creation is not available right now",
                CompanyCreateRules.CreationBlockedReason(false, false, 0, 1, false));
            Assert.Equal("Company creation is not available right now",
                CompanyCreateRules.CreationBlockedReason(false, false, 0, 1, true));
        }

        [Fact]
        public void A_pending_retry_blocks_a_normal_user_before_the_limit()
        {
            Assert.Equal("Your earlier company is waiting for a retry",
                CompanyCreateRules.CreationBlockedReason(true, true, 5, 1, false));
        }

        [Fact]
        public void The_limit_blocks_a_normal_user()
        {
            Assert.Equal("You can create 1 company. You have reached the limit.",
                CompanyCreateRules.CreationBlockedReason(true, false, 1, 1, false));
            Assert.Null(CompanyCreateRules.CreationBlockedReason(true, false, 0, 1, false));
        }

        [Fact]
        public void A_platform_administrator_with_a_server_is_never_blocked()
        {
            Assert.Null(CompanyCreateRules.CreationBlockedReason(true, true, 9, 1, true));
            Assert.Null(CompanyCreateRules.CreationBlockedReason(true, false, 9, 0, true));
        }
    }
}
