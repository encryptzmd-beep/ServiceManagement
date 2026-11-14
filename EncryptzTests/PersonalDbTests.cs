using System.Text.RegularExpressions;
using EncryptzBL.Common;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EncryptzTests
{
    public class PersonalDbTests
    {
        private static IConfiguration Config(string? connection)
        {
            var values = new Dictionary<string, string?>();
            if (connection != null) values["ConnectionStrings:PersonalConnection"] = connection;
            return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Without_a_connection_string_the_api_still_starts(string? connection)
        {
            var helper = new PersonalDbHelper(Config(connection));

            Assert.False(helper.IsConfigured);
        }

        [Fact]
        public void With_a_connection_string_it_is_configured()
        {
            var helper = new PersonalDbHelper(Config("Server=x;Database=PersonalDB;Integrated Security=true"));

            Assert.True(helper.IsConfigured);
        }

        [Fact]
        public void The_message_for_users_names_no_database()
        {
            Assert.Equal("This application is not available right now", PersonalDbHelper.NotAvailable);
        }

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Schema()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "PersonalDB", "01_Schema.sql"));

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_schema_script_never_switches_creates_or_drops_a_database(string forbidden)
        {
            var code = Regex.Replace(Schema(), @"/\*.*?\*/", "", RegexOptions.Singleline);
            code = Regex.Replace(code, @"--[^\n]*", "");

            Assert.DoesNotContain(forbidden, code, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("OBJECT_ID('dbo.Companies') IS NOT NULL")]   // the main database
        [InlineData("OBJECT_ID('dbo.Locations') IS NOT NULL")]   // a company database
        [InlineData("DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')")]
        public void The_schema_script_refuses_every_database_that_is_not_the_personal_one(string guard)
        {
            var script = Schema();

            Assert.Contains(guard, script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        [Fact]
        public void The_personal_db_is_registered_next_to_the_main_one()
        {
            var registration = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "SrvInjection", "ServiceRegistration.cs"));

            Assert.Contains("services.AddScoped<PersonalDbHelper>();", registration);
        }
    }
}
