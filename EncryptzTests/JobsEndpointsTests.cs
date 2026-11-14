using System.Reflection;
using System.Security.Claims;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class MainIdentityTests
    {
        private static ClaimsPrincipal Token(params (string Type, string Value)[] claims)
            => new(new ClaimsIdentity(claims.Select(c => new Claim(c.Type, c.Value)), "test"));

        [Theory]
        [InlineData("false")]
        [InlineData("true")]
        public void A_login_token_of_the_main_database_gives_its_user(string platformAdmin)
        {
            var user = Token((ClaimTypes.NameIdentifier, "11"), (ClaimTypes.Role, "Technician"), ("PlatformAdmin", platformAdmin));

            Assert.Equal(11, MainIdentity.UserId(user));
        }

        /// <summary>
        /// A customer-portal token is signed with the same key, but its user id is the id in
        /// one COMPANY database. Taken as a main user id it would open another person's data.
        /// </summary>
        [Fact]
        public void A_customer_portal_token_is_nobody_here()
        {
            var customer = Token((ClaimTypes.NameIdentifier, "11"), (ClaimTypes.Role, "Customer"), ("CustomerId", "4"), ("CompanyId", "2"));

            Assert.Equal(0, MainIdentity.UserId(customer));
        }

        [Fact]
        public void A_token_that_carries_a_customer_id_is_refused_whatever_else_it_carries()
        {
            var mixed = Token((ClaimTypes.NameIdentifier, "11"), ("PlatformAdmin", "false"), ("CustomerId", "4"));

            Assert.Equal(0, MainIdentity.UserId(mixed));
        }

        [Fact]
        public void The_customer_role_is_refused_also_without_a_customer_id()
        {
            var customer = Token((ClaimTypes.NameIdentifier, "11"), (ClaimTypes.Role, "Customer"), ("PlatformAdmin", "false"));

            Assert.Equal(0, MainIdentity.UserId(customer));
        }

        [Theory]
        [InlineData("")]
        [InlineData("0")]
        [InlineData("-3")]
        [InlineData("abc")]
        [InlineData("11; DROP")]
        public void An_id_that_is_not_a_positive_number_is_nobody(string id)
        {
            Assert.Equal(0, MainIdentity.UserId(Token((ClaimTypes.NameIdentifier, id), ("PlatformAdmin", "false"))));
        }

        [Fact]
        public void Nobody_logged_in_is_nobody()
        {
            Assert.Equal(0, MainIdentity.UserId(new ClaimsPrincipal(new ClaimsIdentity())));
            Assert.Equal(0, MainIdentity.UserId(null));
            // claims without an authenticated identity
            Assert.Equal(0, MainIdentity.UserId(new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"), new Claim("PlatformAdmin", "false")
            }))));
        }
    }

    public class JobsEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(JobsController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"JobsController.{name} does not exist");

        [Theory]
        [InlineData("GetProfile", "GET", "profile")]
        [InlineData("SaveProfile", "POST", "profile")]
        [InlineData("SetVisible", "POST", "profile/visible")]
        [InlineData("SaveExperience", "POST", "experience")]
        [InlineData("DeleteExperience", "DELETE", "experience/{id:int}")]
        [InlineData("SaveEducation", "POST", "education")]
        [InlineData("DeleteEducation", "DELETE", "education/{id:int}")]
        [InlineData("SaveSkill", "POST", "skills")]
        [InlineData("DeleteSkill", "DELETE", "skills/{id:int}")]
        [InlineData("SuggestSkills", "GET", "skills/suggest")]
        [InlineData("SaveCertificate", "POST", "certificates")]
        [InlineData("DeleteCertificate", "DELETE", "certificates/{id:int}")]
        [InlineData("SaveResume", "POST", "resume")]
        [InlineData("DeleteResume", "DELETE", "resume")]
        [InlineData("GetFile", "GET", "files/{id:int}")]
        public void The_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Fact]
        public void The_controller_is_under_api_jobs_and_needs_a_login_everywhere()
        {
            Assert.Equal("api/jobs", typeof(JobsController).GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(typeof(JobsController).GetCustomAttribute<AuthorizeAttribute>());

            foreach (var action in typeof(JobsController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void No_endpoint_takes_a_user_from_the_caller()
        {
            foreach (var action in typeof(JobsController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                foreach (var parameter in action.GetParameters())
                    Assert.False(parameter.Name!.Contains("user", StringComparison.OrdinalIgnoreCase),
                        $"{action.Name} takes '{parameter.Name}'");
        }

        [Theory]
        [InlineData(typeof(JobProfileDto))]
        [InlineData(typeof(JobExperienceDto))]
        [InlineData(typeof(JobEducationDto))]
        [InlineData(typeof(JobSkillDto))]
        [InlineData(typeof(JobCertificateDto))]
        [InlineData(typeof(JobFileInfoDto))]
        [InlineData(typeof(JobProfilePageDto))]
        [InlineData(typeof(SetJobVisibilityRequest))]
        [InlineData(typeof(JobCertificateForm))]
        public void No_dto_carries_a_user_id(Type dto)
        {
            Assert.DoesNotContain(dto.GetProperties(), p => p.Name.Contains("UserId", StringComparison.OrdinalIgnoreCase));
        }

        [Theory]
        [InlineData("SaveCertificate")]
        [InlineData("SaveResume")]
        public void An_upload_is_limited_in_size_before_it_is_read(string action)
        {
            var limit = Action(action).GetCustomAttribute<RequestSizeLimitAttribute>();

            Assert.NotNull(limit);
        }

        [Fact]
        public void Every_method_of_the_service_takes_the_user_first()
        {
            foreach (var method in typeof(IJobsService).GetMethods())
            {
                var first = method.GetParameters().FirstOrDefault();
                Assert.True(first != null && first.Name == "userId" && first.ParameterType == typeof(int),
                    $"IJobsService.{method.Name} must take 'int userId' first");
            }
        }

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        [Fact]
        public void The_service_is_registered()
        {
            var registration = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "SrvInjection", "ServiceRegistration.cs"));

            Assert.Contains("services.AddScoped<IJobsService, JobsService>();", registration);
        }

        [Fact]
        public void Every_endpoint_takes_the_user_from_the_main_identity_and_from_nowhere_else()
        {
            var source = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Controllers", "JobsController.cs"));

            Assert.Contains("MainIdentity.UserId(User)", source);
            // the raw claim would also accept a customer-portal token
            Assert.DoesNotContain("ClaimTypes.NameIdentifier", source);
        }

        /// <summary>
        /// Every public method of the service goes through the one guard that refuses an
        /// unknown user, answers "not available" without a Personal DB, and turns a database
        /// error into that same sentence.
        /// </summary>
        [Fact]
        public void Every_method_of_the_service_goes_through_the_guard()
        {
            var source = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzBL", "Infrastructure", "Jobs", "JobsService.cs"));

            foreach (var method in typeof(IJobsService).GetMethods())
            {
                var start = source.IndexOf(" " + method.Name + "(int userId", StringComparison.Ordinal);
                Assert.True(start >= 0, method.Name + " was not found in JobsService.cs");
                var next = source.IndexOf("\n        public ", start, StringComparison.Ordinal);
                var body = source.Substring(start, (next < 0 ? source.Length : next) - start);

                Assert.True(body.Contains("Guarded(userId,"), method.Name + " does not go through Guarded(userId, ...)");
            }

            Assert.Contains("PersonalDbHelper.NotAvailable", source);
            Assert.Contains("_personal.IsConfigured", source);
        }

        [Fact]
        public void A_download_is_an_attachment_that_the_browser_must_not_sniff()
        {
            var source = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Controllers", "JobsController.cs"));

            Assert.Contains("X-Content-Type-Options", source);
            Assert.Contains("nosniff", source);
            Assert.Contains("JobsRules.ContentTypeFor(", source);
        }
    }
}
