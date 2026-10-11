using EncryptzBL.Common.Provisioning;
using Xunit;

namespace EncryptzTests
{
    public class SqlTenantDatabaseServerTests
    {
        [Fact]
        public void A_generated_name_is_bracketed_into_the_create_statement()
        {
            Assert.Equal("CREATE DATABASE [EncryptzTenant_000007];", SqlTenantDatabaseServer.CreateDatabaseSql("EncryptzTenant_000007"));
        }

        [Fact]
        public void A_generated_name_is_bracketed_into_the_drop_statement()
        {
            var sql = SqlTenantDatabaseServer.DropDatabaseSql("EncryptzTenant_000007");

            Assert.Contains("DROP DATABASE [EncryptzTenant_000007];", sql);
            Assert.Contains("ALTER DATABASE [EncryptzTenant_000007] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;", sql);
            Assert.StartsWith("IF DB_ID(N'EncryptzTenant_000007') IS NOT NULL", sql);
        }

        [Theory]
        [InlineData("master")]
        [InlineData("MainDBEncryptz")]
        [InlineData("FelixServiceDB")]
        [InlineData("HamsterserviceDB")]
        [InlineData("EncryptzTenant_000007]; DROP DATABASE master--")]
        [InlineData("EncryptzTenant_000007 ")]
        [InlineData("")]
        public void No_statement_is_ever_built_for_another_name(string name)
        {
            Assert.Throws<InvalidOperationException>(() => SqlTenantDatabaseServer.CreateDatabaseSql(name));
            Assert.Throws<InvalidOperationException>(() => SqlTenantDatabaseServer.DropDatabaseSql(name));
        }
    }
}
