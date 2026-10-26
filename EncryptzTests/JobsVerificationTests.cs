using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Verification of certificates and jobs by the platform administrator (script 09).</summary>
    public class JobsVerificationTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "09_Jobs_Verification.sql"));
        }

        private static string Body(string procedure)
            => Regex.Match(Script, $@"CREATE OR ALTER PROCEDURE jobs\.{procedure}(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        // ── the script ────────────────────────────────────────────────────────

        [Fact]
        public void The_script_needs_script_08_and_the_personal_database()
        {
            Assert.Contains("OBJECT_ID('jobs.Notifications') IS NULL", Script);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.Contains("SET NOEXEC ON", Script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Script);
        }

        [Fact]
        public void A_job_has_a_review_state_and_publishing_sends_it_there()
        {
            Assert.Contains("CHECK (Status IN ('Draft', 'InReview', 'Open', 'Closed'))", Script);

            var setStatus = Body("sp_Company_Posting_SetStatus");
            Assert.Contains("SET Status = CASE WHEN @Status = 'Open' THEN 'InReview' ELSE 'Closed' END", setStatus);
            Assert.Equal("@CompanyId", Regex.Match(setStatus, @"@\w+").Value);

            // a change of a job that people see is checked again
            Assert.Contains("Status = CASE WHEN Status IN ('Open', 'InReview') THEN 'InReview' ELSE Status END", Body("sp_Company_Posting_Save"));
        }

        [Fact]
        public void Every_company_statement_on_jobs_names_the_company()
        {
            foreach (var procedure in new[] { "sp_Company_Posting_List", "sp_Company_Posting_Get", "sp_Company_Posting_Save", "sp_Company_Posting_SetStatus" })
                foreach (var statement in Body(procedure).Split(';').Where(s => s.Contains("jobs.Postings") || s.Contains("jobs.Applications")))
                    Assert.True(statement.Contains("@CompanyId"), $"{procedure}: a statement does not name @CompanyId:\n{statement.Trim()}");
        }

        [Fact]
        public void A_person_statement_names_the_user_and_applying_needs_a_date_of_birth()
        {
            foreach (var procedure in new[] { "sp_Certificate_Save", "sp_Application_Apply" })
            {
                var body = Body(procedure);
                Assert.Equal("@UserId", Regex.Match(body, @"@\w+").Value);
                foreach (var statement in body.Split(';').Where(s => Regex.IsMatch(s, @"jobs\.(Certificates|Files|Applications|Profiles)\b")))
                    Assert.True(statement.Contains("@UserId"), $"{procedure}: a statement does not name @UserId:\n{statement.Trim()}");
            }

            Assert.Contains("DateOfBirth IS NOT NULL", Body("sp_Application_Apply"));
        }

        [Fact]
        public void A_changed_certificate_is_checked_again()
        {
            var save = Body("sp_Certificate_Save");

            Assert.Contains("THEN Status ELSE 'Uploaded' END", save);
            Assert.Contains("THEN VerifiedBy ELSE NULL END", save);
        }

        [Fact]
        public void A_decision_is_made_only_on_what_waits_and_a_refusal_needs_a_reason()
        {
            var certificate = Body("sp_Admin_Certificate_Decide");
            Assert.Contains("Status = 'Uploaded' AND FileId IS NOT NULL", certificate);
            Assert.Contains("ISNULL(@Verified, 0) = 0 AND @Note IS NULL", certificate);
            Assert.Contains("INSERT INTO jobs.Notifications", certificate);

            var posting = Body("sp_Admin_Posting_Decide");
            Assert.Contains("WHERE PostingId = @PostingId AND Status = 'InReview'", posting);
            Assert.Contains("ISNULL(@Approved, 0) = 0 AND @Note IS NULL", posting);
            Assert.Contains("@AdminName", posting);
        }

        [Fact]
        public void The_queue_shows_nobody_who_is_not_waiting_and_no_file_content()
        {
            var list = Body("sp_Admin_Verification_List");

            Assert.Contains("WHERE c.Status = 'Uploaded'", list);
            Assert.Contains("WHERE p.Status = 'InReview'", list);
            Assert.DoesNotContain("Content", list);
            Assert.DoesNotContain("UserId AS", list);
        }

        // ── the service and the endpoints ─────────────────────────────────────

        [Fact]
        public async Task Without_a_personal_database_nothing_can_be_verified()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetVerificationQueue(5)).Message);
            Assert.Equal("Please log in again", (await jobs.DecidePosting(0, 1, true, null, "A")).Message);
        }

        [Theory]
        [InlineData("GetQueue", "GET", null)]
        [InlineData("GetCertificateFile", "GET", "certificates/{id:int}/file")]
        [InlineData("DecideCertificate", "POST", "certificates/{id:int}")]
        [InlineData("DecidePosting", "POST", "postings/{id:int}")]
        [InlineData("GetPeople", "GET", "people")]
        [InlineData("DecidePerson", "POST", "people/{key:guid}")]
        public void The_endpoints_exist_behind_a_login_and_an_unlocked_screen(string action, string verb, string? template)
        {
            var http = typeof(VerificationController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.Equal("api/platform/verification", typeof(VerificationController).GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(typeof(VerificationController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(typeof(VerificationController).GetCustomAttribute<PlatformUnlockedAttribute>());
        }

        private sealed class FakeVerification : IVerificationService
        {
            public int Calls;
            public string LastAdmin = "";

            public Task<ApiResponse<VerificationQueueDto>> GetVerificationQueue(int userId) { Calls++; return Task.FromResult(ApiResponse<VerificationQueueDto>.Ok(new VerificationQueueDto())); }
            public Task<ApiResponse<JobFileContent>> GetCertificateFileForReview(int userId, int certificateId)
            { Calls++; return Task.FromResult(ApiResponse<JobFileContent>.Ok(new JobFileContent("c.pdf", "application/pdf", new byte[] { 1 }))); }
            public Task<ApiResponse<bool>> DecideCertificate(int userId, int certificateId, bool verified, string? note, string adminName)
            { Calls++; LastAdmin = adminName; return Task.FromResult(ApiResponse<bool>.Ok(true)); }
            public Task<ApiResponse<bool>> DecidePosting(int userId, int postingId, bool approved, string? note, string adminName)
            { Calls++; LastAdmin = adminName; return Task.FromResult(ApiResponse<bool>.Ok(true)); }
            public Task<ApiResponse<PersonReviewPageDto>> GetPeopleForReview(int userId, string? query, string? show, int? page)
            { Calls++; return Task.FromResult(ApiResponse<PersonReviewPageDto>.Ok(new PersonReviewPageDto())); }
            public Task<ApiResponse<bool>> DecidePerson(int userId, Guid candidateKey, bool verified, string? note, string adminName)
            { Calls++; LastAdmin = adminName; return Task.FromResult(ApiResponse<bool>.Ok(true)); }
        }

        private static VerificationController Controller(FakeVerification fake, bool platformAdmin)
            => new(fake)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, "5"), new Claim(ClaimTypes.Name, "Platform Person"),
                            new Claim("PlatformAdmin", platformAdmin ? "true" : "false"), new Claim("CompanyId", "2"), new Claim(ClaimTypes.Role, "Admin")
                        }, "test"))
                    }
                }
            };

        [Fact]
        public async Task A_company_administrator_who_is_not_a_platform_administrator_is_refused_everywhere()
        {
            var fake = new FakeVerification();
            var controller = Controller(fake, platformAdmin: false);

            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.GetQueue()).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.GetCertificateFile(1)).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.DecideCertificate(1, new VerificationDecisionRequest { Approve = true })).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.DecidePosting(1, new VerificationDecisionRequest { Approve = true })).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.GetPeople(null, null, null)).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.DecidePerson(Guid.NewGuid(), new VerificationDecisionRequest { Approve = true })).StatusCode);
            Assert.Equal(0, fake.Calls);
        }

        [Fact]
        public async Task A_platform_administrator_decides_under_their_own_name_and_a_file_is_not_sniffed()
        {
            var fake = new FakeVerification();
            var controller = Controller(fake, platformAdmin: true);

            Assert.IsType<OkObjectResult>(await controller.DecidePosting(1, new VerificationDecisionRequest { Approve = true }));
            Assert.Equal("Platform Person", fake.LastAdmin);

            var file = Assert.IsType<FileContentResult>(await controller.GetCertificateFile(1));
            Assert.Equal("c.pdf", file.FileDownloadName);
            Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"].ToString());
        }
    }
}
