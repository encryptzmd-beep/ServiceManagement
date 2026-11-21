using EncryptzAPI.Middleware;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using System.Reflection;
using Xunit;

namespace EncryptzTests
{
    public class MenuRightRulesTests
    {
        private static MenuRightRow Row(bool view = true, bool create = false, bool edit = false, bool delete = false)
            => new("sales/orders", view, create, edit, delete);

        [Theory]
        [InlineData("/Sales/Orders/", "sales/orders")]
        [InlineData("sales/orders", "sales/orders")]
        [InlineData(null, "")]
        public void Paths_compare_the_same(string? given, string expected)
            => Assert.Equal(expected, MenuRightRules.NormalizePath(given));

        [Theory]
        [InlineData("/crm/leads", "CRM")]
        [InlineData("/consultancy/postings", "JOBCONSULTANCY")]
        [InlineData("sales/orders", "SERVICE")]
        public void A_path_belongs_to_its_module(string path, string module)
            => Assert.Equal(module, MenuRightRules.ModuleOf(path));

        [Fact]
        public void A_missing_row_or_no_view_is_no_right()
        {
            Assert.False(MenuRightRules.Has(null, MenuRightKind.Create));
            Assert.False(MenuRightRules.Has(Row(view: false, create: true), MenuRightKind.Create));
        }

        [Fact]
        public void Each_right_is_its_own()
        {
            Assert.True(MenuRightRules.Has(Row(create: true), MenuRightKind.Create));
            Assert.False(MenuRightRules.Has(Row(create: true), MenuRightKind.Edit));
            Assert.False(MenuRightRules.Has(Row(edit: true), MenuRightKind.Delete));
        }

        [Fact]
        public void Save_needs_create_for_new_edit_for_existing_and_both_when_unknown()
        {
            Assert.True(MenuRightRules.Has(Row(create: true), MenuRightKind.Save, isNewRecord: true));
            Assert.False(MenuRightRules.Has(Row(create: true), MenuRightKind.Save, isNewRecord: false));
            Assert.False(MenuRightRules.Has(Row(create: true), MenuRightKind.Save));
            Assert.True(MenuRightRules.Has(Row(create: true, edit: true), MenuRightKind.Save));
        }

        [Theory]
        [InlineData("SalesController")]
        [InlineData("CrmController")]
        [InlineData("ConsultancyController")]
        [InlineData("OwnCandidatesController")]
        [InlineData("CompanyJobsController")]
        [InlineData("ProductMasterController")]
        [InlineData("SparePartController")]
        [InlineData("TechnicianController")]
        [InlineData("ScheduleController")]
        [InlineData("PaymentsController")]
        public void Every_change_of_a_module_needs_a_right(string controller)
        {
            var type = typeof(MenuRightAttribute).Assembly.GetTypes().Single(t => t.Name == controller);
            var open = type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any(h => h.HttpMethods.Any(v => v != "GET")))
                .Where(m => m.GetCustomAttribute<MenuRightAttribute>() == null)
                .Select(m => m.Name)
                .ToList();
            Assert.Empty(open);
        }
    }
}
