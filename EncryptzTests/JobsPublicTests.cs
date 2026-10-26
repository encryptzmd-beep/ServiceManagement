using System.Reflection;
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
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The public job pages: search and read the open jobs without an account (script 17).</summary>
    public class JobsPublicTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] parts) => File.ReadAllText(Path.Combine(new[] { Root() }.Concat(parts).ToArray()));

        [Fact]
        public void The_sitemap_answers_open_jobs_only_and_no_company_or_description()
        {
            var script = Read("EncryptzAPI", "Database", "PersonalDB", "17_Jobs_Public_Sitemap.sql");
            var body = Regex.Match(script, @"CREATE OR ALTER PROCEDURE jobs\.sp_Public_Posting_Sitemap(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.Contains("p.Status = 'Open'", body);
            Assert.Contains("p.ClosesOn IS NULL OR p.ClosesOn >= @Today", body);
            Assert.DoesNotContain("CompanyId", body);
            Assert.DoesNotContain("Description", body);
        }

        [Fact]
        public void Similar_jobs_are_open_jobs_other_than_the_job_and_their_number_is_bounded()
        {
            var script = Read("EncryptzAPI", "Database", "PersonalDB", "18_Jobs_Public_Related.sql");
            var body = Regex.Match(script, @"CREATE OR ALTER PROCEDURE jobs.sp_Public_Posting_Related(.*?)
GO", RegexOptions.Singleline).Groups[1].Value;

            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.Contains("WHERE p.Status = 'Open'", body);
            Assert.Contains("p.PostingId <> ISNULL(@PostingId, 0)", body);
            Assert.Contains("WHEN @Count > 12 THEN 12", body);
            Assert.DoesNotContain("CompanyId", body);
            Assert.DoesNotContain("Applications", body);
        }

        // ── a shared profile (script 19) ──────────────────────────────────────

        private static string Body19(string procedure)
            => Regex.Match(Read("EncryptzAPI", "Database", "PersonalDB", "19_Jobs_Profile_Share.sql"),
                $@"CREATE OR ALTER PROCEDURE jobs.{procedure}(.*?)
GO", RegexOptions.Singleline).Groups[1].Value;

        [Fact]
        public void A_shared_profile_never_shows_contact_details_birth_date_files_or_preferences()
        {
            foreach (var procedure in new[] { "sp_Public_Profile_Get", "sp_Public_Profile_Photo" })
            {
                var body = Body19(procedure);
                foreach (var hidden in new[] { "ContactEmail", "ContactPhone", "DateOfBirth", "Preferences", "'Resume'", "'Certificate'", "UserId AS" })
                    Assert.DoesNotContain(hidden, body);
                Assert.Contains("ShareOn = 1", body);
            }

            Assert.DoesNotContain("Content", Body19("sp_Public_Profile_Get"));
        }

        [Fact]
        public void A_link_is_made_once_from_the_random_generator_and_needs_a_name()
        {
            var set = Body19("sp_Profile_Share_Set");

            Assert.Contains("CRYPT_GEN_RANDOM", set);
            Assert.Contains("FullName <> '' AND Headline <> ''", set);
            Assert.Contains("WHILE @Code IS NULL OR EXISTS", set);
        }

        [Theory]
        [InlineData("../../etc")]
        [InlineData("ABCDEFGHIJ1")]
        [InlineData("abc")]
        [InlineData("abcdefghi0")]
        [InlineData(null)]
        public async Task A_code_the_database_never_makes_is_not_looked_up(string? code)
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:PersonalConnection"] = "Server=nowhere;Database=x;Connect Timeout=1" }).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            // refused before any database is asked: "Not found", not "not available"
            Assert.Equal("Not found", (await jobs.GetPublicProfile(code)).Message);
        }

        [Fact]
        public async Task A_profile_link_that_is_off_is_a_404_never_kept_and_never_indexed()
        {
            var controller = new PublicProfilesController(new FakePublic()) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

            Assert.IsType<NotFoundObjectResult>(await controller.GetProfile("zzzzzzzzzz"));
            Assert.IsType<OkObjectResult>(await controller.GetProfile("abcdefghij"));
            Assert.Equal("no-store", controller.Response.Headers["Cache-Control"].ToString());
            Assert.Equal("noindex, nofollow", controller.Response.Headers["X-Robots-Tag"].ToString());
            Assert.NotNull(typeof(PublicProfilesController).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void Every_public_method_is_shielded_and_asks_as_nobody()
        {
            var source = Read("EncryptzBL", "Infrastructure", "Jobs", "JobsService.Public.cs");

            foreach (var method in typeof(IPublicJobsService).GetMethods())
            {
                var start = source.IndexOf(" " + method.Name + "(", StringComparison.Ordinal);
                Assert.True(start >= 0, method.Name + " was not found");
                var next = source.IndexOf("\n        public ", start, StringComparison.Ordinal);
                var body = source.Substring(start, (next < 0 ? source.Length : next) - start);

                Assert.True(body.Contains("Shielded(Nobody,"), method.Name + " does not go through Shielded(Nobody, ...)");
            }

            Assert.Contains("private const int Nobody = 0;", source);
            Assert.DoesNotContain("Told(", source);
        }

        [Fact]
        public async Task Without_a_personal_database_the_public_pages_are_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SearchPublicPostings(null, null, null, null, null)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetPublicPosting(1)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetPublicSitemap()).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetRelatedPublicPostings(1)).Message);
        }

        [Theory]
        [InlineData("Search", null)]
        [InlineData("GetPosting", "{id:int}")]
        [InlineData("GetRelated", "{id:int}/related")]
        [InlineData("GetSitemap", "sitemap")]
        public void The_endpoints_are_read_only_anonymous_and_rate_limited(string action, string? template)
        {
            var http = typeof(PublicJobsController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Equal(new[] { "GET" }, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.Equal("api/public/jobs", typeof(PublicJobsController).GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(typeof(PublicJobsController).GetCustomAttribute<AllowAnonymousAttribute>());
            Assert.Equal(RateLimitPolicies.PublicJobs, typeof(PublicJobsController).GetCustomAttribute<EnableRateLimitingAttribute>()!.PolicyName);
        }

        private sealed class FakePublic : IPublicJobsService
        {
            public Task<ApiResponse<JobPostingSearchResultDto>> SearchPublicPostings(string? query, string? city, string? employmentType, string? workMode, int? page)
                => Task.FromResult(ApiResponse<JobPostingSearchResultDto>.Ok(new JobPostingSearchResultDto()));
            public Task<ApiResponse<JobPostingViewDto>> GetPublicPosting(int postingId)
                => Task.FromResult(postingId == 1 ? ApiResponse<JobPostingViewDto>.Ok(new JobPostingViewDto { PostingId = 1 }) : ApiResponse<JobPostingViewDto>.Fail("Not found"));
            public Task<ApiResponse<List<JobPostingViewDto>>> GetRelatedPublicPostings(int postingId)
                => Task.FromResult(ApiResponse<List<JobPostingViewDto>>.Ok(new List<JobPostingViewDto>()));
            public Task<ApiResponse<List<PublicPostingLinkDto>>> GetPublicSitemap()
                => Task.FromResult(ApiResponse<List<PublicPostingLinkDto>>.Ok(new List<PublicPostingLinkDto>()));
            public Task<ApiResponse<PublicProfileDto>> GetPublicProfile(string? code)
                => Task.FromResult(code == "abcdefghij" ? ApiResponse<PublicProfileDto>.Ok(new PublicProfileDto { FullName = "Leema" }) : ApiResponse<PublicProfileDto>.Fail("Not found"));
            public Task<ApiResponse<JobFileContent>> GetPublicProfilePhoto(string? code)
                => Task.FromResult(ApiResponse<JobFileContent>.Fail("Not found"));
        }

        private static PublicJobsController Controller()
            => new(new FakePublic()) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        [Fact]
        public async Task A_job_that_is_not_open_is_a_404_so_search_engines_drop_it()
        {
            var controller = Controller();

            Assert.IsType<NotFoundObjectResult>(await controller.GetPosting(2));
            Assert.IsType<OkObjectResult>(await controller.GetPosting(1));
            Assert.Equal("public, max-age=300", controller.Response.Headers["Cache-Control"].ToString());
        }
    }
}
