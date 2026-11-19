using System.Reflection;
using EncryptzAPI.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace EncryptzTests
{
    // Previous / next of the transaction toolbar (Sales Order, Quotation)
    public class TransactionToolbarEndpointTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] path) => File.ReadAllText(Path.Combine(new[] { Root() }.Concat(path).ToArray()));

        [Fact]
        public void Sales_order_neighbours_route()
        {
            var m = typeof(SalesController).GetMethod("GetOrderNeighbours")!;
            Assert.Equal("orders/{id:int}/neighbours", m.GetCustomAttribute<HttpGetAttribute>()!.Template);
            Assert.Contains("sp_SalesOrder_Neighbours", Read("EncryptzBL", "Infrastructure", "Sales", "Modules", "SalesService.cs"));
        }

        [Fact]
        public void Quotation_neighbours_route_and_scope()
        {
            var m = typeof(CrmController).GetMethod("GetQuotationNeighbours")!;
            Assert.Equal("quotations/{id:int}/neighbours", m.GetCustomAttribute<HttpGetAttribute>()!.Template);
            var s = Read("EncryptzBL", "Infrastructure", "Crm", "CrmService.Quotations.cs");
            var i = s.IndexOf("crm.sp_Quotation_Neighbours", StringComparison.Ordinal);
            Assert.True(i > 0);
            var call = s.Substring(i, 400);
            Assert.Contains("@CompanyId", call);
            Assert.Contains("@UserId", call);
            Assert.Contains("@IsManager", call);
            Assert.Contains("@LocationId", call);
        }

        [Fact]
        public void Neighbours_dto_has_both_ids()
        {
            var t = typeof(EncryptzBL.DTO_s.NeighboursDto);
            Assert.Equal(typeof(int?), t.GetProperty("PreviousId")!.PropertyType);
            Assert.Equal(typeof(int?), t.GetProperty("NextId")!.PropertyType);
        }
    }
}
