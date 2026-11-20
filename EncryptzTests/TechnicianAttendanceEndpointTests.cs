using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // Attendance check-in required per technician (source checks)
    public class TechnicianAttendanceEndpointTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Service() => File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Technician", "modules", "TechnicianService.cs"));
        private static string Controller(string name) => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Controllers", name + ".cs"));

        private static string Method(string source, string signatureStart)
        {
            var i = source.IndexOf(signatureStart, StringComparison.Ordinal);
            Assert.True(i >= 0, signatureStart + " not found");
            var next = Regex.Match(source.Substring(i + signatureStart.Length), @"\n\s*(\[Http|public |private |//\s*(GET|POST|PUT))");
            return next.Success ? source.Substring(i, signatureStart.Length + next.Index) : source.Substring(i);
        }

        private static string Attributes(string source, string action)
        {
            var m = Regex.Match(source, @"((?:\s*\[[^\]]+\])+)\s*public async Task<IActionResult> " + action + @"\(");
            Assert.True(m.Success, action + " not found");
            return m.Groups[1].Value;
        }

        [Fact]
        public void Needs_check_in_works_before_script_19()
        {
            var body = Method(Service(), "public async Task<bool> IsAttendanceRequired(int technicianId)");
            Assert.Contains("COL_LENGTH('dbo.Technicians', 'AttendanceRequired')", body);
            Assert.Contains("sp_executesql", body);
            Assert.Contains("ISNULL(", body);
        }

        [Fact]
        public void Needs_check_in_is_required_and_not_checked_in()
        {
            var body = Method(Service(), "public async Task<bool> NeedsCheckIn(int technicianId)");
            Assert.Contains("IsAttendanceRequired(technicianId)", body);
            Assert.Contains("IsCheckedIn(technicianId)", body);
        }

        [Theory]
        [InlineData("TechnicianController", "Please check in before working on a job")]
        [InlineData("SparePartController", "Please check in before requesting spare parts")]
        [InlineData("PaymentsController", "Please check in before recording a payment")]
        public void Guards_use_needs_check_in_and_keep_their_message(string controller, string message)
        {
            var c = Controller(controller);
            Assert.Contains("NeedsCheckIn(", c);
            Assert.DoesNotMatch(new Regex(@"!\s*await\s+_\w+\.IsCheckedIn\("), c);
            Assert.Contains(message, c);
        }

        [Fact]
        public void Attendance_routes_and_roles()
        {
            var c = Controller("TechnicianController");
            var list = Attributes(c, "GetAttendanceRules");
            Assert.Contains("[HttpGet(\"attendance-required\")]", list);
            Assert.Contains("[Authorize(Roles = \"Admin,Manager\")]", list);
            var set = Attributes(c, "SetAttendanceRequired");
            Assert.Contains("[HttpPut(\"attendance-required\")]", set);
            Assert.Contains("[Authorize(Roles = \"Admin,Manager\")]", set);
            var mine = Attributes(c, "GetMyAttendanceRule");
            Assert.Contains("[HttpGet(\"my-attendance-rule\")]", mine);
            Assert.DoesNotContain("Authorize(Roles", mine);
            Assert.Contains("GetTechnicianId()", Method(c, "public async Task<IActionResult> GetMyAttendanceRule("));
        }

        [Fact]
        public void Set_is_keyed_by_the_technician_id_the_list_carries()
        {
            // the technician list rows (sp_Technician_GetAll) carry TechnicianId, not UserId
            Assert.NotNull(typeof(EncryptzBL.DTO_s.AttendanceRequiredSetDto).GetProperty("TechnicianId"));
            Assert.Null(typeof(EncryptzBL.DTO_s.AttendanceRequiredSetDto).GetProperty("UserId"));
            var body = Method(Service(), "public async Task<ApiResponse<string>> SetAttendanceRequired(int technicianId, bool required)");
            Assert.Contains("SELECT TOP 1 UserId FROM dbo.Technicians WHERE TechnicianId = @TechnicianId", body);
            Assert.Contains("sp_Technician_AttendanceRequired_Set", body);
        }

        [Fact]
        public void Set_and_list_call_their_procedures()
        {
            var s = Service();
            Assert.Contains("sp_Technician_AttendanceRequired_List", s);
            Assert.Contains("sp_Technician_AttendanceRequired_Set", s);
        }
    }
}
