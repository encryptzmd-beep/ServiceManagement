using System.Security.Claims;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The guard of JobsService, run for real (no database is reached in any of these).</summary>
    public class JobsServiceGuardTests
    {
        private static JobsService Service(string? connection)
        {
            var values = new Dictionary<string, string?>();
            if (connection != null) values["ConnectionStrings:PersonalConnection"] = connection;
            var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
            return new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);
        }

        [Fact]
        public async Task Without_a_personal_database_every_call_says_not_available()
        {
            var jobs = Service(null);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetPage(11)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SaveProfile(11, new JobProfileDto())).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SetVisible(11, true)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SaveResume(11, null)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetFile(11, 1)).Message);
            Assert.False((await jobs.GetPage(11)).Success);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-4)]
        public async Task Nobody_is_refused_before_anything_else(int userId)
        {
            var result = await Service(null).GetPage(userId);

            Assert.False(result.Success);
            Assert.Equal("Please log in again", result.Message);
        }

        /// <summary>
        /// A connection string that is set but wrong does not fail with a database error: the
        /// driver refuses it with another exception type. The caller must still get the one
        /// sentence, never an HTTP 500.
        /// </summary>
        [Fact]
        public async Task An_error_that_is_not_a_database_error_is_not_available_too()
        {
            var jobs = Service("this is not a connection string");

            var page = await jobs.GetPage(11);
            var save = await jobs.SaveSkill(11, new JobSkillDto { SkillName = "Tally", Level = "Expert" });

            Assert.False(page.Success);
            Assert.Equal(PersonalDbHelper.NotAvailable, page.Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, save.Message);
        }

        [Fact]
        public async Task A_rule_is_answered_before_the_database_is_tried()
        {
            // the connection would fail: the rule must answer first
            var result = await Service("this is not a connection string").SaveSkill(11, new JobSkillDto { SkillName = "", Level = "Expert" });

            Assert.Equal("Enter the skill", result.Message);
        }

        [Fact]
        public void Today_is_the_day_in_India_not_the_day_of_the_server()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs"))) folder = folder.Parent;
            var source = File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzBL", "Infrastructure", "Jobs", "JobsService.cs"));

            Assert.DoesNotContain("DateTime.Today", source);
            Assert.DoesNotContain("DateTime.Now", source);
            Assert.Contains("TimeHelper.IndianNow", source);
        }
    }

    /// <summary>The download endpoint, run for real against a service that answers from memory.</summary>
    public class JobsDownloadTests
    {
        private sealed class FakeJobs : IJobsService
        {
            public int AskedBy = -1, AskedFor = -1;
            public JobFileContent? File;

            public Task<ApiResponse<JobFileContent>> GetFile(int userId, int fileId)
            {
                AskedBy = userId;
                AskedFor = fileId;
                return Task.FromResult(File == null || userId <= 0
                    ? ApiResponse<JobFileContent>.Fail("Not found")
                    : ApiResponse<JobFileContent>.Ok(File));
            }

            public Task<ApiResponse<JobProfilePageDto>> GetPage(int userId) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> SaveProfile(int userId, JobProfileDto dto) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> SetVisible(int userId, bool isVisible) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SaveExperience(int userId, JobExperienceDto dto) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeleteExperience(int userId, int experienceId) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SaveEducation(int userId, JobEducationDto dto) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeleteEducation(int userId, int educationId) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SaveSkill(int userId, JobSkillDto dto) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeleteSkill(int userId, int skillId) => throw new NotSupportedException();
            public Task<ApiResponse<List<string>>> SuggestSkills(int userId, string? query) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SaveCertificate(int userId, JobCertificateDto dto, JobUpload? file) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeleteCertificate(int userId, int certificateId) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SaveResume(int userId, JobUpload? file) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeleteResume(int userId) => throw new NotSupportedException();
            public Task<ApiResponse<int>> SavePhoto(int userId, JobUpload? file) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> DeletePhoto(int userId) => throw new NotSupportedException();
            public Task<ApiResponse<JobFileContent>> GetPhoto(int userId) => throw new NotSupportedException();
        }

        private static ClaimsPrincipal MainUser(int id)
            => new(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, "Technician"), new Claim("PlatformAdmin", "false")
            }, "test"));

        private static ClaimsPrincipal Customer(int id)
            => new(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, "Customer"), new Claim("CustomerId", "4")
            }, "test"));

        private static (JobsController Controller, FakeJobs Jobs) Make(ClaimsPrincipal user, JobFileContent? file)
        {
            var jobs = new FakeJobs { File = file };
            var controller = new JobsController(jobs)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } }
            };
            return (controller, jobs);
        }

        [Fact]
        public async Task A_file_is_given_as_a_download_with_a_type_from_the_fixed_list()
        {
            var bytes = new byte[] { 1, 2, 3 };
            var (controller, jobs) = Make(MainUser(11), new JobFileContent("cv.pdf", "text/html", bytes));

            var result = Assert.IsType<FileContentResult>(await controller.GetFile(9));

            Assert.Equal("cv.pdf", result.FileDownloadName);            // a download name makes it an attachment
            Assert.Equal("application/pdf", result.ContentType);        // from the name, never what was stored or sent
            Assert.Equal(bytes, result.FileContents);
            Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"].ToString());
            Assert.Equal(11, jobs.AskedBy);
            Assert.Equal(9, jobs.AskedFor);
        }

        [Theory]
        [InlineData("page.html")]
        [InlineData("script.svg")]
        [InlineData("noextension")]
        public async Task A_file_of_any_other_name_is_never_given_a_type_the_browser_would_show(string name)
        {
            var (controller, _) = Make(MainUser(11), new JobFileContent(name, "text/html", new byte[] { 1 }));

            var result = Assert.IsType<FileContentResult>(await controller.GetFile(9));

            Assert.Equal("application/octet-stream", result.ContentType);
            Assert.False(string.IsNullOrEmpty(result.FileDownloadName));
        }

        [Fact]
        public async Task A_file_that_is_not_the_callers_is_not_found()
        {
            var (controller, _) = Make(MainUser(11), null);

            Assert.IsType<NotFoundObjectResult>(await controller.GetFile(9));
        }

        [Fact]
        public async Task A_customer_portal_token_reaches_the_service_as_nobody()
        {
            var (controller, jobs) = Make(Customer(11), new JobFileContent("cv.pdf", "application/pdf", new byte[] { 1 }));

            Assert.IsType<NotFoundObjectResult>(await controller.GetFile(9));
            Assert.Equal(0, jobs.AskedBy);
        }
    }

    /// <summary>Text checks on PersonalDB/03: the corrections to two procedures of script 02.</summary>
    public class JobsScript03Tests
    {
        private static string Script()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs"))) folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "03_Jobs_Profile_Corrections.sql")).Replace("\r\n", "\n");
        }

        private static string Code() => Regex.Replace(Regex.Replace(Script(), @"/\*.*?\*/", "", RegexOptions.Singleline), @"--[^\n]*", "");

        private static string Procedure(string name)
        {
            var m = Regex.Match(Code(), @"CREATE OR ALTER PROCEDURE jobs\." + name + @"(?<body>.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, name + " is not in script 03");
            return m.Groups["body"].Value;
        }

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_creates_or_drops(string forbidden)
        {
            Assert.DoesNotContain(forbidden, Code(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_script_runs_only_in_the_personal_database_after_script_02()
        {
            var script = Script();

            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.Contains("OBJECT_ID('jobs.Profiles') IS NULL", script);
            Assert.True(Regex.Matches(script, "SET NOEXEC ON").Count >= 2);
        }

        /// <summary>
        /// Check and switch in ONE statement: with two, a profile save that clears the headline
        /// in between would leave a profile without a headline visible.
        /// </summary>
        [Fact]
        public void Visibility_is_checked_and_switched_in_one_statement()
        {
            var body = Procedure("sp_Profile_SetVisible");

            Assert.Single(Regex.Matches(body, @"\bUPDATE\s+jobs\.Profiles\b"));
            Assert.Matches(@"WHERE\s+UserId\s*=\s*@UserId\s+AND\s*\(\s*@IsVisible\s*=\s*0\s+OR\s*\(\s*FullName\s*<>\s*''\s+AND\s+Headline\s*<>\s*''\s*\)\s*\)", body);
            Assert.DoesNotMatch(@"IF[^;]*EXISTS\s*\(\s*SELECT[^;]*FROM\s+jobs\.Profiles", body);
            Assert.Contains("Add your name and a headline before you switch this on", body);
        }

        /// <summary>A skill name is free text: one that only a single person typed is not shown to others.</summary>
        [Fact]
        public void A_skill_is_suggested_only_when_at_least_two_people_have_it()
        {
            var body = Procedure("sp_Skill_Suggest");

            Assert.Matches(@"GROUP\s+BY\s+s\.SkillName\s+HAVING\s+COUNT\s*\(\s*DISTINCT\s+s\.UserId\s*\)\s*>=\s*2", body);
            Assert.Matches(@"SELECT\s+TOP\s*\(\s*10\s*\)\s+s\.SkillName\s+FROM", body);
            Assert.DoesNotContain("EvidenceUrl", body);
        }
    }
}
