using EncryptzBL.Common.Provisioning;
using Xunit;

namespace EncryptzTests
{
    /// <summary>
    /// A procedure named sp_... that also exists in the server's master database makes
    /// CREATE OR ALTER fail in a new database with error 208 (Invalid object name): the
    /// server finds the one in master, decides to ALTER, and then does not find it here.
    /// The batch is then run once more as a plain CREATE.
    /// </summary>
    public class TenantScriptMasterShadowTests
    {
        private const int InvalidObjectName = 208;

        private const string Batch =
            "/* ====\n   3. Menus\n   ==== */\n"
            + "CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetMenu\n    @CustomerId INT\nAS\nBEGIN\n"
            + "    -- CREATE OR ALTER PROCEDURE dbo.sp_Other stays as it is\n    SELECT 1;\nEND";

        [Fact]
        public void An_sp_procedure_that_failed_with_invalid_object_name_is_tried_as_a_plain_create()
        {
            var plain = SqlTenantDatabaseServer.AsPlainCreate(Batch, InvalidObjectName);

            Assert.NotNull(plain);
            Assert.Contains("\nCREATE PROCEDURE dbo.sp_Customer_GetMenu\n", plain);
            Assert.StartsWith("/* ====", plain);
            // only the statement itself changes, never text further down
            Assert.Contains("-- CREATE OR ALTER PROCEDURE dbo.sp_Other stays as it is", plain);
            Assert.Equal(Batch.Length - " OR ALTER".Length, plain!.Length);
        }

        [Theory]
        [InlineData("CREATE OR ALTER PROCEDURE dbo.sp_X AS SELECT 1;")]
        [InlineData("create or alter proc [dbo].[sp_X] as select 1;")]
        [InlineData("-- a note\n  CREATE   OR\tALTER PROCEDURE sp_X AS SELECT 1;")]
        public void The_spellings_of_the_statement_are_recognised(string batch)
        {
            var plain = SqlTenantDatabaseServer.AsPlainCreate(batch, InvalidObjectName);

            Assert.NotNull(plain);
            Assert.DoesNotContain("ALTER", plain!, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData(207)]    // invalid column name
        [InlineData(2714)]   // there is already an object named ...
        [InlineData(0)]
        public void Any_other_error_is_not_retried(int number)
        {
            Assert.Null(SqlTenantDatabaseServer.AsPlainCreate(Batch, number));
        }

        [Theory]
        [InlineData("CREATE OR ALTER PROCEDURE dbo.usp_X AS SELECT 1;")]           // master is searched for sp_ only
        [InlineData("CREATE OR ALTER FUNCTION dbo.sp_X() RETURNS INT AS BEGIN RETURN 1 END")]
        [InlineData("CREATE OR ALTER VIEW dbo.sp_X AS SELECT 1 AS A;")]
        [InlineData("CREATE PROCEDURE dbo.sp_X AS SELECT 1;")]
        [InlineData("ALTER PROCEDURE dbo.sp_X AS SELECT 1;")]
        [InlineData("SELECT 1 FROM dbo.Missing;")]
        [InlineData("IF 1 = 1 EXEC('CREATE OR ALTER PROCEDURE dbo.sp_X AS SELECT 1;');")]
        [InlineData("")]
        public void Nothing_else_is_retried(string batch)
        {
            Assert.Null(SqlTenantDatabaseServer.AsPlainCreate(batch, InvalidObjectName));
        }

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        [Fact]
        public void The_batch_of_the_shipped_script_that_failed_on_the_live_server_is_covered()
        {
            var script = TenantScript.Parse(File.ReadAllText(
                Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "ProjectDB", "New_Tenant_Database.sql")));
            var batch = script.Batches.Single(b => b.Contains("CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetMenu"));

            var plain = SqlTenantDatabaseServer.AsPlainCreate(batch, InvalidObjectName);

            Assert.NotNull(plain);
            Assert.Contains("CREATE PROCEDURE dbo.sp_Customer_GetMenu", plain);
        }

        [Fact]
        public void Every_batch_of_the_base_script_and_of_the_follow_ups_runs_through_the_retry()
        {
            var source = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzBL", "Common", "Provisioning", "SqlTenantDatabaseServer.cs"));
            var build = source.Substring(source.IndexOf("public async Task BuildTenantAsync", StringComparison.Ordinal));
            build = build.Substring(0, build.IndexOf("private const int InvalidObjectName", StringComparison.Ordinal));

            Assert.Equal(2, build.Split("await RunBatchAsync(conn, batch, ct);").Length - 1);
            Assert.DoesNotContain("new SqlCommand(batch, conn)", build);
        }
    }
}
