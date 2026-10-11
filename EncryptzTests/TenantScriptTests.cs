using EncryptzBL.Common.Provisioning;
using Xunit;

namespace EncryptzTests
{
    public class TenantScriptTests
    {
        private const string Settings = @"IF OBJECT_ID('tempdb..#TenantSettings') IS NOT NULL DROP TABLE #TenantSettings;

CREATE TABLE #TenantSettings
(
    CompanyId       INT           NOT NULL,   -- a comment
    ProjectId       INT           NOT NULL,
    LocationName    NVARCHAR(200) NOT NULL,
    LocationCode    NVARCHAR(50)  NULL,
    LocationCity    NVARCHAR(100) NULL,
    CopyLookupsFrom SYSNAME       NULL        -- existing service DB
);

INSERT INTO #TenantSettings (CompanyId, ProjectId, LocationName, LocationCode, LocationCity, CopyLookupsFrom)
VALUES (0, 0, N'Head Office', N'HO', NULL, N'FelixServiceDB');";

        private static string Script(params string[] batches) => string.Join("\nGO\n", batches) + "\nGO\n";

        [Fact]
        public void The_hand_edited_settings_batch_is_left_out()
        {
            var script = TenantScript.Parse(Script("SET NOCOUNT ON;", Settings, "SELECT CompanyId FROM #TenantSettings;", "CREATE TABLE dbo.A (Id INT);"));

            Assert.Equal(new[] { "SET NOCOUNT ON;", "SELECT CompanyId FROM #TenantSettings;", "CREATE TABLE dbo.A (Id INT);" }, script.Batches);
        }

        [Fact]
        public void A_script_without_a_settings_batch_is_refused()
        {
            var ex = Assert.Throws<InvalidOperationException>(() => TenantScript.Parse(Script("SET NOCOUNT ON;", "CREATE TABLE dbo.A (Id INT);")));

            Assert.Contains("settings", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void A_script_with_two_settings_batches_is_refused()
        {
            Assert.Throws<InvalidOperationException>(() => TenantScript.Parse(Script(Settings, "SELECT 1;", Settings)));
        }

        [Theory]
        [InlineData("CopyLookupsFrom SYSNAME       NULL", "CopyLookupsFrom SYSNAME NULL,\n    Extra INT NULL")]
        [InlineData("LocationCity    NVARCHAR(100) NULL,", "")]
        [InlineData("ProjectId       INT", "ScopeId         INT")]
        public void A_settings_table_with_other_columns_is_refused(string find, string replace)
        {
            var changed = Settings.Replace(find, replace);
            Assert.NotEqual(Settings, changed);

            Assert.Throws<InvalidOperationException>(() => TenantScript.Parse(Script(changed, "SELECT 1;")));
        }

        [Theory]
        [InlineData("CREATE DATABASE X;")]
        [InlineData("  create database [X]")]
        [InlineData("DROP DATABASE X;")]
        [InlineData("USE [master]")]
        [InlineData("ALTER DATABASE X SET RECOVERY SIMPLE")]
        public void A_script_with_a_database_level_statement_is_refused(string statement)
        {
            Assert.Throws<InvalidOperationException>(() => TenantScript.Parse(Script(Settings, "SELECT 1;\n" + statement)));
        }

        [Fact]
        public void The_table_the_API_creates_has_the_columns_the_script_reads()
        {
            foreach (var column in new[] { "CompanyId", "ProjectId", "LocationName", "LocationCode", "LocationCity", "CopyLookupsFrom" })
            {
                Assert.Contains(column, TenantScript.CreateSettingsTableSql);
                Assert.Contains("@" + column, TenantScript.InsertSettingsSql);
            }

            Assert.StartsWith("CREATE TABLE #TenantSettings", TenantScript.CreateSettingsTableSql);
        }

        // ── the real script of the repository ─────────────────────────────────

        private static string RepositoryScriptPath()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "EncryptzAPI", "Database", "ProjectDB")))
                dir = dir.Parent;

            Assert.NotNull(dir);
            return Path.Combine(dir!.FullName, "EncryptzAPI", "Database", "ProjectDB", "New_Tenant_Database.sql");
        }

        [Fact]
        public void The_real_tenant_script_has_the_shape_the_API_relies_on()
        {
            var script = TenantScript.Load(RepositoryScriptPath());

            Assert.True(script.Batches.Count > 1000, $"only {script.Batches.Count} batches");
            Assert.DoesNotContain(script.Batches, b => b.Contains("CREATE TABLE #TenantSettings", StringComparison.OrdinalIgnoreCase));
            // the script's own safety checks stay in: they stop everything on a wrong database
            Assert.Contains(script.Batches, b => b.Contains("SET NOEXEC ON") && b.Contains("already has service tables"));
            // later batches still read the settings the API supplies
            Assert.Contains(script.Batches, b => b.Contains("FROM #TenantSettings"));
        }

        [Fact]
        public void The_table_the_API_creates_matches_the_real_script_column_by_column()
        {
            // name, type (with its length) and nullability of every column, in order
            var real = TenantScript.SettingsColumnDefinitions(File.ReadAllText(RepositoryScriptPath()));
            var supplied = TenantScript.SettingsColumnDefinitions(TenantScript.CreateSettingsTableSql);

            Assert.Equal(6, real.Count);
            Assert.Equal(real, supplied);
        }

        [Fact]
        public void Column_definitions_are_read_without_comments_and_extra_blanks()
        {
            var columns = TenantScript.SettingsColumnDefinitions(Settings);

            Assert.Equal(new[]
            {
                "COMPANYID INT NOT NULL", "PROJECTID INT NOT NULL", "LOCATIONNAME NVARCHAR(200) NOT NULL",
                "LOCATIONCODE NVARCHAR(50) NULL", "LOCATIONCITY NVARCHAR(100) NULL", "COPYLOOKUPSFROM SYSNAME NULL"
            }, columns);
        }

        [Theory]
        [InlineData("LocationName    NVARCHAR(200) NOT NULL", "LocationName    NVARCHAR(100) NOT NULL")]
        [InlineData("LocationName    NVARCHAR(200) NOT NULL", "LocationName    NVARCHAR ( 200 ) NULL")]
        [InlineData("LocationCode    NVARCHAR(50)  NULL", "LocationCode    VARCHAR(50)  NULL")]
        [InlineData("CopyLookupsFrom SYSNAME       NULL", "CopyLookupsFrom SYSNAME       NOT NULL")]
        public void A_changed_type_length_or_nullability_shows_in_the_column_definitions(string find, string replace)
        {
            var changed = Settings.Replace(find, replace);
            Assert.NotEqual(Settings, changed);

            Assert.NotEqual(
                TenantScript.SettingsColumnDefinitions(TenantScript.CreateSettingsTableSql),
                TenantScript.SettingsColumnDefinitions(changed));
        }

        [Fact]
        public void The_script_is_shipped_next_to_the_API()
        {
            var csproj = File.ReadAllText(Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(Path.GetDirectoryName(RepositoryScriptPath())!)!)!, "EncryptzAPI.csproj"));

            Assert.Contains("New_Tenant_Database.sql", csproj);
            Assert.Contains("CopyToOutputDirectory", csproj);
        }
    }
}
