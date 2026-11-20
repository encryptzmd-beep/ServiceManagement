using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 19_Technician_Attendance_Optional.sql: attendance check-in required per technician ─────

    public class TechnicianAttendanceScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Script19() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "19_Technician_Attendance_Optional.sql"));

        private static string Proc(string name)
        {
            var m = Regex.Match(Script19(), @"CREATE OR ALTER PROCEDURE dbo\." + name + @"\b(.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, name + " not found");
            return m.Groups[1].Value;
        }

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script19();
            Assert.Contains("dbo.Locations is missing", s);
            Assert.Contains("SET NOEXEC ON", s);
            Assert.DoesNotMatch(new Regex(@"(?m)^\s*USE\s"), s);
        }

        [Fact]
        public void Adds_the_column_once_with_default_required()
        {
            var s = Script19();
            Assert.Contains("COL_LENGTH('dbo.Technicians', 'AttendanceRequired') IS NULL", s);
            Assert.Matches(new Regex(@"ADD AttendanceRequired BIT NOT NULL\s+CONSTRAINT \w+ DEFAULT \(1\)"), s);
        }

        [Fact]
        public void List_returns_every_technician_flag()
        {
            var body = Proc("sp_Technician_AttendanceRequired_List");
            Assert.Contains("UserId", body);
            Assert.Contains("TechnicianId", body);
            Assert.Contains("AttendanceRequired", body);
        }

        [Fact]
        public void Set_updates_by_user_and_refuses_unknown()
        {
            var body = Proc("sp_Technician_AttendanceRequired_Set");
            Assert.Contains("@UserId INT", body);
            Assert.Contains("@Required BIT", body);
            Assert.Contains("'Technician not found'", body);
            Assert.Contains("UPDATE dbo.Technicians SET AttendanceRequired = @Required WHERE UserId = @UserId", body);
        }

        [Fact]
        public void Existing_technician_procedures_are_not_touched()
        {
            var s = Script19();
            Assert.DoesNotContain("sp_Technician_Create", s);
            Assert.DoesNotContain("sp_Technician_Update", s);
            Assert.DoesNotContain("sp_Technician_GetAll", s);
        }

        [Fact]
        public void Csproj_ships_19()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\19_Technician_Attendance_Optional.sql", project);
        }

        [Fact]
        public void Script_parses_as_follow_up()
        {
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("19_Technician_Attendance_Optional.sql", Script19()).Batches);
        }
    }
}
