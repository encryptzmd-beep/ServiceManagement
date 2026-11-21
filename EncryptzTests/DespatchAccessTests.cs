using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace EncryptzTests
{
    /// <summary>A Storekeeper issues spare and repaired parts, and never touches a sales despatch.</summary>
    public class DespatchAccessTests
    {
        private static MethodInfo Action(string name) => typeof(SalesController).GetMethod(name)!;

        [Theory]
        [InlineData(nameof(SalesController.CreateServiceDespatch))]
        [InlineData(nameof(SalesController.AddServiceDespatchDetails))]
        public void Storekeeper_can_issue_parts(string action)
        {
            Assert.Equal("Storekeeper", Action(action).GetCustomAttribute<MenuRightAttribute>()!.AllowRole);
            Assert.Contains("Storekeeper", Action(action).GetCustomAttribute<AuthorizeAttribute>()!.Roles!);
        }

        [Theory]
        [InlineData(nameof(SalesController.CreateDespatch))]
        [InlineData(nameof(SalesController.AddDespatchDetails))]
        public void Sales_despatch_has_no_storekeeper_exception(string action)
            => Assert.Null(Action(action).GetCustomAttribute<MenuRightAttribute>()!.AllowRole);
    }
}
