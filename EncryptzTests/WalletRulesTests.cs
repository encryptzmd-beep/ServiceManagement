using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Wallet;
using Xunit;

namespace EncryptzTests
{
    public class WalletRulesTests
    {
        private const string NumberRange = "Enter a number from 0 to 100000";

        [Theory]
        [InlineData(PlatformSettingRules.WelcomeCredits)]
        [InlineData(PlatformSettingRules.ReferralCredits)]
        public void A_credit_setting_is_a_number_from_0_to_100000(string key)
        {
            Assert.Equal(("250", (string?)null), PlatformSettingRules.Validate(key, "250"));
            Assert.Equal(("0", (string?)null), PlatformSettingRules.Validate(key, "0"));
            Assert.Equal(("100000", (string?)null), PlatformSettingRules.Validate(key, " 100000 "));
        }

        [Theory]
        [InlineData(PlatformSettingRules.WelcomeCredits, "100001")]
        [InlineData(PlatformSettingRules.WelcomeCredits, "-1")]
        [InlineData(PlatformSettingRules.WelcomeCredits, "abc")]
        [InlineData(PlatformSettingRules.WelcomeCredits, "")]
        [InlineData(PlatformSettingRules.ReferralCredits, "100001")]
        [InlineData(PlatformSettingRules.ReferralCredits, "-1")]
        [InlineData(PlatformSettingRules.ReferralCredits, "abc")]
        [InlineData(PlatformSettingRules.ReferralCredits, "")]
        [InlineData(PlatformSettingRules.ReferralCredits, "99999999999")]
        public void Any_other_credit_setting_is_refused(string key, string input)
        {
            Assert.Equal((null, NumberRange), PlatformSettingRules.Validate(key, input));
        }

        [Fact]
        public void The_wallet_start_date_is_not_editable()
        {
            Assert.Equal((null, "Unknown setting"), PlatformSettingRules.Validate(PlatformSettingRules.WalletStartedAt, "2026-01-01"));
        }

        [Fact]
        public void The_limits_are_20_invites_a_day_and_100000_credits()
        {
            Assert.Equal(20, WalletRules.MaxInvitesPerDay);
            Assert.Equal(100000, WalletRules.MaxCredits);
        }

        [Theory]
        [InlineData(" Anu@X.com ", "anu@x.com")]
        [InlineData("A@B.CO", "a@b.co")]
        [InlineData(null, "")]
        public void An_email_is_trimmed_and_lower_cased(string? input, string expected)
        {
            Assert.Equal(expected, WalletRules.NormalizeEmail(input));
        }

        [Theory]
        [InlineData("x")]
        [InlineData("")]
        [InlineData(null)]
        public void An_invite_needs_a_valid_email(string? input)
        {
            Assert.Equal("Enter a valid e-mail address", WalletRules.InviteProblem(input));
        }

        [Fact]
        public void A_valid_email_has_no_invite_problem()
        {
            Assert.Null(WalletRules.InviteProblem("a@b.co"));
        }

        [Theory]
        [InlineData("Self", "You cannot invite yourself")]
        [InlineData("HasAccount", "This person already has an account")]
        [InlineData("Limit", "You can send up to 20 invites a day")]
        [InlineData("Invalid", "Enter a valid e-mail address")]
        [InlineData("Created", null)]
        [InlineData("Resent", null)]
        public void A_refused_invite_has_a_reason_and_a_sent_one_has_none(string result, string? text)
        {
            Assert.Equal(text, WalletRules.RefusalText(result));
        }

        [Theory]
        [InlineData(" k7m2qx9plr4t ", "K7M2QX9PLR4T")]
        [InlineData("ABC", "ABC")]
        [InlineData("", null)]
        [InlineData(null, null)]
        [InlineData("ABC-DEF", null)]
        [InlineData("x' OR 1=1", null)]
        [InlineData("ABCDEFGHJKMNPQRST", null)]
        public void An_invite_key_is_letters_and_digits_up_to_16(string? input, string? expected)
        {
            Assert.Equal(expected, WalletRules.NormalizeInviteKey(input));
        }
    }
}
