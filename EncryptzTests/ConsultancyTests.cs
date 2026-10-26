using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
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
    // ── what a consultancy may write ─────────────────────────────────────────

    public class ConsultancyRulesTests
    {
        [Fact]
        public void A_client_is_tidied_and_needs_a_name()
        {
            var c = new ConsultClientDto { Name = "  Acme Ltd ", Email = " a@acme.in ", Phone = " +91 98470 12345 " };
            Assert.Null(ConsultancyRules.ClientProblem(c));
            Assert.Equal("Acme Ltd", c.Name);
            Assert.Equal("a@acme.in", c.Email);

            Assert.Equal("Enter the name of the client", ConsultancyRules.ClientProblem(new ConsultClientDto { Name = " " }));
            Assert.Equal("Enter a valid e-mail address", ConsultancyRules.ClientProblem(new ConsultClientDto { Name = "A", Email = "no" }));
            Assert.Equal("Enter a valid phone number", ConsultancyRules.ClientProblem(new ConsultClientDto { Name = "A", Phone = "call me" }));
            Assert.Equal("Nothing to save", ConsultancyRules.ClientProblem(null));
        }

        [Theory]
        [InlineData(null, "New")]
        [InlineData("", "New")]
        [InlineData(" interview ", "Interview")]
        [InlineData("notsuitable", "NotSuitable")]
        [InlineData("Hired", null)]
        public void A_stage_comes_from_the_list(string? stage, string? expected)
            => Assert.Equal(expected, ConsultancyRules.Stage(stage));

        [Fact]
        public void A_note_and_a_message_are_limited()
        {
            Assert.Equal("The note can have at most 1000 characters", ConsultancyRules.TalentProblem(new TalentSaveRequest { Note = new string('a', 1001) }));
            Assert.Equal("Choose the stage from the list", ConsultancyRules.TalentProblem(new TalentSaveRequest { Stage = "Gone" }));
            Assert.Equal("Choose one of your open jobs", ConsultancyRules.InviteProblem(new CandidateInviteRequest()));
            Assert.Equal("The message can have at most 500 characters", ConsultancyRules.InviteProblem(new CandidateInviteRequest { PostingId = 1, Message = new string('a', 501) }));
        }

        private static PlacementSaveRequest Placement() => new()
        {
            CandidateName = " Leo Joseph ", JobTitle = " Accountant ", JoinDate = new DateTime(2026, 11, 1, 10, 0, 0),
            AnnualCtc = 450000, FeeAmount = 40000, FeeStatus = "invoiced", GuaranteeUntil = new DateTime(2027, 2, 1)
        };

        [Fact]
        public void A_good_placement_is_tidied()
        {
            var p = Placement();

            Assert.Null(ConsultancyRules.PlacementProblem(p));
            Assert.Equal("Leo Joseph", p.CandidateName);
            Assert.Equal("Invoiced", p.FeeStatus);
            Assert.Equal(new DateTime(2026, 11, 1), p.JoinDate);
        }

        [Fact]
        public void A_placement_names_its_candidate_by_key_application_or_name()
        {
            var p = Placement(); p.CandidateName = "";
            Assert.Equal("Enter the candidate, the job and the joining date", ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.CandidateName = ""; p.CandidateKey = Guid.NewGuid();
            Assert.Null(ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.CandidateName = ""; p.ApplicationId = 31;
            Assert.Null(ConsultancyRules.PlacementProblem(p));
        }

        [Fact]
        public void Amounts_states_and_dates_are_checked()
        {
            var p = Placement(); p.AnnualCtc = 0;
            Assert.Equal("Enter the CTC per year as an amount, or leave it empty", ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.FeeAmount = -1;
            Assert.Equal("Enter the fee as an amount, or leave it empty", ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.FeeStatus = "Owed";
            Assert.Equal("Choose the state of the fee from the list", ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.GuaranteeUntil = new DateTime(2026, 10, 1);
            Assert.Equal("The replacement guarantee cannot end before the joining date", ConsultancyRules.PlacementProblem(p));

            p = Placement(); p.JoinDate = default;
            Assert.Equal("Enter the candidate, the job and the joining date", ConsultancyRules.PlacementProblem(p));
        }
    }

    // ── the service, the endpoints, the script ───────────────────────────────

    public class ConsultancyEndpointsTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        [Fact]
        public async Task Nobody_is_refused_and_without_a_personal_database_it_is_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal("Please log in again", (await jobs.GetClients(0, 2)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SearchCandidates(11, 2, new CandidateSearchRequest { Page = 1 })).Message);
        }

        [Fact]
        public void Every_method_takes_the_user_and_the_company_and_goes_through_the_company_guard()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Jobs", "JobsService.Consultancy.cs"));

            foreach (var method in typeof(IConsultancyService).GetMethods())
            {
                Assert.Equal("userId", method.GetParameters()[0].Name);
                Assert.Equal("companyId", method.GetParameters()[1].Name);

                // the interface is declared in the same file: look in the class only
                var classStart = source.IndexOf("public sealed partial class JobsService", StringComparison.Ordinal);
                var head = source.IndexOf(" " + method.Name + "(int userId, int companyId", classStart, StringComparison.Ordinal);
                Assert.True(head >= 0, method.Name + " was not found");
                var next = source.IndexOf("\n        public ", head, StringComparison.Ordinal);
                var body = source.Substring(head, (next < 0 ? source.Length : next) - head);
                Assert.True(body.Contains("GuardedTenant(userId, companyId,") || body.Contains("GuardedCompany(userId, companyId,"),
                    method.Name + " does not go through GuardedTenant or GuardedCompany");
            }
        }

        [Fact]
        public void A_candidate_is_shown_without_date_of_birth_certificate_files_and_expected_pay()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Jobs", "JobsService.Consultancy.cs"));

            Assert.Contains("page.Profile.Profile.DateOfBirth = null;", source);
            Assert.Contains("certificate.FileId = 0;", source);
            Assert.Contains("page.Profile.Preferences = new JobPreferencesDto();", source);
        }

        [Fact]
        public void The_controller_needs_a_login_takes_nothing_of_who_is_asking_and_is_registered()
        {
            Assert.Equal("api/consultancy", typeof(ConsultancyController).GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(typeof(ConsultancyController).GetCustomAttribute<AuthorizeAttribute>());

            foreach (var action in typeof(ConsultancyController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>());
                foreach (var parameter in action.GetParameters())
                    Assert.False(Regex.IsMatch(parameter.Name!, "user|company", RegexOptions.IgnoreCase), $"{action.Name} takes '{parameter.Name}'");
            }

            foreach (var dto in new[] { typeof(ConsultClientDto), typeof(CandidateDto), typeof(CandidatePageDto), typeof(PlacementDto), typeof(PlacementSaveRequest), typeof(PostingClientDto) })
                Assert.DoesNotContain(dto.GetProperties(), p => Regex.IsMatch(p.Name, "UserId|CompanyId|Ctc$", RegexOptions.IgnoreCase) && p.DeclaringType != typeof(PlacementDto));

            var registration = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "SrvInjection", "ServiceRegistration.cs"));
            Assert.Contains("services.AddScoped<IConsultancyService, JobsService>();", registration);
        }

        [Theory]
        [InlineData("GetClients", "GET", "clients")]
        [InlineData("SaveClient", "POST", "clients")]
        [InlineData("DeleteClient", "DELETE", "clients/{id:int}")]
        [InlineData("GetPostingClients", "GET", "posting-clients")]
        [InlineData("SetPostingClient", "POST", "postings/{id:int}/client")]
        [InlineData("SearchCandidates", "GET", "candidates")]
        [InlineData("GetCandidate", "GET", "candidates/{key:guid}")]
        [InlineData("GetCandidateResume", "GET", "candidates/{key:guid}/resume")]
        [InlineData("SaveTalent", "POST", "candidates/{key:guid}/pool")]
        [InlineData("RemoveTalent", "DELETE", "candidates/{key:guid}/pool")]
        [InlineData("InviteCandidate", "POST", "candidates/{key:guid}/invite")]
        [InlineData("GetPlacements", "GET", "placements")]
        [InlineData("SavePlacement", "POST", "placements")]
        [InlineData("DeletePlacement", "DELETE", "placements/{id:int}")]
        public void The_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = typeof(ConsultancyController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        private static string Read(params string[] path) => File.ReadAllText(Path.Combine(new[] { Root(), "EncryptzAPI", "Database" }.Concat(path).ToArray()));

        /// <summary>Name and body of every procedure of a script.</summary>
        private static List<(string Name, string Body)> Procedures(string script)
            => Regex.Matches(script, @"CREATE OR ALTER PROCEDURE (consult|jobs)\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[2].Value, m.Groups[3].Value)).ToList();

        private static string CompanyScript() => Read("ProjectDB", "11_Consultancy.sql");
        private static string PersonalScript() => Read("PersonalDB", "11_Consultancy_Leaves.sql");

        [Fact]
        public void What_the_company_keeps_is_in_the_company_database_and_every_statement_names_the_company()
        {
            var script = CompanyScript();
            foreach (var table in new[] { "Clients", "PostingClients", "Talent", "Placements" })
                Assert.Contains($"CREATE TABLE consult.{table}", script);
            Assert.Contains("is the Personal DB. Select a company database", script);
            Assert.Contains("is the SaaS main database", script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), script);
            // a person is named by the key of the profile, never by a user id
            Assert.Contains("CandidateKey UNIQUEIDENTIFIER NOT NULL", script);
            Assert.DoesNotMatch(new Regex(@"^\s+UserId\s+INT", RegexOptions.Multiline), script);

            foreach (var (name, body) in Procedures(script))
            {
                Assert.Equal("@CompanyId", Regex.Match(body, @"@\w+").Value);
                foreach (var statement in body.Split(';').Where(s => Regex.IsMatch(s, @"consult\.(Clients|PostingClients|Talent|Placements)\b")))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
            }
        }

        [Fact]
        public void New_company_databases_get_the_script_with_the_API()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains("Database\\ProjectDB\\11_Consultancy.sql", project);
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("11_Consultancy.sql", CompanyScript()).Batches);
        }

        [Fact]
        public void The_personal_database_keeps_nothing_of_Job_Consultancy_and_throws_away_nothing_a_company_wrote()
        {
            var script = PersonalScript();

            Assert.Contains("Move them to the company databases first. Nothing was changed.", script);
            Assert.Contains("DROP SCHEMA consult", script);
            Assert.Contains("ALTER TABLE jobs.Postings DROP COLUMN ClientId", script);
            Assert.Contains("INSERT INTO jobs.CandidateInvitations", script);
            Assert.DoesNotContain("CREATE OR ALTER PROCEDURE consult.", script);
        }

        [Fact]
        public void Every_read_of_a_person_by_a_company_needs_the_profile_to_be_findable()
        {
            var procedures = Procedures(PersonalScript());
            foreach (var name in new[] { "sp_Candidate_Search", "sp_Candidate_Find", "sp_Candidate_Get", "sp_Candidate_Resume", "sp_Candidate_Invite" })
            {
                var body = procedures.Single(p => p.Name == name).Body;
                Assert.Equal("@CompanyId", Regex.Match(body, @"@\w+").Value);
                foreach (var statement in body.Split(';').Where(s => s.Contains("jobs.Profiles")))
                    Assert.True(statement.Contains("IsVisible = 1"), $"{name}: a read of jobs.Profiles without IsVisible = 1:\n{statement.Trim()}");
            }

            // an applicant of the company's own job is reached through that job, not through the switch
            var applicant = procedures.Single(p => p.Name == "sp_Company_Applicant_Identity").Body;
            Assert.Contains("p.CompanyId = @CompanyId", applicant);
            Assert.Contains("a.Status <> 'Withdrawn'", applicant);
        }

        [Fact]
        public void A_company_never_receives_a_user_id_or_what_a_person_expects_to_earn()
        {
            foreach (var (_, body) in Procedures(PersonalScript()))
            {
                Assert.DoesNotContain("PreferenceTerms", body);
                Assert.DoesNotContain("AS UserId", body);
                // a user id is only ever written down (a look, or a notification for the person), never handed back
                foreach (var statement in body.Split(';').Where(s => Regex.IsMatch(s, @"\bpr\.UserId\s*,")))
                    Assert.Matches(@"INSERT INTO jobs\.(ProfileViews|Notifications)", statement);
            }
        }

        [Fact]
        public void A_company_database_without_the_script_is_told_plainly()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Jobs", "JobsService.Consultancy.cs"));

            Assert.Contains("catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)", source);
            Assert.Contains("_users!.GetApplicationDatabase(userId, companyId, HiringAccess.ModuleKey)", source);
        }

        private sealed class FakeConsultancy : IConsultancyService
        {
            public int User = -1, Company = -1;
            public bool Refuse;
            private Task<ApiResponse<T>> Seen<T>(int userId, int companyId, T data)
            {
                User = userId; Company = companyId;
                return Task.FromResult(Refuse ? ApiResponse<T>.Fail(HiringAccess.NotSubscribed) : ApiResponse<T>.Ok(data));
            }

            public Task<ApiResponse<List<ConsultClientDto>>> GetClients(int userId, int companyId) => Seen(userId, companyId, new List<ConsultClientDto>());
            public Task<ApiResponse<int>> SaveClient(int userId, int companyId, ConsultClientDto dto) => Seen(userId, companyId, 1);
            public Task<ApiResponse<bool>> DeleteClient(int userId, int companyId, int clientId) => Seen(userId, companyId, true);
            public Task<ApiResponse<List<PostingClientDto>>> GetPostingClients(int userId, int companyId) => Seen(userId, companyId, new List<PostingClientDto>());
            public Task<ApiResponse<bool>> SetPostingClient(int userId, int companyId, int postingId, int? clientId) => Seen(userId, companyId, true);
            public Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, CandidateSearchRequest req) => Seen(userId, companyId, new CandidateSearchResultDto());
            public Task<ApiResponse<CandidatePageDto>> GetCandidate(int userId, int companyId, Guid candidateKey) => Seen(userId, companyId, new CandidatePageDto());
            public Task<ApiResponse<JobFileContent>> GetCandidateResume(int userId, int companyId, Guid candidateKey) => Seen(userId, companyId, new JobFileContent("cv.pdf", "application/pdf", new byte[] { 1 }));
            public Task<ApiResponse<bool>> SaveTalent(int userId, int companyId, Guid candidateKey, TalentSaveRequest req) => Seen(userId, companyId, true);
            public Task<ApiResponse<bool>> RemoveTalent(int userId, int companyId, Guid candidateKey) => Seen(userId, companyId, true);
            public Task<ApiResponse<bool>> InviteCandidate(int userId, int companyId, Guid candidateKey, CandidateInviteRequest req) => Seen(userId, companyId, true);
            public Task<ApiResponse<PlacementListDto>> GetPlacements(int userId, int companyId) => Seen(userId, companyId, new PlacementListDto());
            public Task<ApiResponse<int>> SavePlacement(int userId, int companyId, PlacementSaveRequest req) => Seen(userId, companyId, 1);
            public Task<ApiResponse<bool>> DeletePlacement(int userId, int companyId, int placementId) => Seen(userId, companyId, true);
        }

        private static ConsultancyController Controller(FakeConsultancy fake)
            => new(fake)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, "11"), new Claim("PlatformAdmin", "false"), new Claim("CompanyId", "2"), new Claim(ClaimTypes.Role, "Admin")
                        }, "test"))
                    }
                }
            };

        [Fact]
        public async Task The_user_and_the_company_come_from_the_token_and_a_refusal_is_403()
        {
            var fake = new FakeConsultancy();
            Assert.IsType<OkObjectResult>(await Controller(fake).GetClients());
            Assert.Equal(11, fake.User);
            Assert.Equal(2, fake.Company);

            fake.Refuse = true;
            Assert.Equal(403, Assert.IsType<ObjectResult>(await Controller(fake).GetPlacements()).StatusCode);
            Assert.Equal(403, Assert.IsType<ObjectResult>(await Controller(fake).GetCandidateResume(Guid.NewGuid())).StatusCode);
        }
    }
}
