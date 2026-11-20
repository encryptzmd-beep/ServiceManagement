using System.Reflection;
using EncryptzAPI.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace EncryptzTests
{
    // Product category master (Products › Manage categories)
    public class ProductCategoryEndpointTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        [Fact]
        public void Everyone_of_the_service_reads_the_list()
        {
            var m = typeof(ProductMasterController).GetMethod("GetCategories")!;
            Assert.Equal("categories", m.GetCustomAttribute<HttpGetAttribute>()!.Template);
            Assert.Null(m.GetCustomAttribute<AuthorizeAttribute>());
        }

        [Fact]
        public void Only_the_back_office_changes_it()
        {
            var m = typeof(ProductMasterController).GetMethod("SaveCategory")!;
            Assert.Equal("categories", m.GetCustomAttribute<HttpPostAttribute>()!.Template);
            Assert.Equal("Admin,CompanyAdmin,ServiceManager,Manager", m.GetCustomAttribute<AuthorizeAttribute>()!.Roles);
        }

        [Fact]
        public void The_service_calls_the_procedures()
        {
            var s = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Products", "Modules", "ProductMasterService.cs"));
            Assert.Contains("sp_ProductCategory_List", s);
            Assert.Contains("sp_ProductCategory_Save", s);
        }

        [Fact]
        public void Dtos_carry_the_tree()
        {
            var t = typeof(EncryptzBL.DTO_s.ProductCategoryDto);
            foreach (var p in new[] { "CategoryId", "ParentId", "Name", "IsActive", "ProductCount" }) Assert.NotNull(t.GetProperty(p));
            Assert.Equal(typeof(int?), t.GetProperty("ParentId")!.PropertyType);
            var s = typeof(EncryptzBL.DTO_s.ProductCategorySaveDto);
            foreach (var p in new[] { "CategoryId", "ParentId", "Name", "IsActive" }) Assert.NotNull(s.GetProperty(p));
        }
    }
}
