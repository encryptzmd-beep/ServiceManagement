using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Text checks on script 21: it cannot be run in a test (the server is live).</summary>
    public class ApplicationsScriptTests
    {
        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Script()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "21_Applications.sql"));

        /// <summary>Text of one procedure: from its CREATE to the next GO.</summary>
        private static string Procedure(string name)
        {
            var script = Script();
            var start = script.IndexOf("CREATE OR ALTER PROCEDURE dbo." + name, StringComparison.Ordinal);
            Assert.True(start >= 0, name + " is not in script 21");
            var end = script.IndexOf("\nGO", start, StringComparison.Ordinal);
            return script.Substring(start, (end < 0 ? script.Length : end) - start);
        }

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_or_drops(string forbidden)
        {
            var code = Regex.Replace(Script(), @"/\*.*?\*/", "", RegexOptions.Singleline);
            code = Regex.Replace(code, @"--[^\n]*", "");

            Assert.DoesNotContain(forbidden, code, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_script_refuses_to_run_before_script_20()
        {
            var script = Script();

            Assert.Contains("OBJECT_ID('dbo.sp_Company_GetCreationState') IS NULL", script);
            Assert.Contains("OBJECT_ID('dbo.sp_Platform_GetCompanyModules') IS NULL", script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        [Theory]
        [InlineData("AppType")]
        [InlineData("RoutePath")]
        [InlineData("IsReleased")]
        [InlineData("Family")]
        public void Each_new_column_is_added_only_when_it_is_missing(string column)
        {
            Assert.Contains($"IF COL_LENGTH('dbo.Modules', '{column}') IS NULL", Script());
        }

        [Theory]
        [InlineData("INVENTORY", "Commercial")]
        [InlineData("CRM", "Commercial")]
        [InlineData("ACCOUNTS", "Commercial")]
        [InlineData("PAYROLL", "Commercial")]
        [InlineData("JOBCONSULTANCY", "Commercial")]
        [InlineData("SCHOOL", "Commercial")]
        [InlineData("JOBPORTAL", "Personal")]
        [InlineData("EXPENSE", "Personal")]
        public void Each_new_application_is_seeded_as_coming_soon(string key, string type)
        {
            // one line per application: (N'KEY', N'Name', N'Description', N'icon', sort, N'Type')
            Assert.Matches(@"\(N'" + key + @"',[^\n]*N'" + type + @"'\)", Script());
        }

        [Theory]
        [InlineData("sp_User_GetModules")]
        [InlineData("sp_User_ValidateScope")]
        [InlineData("sp_Platform_GetCompanyModules")]
        [InlineData("sp_Platform_SetCompanyModule")]
        [InlineData("sp_Platform_GetModuleAccess")]
        [InlineData("sp_Platform_SetModuleAccess")]
        public void Company_procedures_see_commercial_applications_only(string name)
        {
            Assert.Contains("AppType = 'Commercial'", Procedure(name));
        }

        [Fact]
        public void Personal_applications_are_listed_by_their_own_procedure()
        {
            var body = Procedure("sp_User_GetPersonalApps");

            Assert.Contains("AppType = 'Personal'", body);
            Assert.Contains("IsActive = 1", body);
        }

        [Fact]
        public void A_company_cannot_be_subscribed_to_an_application_that_is_not_released()
        {
            Assert.Contains("This application is not available yet", Procedure("sp_Platform_SetCompanyModule"));
        }

        [Theory]
        [InlineData("The key is already used")]
        [InlineData("The key of an application cannot be changed")]
        [InlineData("The type cannot be changed while a company is subscribed")]
        [InlineData("A personal application needs a route before it is released")]
        public void Saving_an_application_refuses_what_the_spec_refuses(string message)
        {
            Assert.Contains(message, Procedure("sp_Platform_SaveModule"));
        }

        [Fact]
        public void The_readme_tells_to_run_it_again_after_scripts_14_and_19()
        {
            var readme = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "21_Applications_README.md"));

            Assert.Contains("14_Company_Tenancy_Cutover.sql", readme);
            Assert.Contains("19_Module_Management.sql", readme);
            Assert.Contains("run `21_Applications.sql` again", readme);
        }
    }
}
