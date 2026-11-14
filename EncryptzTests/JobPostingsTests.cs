using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
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
    // ── what a company may write into a job ──────────────────────────────────

    public class JobPostingRulesTests
    {
        private static JobPostingDto Good() => new()
        {
            Title = "  Accountant ", City = " Kochi ", EmploymentType = "full-time", WorkMode = "hybrid",
            ExperienceMinYears = 1, ExperienceMaxYears = 3, SalaryMin = 20000, SalaryMax = 30000,
            Skills = " Tally, GST ", Description = "  Books of three branches. ", ClosesOn = new DateTime(2026, 12, 31, 15, 0, 0)
        };

        [Fact]
        public void A_good_posting_is_tidied_and_taken()
        {
            var p = Good();

            Assert.Null(JobPostingRules.PostingProblem(p));
            Assert.Equal("Accountant", p.Title);
            Assert.Equal("Kochi", p.City);
            Assert.Equal("Full-time", p.EmploymentType);
            Assert.Equal("Hybrid", p.WorkMode);
            Assert.Equal("Tally, GST", p.Skills);
            Assert.Equal(new DateTime(2026, 12, 31), p.ClosesOn);
        }

        [Fact]
        public void Everything_optional_can_be_left_out()
        {
            var p = Good();
            p.ExperienceMinYears = p.ExperienceMaxYears = p.SalaryMin = p.SalaryMax = null;
            p.Skills = null!;
            p.ClosesOn = null;

            Assert.Null(JobPostingRules.PostingProblem(p));
        }

        [Fact]
        public void Nothing_is_refused()
            => Assert.Equal("Nothing to save", JobPostingRules.PostingProblem(null));

        [Theory]
        [InlineData("", "Kochi", "d")]
        [InlineData("t", "  ", "d")]
        [InlineData("t", "Kochi", "")]
        public void Title_city_and_description_are_required(string title, string city, string description)
        {
            var p = Good();
            p.Title = title; p.City = city; p.Description = description;

            Assert.Equal("Enter the title, the city and the description of the job", JobPostingRules.PostingProblem(p));
        }

        [Fact]
        public void Lengths_are_limited()
        {
            var p = Good(); p.Title = new string('a', 201);
            Assert.Equal("The title is too long", JobPostingRules.PostingProblem(p));

            p = Good(); p.City = new string('a', 101);
            Assert.Equal("The city is too long", JobPostingRules.PostingProblem(p));

            p = Good(); p.Skills = new string('a', 401);
            Assert.Equal("The skills are too long", JobPostingRules.PostingProblem(p));

            p = Good(); p.Description = new string('a', 4001);
            Assert.Equal("The description is too long", JobPostingRules.PostingProblem(p));
        }

        [Fact]
        public void Type_and_mode_come_from_the_lists()
        {
            var p = Good(); p.EmploymentType = "Sometimes";
            Assert.Equal("Choose the type of employment", JobPostingRules.PostingProblem(p));

            p = Good(); p.WorkMode = "";
            Assert.Equal("Choose the working mode", JobPostingRules.PostingProblem(p));
        }

        [Theory]
        [InlineData(-1, 3, "Enter the experience in years, from 0 to 60")]
        [InlineData(1, 61, "Enter the experience in years, from 0 to 60")]
        [InlineData(5, 2, "The least experience cannot be more than the most")]
        public void The_experience_range_is_checked(int min, int max, string expected)
        {
            var p = Good(); p.ExperienceMinYears = min; p.ExperienceMaxYears = max;

            Assert.Equal(expected, JobPostingRules.PostingProblem(p));
        }

        [Theory]
        [InlineData(0, 30000, "Enter the salary per month as an amount, or leave it empty")]
        [InlineData(20000, -1, "Enter the salary per month as an amount, or leave it empty")]
        [InlineData(40000, 30000, "The lowest salary cannot be more than the highest")]
        public void The_salary_range_is_checked(int min, int max, string expected)
        {
            var p = Good(); p.SalaryMin = min; p.SalaryMax = max;

            Assert.Equal(expected, JobPostingRules.PostingProblem(p));
        }

        [Fact]
        public void A_note_is_trimmed_and_limited()
        {
            Assert.Equal("hello", JobPostingRules.Note("  hello "));
            Assert.Equal("", JobPostingRules.Note(null));
            Assert.Null(JobPostingRules.Note(new string('a', 1001)));
        }

        [Fact]
        public void Search_text_and_page_are_made_safe()
        {
            Assert.Equal(100, JobPostingRules.SearchText(new string('a', 300)).Length);
            Assert.Equal("", JobPostingRules.SearchText(null));
            Assert.Equal(1, JobPostingRules.Page(null));
            Assert.Equal(1, JobPostingRules.Page(0));
            Assert.Equal(1, JobPostingRules.Page(-3));
            Assert.Equal(4, JobPostingRules.Page(4));
        }

        [Fact]
        public void A_company_cannot_withdraw_for_a_person_and_a_posting_never_becomes_a_draft_again()
        {
            Assert.Null(JobPostingRules.InList(JobPostingRules.ApplicantStates, "Withdrawn"));
            Assert.Equal("Shortlisted", JobPostingRules.InList(JobPostingRules.ApplicantStates, " shortlisted "));
            Assert.Null(JobPostingRules.InList(JobPostingRules.PostingMoves, "Draft"));
            Assert.Equal("Open", JobPostingRules.InList(JobPostingRules.PostingMoves, "open"));
        }
    }

    // ── who may act for a company ────────────────────────────────────────────

    public class HiringAccessTests
    {
        private static CompanyResponseDto Member(string role = "Technician", string name = "Hamster A/C")
            => new() { CompanyId = 2, CompanyName = name, RoleInCompany = role };

        private static List<ModuleDto> Catalogue(string state)
            => new()
            {
                new ModuleDto { ModuleKey = "SERVICE", State = "Available" },
                new ModuleDto { ModuleKey = "JOBCONSULTANCY", State = state }
            };

        [Fact]
        public void A_member_who_may_open_Job_Consultancy_may_manage_the_jobs()
            => Assert.Null(HiringAccess.Refusal(Member(), Catalogue("Available")));

        [Theory]
        [InlineData("NotSubscribed", HiringAccess.NotSubscribed)]
        [InlineData("NoAccess", HiringAccess.NoAccess)]
        [InlineData("ComingSoon", HiringAccess.NotReleased)]
        [InlineData("Something new", HiringAccess.NotReleased)]
        public void Any_other_state_of_the_application_is_refused_with_its_reason(string state, string expected)
            => Assert.Equal(expected, HiringAccess.Refusal(Member("Admin"), Catalogue(state)));

        [Fact]
        public void Another_application_of_the_company_does_not_count()
        {
            var onlyService = new List<ModuleDto> { new() { ModuleKey = "SERVICE", State = "Available" } };

            Assert.Equal(HiringAccess.NotReleased, HiringAccess.Refusal(Member("Admin"), onlyService));
            Assert.Equal(HiringAccess.NotReleased, HiringAccess.Refusal(Member("Admin"), null));
        }

        [Fact]
        public void Somebody_who_is_not_a_member_is_refused_whatever_the_catalogue_says()
        {
            Assert.Equal(HiringAccess.NotMember, HiringAccess.Refusal(null, Catalogue("Available")));
            // a company without a name cannot publish
            Assert.Equal(HiringAccess.NotMember, HiringAccess.Refusal(Member(name: " "), Catalogue("Available")));
        }

        [Theory]
        [InlineData(2, true)]
        [InlineData(9, false)]    // not a member
        [InlineData(0, false)]    // no company chosen
        [InlineData(-2, false)]
        public void The_membership_is_the_row_of_that_company(int companyId, bool found)
        {
            var companies = new List<CompanyResponseDto> { Member(), new() { CompanyId = 3, CompanyName = "Felix", RoleInCompany = "Admin" } };

            Assert.Equal(found, HiringAccess.Membership(companies, companyId) != null);
            Assert.Null(HiringAccess.Membership(null, 2));
        }

        [Fact]
        public void Every_refusal_is_known_as_one_and_nothing_else_is()
        {
            foreach (var message in new[] { HiringAccess.NotMember, HiringAccess.NotReleased, HiringAccess.NotSubscribed, HiringAccess.NoAccess })
                Assert.True(HiringAccess.IsRefusal(message));

            Assert.False(HiringAccess.IsRefusal("Not found"));
            Assert.False(HiringAccess.IsRefusal(PersonalDbHelper.NotAvailable));
            Assert.False(HiringAccess.IsRefusal(null));
        }
    }

    // ── the services, as far as they go without a database ───────────────────

    public class JobPostingsGuardTests
    {
        private static JobsService Service()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            return new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);
        }

        [Fact]
        public async Task Nobody_is_refused_and_without_a_personal_database_it_is_not_available()
        {
            var jobs = Service();

            Assert.Equal("Please log in again", (await jobs.SearchPostings(0, null, null, null, null, 1)).Message);
            Assert.Equal("Please log in again", (await jobs.GetCompanyPostings(0, 2)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.Apply(11, 1, "")).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetCompanyPostings(11, 2)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetApplicantResume(11, 2, 1, 1)).Message);
        }

        [Fact]
        public void Every_method_takes_the_user_first_and_the_company_side_the_company_second()
        {
            foreach (var method in typeof(IJobPostingsService).GetMethods())
                Assert.Equal("userId", method.GetParameters()[0].Name);

            foreach (var method in typeof(ICompanyJobsService).GetMethods())
            {
                Assert.Equal("userId", method.GetParameters()[0].Name);
                Assert.Equal("companyId", method.GetParameters()[1].Name);
            }
        }

        private static string Source(params string[] path)
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            Assert.NotNull(folder);
            return File.ReadAllText(Path.Combine(new[] { folder!.FullName }.Concat(path).ToArray()));
        }

        /// <summary>No method of the company side reaches the database without the check of who may act for the company.</summary>
        [Fact]
        public void Every_company_method_goes_through_the_company_guard()
        {
            var source = Source("EncryptzBL", "Infrastructure", "Jobs", "JobsService.Company.cs");

            foreach (var method in typeof(ICompanyJobsService).GetMethods())
            {
                var start = source.IndexOf(" " + method.Name + "(int userId, int companyId", StringComparison.Ordinal);
                Assert.True(start >= 0, method.Name + " was not found");
                var next = source.IndexOf("\n        public ", start, StringComparison.Ordinal);
                var body = source.Substring(start, (next < 0 ? source.Length : next) - start);

                Assert.True(body.Contains("GuardedCompany(userId, companyId,"), method.Name + " does not go through GuardedCompany");
            }

            Assert.Contains("HiringAccess.Refusal(membership, modules)", source);
            Assert.Contains("_users.GetModules(userId, companyId)", source);
            Assert.Contains("_users.GetUserCompanies(userId)", source);
        }

        [Fact]
        public void Every_person_method_goes_through_the_guard()
        {
            var source = Source("EncryptzBL", "Infrastructure", "Jobs", "JobsService.Postings.cs");

            foreach (var method in typeof(IJobPostingsService).GetMethods())
            {
                var start = source.IndexOf(" " + method.Name + "(", StringComparison.Ordinal);
                Assert.True(start >= 0, method.Name + " was not found");
                var next = source.IndexOf("\n        public ", start, StringComparison.Ordinal);
                var body = source.Substring(start, (next < 0 ? source.Length : next) - start);

                Assert.True(body.Contains("Guarded(userId,"), method.Name + " does not go through Guarded");
            }
        }

        [Fact]
        public void An_applicant_is_shown_without_date_of_birth_certificate_files_and_preferences()
        {
            var source = Source("EncryptzBL", "Infrastructure", "Jobs", "JobsService.Company.cs");

            Assert.Contains("profile.Profile.DateOfBirth = null;", source);
            Assert.Contains("certificate.FileId = 0;", source);
            Assert.Contains("profile.Preferences = new JobPreferencesDto();", source);
        }

        [Fact]
        public void The_services_are_registered()
        {
            var registration = Source("EncryptzAPI", "SrvInjection", "ServiceRegistration.cs");

            Assert.Contains("services.AddScoped<IJobPostingsService, JobsService>();", registration);
            Assert.Contains("services.AddScoped<ICompanyJobsService, JobsService>();", registration);
        }
    }

    // ── the endpoints ────────────────────────────────────────────────────────

    public class JobPostingsEndpointsTests
    {
        [Theory]
        [InlineData(typeof(JobPostingsController), "Search", "GET", "postings")]
        [InlineData(typeof(JobPostingsController), "GetPosting", "GET", "postings/{id:int}")]
        [InlineData(typeof(JobPostingsController), "Apply", "POST", "postings/{id:int}/apply")]
        [InlineData(typeof(JobPostingsController), "Save", "POST", "postings/{id:int}/save")]
        [InlineData(typeof(JobPostingsController), "Unsave", "DELETE", "postings/{id:int}/save")]
        [InlineData(typeof(JobPostingsController), "GetApplications", "GET", "applications")]
        [InlineData(typeof(JobPostingsController), "Withdraw", "POST", "applications/{id:int}/withdraw")]
        [InlineData(typeof(JobPostingsController), "GetSaved", "GET", "saved")]
        [InlineData(typeof(CompanyJobsController), "GetPostings", "GET", "postings")]
        [InlineData(typeof(CompanyJobsController), "GetPosting", "GET", "postings/{id:int}")]
        [InlineData(typeof(CompanyJobsController), "SavePosting", "POST", "postings")]
        [InlineData(typeof(CompanyJobsController), "SetPostingStatus", "POST", "postings/{id:int}/status")]
        [InlineData(typeof(CompanyJobsController), "DeletePosting", "DELETE", "postings/{id:int}")]
        [InlineData(typeof(CompanyJobsController), "GetApplicants", "GET", "postings/{id:int}/applicants")]
        [InlineData(typeof(CompanyJobsController), "GetApplicant", "GET", "postings/{id:int}/applicants/{applicationId:int}")]
        [InlineData(typeof(CompanyJobsController), "GetApplicantResume", "GET", "postings/{id:int}/applicants/{applicationId:int}/resume")]
        [InlineData(typeof(CompanyJobsController), "SetApplicantStatus", "POST", "postings/{id:int}/applicants/{applicationId:int}/status")]
        [InlineData(typeof(CompanyJobsController), "GetDashboard", "GET", "dashboard")]
        [InlineData(typeof(CompanyJobsController), "SetApplicantInterview", "POST", "postings/{id:int}/applicants/{applicationId:int}/interview")]
        public void The_endpoints_exist_with_their_routes(Type controller, string action, string verb, string template)
        {
            var method = controller.GetMethod(action) ?? throw new Xunit.Sdk.XunitException($"{controller.Name}.{action} does not exist");
            var http = method.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData(typeof(JobPostingsController), "api/jobs")]
        [InlineData(typeof(CompanyJobsController), "api/company-jobs")]
        public void Both_controllers_need_a_login_everywhere(Type controller, string route)
        {
            Assert.Equal(route, controller.GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>());

            foreach (var action in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Theory]
        [InlineData(typeof(JobPostingsController))]
        [InlineData(typeof(CompanyJobsController))]
        public void No_endpoint_takes_a_user_or_a_company_from_the_caller(Type controller)
        {
            foreach (var action in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                foreach (var parameter in action.GetParameters())
                    Assert.False(Regex.IsMatch(parameter.Name!, "user|company", RegexOptions.IgnoreCase), $"{action.Name} takes '{parameter.Name}'");
        }

        [Theory]
        [InlineData(typeof(JobPostingDto))]
        [InlineData(typeof(CompanyPostingDto))]
        [InlineData(typeof(JobPostingViewDto))]
        [InlineData(typeof(JobPostingSearchResultDto))]
        [InlineData(typeof(JobApplicationDto))]
        [InlineData(typeof(JobApplyRequest))]
        [InlineData(typeof(JobApplicantDto))]
        [InlineData(typeof(JobApplicantPageDto))]
        [InlineData(typeof(SetJobStatusRequest))]
        public void No_dto_carries_a_user_id_or_a_company_id(Type dto)
        {
            Assert.DoesNotContain(dto.GetProperties(), p => Regex.IsMatch(p.Name, "UserId|CompanyId|PostedBy", RegexOptions.IgnoreCase));
        }

        private sealed class FakeCompanyJobs : ICompanyJobsService
        {
            public int User = -1, Company = -1;
            public bool Refuse;

            private Task<ApiResponse<T>> Seen<T>(int userId, int companyId, T data)
            {
                User = userId; Company = companyId;
                return Task.FromResult(Refuse ? ApiResponse<T>.Fail(HiringAccess.NotSubscribed) : ApiResponse<T>.Ok(data));
            }

            public Task<ApiResponse<List<CompanyPostingDto>>> GetCompanyPostings(int userId, int companyId) => Seen(userId, companyId, new List<CompanyPostingDto>());
            public Task<ApiResponse<CompanyPostingDto>> GetCompanyPosting(int userId, int companyId, int postingId) => Seen(userId, companyId, new CompanyPostingDto());
            public Task<ApiResponse<int>> SaveCompanyPosting(int userId, int companyId, JobPostingDto dto) => Seen(userId, companyId, 1);
            public Task<ApiResponse<bool>> SetCompanyPostingStatus(int userId, int companyId, int postingId, string? status) => Seen(userId, companyId, true);
            public Task<ApiResponse<bool>> DeleteCompanyPosting(int userId, int companyId, int postingId) => Seen(userId, companyId, true);
            public Task<ApiResponse<List<JobApplicantDto>>> GetApplicants(int userId, int companyId, int postingId) => Seen(userId, companyId, new List<JobApplicantDto>());
            public Task<ApiResponse<JobApplicantPageDto>> GetApplicant(int userId, int companyId, int postingId, int applicationId) => Seen(userId, companyId, new JobApplicantPageDto());
            public Task<ApiResponse<JobFileContent>> GetApplicantResume(int userId, int companyId, int postingId, int applicationId)
                => Seen(userId, companyId, new JobFileContent("cv.pdf", "application/pdf", new byte[] { 1, 2 }));
            public Task<ApiResponse<bool>> SetApplicantStatus(int userId, int companyId, int postingId, int applicationId, string? status, string? reason = null) => Seen(userId, companyId, true);
            public Task<ApiResponse<CompanyDashboardDto>> GetCompanyDashboard(int userId, int companyId) => Seen(userId, companyId, new CompanyDashboardDto());
            public Task<ApiResponse<bool>> SetApplicantInterview(int userId, int companyId, int postingId, int applicationId, JobInterviewRequest? req) => Seen(userId, companyId, true);
        }

        private static CompanyJobsController Controller(FakeCompanyJobs jobs, params Claim[] claims)
            => new(jobs)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) }
                }
            };

        private static Claim[] MainUser(int id, string? companyId)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, id.ToString()), new(ClaimTypes.Role, "Admin"), new("PlatformAdmin", "false")
            };
            if (companyId != null) claims.Add(new Claim("CompanyId", companyId));
            return claims.ToArray();
        }

        [Fact]
        public async Task The_company_and_the_user_come_from_the_token()
        {
            var jobs = new FakeCompanyJobs();

            Assert.IsType<OkObjectResult>(await Controller(jobs, MainUser(11, "2")).GetPostings());
            Assert.Equal(11, jobs.User);
            Assert.Equal(2, jobs.Company);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("abc")]
        [InlineData("-2")]
        public async Task A_token_without_a_usable_company_gives_company_zero(string? companyId)
        {
            var jobs = new FakeCompanyJobs();

            await Controller(jobs, MainUser(11, companyId)).GetPostings();

            Assert.Equal(0, jobs.Company);
        }

        [Fact]
        public async Task A_customer_portal_token_is_nobody()
        {
            var jobs = new FakeCompanyJobs();
            var customer = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"), new Claim(ClaimTypes.Role, "Customer"),
                new Claim("CustomerId", "5"), new Claim("CompanyId", "2")
            };

            await Controller(jobs, customer).GetPostings();

            Assert.Equal(0, jobs.User);
        }

        [Fact]
        public async Task A_refusal_is_answered_with_403_also_for_the_resume()
        {
            var jobs = new FakeCompanyJobs { Refuse = true };
            var controller = Controller(jobs, MainUser(11, "2"));

            Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(await controller.GetPostings()).StatusCode);
            Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(await controller.GetApplicantResume(1, 1)).StatusCode);
        }

        [Fact]
        public async Task The_resume_is_a_download_that_the_browser_must_not_sniff()
        {
            var controller = Controller(new FakeCompanyJobs(), MainUser(11, "2"));

            var file = Assert.IsType<FileContentResult>(await controller.GetApplicantResume(1, 1));

            Assert.Equal("cv.pdf", file.FileDownloadName);
            Assert.Equal("application/pdf", file.ContentType);
            Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"].ToString());
        }
    }

    // ── the script ───────────────────────────────────────────────────────────

    public class JobPostingsScriptTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "06_Jobs_Postings.sql"));
        }

        /// <summary>Name and body of every procedure of the script.</summary>
        private static List<(string Name, string Body)> Procedures()
            => Regex.Matches(Script, @"CREATE OR ALTER PROCEDURE jobs\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        [Fact]
        public void It_refuses_any_database_but_the_personal_one_and_names_no_database()
        {
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.Contains("SET NOEXEC ON", Script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Script);
            Assert.DoesNotContain("CREATE DATABASE", Script, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void It_has_the_tables_and_the_sixteen_procedures()
        {
            foreach (var table in new[] { "Postings", "Applications", "SavedPostings", "ProfileViews" })
                Assert.Contains($"CREATE TABLE jobs.{table}", Script);

            Assert.Equal(new[]
            {
                "sp_Application_Apply", "sp_Application_ListMine", "sp_Application_Withdraw",
                "sp_Company_Applicant_Get", "sp_Company_Applicant_List", "sp_Company_Applicant_Resume", "sp_Company_Applicant_SetStatus",
                "sp_Company_Posting_Delete", "sp_Company_Posting_Get", "sp_Company_Posting_List", "sp_Company_Posting_Save", "sp_Company_Posting_SetStatus",
                "sp_Posting_Get", "sp_Posting_Search", "sp_Saved_ListMine", "sp_Saved_Set"
            }, Procedures().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
        }

        [Fact]
        public void A_person_procedure_takes_the_user_first_and_a_company_procedure_the_company()
        {
            foreach (var (name, body) in Procedures())
            {
                var first = Regex.Match(body, @"@\w+").Value;
                Assert.Equal(name.StartsWith("sp_Company_") ? "@CompanyId" : "@UserId", first);
            }
        }

        /// <summary>The statements of a body that touch one of the tables (split at the semicolons).</summary>
        private static IEnumerable<string> Statements(string body, params string[] tables)
            => body.Split(';').Where(s => tables.Any(t => s.Contains("jobs." + t)));

        [Fact]
        public void Every_person_statement_on_applications_and_saved_postings_names_the_user()
        {
            foreach (var (name, body) in Procedures().Where(p => !p.Name.StartsWith("sp_Company_")))
                foreach (var statement in Statements(body, "Applications", "SavedPostings"))
                    Assert.True(statement.Contains("@UserId"), $"{name}: a statement does not name @UserId:\n{statement.Trim()}");
        }

        [Fact]
        public void Every_company_statement_on_postings_and_applications_names_the_company()
        {
            foreach (var (name, body) in Procedures().Where(p => p.Name.StartsWith("sp_Company_")))
                foreach (var statement in Statements(body, "Postings", "Applications", "SavedPostings"))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
        }

        [Theory]
        [InlineData("sp_Company_Applicant_List")]
        [InlineData("sp_Company_Applicant_Get")]
        [InlineData("sp_Company_Applicant_Resume")]
        [InlineData("sp_Company_Applicant_SetStatus")]
        public void A_withdrawn_applicant_is_out_of_reach_of_the_company(string procedure)
        {
            var body = Procedures().Single(p => p.Name == procedure).Body;

            foreach (var statement in Statements(body, "Applications"))
                Assert.Contains("a.Status <> 'Withdrawn'", statement);
        }

        [Fact]
        public void What_a_person_reads_of_a_posting_never_names_who_posted_it_or_a_draft()
        {
            foreach (var name in new[] { "sp_Posting_Search", "sp_Posting_Get", "sp_Saved_ListMine", "sp_Application_ListMine" })
            {
                var body = Procedures().Single(p => p.Name == name).Body;
                Assert.DoesNotContain("PostedBy", body);
                Assert.DoesNotContain("p.CompanyId", body);
            }

            Assert.Contains("p.Status = 'Open'", Procedures().Single(p => p.Name == "sp_Posting_Search").Body);
            Assert.Contains("p.Status <> 'Draft'", Procedures().Single(p => p.Name == "sp_Posting_Get").Body);
            Assert.Contains("p.Status <> 'Draft'", Procedures().Single(p => p.Name == "sp_Saved_ListMine").Body);
        }

        [Fact]
        public void A_look_at_an_applicant_is_written_down()
        {
            foreach (var name in new[] { "sp_Company_Applicant_Get", "sp_Company_Applicant_Resume" })
                Assert.Contains("INSERT INTO jobs.ProfileViews", Procedures().Single(p => p.Name == name).Body);
        }
    }
}
