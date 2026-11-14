using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Suitable candidates for each job posting of Job Consultancy (script PersonalDB/24).</summary>
    public class PostingMatchesTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "24_Jobs_Posting_Matches.sql"));
        }

        private static string Part(string kind, string name)
            => Regex.Match(Script, $@"CREATE OR ALTER {kind} jobs\.{name}\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        private static string Fit => Part("FUNCTION", "fn_Posting_Fit");

        [Fact]
        public void Only_findable_people_who_did_not_apply_and_share_a_skill_or_a_title_word_are_suitable()
        {
            Assert.Contains("pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> ''", Fit);
            Assert.Contains("sk.SkillHits + tt.TitleHits >= 1", Fit);
            Assert.Contains("a.PostingId = job.PostingId AND a.UserId = pr.UserId AND a.Status <> 'Withdrawn'", Fit);
        }

        [Fact]
        public void Skills_title_words_city_mode_and_experience_are_compared_with_wildcards_taken_literally()
        {
            Assert.Contains("s.SkillName LIKE k.Pat", Fit);
            Assert.Contains("u.SubSkillName LIKE k.Pat", Fit);
            Assert.Contains("e.Title LIKE w.Pat", Fit);
            Assert.Contains("j.Kind = 'Job' AND j.Value LIKE w.Pat", Fit);
            Assert.Contains("w.Kind = 'WorkMode' AND w.Value = job.WorkMode", Fit);
            Assert.Contains("y.Months < (job.MaxYears + 1) * 12", Fit);
            Assert.Contains("REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.value)), '[', '[[]'), '%', '[%]'), '_', '[_]')", Fit);
            // short words of a title say nothing about a job
            Assert.Contains("'urgent'", Fit);
        }

        [Fact]
        public void A_company_sees_only_its_own_job_and_never_a_user_id()
        {
            var matches = Part("PROCEDURE", "sp_Posting_Matches");

            Assert.Contains("NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId)", matches);
            var columns = matches.Substring(matches.IndexOf("SELECT TOP (@Count)", StringComparison.Ordinal));
            columns = columns.Substring(0, columns.IndexOf("FROM jobs.fn_Posting_Fit", StringComparison.Ordinal));
            Assert.DoesNotMatch(@"pr\.UserId\s*,|UserId AS|f\.UserId\s*,", columns);
            Assert.Contains("pr.CandidateKey", columns);
            Assert.Contains("p.CompanyId = @CompanyId", Part("PROCEDURE", "sp_Posting_Match_Counts"));
        }

        [Fact]
        public void The_best_fit_comes_first()
        {
            var matches = Part("PROCEDURE", "sp_Posting_Matches");

            Assert.Contains("f.SkillHits * 3 + f.TitleHits * 3", matches);
            Assert.Contains("ORDER BY s.Score DESC", matches);
            Assert.Contains("AS AlreadyInvited", matches);
        }

        [Theory]
        [InlineData("GetPostingMatches", "postings/{id:int}/matches")]
        [InlineData("GetPostingMatchCounts", "postings/match-counts")]
        public void The_endpoints_are_reads_of_the_company(string action, string template)
        {
            var http = typeof(ConsultancyController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Equal(new[] { "GET" }, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }
    }
}
