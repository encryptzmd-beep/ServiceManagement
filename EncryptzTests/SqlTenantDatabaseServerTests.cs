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

        // Extra options are typed by a platform administrator: they must not send the
        // tenant script (or the create / drop) to another database.
        [Theory]
        [InlineData("Database=MainDBEncryptz")]
        [InlineData("Initial Catalog=MainDBEncryptz")]
        [InlineData("Connect Timeout=30;database=master;Pooling=true")]
        public void Extra_options_cannot_choose_another_database(string extraOptions)
        {
            var master = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(SqlTenantDatabaseServer.Master(Job(extraOptions)));
            var tenant = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(SqlTenantDatabaseServer.Tenant(Job(extraOptions), "EncryptzTenant_000007"));

            Assert.Equal("master", master.InitialCatalog);
            Assert.Equal("EncryptzTenant_000007", tenant.InitialCatalog);
            Assert.False(master.Pooling);
            Assert.False(tenant.Pooling);
        }

        [Theory]
        [InlineData("EncryptzTenant_000007")]
        [InlineData("encryptztenant_000007")]
        public void The_database_the_connection_is_in_is_accepted_when_it_is_the_generated_one(string actual)
        {
            SqlTenantDatabaseServer.EnsureConnectedTo(actual, "EncryptzTenant_000007");
        }

        [Theory]
        [InlineData("master")]
        [InlineData("MainDBEncryptz")]
        [InlineData("EncryptzTenant_000008")]
        [InlineData("")]
        [InlineData(null)]
        public void The_script_is_not_run_when_the_connection_is_in_another_database(string? actual)
        {
            var ex = Assert.Throws<InvalidOperationException>(
                () => SqlTenantDatabaseServer.EnsureConnectedTo(actual, "EncryptzTenant_000007"));

            Assert.Contains("EncryptzTenant_000007", ex.Message);
        }

        [Fact]
        public void An_error_of_a_cancelled_command_is_a_cancellation_not_the_servers_text()
        {
            var job = Job();
            using var cts = new CancellationTokenSource();
            var error = new InvalidOperationException("Operation cancelled by user. s3cret;pw");

            // not cancelled: the text, without secrets
            var wrapped = SqlTenantDatabaseServer.Wrapped(error, "Server=srv-01", job, cts.Token);
            Assert.IsType<InvalidOperationException>(wrapped);
            Assert.DoesNotContain("s3cret", wrapped.Message);
            Assert.Null(wrapped.InnerException);

            cts.Cancel();

            var cancelled = SqlTenantDatabaseServer.Wrapped(error, "Server=srv-01", job, cts.Token);
            var oce = Assert.IsAssignableFrom<OperationCanceledException>(cancelled);
            Assert.Equal(cts.Token, oce.CancellationToken);
            Assert.DoesNotContain("s3cret", cancelled.ToString());
        }

        private const string GoodScript =
            "CREATE TABLE #TenantSettings (CompanyId INT NOT NULL, ProjectId INT NOT NULL, LocationName NVARCHAR(200) NOT NULL, "
            + "LocationCode NVARCHAR(50) NULL, LocationCity NVARCHAR(100) NULL, CopyLookupsFrom SYSNAME NULL);\nGO\nSELECT 1;";

        [Fact]
        public void A_script_that_does_not_have_the_expected_shape_is_refused_before_anything_is_created()
        {
            var server = new SqlTenantDatabaseServer(new Lazy<TenantScript>(() => TenantScript.Parse("SELECT 1;")));

            var ex = Assert.Throws<InvalidOperationException>(() => server.EnsureReady());
            Assert.Contains("settings batch", ex.Message);

            // and again at the next job: the answer does not change
            Assert.Throws<InvalidOperationException>(() => server.EnsureReady());
        }

        [Fact]
        public void A_script_file_that_is_missing_is_refused_before_anything_is_created()
        {
            var missing = Path.Combine(Path.GetTempPath(), "no-such-folder-" + Guid.NewGuid().ToString("N"), "New_Tenant_Database.sql");
            var server = new SqlTenantDatabaseServer(new Lazy<TenantScript>(() => TenantScript.Load(missing)));

            Assert.ThrowsAny<IOException>(() => server.EnsureReady());
        }

        [Fact]
        public void A_good_script_is_accepted()
        {
            var dir = Path.Combine(Path.GetTempPath(), "encryptz-tenant-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                File.WriteAllText(Path.Combine(dir, "New_Tenant_Database.sql"), GoodScript);
                File.WriteAllText(Path.Combine(dir, "10_Branch_Access.sql"), "SELECT 10;");

                var loads = 0;
                var server = new SqlTenantDatabaseServer(new Lazy<TenantScript>(() =>
                {
                    loads++;
                    return TenantScript.Load(Path.Combine(dir, "New_Tenant_Database.sql"));
                }));

                server.EnsureReady();
                server.EnsureReady();

                Assert.Equal(1, loads);   // read once for the life of the API
            }
            finally
            {
                Directory.Delete(dir, recursive: true);
            }
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
