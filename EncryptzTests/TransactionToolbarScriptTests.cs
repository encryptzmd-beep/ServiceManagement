using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 20_Transaction_Toolbar.sql: quotation Cancelled status, previous / next ─────
    public class TransactionToolbarScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Script20() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "20_Transaction_Toolbar.sql"));

        private static string Proc(string schemaAndName)
        {
            var m = Regex.Match(Script20(), @"CREATE OR ALTER PROCEDURE " + Regex.Escape(schemaAndName) + @"\b(.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, schemaAndName + " not found");
            return m.Groups[1].Value;
        }

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script20();
            Assert.Contains("dbo.Locations is missing", s);
            Assert.Contains("SET NOEXEC ON", s);
            Assert.Contains("Run 19_Technician_Attendance_Optional.sql first", s);
            Assert.DoesNotMatch(new Regex(@"(?m)^\s*USE\s"), s);
        }

        [Fact]
        public void Quotation_status_allows_cancelled()
        {
            var s = Script20();
            Assert.Contains("DROP CONSTRAINT CK_crm_Quotations_Status", s);
            Assert.Contains("CHECK ([Status] IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded', 'Cancelled'))", s);
        }

        [Fact]
        public void Set_status_cancels_only_an_open_quotation_and_keeps_its_scope()
        {
            var body = Proc("crm.sp_Quotation_SetStatus");
            Assert.Contains("@Status NOT IN ('Sent', 'Rejected', 'Cancelled')", body);
            Assert.Contains("(@Status = 'Cancelled' AND @Current IN ('Draft', 'Sent', 'Rejected'))", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("SentAt = CASE WHEN @Status = 'Sent'", body);
        }

        [Fact]
        public void Quotation_neighbours_move_over_latest_revisions_in_scope()
        {
            var body = Proc("crm.sp_Quotation_Neighbours");
            Assert.Contains("q2.RevisionNo > q.RevisionNo", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("PreviousId", body);
            Assert.Contains("NextId", body);
        }

        [Fact]
        public void Sales_order_neighbours_by_id()
        {
            var body = Proc("dbo.sp_SalesOrder_Neighbours");
            Assert.Contains("@SalesOrderId INT", body);
            Assert.Contains("PreviousId", body);
            Assert.Contains("NextId", body);
        }

        [Fact]
        public void Csproj_ships_20()
            => Assert.Contains(@"Database\ProjectDB\20_Transaction_Toolbar.sql",
                File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj")));

        [Fact]
        public void Script_parses_as_follow_up()
            => Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("20_Transaction_Toolbar.sql", Script20()).Batches);
    }
}
