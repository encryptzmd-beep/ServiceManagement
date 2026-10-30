using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.Infrastructure.Wallet;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The platform address and the mail server as Platform Admin settings (MainDB script 30).</summary>
    public class PlatformUrlAndMailSettingsTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "MainDB", "30_Platform_Url_And_Mail_Settings.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "MainDB", "30_Platform_Url_And_Mail_Settings.sql"));
        }

        private static IConfiguration AppSettingsSmtp() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Smtp:Host"] = "smtp.gmail.com", ["Smtp:Port"] = "587", ["Smtp:EnableSsl"] = "true",
            ["Smtp:UserName"] = "app@x.com", ["Smtp:Password"] = "from-appsettings",
            ["Smtp:FromEmail"] = "app@x.com", ["Smtp:FromName"] = "App"
        }).Build().GetSection("Smtp");

        // ── the script ──

        [Fact]
        public void The_script_adds_only_missing_settings()
        {
            var s = Script();
            Assert.Contains("WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings s WHERE s.SettingKey = v.SettingKey)", s);
            foreach (var key in new[] { "PublicUrl", "SmtpHost", "SmtpPort", "SmtpEnableSsl", "SmtpUserName", "SmtpPassword", "SmtpFromEmail", "SmtpFromName" })
                Assert.Contains($"('{key}',", s);
            Assert.DoesNotContain("UPDATE", s, StringComparison.OrdinalIgnoreCase);
        }

        // ── the rules ──

        [Theory]
        [InlineData("https://serviceapp.encryptz.in/", "https://serviceapp.encryptz.in")]
        [InlineData(" https://encryptz.in/app ", "https://encryptz.in/app")]
        [InlineData("http://localhost:4200", "http://localhost:4200")]
        public void A_platform_address_is_kept_without_the_last_slash(string input, string expected)
            => Assert.Equal((expected, (string?)null), PlatformSettingRules.Validate(PlatformSettingRules.PublicUrl, input));

        [Theory]
        [InlineData("")]
        [InlineData("serviceapp.encryptz.in")]
        [InlineData("javascript:alert(1)")]
        [InlineData("ftp://x.in")]
        [InlineData("https://x.in/?a=1")]
        [InlineData("https://user:pw@x.in")]
        public void A_bad_platform_address_is_refused(string input)
            => Assert.Null(PlatformSettingRules.Validate(PlatformSettingRules.PublicUrl, input).Value);

        [Theory]
        [InlineData("SmtpHost", "smtp.gmail.com", "smtp.gmail.com")]
        [InlineData("SmtpHost", "", "")]
        [InlineData("SmtpPort", "465", "465")]
        [InlineData("SmtpPort", "", "")]
        [InlineData("SmtpEnableSsl", "TRUE", "true")]
        [InlineData("SmtpEnableSsl", "false", "false")]
        [InlineData("SmtpUserName", "donotreply@x.com", "donotreply@x.com")]
        [InlineData("SmtpFromEmail", "donotreply@x.com", "donotreply@x.com")]
        [InlineData("SmtpFromName", "Encryptz Support", "Encryptz Support")]
        [InlineData("SmtpPassword", "abcd efgh ijkl mnop", "abcd efgh ijkl mnop")]
        [InlineData("SmtpPassword", "", "")]
        public void Mail_settings_accept_good_values(string key, string input, string expected)
            => Assert.Equal((expected, (string?)null), PlatformSettingRules.Validate(key, input));

        [Theory]
        [InlineData("SmtpHost", "smtp gmail.com")]
        [InlineData("SmtpPort", "0")]
        [InlineData("SmtpPort", "70000")]
        [InlineData("SmtpEnableSsl", "yes")]
        [InlineData("SmtpUserName", "a b")]
        [InlineData("SmtpFromEmail", "not-mail")]
        [InlineData("SmtpFromName", "a\r\nBcc: x@y.z")]
        [InlineData("SmtpPassword", "********")]
        public void Mail_settings_refuse_bad_values(string key, string input)
            => Assert.Null(PlatformSettingRules.Validate(key, input).Value);

        [Fact]
        public void Only_the_password_is_a_secret()
        {
            Assert.True(PlatformSettingRules.IsSecret("SmtpPassword"));
            Assert.False(PlatformSettingRules.IsSecret("SmtpUserName"));
            Assert.False(PlatformSettingRules.IsSecret("PublicUrl"));
        }

        // ── which value is used ──

        [Fact]
        public void Empty_mail_settings_use_appsettings()
        {
            var o = EmailService.Resolve(new Dictionary<string, string> { ["SmtpHost"] = "", ["SmtpPassword"] = "" }, AppSettingsSmtp(), _ => "never");
            Assert.Equal(new SmtpOptions("smtp.gmail.com", 587, true, "app@x.com", "from-appsettings", "app@x.com", "App"), o);
        }

        [Fact]
        public void Set_mail_settings_win_and_the_password_is_decrypted()
        {
            var settings = new Dictionary<string, string>
            {
                ["SmtpHost"] = "mail.encryptz.in", ["SmtpPort"] = "465", ["SmtpEnableSsl"] = "false",
                ["SmtpUserName"] = "u@encryptz.in", ["SmtpPassword"] = "CIPHER",
                ["SmtpFromEmail"] = "noreply@encryptz.in", ["SmtpFromName"] = "Encryptz"
            };
            var o = EmailService.Resolve(settings, AppSettingsSmtp(), c => c == "CIPHER" ? "plain" : "wrong");
            Assert.Equal(new SmtpOptions("mail.encryptz.in", 465, false, "u@encryptz.in", "plain", "noreply@encryptz.in", "Encryptz"), o);
        }

        [Theory]
        [InlineData("https://encryptz.in/", "https://cfg.in", "https://encryptz.in")]
        [InlineData("", "https://cfg.in/", "https://cfg.in")]
        [InlineData(null, null, "https://serviceapp.encryptz.in")]
        public void The_link_address_is_the_setting_then_appsettings_then_the_default(string? setting, string? config, string expected)
            => Assert.Equal(expected, WalletService.ResolvePublicUrl(setting, config));
    }
}
