using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 17_CRM_Product_Fixes.sql: lead product, product categories, report fixes ─────

    public class CrmProductScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] path) => File.ReadAllText(Path.Combine(new[] { Root(), "EncryptzAPI", "Database" }.Concat(path).ToArray()));

        private static string Script17() => Read("ProjectDB", "17_CRM_Product_Fixes.sql");

        private static List<(string Name, string Body)> Procedures(string script)
            => Regex.Matches(script, @"CREATE OR ALTER PROCEDURE crm\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        private static string Body(string name) => Procedures(Script17()).Single(p => p.Name == name).Body;

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script17();
            Assert.Contains("SET NOEXEC ON", s);
            Assert.Contains("Run 14_CRM.sql first", s);
            Assert.DoesNotMatch(new Regex(@"\bUSE\s+\["), s);
        }

        [Fact]
        public void Requires_script_16_to_have_run()
        {
            var s = Script17();
            Assert.Contains("COL_LENGTH('crm.Quotations', 'SentAt') IS NULL", s);
            Assert.Contains("Run 16_CRM_Board_Reports.sql first", s);
        }

        [Fact]
        public void Adds_ProductMasterId_idempotently()
        {
            var s = Script17();
            Assert.Contains("COL_LENGTH('crm.Leads', 'ProductMasterId') IS NULL", s);
            Assert.Contains("ADD ProductMasterId INT NULL", s);
        }

        [Fact]
        public void Categories_are_active_non_empty_distinct_and_ordered()
        {
            var body = Body("sp_Product_Categories");
            Assert.Contains("@CompanyId", body);
            Assert.Contains("DISTINCT", body);
            Assert.Contains("IsActive = 1", body);
            Assert.Contains("<> ''", body);
            Assert.Contains("p.CompanyId = @CompanyId", body);
            Assert.Contains("ORDER BY", body);
        }

        [Fact]
        public void Product_search_filters_by_category_and_returns_HsnSac()
        {
            var body = Body("sp_Product_Search");
            Assert.Contains("@Category", body);
            Assert.Contains("HsnSac", body);
            Assert.Contains("p.IsActive = 1", body);
            Assert.Contains("LTRIM(RTRIM(p.Category)) = @Category", body);
        }

        [Fact]
        public void Lead_save_validates_the_product_against_active_ProductMaster()
        {
            var body = Body("sp_Lead_Save");
            Assert.Matches(@"@ProductMasterId\s+INT\s*=\s*NULL", body);
            Assert.Contains("NULLIF(@ProductMasterId, 0)", body);
            Assert.Contains("dbo.ProductMaster", body);
            Assert.Contains("IsActive = 1", body);
            Assert.Contains("ProductMasterId = @ProductMasterId AND CompanyId = @CompanyId AND IsActive = 1", body);
            Assert.Contains("ProductMasterId = @ProductMasterId", body);
            Assert.Contains("LocationId, CreatedBy, ProductMasterId)", body);
            Assert.Contains("@LocationId, @UserId, @ProductMasterId)", body);
        }

        [Fact]
        public void Lead_save_keeps_its_guards_and_new_parameter_is_last()
        {
            var body = Body("sp_Lead_Save");
            Assert.Contains("N'A converted or lost lead cannot be changed'", body);
            Assert.Contains("N'Select a branch first'", body);
            Assert.True(body.IndexOf("@Remarks", StringComparison.Ordinal) < body.IndexOf("@ProductMasterId", StringComparison.Ordinal));
        }

        [Fact]
        public void Lead_get_returns_product_and_keeps_convert_check()
        {
            var body = Body("sp_Lead_Get");
            Assert.Contains("l.ProductMasterId", body);
            Assert.Contains("ProductName", body);
            Assert.Contains("l.ConvertNeedsCheck", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
        }

        [Fact]
        public void Sources_conversion_pct_is_wide_enough()
        {
            var body = Body("sp_Report_Sources");
            Assert.Contains("DECIMAL(7,1)", body);
            Assert.DoesNotContain("DECIMAL(5,1)", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
        }

        [Fact]
        public void Team_follow_ups_of_a_non_manager_are_their_own()
        {
            var body = Body("sp_Report_Team");
            Assert.Contains("AND (@IsManager = 1 OR f.UserId = @UserId)", body);
            Assert.Contains("f.UserId", body);
            Assert.Contains("l.LocationId = @LocationId", body);
        }

        [Fact]
        public void Board_treats_owner_zero_as_all()
        {
            var body = Body("sp_Lead_Board");
            Assert.Contains("SET @OwnerUserId = NULLIF(@OwnerUserId, 0);", body);
            Assert.Contains("l.LocationId = @LocationId", body);
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", body);
        }

        [Fact]
        public void Csproj_ships_script_17()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\17_CRM_Product_Fixes.sql", project);
        }

        [Fact]
        public void Parses_as_follow_up()
        {
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("17_CRM_Product_Fixes.sql", Script17()).Batches);
        }
    }
}
