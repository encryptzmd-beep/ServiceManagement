using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Text checks on the Job Portal script of the Personal DB.</summary>
    public class JobsScriptTests
    {
        private static readonly string[] Tables = { "Profiles", "Experience", "Education", "Skills", "Files", "Certificates" };

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Script()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "PersonalDB", "02_Jobs_Profile.sql"))
                   .Replace("\r\n", "\n");

        private static string WithoutComments(string sql)
        {
            sql = Regex.Replace(sql, @"/\*.*?\*/", "", RegexOptions.Singleline);
            return Regex.Replace(sql, @"--[^\n]*", "");
        }

        /// <summary>Name and text (comments removed) of every procedure of the script.</summary>
        private static List<(string Name, string Body)> Procedures()
        {
            var script = Script();
            var list = new List<(string, string)>();
            foreach (Match m in Regex.Matches(script, @"CREATE OR ALTER PROCEDURE jobs\.(?<name>\w+)(?<body>.*?)\nGO", RegexOptions.Singleline))
                list.Add((m.Groups["name"].Value, WithoutComments(m.Groups["body"].Value)));
            return list;
        }

        public static IEnumerable<object[]> ProcedureNames() => Procedures().Select(p => new object[] { p.Name });

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_creates_or_drops_a_database_or_a_table(string forbidden)
        {
            Assert.DoesNotContain(forbidden, WithoutComments(Script()), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_script_runs_only_in_a_database_marked_as_the_personal_one()
        {
            var script = Script();

            Assert.Contains("OBJECT_ID('dbo.SchemaInfo') IS NULL", script);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.True(Regex.Matches(script, "SET NOEXEC ON").Count >= 2, "both guards must stop the script");
        }

        [Fact]
        public void The_marker_is_read_in_a_batch_of_its_own()
        {
            // a batch that reads a table that is not there fails as a whole and would NOT set
            // NOEXEC: the existence check must come in an earlier batch
            var batches = Script().Split("\nGO");
            var marker = batches.Single(b => b.Contains("FROM dbo.SchemaInfo"));

            Assert.DoesNotContain("OBJECT_ID('dbo.SchemaInfo')", marker);
        }

        [Theory]
        [InlineData("sp_Profile_Get")]
        [InlineData("sp_Profile_Save")]
        [InlineData("sp_Profile_SetVisible")]
        [InlineData("sp_Experience_Save")]
        [InlineData("sp_Experience_Delete")]
        [InlineData("sp_Education_Save")]
        [InlineData("sp_Education_Delete")]
        [InlineData("sp_Skill_Save")]
        [InlineData("sp_Skill_Delete")]
        [InlineData("sp_Skill_Suggest")]
        [InlineData("sp_Certificate_Save")]
        [InlineData("sp_Certificate_Delete")]
        [InlineData("sp_Resume_Save")]
        [InlineData("sp_Resume_Delete")]
        [InlineData("sp_File_Get")]
        public void Every_procedure_of_the_plan_is_there(string name)
        {
            Assert.Contains(Procedures(), p => p.Name == name);
        }

        [Theory]
        [MemberData(nameof(ProcedureNames))]
        public void Every_procedure_takes_the_user_first(string name)
        {
            var body = Procedures().Single(p => p.Name == name).Body;

            Assert.Matches(@"^\s*@UserId\s+INT\b", body);
        }

        /// <summary>
        /// The rule that keeps one person's rows from another: inside a procedure, every
        /// statement that touches a table of the schema names @UserId. (The suggestions are
        /// the one exception: skill names of everybody, and nothing else.)
        /// </summary>
        [Theory]
        [MemberData(nameof(ProcedureNames))]
        public void Every_statement_on_a_table_is_limited_to_the_user(string name)
        {
            if (name == "sp_Skill_Suggest") return;

            var body = Procedures().Single(p => p.Name == name).Body;
            foreach (var statement in body.Split(';'))
            {
                if (!Tables.Any(t => Regex.IsMatch(statement, @"\bjobs\." + t + @"\b")))
                    continue;

                Assert.True(statement.Contains("@UserId"),
                    $"{name}: a statement touches a jobs table without @UserId:\n{statement.Trim()}");
            }
        }

        [Fact]
        public void The_suggestions_return_names_only()
        {
            var body = Procedures().Single(p => p.Name == "sp_Skill_Suggest").Body;

            Assert.Matches(@"SELECT\s+DISTINCT\s+TOP\s*\(?10\)?\s+s\.SkillName\s+FROM", body);
            Assert.DoesNotContain("s.UserId,", body);
            Assert.DoesNotContain("EvidenceUrl", body);
        }

        [Theory]
        [InlineData("sp_Experience_Save", 30)]
        [InlineData("sp_Education_Save", 20)]
        [InlineData("sp_Skill_Save", 50)]
        [InlineData("sp_Certificate_Save", 30)]
        public void The_limits_per_user_are_checked_in_the_database(string procedure, int limit)
        {
            Assert.Matches(@">=\s*" + limit + @"\b", Procedures().Single(p => p.Name == procedure).Body);
        }

        [Fact]
        public void A_profile_without_name_or_headline_is_never_visible()
        {
            Assert.Contains("Add your name and a headline before you switch this on",
                Procedures().Single(p => p.Name == "sp_Profile_SetVisible").Body);

            // saving the profile without them switches visibility off
            Assert.Matches(@"IsVisible\s*=\s*CASE\s+WHEN\s+@FullName\s*=\s*''\s+OR\s+@Headline\s*=\s*''\s+THEN\s+0",
                Procedures().Single(p => p.Name == "sp_Profile_Save").Body);
        }

        [Fact]
        public void A_certificate_starts_as_uploaded_and_has_room_for_a_verifier()
        {
            var script = Script();

            Assert.Contains("DEFAULT ('Uploaded')", script);
            Assert.Contains("VerifiedBy", script);
            Assert.Contains("VerifiedAt", script);
        }

        [Fact]
        public void File_content_is_returned_by_one_procedure_only()
        {
            foreach (var (name, body) in Procedures().Where(p => p.Name != "sp_File_Get"))
                Assert.False(Regex.IsMatch(body, @"SELECT[^;]*\bContent\b(?!Type)[^;]*FROM\s+jobs\.Files", RegexOptions.Singleline),
                    name + " returns file content");

            Assert.Contains("f.Content", Procedures().Single(p => p.Name == "sp_File_Get").Body);
        }
    }
}
