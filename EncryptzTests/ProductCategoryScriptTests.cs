using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 21_Product_Categories.sql: category / sub category master ─────
    public class ProductCategoryScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Script21() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "21_Product_Categories.sql"));

        private static string Proc(string name)
        {
            var m = Regex.Match(Script21(), @"CREATE OR ALTER PROCEDURE " + Regex.Escape(name) + @"\b(.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, name + " not found");
            return m.Groups[1].Value;
        }

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script21();
            Assert.Contains("dbo.Locations is missing", s);
            Assert.Contains("SET NOEXEC ON", s);
            Assert.Contains("dbo.ProductMaster is missing", s);
            Assert.DoesNotMatch(new Regex(@"(?m)^\s*USE\s"), s);
        }

        [Fact]
        public void Table_is_created_once_with_a_parent_for_sub_categories()
        {
            var s = Script21();
            Assert.Contains("IF OBJECT_ID('dbo.ProductCategories') IS NULL", s);
            Assert.Contains("ParentId", s);
            Assert.Contains("REFERENCES dbo.ProductCategories (CategoryId)", s);
            Assert.Contains("UX_ProductCategories_Parent_Name", s);
        }

        [Fact]
        public void Existing_product_values_are_seeded_once()
        {
            var s = Script21();
            Assert.Contains("SELECT DISTINCT LTRIM(RTRIM(pm.Category))", s);
            Assert.Contains("LTRIM(RTRIM(pm.SubCategory))", s);
            Assert.Matches(new Regex(@"WHERE NOT EXISTS \(SELECT 1 FROM dbo\.ProductCategories"), s);
        }

        [Fact]
        public void Save_checks_the_name_and_renames_the_products_too()
        {
            var body = Proc("dbo.sp_ProductCategory_Save");
            Assert.Contains("'Enter the name'", body);
            Assert.Contains("'This name is already in the list'", body);
            Assert.Contains("UPDATE dbo.ProductMaster SET Category = @Name", body);
            Assert.Contains("UPDATE dbo.ProductMaster SET SubCategory = @Name", body);
            Assert.Contains("'A sub category cannot have sub categories'", body);
        }

        [Fact]
        public void List_returns_the_tree()
        {
            var body = Proc("dbo.sp_ProductCategory_List");
            foreach (var c in new[] { "CategoryId", "ParentId", "Name", "IsActive", "ProductCount" }) Assert.Contains(c, body);
        }

        [Fact]
        public void Crm_categories_come_from_the_master_when_crm_is_there()
        {
            var s = Script21();
            Assert.Contains("IF SCHEMA_ID('crm') IS NOT NULL", s);
            Assert.Contains("CREATE OR ALTER PROCEDURE crm.sp_Product_Categories", s);
            Assert.Contains("FROM dbo.ProductCategories", s.Substring(s.IndexOf("crm.sp_Product_Categories", StringComparison.Ordinal)));
        }

        [Fact]
        public void Csproj_ships_21()
            => Assert.Contains(@"Database\ProjectDB\21_Product_Categories.sql",
                File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj")));

        [Fact]
        public void Script_parses_as_follow_up()
            => Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("21_Product_Categories.sql", Script21()).Batches);
    }
}
