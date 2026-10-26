using System.Text.RegularExpressions;
using EncryptzBL.Common;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The Verified tick on jobs and people (script 16).</summary>
    public class JobsVerifiedBadgesTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "16_Jobs_Verified_Badges.sql"));
        }

        private static string Body(string procedure)
            => Regex.Match(Script, $@"CREATE OR ALTER PROCEDURE jobs\.{procedure}(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        [Fact]
        public void The_script_runs_only_in_the_personal_database_after_script_15()
        {
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.Contains("OBJECT_ID('jobs.SubSkills') IS NULL", Script);
            Assert.DoesNotContain("DROP TABLE", Script, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("CREATE TABLE", Script, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("sp_Profile_Get")]
        [InlineData("sp_Candidate_Search")]
        [InlineData("sp_Company_Applicant_List")]
        [InlineData("sp_Posting_Search")]
        [InlineData("sp_Posting_Get")]
        [InlineData("sp_Saved_ListMine")]
        [InlineData("sp_Company_Posting_List")]
        public void Every_list_and_page_answers_the_tick(string procedure)
            => Assert.Contains("AS IsVerified", Body(procedure));

        [Fact]
        public void Only_an_approval_verifies_a_job()
        {
            var decide = Body("sp_Admin_Posting_Decide");

            Assert.Contains("VerifiedAt  = CASE WHEN @Approved = 1 THEN GETDATE() ELSE VerifiedAt END", decide);
            Assert.Contains("WHERE PostingId = @PostingId AND Status = 'InReview'", decide);
        }

        [Fact]
        public void A_returned_or_waiting_job_shows_no_tick()
        {
            Assert.Contains("p.VerifiedAt IS NOT NULL AND p.Status IN ('Open', 'Closed')", Body("sp_Posting_Get"));
            Assert.Contains("p.VerifiedAt IS NOT NULL AND p.Status IN ('Open', 'Closed')", Body("sp_Company_Posting_List"));
        }

        [Fact]
        public void A_new_name_or_date_of_birth_takes_the_tick_away()
        {
            var save = Body("sp_Profile_Save");

            Assert.Contains("FullName COLLATE Latin1_General_BIN2 <> @FullName COLLATE Latin1_General_BIN2", save);
            Assert.Contains("ISNULL(DateOfBirth, '1900-01-01') <> ISNULL(@DateOfBirth, '1900-01-01')", save);
            Assert.Contains("THEN NULL ELSE VerifiedAt END", save);
        }

        [Fact]
        public void Taking_the_tick_away_needs_a_reason_and_the_person_is_told_by_key_only()
        {
            var decide = Body("sp_Admin_Person_Decide");

            Assert.Contains("IF @Verified = 0 AND @Note IS NULL", decide);
            Assert.Contains("WHERE CandidateKey = @CandidateKey", decide);
            Assert.Contains("'User' AS Audience", decide);
            Assert.DoesNotContain("UpdatedAt", decide.Split("SELECT CAST(1")[0].Split("UPDATE jobs.Profiles")[1]);
        }

        [Fact]
        public void The_people_list_names_nobody_by_user_id_and_holds_no_file()
        {
            var list = Body("sp_Admin_Person_List");

            Assert.Contains("pr.CandidateKey", list);
            Assert.DoesNotContain("pr.UserId,", list);
            Assert.DoesNotContain("Content", list);
            Assert.Contains("pr.FullName <> '' AND pr.Headline <> ''", list);
        }

        [Fact]
        public async Task Without_a_personal_database_or_a_login_nobody_is_verified()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetPeopleForReview(5, null, null, null)).Message);
            Assert.Equal("Please log in again", (await jobs.DecidePerson(0, Guid.NewGuid(), true, null, "A")).Message);
        }
    }
}
