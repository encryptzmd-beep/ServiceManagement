using Xunit;

namespace EncryptzTests
{
    /// <summary>MainDB script 27: the wallet (credits ledger and referrals).</summary>
    public class WalletScriptTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "MainDB", "27_Wallet.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "MainDB", "27_Wallet.sql"));
        }

        private static string Procedure(string name)
        {
            var s = Script();
            var body = s.Substring(s.IndexOf($"PROCEDURE dbo.{name}", StringComparison.Ordinal));
            return body.Substring(0, body.IndexOf("\nGO", StringComparison.Ordinal));
        }

        private static string Trigger()
        {
            var s = Script();
            var body = s.Substring(s.IndexOf("TRIGGER dbo.TR_Users_Wallet", StringComparison.Ordinal));
            return body.Substring(0, body.IndexOf("\nGO", StringComparison.Ordinal));
        }

        [Fact]
        public void The_script_guards_the_database_and_is_rerunnable()
        {
            var s = Script();
            Assert.Contains("OBJECT_ID('dbo.Users') IS NULL", s);
            Assert.Contains("IF OBJECT_ID('dbo.WalletLedger') IS NULL", s);
            Assert.Contains("IF OBJECT_ID('dbo.Referrals') IS NULL", s);
            Assert.DoesNotContain("DROP TABLE", s, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("DELETE FROM dbo.WalletLedger", s, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("UPDATE dbo.WalletLedger", s, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("PROCEDURE dbo.sp_Wallet_OnUserOnboarded")]
        [InlineData("PROCEDURE dbo.sp_User_SelfRegister")]
        [InlineData("PROCEDURE dbo.sp_Wallet_GetBalance")]
        [InlineData("PROCEDURE dbo.sp_Wallet_GetLedger")]
        [InlineData("PROCEDURE dbo.sp_Wallet_GetReferrals")]
        [InlineData("PROCEDURE dbo.sp_Wallet_SaveReferral")]
        [InlineData("FUNCTION dbo.fn_Wallet_IsOnboarded")]
        [InlineData("TRIGGER dbo.TR_Users_Wallet")]
        public void Each_object_is_create_or_alter(string obj)
            => Assert.Contains($"CREATE OR ALTER {obj}", Script());

        [Theory]
        [InlineData("WelcomeCredits", true)]
        [InlineData("ReferralCredits", true)]
        [InlineData("WalletStartedAt", false)]
        public void Settings_are_seeded_only_when_missing(string key, bool zero)
        {
            var s = Script();
            var at = s.IndexOf($"'{key}'", StringComparison.Ordinal);
            Assert.True(at >= 0, key);
            var start = s.LastIndexOf("INSERT INTO dbo.PlatformSettings", at, StringComparison.Ordinal);
            Assert.True(start >= 0, key);
            var block = s.Substring(start, s.IndexOf(';', at) - start);
            Assert.Contains("WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings", block);
            if (zero) Assert.Contains("'0'", block);
        }

        [Fact]
        public void The_wallet_app_is_a_released_personal_app()
        {
            var s = Script();
            Assert.Contains("N'WALLET'", s);
            Assert.Contains("N'apps/wallet'", s);
            Assert.Contains("N'Personal'", s);
        }

        [Fact]
        public void Payment_is_idempotent()
        {
            var p = Procedure("sp_Wallet_OnUserOnboarded");
            foreach (var t in new[] { "UPDLOCK", "'Welcome'", "'ReferralJoined'", "'ReferralInviter'", "'Credited'", "fn_Wallet_IsOnboarded", "WalletStartedAt" })
                Assert.Contains(t, p);
            var s = Script();
            Assert.Contains("UX_WalletLedger_Welcome", s);
            Assert.Contains("UX_WalletLedger_Referral", s);
        }

        [Fact]
        public void Emails_are_compared_normalized()
            => Assert.Contains("LOWER(LTRIM(RTRIM(", Procedure("sp_Wallet_OnUserOnboarded"));

        [Fact]
        public void The_trigger_does_not_raise_or_roll_back()
        {
            var t = Trigger();
            Assert.Contains("TRIGGER_NESTLEVEL", t);
            Assert.Contains("sp_Wallet_OnUserOnboarded", t);
            Assert.DoesNotContain("RAISERROR", t, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("ROLLBACK", t, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_trigger_does_not_doom_the_callers_transaction()
            => Assert.Contains("SET XACT_ABORT OFF", Trigger());

        [Fact]
        public void A_resend_is_only_for_sent_invites_and_keeps_the_first_send_date()
        {
            var s = Script();
            var p = Procedure("sp_Wallet_SaveReferral");
            Assert.Contains("COL_LENGTH('dbo.Referrals', 'LastSentAt')", s);
            Assert.Contains("@OldStatus <> 'Sent'", p);
            Assert.Contains("SET LastSentAt = SYSDATETIME()", p);
            Assert.DoesNotContain("SET SentAt", p);
            Assert.Contains("ISNULL(LastSentAt, SentAt)", p);
        }

        [Fact]
        public void The_ledger_is_append_only_with_known_kinds()
        {
            var s = Script();
            Assert.Contains("CK_WalletLedger_Kind", s);
            Assert.Contains("'Welcome', 'ReferralJoined', 'ReferralInviter', 'Redeem', 'Adjustment'", s);
            var t = s.Substring(s.IndexOf("TRIGGER dbo.TR_WalletLedger_NoChange", StringComparison.Ordinal));
            t = t.Substring(0, t.IndexOf("\nGO", StringComparison.Ordinal));
            Assert.Contains("INSTEAD OF UPDATE, DELETE", t);
            Assert.Contains("Wallet entries cannot be changed or deleted; add a correcting entry.", t);
        }

        [Fact]
        public void The_trigger_skips_updates_that_do_not_touch_name_or_mobile()
        {
            var t = Trigger();
            Assert.Contains("UPDATE(FullName)", t);
            Assert.Contains("UPDATE(MobileNumber)", t);
            Assert.Contains("FROM deleted", t);
        }

        [Fact]
        public void The_email_lookups_are_sargable()
        {
            var s = Script();
            Assert.Contains("IX_Referrals_Email", s);
            Assert.DoesNotContain("LOWER(LTRIM(RTRIM(Email))) = @Email", s);
        }

        [Fact]
        public void Self_register_passes_the_token()
        {
            var p = Procedure("sp_User_SelfRegister");
            Assert.Contains("@ReferralToken", p);
            Assert.Contains("sp_set_session_context", p);
            Assert.Contains("'Email already registered'", p);
            Assert.Contains("'Mobile number already registered'", p);
        }

        [Fact]
        public void Save_referral_answers_every_case()
        {
            var p = Procedure("sp_Wallet_SaveReferral");
            foreach (var t in new[] { "'Created'", "'Resent'", "'Self'", "'HasAccount'", "'Limit'", "'Invalid'", "20" })
                Assert.Contains(t, p);
        }
    }
}
