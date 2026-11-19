using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 16_CRM_Board_Reports.sql: SentAt, the Kanban board and the quotation list ─────

    public class CrmBoardScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] path) => File.ReadAllText(Path.Combine(new[] { Root(), "EncryptzAPI", "Database" }.Concat(path).ToArray()));

        private static string Script16() => Read("ProjectDB", "16_CRM_Board_Reports.sql");

        private static List<(string Name, string Body)> Procedures(string script)
            => Regex.Matches(script, @"CREATE OR ALTER PROCEDURE crm\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        private static string Body(string name) => Procedures(Script16()).Single(p => p.Name == name).Body;

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script16();
            Assert.Contains("SET NOEXEC ON", s);
            Assert.Contains("Run 14_CRM.sql first", s);
            Assert.DoesNotMatch(new Regex(@"\bUSE\s+\["), s);
        }

        [Fact]
        public void Adds_SentAt_idempotently()
        {
            Assert.Contains("COL_LENGTH('crm.Quotations', 'SentAt') IS NULL", Script16());
        }

        [Fact]
        public void Backfills_SentAt_from_UpdatedAt()
        {
            var s = Script16();
            Assert.Contains("SET SentAt = UpdatedAt", s);
            Assert.Contains("Status IN ('Sent', 'Rejected', 'Accepted', 'Superseded')", s);
            Assert.Contains("SentAt IS NULL", s);
        }

        [Fact]
        public void SetStatus_stamps_SentAt_and_keeps_convert_check()
        {
            var body = Body("sp_Quotation_SetStatus");
            Assert.Contains("SentAt", body);
            Assert.Contains("ConvertNeedsCheck", body);
            Assert.Contains("N'A manager must check the sales orders for this lead first'", body);
        }

        [Fact]
        public void Board_uses_attention_constants()
        {
            var body = Body("sp_Lead_Board");
            Assert.Contains("-24", body);
            Assert.Contains("-7", body);
            Assert.Contains("-14", body);
            Assert.Contains("TOP (500)", body);
            Assert.Contains("l.Status NOT IN ('Converted', 'Lost')", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
        }

        [Fact]
        public void Board_latest_quotation_is_draft_or_sent()
        {
            var body = Body("sp_Lead_Board");
            Assert.Contains("Status IN ('Draft', 'Sent')", body);
            Assert.Contains("ORDER BY q.QuotationId DESC", body);
        }

        [Fact]
        public void Quotation_list_is_scoped_and_paged()
        {
            var body = Body("sp_Quotation_List");
            Assert.Contains("OFFSET", body);
            Assert.Contains("FETCH NEXT", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("COUNT(*) OVER ()", body);
        }

        private static readonly string[] ReportNames = { "sp_Report_Pipeline", "sp_Report_Sources", "sp_Report_Team", "sp_Report_LostReasons" };

        [Fact]
        public void Board_cards_put_undated_follow_ups_last()
        {
            Assert.Contains("ORDER BY IsOverdue DESC, CASE WHEN NextFollowUpAt IS NULL THEN 1 ELSE 0 END, NextFollowUpAt, LeadId DESC", Body("sp_Lead_Board"));
        }

        [Fact]
        public void Pipeline_lists_five_open_stages()
        {
            var body = Body("sp_Report_Pipeline");
            var values = Regex.Match(body, @"VALUES(.*?)\) st", RegexOptions.Singleline).Groups[1].Value;
            foreach (var s in new[] { "'New'", "'Contacted'", "'Qualified'", "'Quotation'", "'Negotiation'" })
                Assert.Contains(s, values);
            Assert.DoesNotContain("'Converted'", values);
            Assert.DoesNotContain("'Lost'", values);
        }

        [Fact]
        public void Sources_filters_each_figure_by_its_event_date()
        {
            var body = Body("sp_Report_Sources");
            Assert.Contains("LeadDate", body);
            Assert.Contains("ConvertedAt", body);
            Assert.Contains("LostAt", body);
            Assert.Contains("N'(none)'", body);
        }

        [Fact]
        public void Team_credits_follow_ups_to_who_logged_them()
        {
            Assert.Contains("f.UserId", Body("sp_Report_Team"));
        }

        [Fact]
        public void LostReasons_skips_superseded()
        {
            Assert.Contains("<> 'Superseded'", Body("sp_Report_LostReasons"));
        }

        [Fact]
        public void Every_report_is_scoped_by_location_and_owner()
        {
            foreach (var name in ReportNames)
            {
                var body = Body(name);
                Assert.Contains("l.LocationId = @LocationId", body);
                Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
            }
        }

        [Fact]
        public void Csproj_ships_script_16()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\16_CRM_Board_Reports.sql", project);
        }

        [Fact]
        public void Parses_as_follow_up()
        {
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("16_CRM_Board_Reports.sql", Script16()).Batches);
        }
    }
}
