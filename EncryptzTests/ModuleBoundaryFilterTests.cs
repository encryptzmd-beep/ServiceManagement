using System.Reflection;
using System.Security.Claims;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace EncryptzTests
{
    public class ModuleBoundaryFilterTests
    {
        private static AuthorizationFilterContext Context(object[] metadata, params Claim[] claims)
        {
            var http = new DefaultHttpContext();
            if (claims.Length > 0)
                http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));

            var descriptor = new ActionDescriptor { EndpointMetadata = metadata.ToList() };
            return new AuthorizationFilterContext(
                new ActionContext(http, new RouteData(), descriptor), new List<IFilterMetadata>());
        }

        private static readonly object[] ServiceEndpoint = { new AppModuleAttribute("SERVICE") };

        [Fact]
        public void A_token_for_the_module_passes()
        {
            var context = Context(ServiceEndpoint,
                new Claim("TenantKey", "K"), new Claim("ModuleKey", "service"), new Claim(ClaimTypes.Role, "Technician"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Theory]
        [InlineData("")]
        [InlineData("SALES")]
        public void A_token_for_no_module_or_another_module_is_refused(string moduleKey)
        {
            var context = Context(ServiceEndpoint,
                new Claim("TenantKey", "K"), new Claim("ModuleKey", moduleKey), new Claim(ClaimTypes.Role, "Admin"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            var result = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        }

        [Fact]
        public void A_token_issued_before_modules_existed_passes()
        {
            var context = Context(ServiceEndpoint,
                new Claim("ProjectKey", "C001-P001"), new Claim(ClaimTypes.Role, "Technician"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Fact]
        public void Customers_and_anonymous_callers_are_not_checked_here()
        {
            var customer = Context(ServiceEndpoint, new Claim("TenantKey", "K"), new Claim(ClaimTypes.Role, "Customer"));
            new ModuleBoundaryFilter().OnAuthorization(customer);
            Assert.Null(customer.Result);

            var anonymous = Context(ServiceEndpoint);
            new ModuleBoundaryFilter().OnAuthorization(anonymous);
            Assert.Null(anonymous.Result);
        }

        [Fact]
        public void Endpoints_without_a_module_are_not_checked()
        {
            var context = Context(Array.Empty<object>(), new Claim("TenantKey", "K"), new Claim("ModuleKey", ""));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Fact]
        public void Every_business_controller_declares_its_module()
        {
            // JobsController is a personal application: it works without a company, on the
            // Personal DB, so it has no module of a company to declare (see MainIdentity).
            // JobPostingsController is the same application. CompanyJobsController is the first
            // page of Job Consultancy; it works on the Personal DB with the company-stage token
            // (no branch, no company database), so HiringAccess checks the subscription and the
            // access on every call instead of the module claim of a scoped token.
            var controlPlane = new[]
            {
                "AuthController", "CompanyController", "PlatformController", "WeatherForecastController",
                "JobsController", "JobPostingsController", "CompanyJobsController", "VerificationController", "ConsultancyController", "NotificationsController",
                "LoginAdsController"   // the sign-in page, before anyone has a company
            };

            var untagged = typeof(AuthController).Assembly.GetTypes()
                .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
                .Where(t => !controlPlane.Contains(t.Name))
                .Where(t => t.GetCustomAttribute<AppModuleAttribute>() == null)
                .Select(t => t.Name)
                .OrderBy(n => n)
                .ToList();

            Assert.Empty(untagged);
        }

        [Fact]
        public void A_token_with_neither_key_claim_is_refused_on_a_module_endpoint()
        {
            var context = Context(ServiceEndpoint, new Claim(ClaimTypes.Role, "Admin"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            var result = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        }

        [Fact]
        public void Endpoints_that_allow_anonymous_are_not_checked()
        {
            var context = Context(new object[] { new AppModuleAttribute("SERVICE"), new AllowAnonymousAttribute() },
                new Claim("TenantKey", "K"), new Claim("ModuleKey", ""), new Claim(ClaimTypes.Role, "Admin"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Fact]
        public void Every_module_controller_requires_a_login()
        {
            var open = typeof(AuthController).Assembly.GetTypes()
                .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
                .Where(t => t.GetCustomAttribute<AppModuleAttribute>() != null)
                .Where(t => t.GetCustomAttribute<AuthorizeAttribute>() == null)
                .Select(t => t.Name)
                .OrderBy(n => n)
                .ToList();

            Assert.Empty(open);
        }
    }
}
