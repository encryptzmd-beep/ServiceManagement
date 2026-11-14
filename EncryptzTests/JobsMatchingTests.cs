using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Jobs that match the person's preferences, and who looked at the person's profile (script 07).</summary>
    public class JobsMatchingTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "07_Jobs_Matching_And_Views.sql"));
        }

        private static List<(string Name, string Body)> Procedures()
            => Regex.Matches(Script, @"CREATE OR ALTER PROCEDURE jobs\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        [Fact]
        public void The_script_needs_scripts_05_and_06_and_the_personal_database()
        {
            Assert.Contains("OBJECT_ID('jobs.Preferences') IS NULL", Script);
            Assert.Contains("OBJECT_ID('jobs.Postings') IS NULL", Script);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.Contains("SET NOEXEC ON", Script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Script);
            Assert.DoesNotContain("CREATE TABLE", Script);
        }

        [Fact]
        public void It_has_the_two_procedures_and_both_take_the_user_first()
        {
            Assert.Equal(new[] { "sp_Posting_Search", "sp_ProfileView_ListMine" }, Procedures().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));

            foreach (var (_, body) in Procedures())
                Assert.Equal("@UserId", Regex.Match(body, @"@\w+").Value);
        }

        [Fact]
        public void Every_statement_on_the_tables_of_a_person_names_the_user()
        {
            foreach (var (name, body) in Procedures())
                foreach (var table in new[] { "Applications", "SavedPostings", "Preferences", "ProfileViews" })
                    foreach (Match m in Regex.Matches(body, $@"jobs\.{table}\s+(\w+)"))
                        Assert.True(body.Contains($"{m.Groups[1].Value}.UserId = @UserId"), $"{name}: jobs.{table} {m.Groups[1].Value} is not limited to the user");
        }

        [Fact]
        public void The_search_still_shows_open_jobs_only_and_scores_each_one()
        {
            var body = Procedures().Single(p => p.Name == "sp_Posting_Search").Body;

            Assert.Contains("p.Status = 'Open'", body);
            Assert.Contains("p.ClosesOn >= @Today", body);
            Assert.Contains("AS MatchScore", body);
            Assert.Contains("@Sort", body);
            Assert.DoesNotContain("PostedBy", body);
            // a preference is text the person typed: its wildcards are taken literally too
            Assert.Equal(3, Regex.Matches(body, @"REPLACE\(REPLACE\(REPLACE\([jl]\.Value").Count);
        }

        [Fact]
        public void The_list_of_views_names_the_company_and_the_job_never_the_user_who_looked()
        {
            var body = Procedures().Single(p => p.Name == "sp_ProfileView_ListMine").Body;

            Assert.Contains("p.CompanyName", body);
            Assert.Contains("v.UserId = @UserId", body);
            Assert.DoesNotContain("ViewerUserId", body);
        }

        [Theory]
        [InlineData(null, "match")]
        [InlineData("", "match")]
        [InlineData("match", "match")]
        [InlineData("NEWEST", "newest")]
        [InlineData("anything", "match")]
        public void The_order_is_best_match_unless_newest_is_asked_for(string? sort, string expected)
            => Assert.Equal(expected, JobPostingRules.Sort(sort));

        [Fact]
        public async Task Without_a_personal_database_the_views_are_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetProfileViews(11)).Message);
            Assert.Equal("Please log in again", (await jobs.GetProfileViews(0)).Message);
        }

        [Fact]
        public void The_views_have_their_endpoint_and_the_search_takes_the_order()
        {
            var http = typeof(JobPostingsController).GetMethod("GetProfileViews")!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();
            Assert.Contains("GET", http.HttpMethods);
            Assert.Equal("profile-views", http.Template);

            Assert.Contains(typeof(JobPostingsController).GetMethod("Search")!.GetParameters(), p => p.Name == "sort");
            Assert.DoesNotContain(typeof(JobProfileViewDto).GetProperties(), p => p.Name.Contains("UserId", StringComparison.OrdinalIgnoreCase));
        }
    }
}
