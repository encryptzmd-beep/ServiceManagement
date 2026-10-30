using Xunit;

namespace EncryptzTests
{
    /// <summary>MainDB script 29: an invite link of one's own; referral credits for the inviter only.</summary>
    public class WalletInviteLinkScriptTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "MainDB", "29_Wallet_Invite_Link.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "MainDB", "29_Wallet_Invite_Link.sql"));
        }

        private static string Procedure(string name)
        {
            var s = Script();
            var body = s.Substring(s.IndexOf($"PROCEDURE dbo.{name}", StringComparison.Ordinal));
            return body.Substring(0, body.IndexOf("\nGO", StringComparison.Ordinal));
        }

        [Fact]
        public void The_script_needs_script_27_and_is_rerunnable()
        {
            var s = Script();
            Assert.Contains("OBJECT_ID('dbo.WalletLedger') IS NULL", s);
            Assert.Contains("IF OBJECT_ID('dbo.WalletInviteKeys') IS NULL", s);
            Assert.DoesNotContain("DROP TABLE", s, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("UPDATE dbo.WalletLedger", s, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("DELETE", s, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("sp_Wallet_GetInviteKey")]
        [InlineData("sp_User_SelfRegister")]
        [InlineData("sp_Wallet_OnUserOnboarded")]
        public void Each_procedure_is_create_or_alter(string sp)
            => Assert.Contains($"CREATE OR ALTER PROCEDURE dbo.{sp}", Script());

        [Fact]
        public void The_key_is_random_and_not_the_user_id()
        {
            var p = Procedure("sp_Wallet_GetInviteKey");
            Assert.Contains("CRYPT_GEN_RANDOM", p);
            Assert.Contains("UQ_WalletInviteKeys_Key", Script());
        }

        [Fact]
        public void Self_register_passes_the_inviter_key_and_clears_it()
        {
            var p = Procedure("sp_User_SelfRegister");
            Assert.Contains("@InviterKey", p);
            Assert.Contains("sp_set_session_context N'InviterKey', @InviterKey", p);
            Assert.Contains("sp_set_session_context N'InviterKey', NULL", p);
            Assert.Contains("'Email already registered'", p);
        }

        [Fact]
        public void Only_the_inviter_is_paid_for_a_referral()
        {
            var p = Procedure("sp_Wallet_OnUserOnboarded");
            Assert.Contains("'ReferralInviter'", p);
            Assert.DoesNotContain("'ReferralJoined'", p);
            Assert.Contains("SESSION_CONTEXT(N'InviterKey')", p);
            Assert.Contains("@KeyOwner <> @UserId", p);
            Assert.Contains("UPDLOCK", p);
        }
    }
}
