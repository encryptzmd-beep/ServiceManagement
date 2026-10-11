using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;
using Xunit;

namespace EncryptzTests
{
    public class TenantConnectionStringTests
    {
        [Fact]
        public void Builds_a_connection_string_from_its_parts()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("10.0.0.5", "TenantA", "app", "p@ss", null));

            Assert.Equal("10.0.0.5", parsed.DataSource);
            Assert.Equal("TenantA", parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
            Assert.Equal("p@ss", parsed.Password);
            Assert.True(parsed.TrustServerCertificate);
            Assert.True(parsed.MultipleActiveResultSets);
        }

        [Theory]
        [InlineData("Tenant;User ID=sa")]
        [InlineData("Tenant';DROP")]
        [InlineData("Ten\"ant=x")]
        public void A_name_with_separators_stays_inside_its_own_field(string database)
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("srv", database, "app", "pw;Initial Catalog=master", null));

            Assert.Equal(database, parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
            Assert.Equal("pw;Initial Catalog=master", parsed.Password);
        }

        [Fact]
        public void Extra_options_are_appended()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("srv", "db", "app", "pw", " Connect Timeout=7; "));

            Assert.Equal(7, parsed.ConnectTimeout);
            Assert.Equal("db", parsed.InitialCatalog);
        }

        [Theory]
        [InlineData(null, "db", "u")]
        [InlineData("srv", " ", "u")]
        [InlineData("srv", "db", "")]
        public void Incomplete_details_are_refused(string? server, string? database, string? user)
        {
            Assert.Throws<InvalidOperationException>(
                () => TenantConnectionString.Build(server, database, user, "pw", null));
        }

        [Fact]
        public void Values_are_trimmed()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build(" srv ", " db ", " app ", "pw", null));

            Assert.Equal("srv", parsed.DataSource);
            Assert.Equal("db", parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
        }
    }
}
