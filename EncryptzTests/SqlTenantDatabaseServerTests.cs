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

        private static ProvisionJob Job(string extraOptions = "") => new()
        {
            CompanyId = 7, Attempt = Guid.NewGuid(), TenantScopeId = 1, FirstBranchName = "Head Office",
            ServerName = "srv-01", AdminUser = "creator", AdminPassword = "s3cret;pw", ExtraOptions = extraOptions
        };

        [Theory]
        [InlineData("")]
        [InlineData("Pooling=true")]
        [InlineData("Pooling=true;Connect Timeout=600")]
        public void Neither_connection_is_ever_pooled_so_nothing_keeps_a_database_open(string extraOptions)
        {
            var master = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(SqlTenantDatabaseServer.Master(Job(extraOptions)));
            var tenant = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(SqlTenantDatabaseServer.Tenant(Job(extraOptions), "EncryptzTenant_000007"));

            Assert.False(master.Pooling);
            Assert.False(tenant.Pooling);
            Assert.Equal("master", master.InitialCatalog);
            Assert.Equal("EncryptzTenant_000007", tenant.InitialCatalog);
            Assert.Equal(15, master.ConnectTimeout);
            Assert.Equal(15, tenant.ConnectTimeout);
        }

        [Theory]
        [InlineData("NoSuchKeyword=1;Password=other-secret")]
        [InlineData("this is not a connection string")]
        public void Options_that_cannot_be_read_give_an_error_that_shows_none_of_the_connection_string(string extraOptions)
        {
            var ex = Assert.Throws<InvalidOperationException>(() => SqlTenantDatabaseServer.Tenant(Job(extraOptions), "EncryptzTenant_000007"));

            Assert.Equal("The connection settings of the database server are not valid.", ex.Message);
            Assert.Null(ex.InnerException);
            Assert.Throws<InvalidOperationException>(() => SqlTenantDatabaseServer.Master(Job(extraOptions)));
        }

        [Fact]
        public void An_error_text_loses_the_connection_string_and_the_password()
        {
            var job = Job();
            var connectionString = SqlTenantDatabaseServer.Tenant(job, "EncryptzTenant_000007");

            var text = SqlTenantDatabaseServer.WithoutSecrets(
                "Cannot open '" + connectionString + "' (password s3cret;pw) for creator", connectionString, job);

            Assert.DoesNotContain(connectionString, text);
            Assert.DoesNotContain("s3cret;pw", text);
            Assert.DoesNotContain("s3cret", text);
            Assert.StartsWith("Cannot open '", text);
            Assert.EndsWith("for creator", text);
        }

        [Fact]
        public async Task What_building_throws_never_shows_the_connection_string()
        {
            // No server is contacted: the options cannot be read, so it fails before any connection is opened.
            var server = new SqlTenantDatabaseServer(new Lazy<TenantScript>(() => TenantScript.Parse(
                "CREATE TABLE #TenantSettings (CompanyId INT NOT NULL, ProjectId INT NOT NULL, LocationName NVARCHAR(200) NOT NULL, "
                + "LocationCode NVARCHAR(50) NULL, LocationCity NVARCHAR(100) NULL, CopyLookupsFrom SYSNAME NULL);\nGO\nSELECT 1;")));
            var job = Job("NoSuchKeyword=1;Password=other-secret");

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => server.BuildTenantAsync(job, "EncryptzTenant_000007", CancellationToken.None));

            Assert.DoesNotContain("s3cret", ex.ToString());
            Assert.DoesNotContain("other-secret", ex.ToString());
            Assert.DoesNotContain("NoSuchKeyword", ex.ToString());
        }

        [Fact]
        public async Task A_script_that_does_not_have_the_expected_shape_stops_the_build_before_any_connection()
        {
            var server = new SqlTenantDatabaseServer(new Lazy<TenantScript>(() => TenantScript.Parse("SELECT 1;")));

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => server.BuildTenantAsync(Job(), "EncryptzTenant_000007", CancellationToken.None));

            Assert.Contains("settings batch", ex.Message);
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
