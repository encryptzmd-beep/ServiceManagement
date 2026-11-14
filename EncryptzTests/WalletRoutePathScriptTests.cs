using Xunit;

namespace EncryptzTests
{
    /// <summary>MainDB script 28: the Wallet app opens from the launcher (its route starts with /).</summary>
    public class WalletRoutePathScriptTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "MainDB", "28_Wallet_Route_Path.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "MainDB", "28_Wallet_Route_Path.sql"));
        }

        [Fact]
        public void The_route_gets_its_leading_slash_and_a_changed_route_is_kept()
        {
            var s = Script();
            Assert.Contains("SET RoutePath = N'/apps/wallet'", s);
            Assert.Contains("WHERE ModuleKey = N'WALLET' AND RoutePath = N'apps/wallet'", s);
        }

        [Fact]
        public void The_script_needs_script_27_and_touches_no_table_shape()
        {
            var s = Script();
            Assert.Contains("OBJECT_ID('dbo.WalletLedger') IS NULL", s);
            Assert.DoesNotContain("ALTER TABLE", s, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("DELETE", s, StringComparison.OrdinalIgnoreCase);
        }
    }
}
