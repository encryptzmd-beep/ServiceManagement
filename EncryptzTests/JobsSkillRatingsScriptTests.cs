using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Text checks on PersonalDB/13: skill ratings and sub-skills.</summary>
    public class JobsSkillRatingsScriptTests
    {
        private static readonly string[] Tables = { "Profiles", "Experience", "Education", "Skills", "SubSkills", "Files", "Certificates" };

        private static string Script()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            if (folder == null)
                throw new Xunit.Sdk.XunitException("The repository root was not found");

            return File.ReadAllText(Path.Combine(folder.FullName, "EncryptzAPI", "Database", "PersonalDB", "13_Jobs_Skill_Ratings.sql"))
                       .Replace("\r\n", "\n");
        }

        private static List<(string Name, string Body)> Procedures()
        {
            var list = new List<(string, string)>();
            foreach (Match m in Regex.Matches(Script(), @"CREATE OR ALTER PROCEDURE jobs\.(?<name>\w+)(?<body>.*?)\nGO", RegexOptions.Singleline))
            {
                var body = Regex.Replace(m.Groups["body"].Value, @"/\*.*?\*/", "", RegexOptions.Singleline);
                list.Add((m.Groups["name"].Value, Regex.Replace(body, @"--[^\n]*", "")));
            }
            return list;
        }

        [Fact]
        public void The_script_runs_only_in_the_personal_database_and_drops_nothing()
        {
            var script = Script();

            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.DoesNotContain("DROP ", script, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("USE ", script, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Every_statement_on_a_table_is_limited_to_the_user()
        {
            var procedures = Procedures();
            Assert.Equal(new[] { "sp_Profile_Get", "sp_Skill_Save", "sp_Skill_Delete" }, procedures.Select(p => p.Name));

            foreach (var (name, body) in procedures)
            {
                Assert.Matches(@"^\s*@UserId\s+INT\b", body);
                foreach (var statement in body.Split(';'))
                {
                    if (!Tables.Any(t => Regex.IsMatch(statement, @"\bjobs\." + t + @"\b")))
                        continue;

                    Assert.True(statement.Contains("@UserId"),
                        $"{name}: a statement touches a jobs table without @UserId:\n{statement.Trim()}");
                }
            }
        }

        [Fact]
        public void Ratings_are_kept_between_1_and_5_and_a_skill_has_up_to_20_sub_skills()
        {
            var script = Script();

            Assert.Contains("CK_jobs_Skills_Rating CHECK (Rating BETWEEN 1 AND 5)", script);
            Assert.Contains("CK_jobs_SubSkills_Rating CHECK (Rating BETWEEN 1 AND 5)", script);
            Assert.Matches(@"SELECT\s+TOP\s*\(20\)", Procedures().Single(p => p.Name == "sp_Skill_Save").Body);
        }

        [Fact]
        public void The_sub_skills_stay_the_last_result_set_of_the_profile()
        {
            // the procedures of scripts 06, 10 and 11 EXEC sp_Profile_Get last: what they put
            // in front keeps its place
            var body = Procedures().Single(p => p.Name == "sp_Profile_Get").Body;
            var selects = Regex.Matches(body, @"\bSELECT\b").Count;

            Assert.Equal(7, selects);
            Assert.True(body.LastIndexOf("jobs.SubSkills", StringComparison.Ordinal) > body.LastIndexOf("jobs.Files", StringComparison.Ordinal));
        }
    }
}
