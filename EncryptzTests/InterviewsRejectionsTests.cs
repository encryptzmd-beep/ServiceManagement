using System.Text.RegularExpressions;
using EncryptzBL.Common.Jobs;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Interviews, the reason of a rejection and the dashboards (script PersonalDB/26).</summary>
    public class InterviewsRejectionsTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "26_Jobs_Interviews_Rejections.sql"));
        }

        private static string Body(string procedure)
            => Regex.Match(Script, @"CREATE OR ALTER PROCEDURE jobs\." + procedure + @"\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("Not a fit")]
        [InlineData("   short reason here    ")]
        public void A_rejection_without_a_real_reason_is_refused(string? reason)
            => Assert.Equal("Say why the application is rejected (20 characters at least)", JobPostingRules.RejectReasonProblem(reason));

        [Fact]
        public void A_reason_of_twenty_characters_or_more_is_taken_and_a_very_long_one_is_not()
        {
            Assert.Null(JobPostingRules.RejectReasonProblem("Needs 3 years of Tally"));
            Assert.Null(JobPostingRules.RejectReasonProblem(new string('a', 1000)));
            Assert.Equal("The reason is too long (1000 characters at most)", JobPostingRules.RejectReasonProblem(new string('a', 1001)));
        }

        [Fact]
        public void The_database_also_refuses_a_rejection_without_a_reason_and_keeps_every_rejection_with_the_skills()
        {
            var set = Body("sp_Company_Applicant_SetStatus");

            Assert.Contains("IF @Status = 'Rejected' AND LEN(@Reason) < 20", set);
            Assert.Contains("RejectReason = CASE WHEN @Status = 'Rejected' THEN @Reason ELSE '' END", set);
            Assert.Contains("INSERT INTO jobs.Rejections (ApplicationId, PostingId, CompanyId, UserId, CompanyName, JobTitle, Skills, Reason)", set);
            Assert.Contains("@Skills = p.Skills", set);
            // only the company's own applications
            Assert.Contains("p.CompanyId = @CompanyId", set);
        }

        [Fact]
        public void The_person_reads_the_reason_and_sees_the_interview()
        {
            var mine = Body("sp_Application_ListMine");
            Assert.Contains("a.InterviewAt, a.InterviewMode, a.InterviewPlace, a.InterviewNote, a.RejectReason", mine);
            Assert.Contains("WHERE a.UserId = @UserId", mine);
            Assert.Contains("' · ' + LEFT(@Reason, 300)", Body("sp_Company_Applicant_SetStatus"));
        }

        [Fact]
        public void An_interview_is_set_only_for_an_open_application_of_the_company_and_the_person_is_told()
        {
            var interview = Body("sp_Company_Applicant_Interview");

            Assert.Contains("p.CompanyId = @CompanyId", interview);
            Assert.Contains("IF @At IS NOT NULL AND @Status NOT IN ('Applied', 'Shortlisted')", interview);
            Assert.Contains("@At < GETDATE() OR @At > DATEADD(YEAR, 1, GETDATE())", interview);
            Assert.Contains("Status         = CASE WHEN @At IS NOT NULL AND Status = 'Applied' THEN 'Shortlisted' ELSE Status END", interview);
            Assert.Contains("'Interview' AS Kind", interview);
        }

        [Fact]
        public void The_company_dashboard_reads_only_the_company_and_the_admin_list_names_no_user()
        {
            var board = Body("sp_Company_Dashboard");
            Assert.Equal(3, Regex.Matches(board, @"p\.CompanyId = @CompanyId").Count);

            var admin = Body("sp_Admin_Rejection_List");
            Assert.Contains("r.CompanyName, r.JobTitle, r.Skills, r.Reason", admin);
            Assert.DoesNotContain("r.UserId,", admin);
            Assert.Contains("OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY", admin);
        }
    }
}
