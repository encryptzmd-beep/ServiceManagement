using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Job Consultancy, the candidates a company adds itself (ProjectDB/12): private, no duplicates.</summary>
    public class OwnCandidatesTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static readonly string Script = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "12_Consultancy_Candidates.sql"));

        private static string Proc(string name)
            => Regex.Match(Script, $@"CREATE OR ALTER PROCEDURE consult\.{name}\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        // ── duplicates ───────────────────────────────────────────────────────

        [Theory]
        [InlineData("+91 98470 12345", "9847012345")]
        [InlineData("098470-12345", "9847012345")]
        [InlineData("98470 12345", "9847012345")]
        [InlineData("(0484) 2345678", "4842345678")]
        [InlineData("12345", "")]
        [InlineData("", "")]
        [InlineData(null, "")]
        public void A_phone_is_compared_by_its_last_ten_digits(string? phone, string key)
            => Assert.Equal(key, ConsultancyRules.PhoneKey(phone));

        [Fact]
        public void An_email_is_compared_trimmed_and_in_lower_case()
            => Assert.Equal("sruthi.das@example.com", ConsultancyRules.EmailKey("  Sruthi.Das@Example.COM "));

        [Fact]
        public void The_database_refuses_a_second_candidate_with_the_same_email_or_phone_in_a_company()
        {
            Assert.Contains("CREATE UNIQUE INDEX UQ_consult_Candidates_Email ON consult.Candidates(CompanyId, EmailKey) WHERE EmailKey <> ''", Script);
            Assert.Contains("CREATE UNIQUE INDEX UQ_consult_Candidates_Phone ON consult.Candidates(CompanyId, PhoneKey) WHERE PhoneKey <> ''", Script);

            var save = Proc("sp_OwnCandidate_Save");
            Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", save);
            Assert.Contains("c.CandidateId <> @CandidateId", save);
            Assert.Contains("'You already have this candidate: ' + @Same", save);
        }

        // ── what is typed ────────────────────────────────────────────────────

        [Fact]
        public void A_candidate_needs_a_name_and_an_email_or_a_phone()
        {
            Assert.Equal("Enter the name of the candidate", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { Email = "a@b.co" }));
            Assert.Equal("Enter an e-mail or a phone number", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { FullName = "Anu" }));
            Assert.Equal("Enter a valid e-mail address", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { FullName = "Anu", Email = "anu@" }));
            Assert.Equal("Enter a valid phone number", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { FullName = "Anu", Phone = "123" }));
            Assert.Equal("Experience is from 0 to 60 years", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { FullName = "Anu", Phone = "9847012345", ExperienceYears = 70 }));
            Assert.Equal("Choose where you met the candidate", ConsultancyRules.OwnCandidateProblem(new OwnCandidateDto { FullName = "Anu", Phone = "9847012345", Source = "Moon" }));
        }

        [Fact]
        public void What_is_typed_is_tidied()
        {
            var c = new OwnCandidateDto { FullName = "  Anu Thomas ", Phone = " 98470 12345 ", Skills = "Tally, , GST,tally ", Stage = "interview", ExperienceYears = 3.46m };

            Assert.Null(ConsultancyRules.OwnCandidateProblem(c));
            Assert.Equal("Anu Thomas", c.FullName);
            Assert.Equal("Tally, GST", c.Skills);
            Assert.Equal("Interview", c.Stage);
            Assert.Equal(3.5m, c.ExperienceYears);
        }

        // ── only the company ─────────────────────────────────────────────────

        [Theory]
        [InlineData("sp_OwnCandidate_List")]
        [InlineData("sp_OwnCandidate_Duplicates")]
        [InlineData("sp_OwnCandidate_Save")]
        [InlineData("sp_OwnCandidate_Delete")]
        [InlineData("sp_OwnCandidate_Resume_Save")]
        [InlineData("sp_OwnCandidate_Resume_Get")]
        public void Every_procedure_takes_the_company_first_and_names_it(string name)
        {
            var body = Proc(name);
            Assert.StartsWith("@CompanyId", body.Trim());
            Assert.Contains("CompanyId = @CompanyId", body);
        }

        [Fact]
        public void The_list_never_carries_the_resume_file()
            => Assert.DoesNotMatch(@"c\.Resume\s*,|c\.Resume AS", Proc("sp_OwnCandidate_List"));

        [Fact]
        public void The_script_goes_into_every_company_database_and_only_there()
        {
            Assert.Contains("is the Personal DB. Select a company database.", Script);
            Assert.Contains("Run 11_Consultancy.sql in this company database first.", Script);
            Assert.Contains(@"Database\ProjectDB\12_Consultancy_Candidates.sql", File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj")));
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("12_Consultancy_Candidates.sql", Script).Batches);
        }

        private static readonly string Search = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "13_Consultancy_Candidate_Search.sql"));

        [Fact]
        public void In_the_candidate_search_only_the_company_that_added_them_sees_them()
        {
            foreach (var name in new[] { "sp_OwnCandidate_Search", "sp_OwnCandidate_Get" })
            {
                var body = Regex.Match(Search, $@"CREATE OR ALTER PROCEDURE consult\.{name}\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;
                Assert.StartsWith("@CompanyId", body.Trim());
                Assert.Contains("c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0", body);
                Assert.DoesNotMatch(@"c\.Resume\s*,|c\.Resume AS", body);
            }
            Assert.Contains(@"Database\ProjectDB\13_Consultancy_Candidate_Search.sql", File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj")));
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("13_Consultancy_Candidate_Search.sql", Search).Batches);
        }

        [Fact]
        public void The_search_of_the_company_takes_the_words_and_filters_of_the_candidate_search()
        {
            Assert.Contains("CASE WHEN @MatchAll = 1 THEN @WordCount ELSE 1 END", Search);
            Assert.Contains("c.City LIKE l.Pat", Search);
            Assert.Contains("b.Band IN (SELECT Value FROM @BandList)", Search);
            Assert.Contains("c.Skills NOT LIKE k.Pat", Search);
            Assert.Contains("@WithResume = 0 OR c.Resume IS NOT NULL", Search);
        }

        [Fact]
        public void A_company_database_without_the_script_still_shows_the_people_of_Job_Portal()
        {
            var service = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Jobs", "JobsService.Consultancy.cs"));
            Assert.Contains("catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)", service.Substring(service.IndexOf("AddOwnCandidates(SqlDbHelper", StringComparison.Ordinal)));
        }

        [Theory]
        [InlineData("GetOne", "GET", "{id:int}")]
        [InlineData("GetAll", "GET", null)]
        [InlineData("GetDuplicates", "GET", "duplicates")]
        [InlineData("Save", "POST", null)]
        [InlineData("Delete", "DELETE", "{id:int}")]
        [InlineData("SaveResume", "POST", "{id:int}/resume")]
        [InlineData("DeleteResume", "DELETE", "{id:int}/resume")]
        [InlineData("GetResume", "GET", "{id:int}/resume")]
        public void The_endpoints_exist_behind_a_login(string action, string verb, string? template)
        {
            var http = typeof(OwnCandidatesController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.Equal("api/consultancy/own-candidates", typeof(OwnCandidatesController).GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.NotNull(typeof(OwnCandidatesController).GetCustomAttribute<AuthorizeAttribute>());
        }
    }
}
