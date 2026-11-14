using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformServerEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetDbServers", "GET", "db-servers")]
        [InlineData("SaveDbServer", "POST", "db-servers/save")]
        [InlineData("TestDbServer", "POST", "db-servers/test")]
        [InlineData("GetSettings", "GET", "settings")]
        [InlineData("SaveSetting", "POST", "settings/save")]
        public void The_endpoints_exist_behind_the_platform_unlock(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
        }

        [Fact]
        public void A_server_is_never_sent_out_with_its_password()
        {
            Assert.DoesNotContain(typeof(DbServerDto).GetProperties(),
                p => p.Name.Contains("Password", StringComparison.OrdinalIgnoreCase) && p.PropertyType == typeof(string));
            Assert.NotNull(typeof(DbServerDto).GetProperty("HasPassword"));
        }

        [Fact]
        public void A_company_row_carries_its_database_state()
        {
            Assert.NotNull(typeof(PlatformCompanyDto).GetProperty("ProvisionStatus"));
            Assert.NotNull(typeof(PlatformCompanyDto).GetProperty("ProvisionError"));
            Assert.NotNull(typeof(PlatformCompanyDto).GetProperty("DatabaseName"));
        }

        private static List<PlatformCompanyDto> FailedCompanies() => new()
        {
            new PlatformCompanyDto { CompanyId = 1, ProvisionStatus = "Failed", ProvisionError = "Login failed for sa on SRV1", DatabaseName = "Co_1" }
        };

        [Fact]
        public void A_platform_administrator_keeps_the_error_and_the_database_name()
        {
            var list = FailedCompanies();

            PlatformCompanyDto.HideDatabaseDetail(list, isPlatformAdmin: true);

            Assert.Equal("Login failed for sa on SRV1", list[0].ProvisionError);
            Assert.Equal("Co_1", list[0].DatabaseName);
            Assert.Equal("Failed", list[0].ProvisionStatus);
        }

        [Fact]
        public void A_company_administrator_sees_the_status_only()
        {
            var list = FailedCompanies();

            PlatformCompanyDto.HideDatabaseDetail(list, isPlatformAdmin: false);

            Assert.Equal("", list[0].ProvisionError);
            Assert.Equal("", list[0].DatabaseName);
            Assert.Equal("Failed", list[0].ProvisionStatus);
        }
    }
}
