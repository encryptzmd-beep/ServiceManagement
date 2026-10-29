using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>
    /// The scripts of the QA fix round of 28-Oct-2026: MainDB/26 (database state, BUG-028),
    /// PersonalDB/27 (a company's own people are not its candidates, BUG-022) and
    /// PersonalDB/28 (a month in two jobs counts once, GAP-014).
    /// </summary>
    public class QaFixScriptsTests
    {
        private static string Read(string folder, string file)
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, "EncryptzAPI", "Program.cs")))
                dir = dir.Parent;
            return File.ReadAllText(Path.Combine(dir!.FullName, "EncryptzAPI", "Database", folder, file)).Replace("\r\n", "\n");
        }

        private static string Part(string script, string kind, string name)
            => Regex.Match(script, $@"CREATE OR ALTER {kind} {Regex.Escape(name)}\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        private static readonly string Main26 = Read("MainDB", "26_Platform_Database_State.sql");
        private static readonly string Personal27 = Read("PersonalDB", "27_Jobs_Matches_Exclude_Members.sql");
        private static readonly string Personal28 = Read("PersonalDB", "28_Jobs_Experience_Overlaps_Once.sql");

        [Theory]
        [InlineData("USE ")]
        [InlineData("DROP TABLE")]
        [InlineData("DROP DATABASE")]
        [InlineData("CREATE TABLE dbo.")]
        public void The_scripts_change_no_table_and_never_switch_database(string forbidden)
        {
            Assert.DoesNotContain(forbidden, Main26);
            Assert.DoesNotContain(forbidden, Personal27);
            Assert.DoesNotContain(forbidden, Personal28);
        }

        [Fact]
        public void The_personal_scripts_refuse_a_database_that_is_not_the_personal_db()
        {
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Personal27);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Personal28);
        }

        [Fact]
        public void Companies_answer_their_database_state_and_servers_count_attached_databases_too()
        {
            var companies = Part(Main26, "PROCEDURE", "dbo.sp_Platform_GetCompanies");
            Assert.Contains("c.ProvisionStatus,", companies);
            Assert.Contains("AS DatabaseName", companies);

            var servers = Part(Main26, "PROCEDURE", "dbo.sp_Platform_GetDbServers");
            Assert.Contains("c.DbServerId IS NULL AND LTRIM(RTRIM(c.ServerName)) = LTRIM(RTRIM(s.ServerName))", servers);
            Assert.DoesNotContain("AdminPasswordEnc AS", servers);   // the password is never returned
        }

        [Fact]
        public void The_members_of_the_company_are_left_out_of_the_matches_and_their_counts()
        {
            var matches = Part(Personal27, "PROCEDURE", "jobs.sp_Posting_Matches");
            var counts = Part(Personal27, "PROCEDURE", "jobs.sp_Posting_Match_Counts");
            foreach (var body in new[] { matches, counts })
            {
                Assert.Contains("@ExcludeUserIds NVARCHAR(MAX) = NULL", body);
                Assert.Contains("TRY_CAST(x.value AS INT) = f.UserId", body);
            }
            // still only a job of the company
            Assert.Contains("PostingId = @PostingId AND CompanyId = @CompanyId", matches);
        }

        [Fact]
        public void Experience_months_are_merged_before_they_are_counted()
        {
            var months = Part(Personal28, "FUNCTION", "jobs.fn_Experience_Months");
            Assert.Contains("CASE WHEN e.EndMonth IS NULL OR e.EndMonth > @Today THEN @Today ELSE e.EndMonth END", months);
            Assert.Contains("FromMonth > DATEADD(MONTH, 1, ReachedBefore)", months);
            Assert.Contains("GROUP BY Period", months);

            // both users of the months take them from the function, none sums the entries any more
            Assert.Contains("OUTER APPLY jobs.fn_Experience_Months(pr.UserId, CAST(GETDATE() AS DATE)) x", Part(Personal28, "FUNCTION", "jobs.fn_Posting_Fit"));
            Assert.Contains("OUTER APPLY jobs.fn_Experience_Months(pr.UserId, @Today) x", Part(Personal28, "PROCEDURE", "jobs.sp_Candidate_Search"));
            Assert.DoesNotContain("SUM(DATEDIFF(MONTH, e.StartMonth", Personal28);
        }
    }
}
