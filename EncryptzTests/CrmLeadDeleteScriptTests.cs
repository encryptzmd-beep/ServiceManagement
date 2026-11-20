using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 22_CRM_Lead_Delete.sql: soft delete of a lead, hidden from every read ─────
    public class CrmLeadDeleteScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Script22() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "22_CRM_Lead_Delete.sql"));

        private static string Proc(string schemaAndName)
        {
            var m = Regex.Match(Script22(), @"CREATE OR ALTER PROCEDURE " + Regex.Escape(schemaAndName) + @"\b(.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, schemaAndName + " not found");
            return m.Groups[1].Value;
        }

        public static IEnumerable<object[]> FilteredProcs() => new[]
        {
            "crm.sp_Lead_List", "crm.sp_Lead_Get", "crm.sp_Lead_Board", "crm.sp_Dashboard",
            "crm.sp_Report_Conversion", "crm.sp_Report_FollowUps", "crm.sp_Report_LostReasons", "crm.sp_Report_Pipeline",
            "crm.sp_Report_Sources", "crm.sp_Report_Team",
            "crm.sp_Quotation_List", "crm.sp_Quotation_Neighbours", "crm.sp_Quotation_Get",
            "crm.sp_Lead_StatusCounts", "crm.sp_Quotation_StatusCounts",
        }.Select(p => new object[] { p });

        [Fact]
        public void Quotation_counts_follow_the_list_filters_except_the_status()
        {
            var body = Proc("crm.sp_Quotation_StatusCounts");
            Assert.Contains("GROUP BY q.Status", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
            Assert.DoesNotContain("@Status", body);
        }

        [Fact]
        public void Status_counts_follow_the_list_filters_except_the_status()
        {
            var body = Proc("crm.sp_Lead_StatusCounts");
            Assert.Contains("GROUP BY l.Status", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.DoesNotContain("@Status", body);
            Assert.DoesNotContain("OFFSET", body);
        }

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script22();
            Assert.Contains("dbo.Locations is missing", s);
            Assert.Contains("SET NOEXEC ON", s);
            Assert.Contains("Run 20_Transaction_Toolbar.sql first", s);
            Assert.Contains("Run 21_Product_Categories.sql first", s);
            Assert.DoesNotMatch(new Regex(@"(?m)^\s*USE\s"), s);
        }

        [Fact]
        public void Adds_the_mark_once()
        {
            var s = Script22();
            Assert.Contains("IF COL_LENGTH('crm.Leads', 'IsDeleted') IS NULL", s);
            Assert.Contains("IsDeleted BIT NOT NULL CONSTRAINT DF_crm_Leads_IsDeleted DEFAULT (0)", s);
            Assert.Contains("IF COL_LENGTH('crm.Leads', 'DeletedAt') IS NULL", s);
            Assert.Contains("IF COL_LENGTH('crm.Leads', 'DeletedBy') IS NULL", s);
        }

        [Fact]
        public void Delete_is_for_the_owner_or_a_manager_and_never_a_converted_lead()
        {
            var body = Proc("crm.sp_Lead_Delete");
            Assert.Contains("@IsManager = 0 AND @owner <> @UserId", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("@status = 'Converted' OR @order IS NOT NULL", body);
            Assert.Contains("@converting IS NOT NULL", body);
            Assert.Contains("SET IsDeleted = 1", body);
            Assert.DoesNotMatch(new Regex(@"DELETE\s+(FROM\s+)?crm\.", RegexOptions.IgnoreCase), body);
        }

        [Theory]
        [MemberData(nameof(FilteredProcs))]
        public void Every_read_of_leads_skips_deleted_ones(string proc)
        {
            var body = Proc(proc);
            var reads = Regex.Matches(body, @"crm\.Leads l\b").Count;
            Assert.True(reads > 0, proc + " does not read crm.Leads");
            Assert.Equal(reads, Regex.Matches(body, @"l\.IsDeleted = 0").Count);
        }

        [Fact]
        public void Lead_numbers_are_never_given_twice()
            => Assert.DoesNotContain("CREATE OR ALTER PROCEDURE crm.sp_Lead_NextNumber", Script22());

        [Fact]
        public void Csproj_ships_22()
            => Assert.Contains(@"Database\ProjectDB\22_CRM_Lead_Delete.sql",
                File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj")));

        [Fact]
        public void Script_parses_as_follow_up()
            => Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("22_CRM_Lead_Delete.sql", Script22()).Batches);
    }
}
