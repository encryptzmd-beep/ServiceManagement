using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Tenant;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace EncryptzBL.Common
{
    /// <summary>The mail server as it is used: each value from Platform Admin > Settings, else from the Smtp section of appsettings.json.</summary>
    public sealed record SmtpOptions(string Host, int Port, bool EnableSsl, string UserName, string Password, string FromEmail, string FromName);

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly PlatformSettingsReader _settings;
        private readonly ITenantSecretProtector _protector;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, PlatformSettingsReader settings, ITenantSecretProtector protector, ILogger<EmailService> logger)
        {
            _config = config;
            _settings = settings;
            _protector = protector;
            _logger = logger;
        }

        public async Task SendEmailAsync(string to, string subject, string body, bool isHtml = true)
        {
            var smtp = Resolve(await _settings.ReadAll(), _config.GetSection("Smtp"), Unprotect);

            using (var client = new SmtpClient(smtp.Host, smtp.Port))
            {
                client.Credentials = new NetworkCredential(smtp.UserName, smtp.Password);
                client.EnableSsl = smtp.EnableSsl;

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(smtp.FromEmail, smtp.FromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = isHtml
                };
                mailMessage.To.Add(to);

                await client.SendMailAsync(mailMessage);
            }
        }

        /// <summary>A setting that is set wins; an empty one falls back to appsettings.json (Smtp section).</summary>
        internal static SmtpOptions Resolve(IReadOnlyDictionary<string, string> settings, IConfiguration smtpSection, Func<string, string> unprotect)
        {
            string Pick(string key, string configKey)
                => settings.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : smtpSection[configKey] ?? "";

            var password = settings.TryGetValue(PlatformSettingRules.SmtpPassword, out var stored) && !string.IsNullOrWhiteSpace(stored)
                ? unprotect(stored)
                : smtpSection["Password"] ?? "";

            return new SmtpOptions(
                Pick(PlatformSettingRules.SmtpHost, "Host"),
                int.TryParse(Pick(PlatformSettingRules.SmtpPort, "Port"), out var port) ? port : 587,
                !bool.TryParse(Pick(PlatformSettingRules.SmtpEnableSsl, "EnableSsl"), out var ssl) || ssl,
                Pick(PlatformSettingRules.SmtpUserName, "UserName"),
                password,
                Pick(PlatformSettingRules.SmtpFromEmail, "FromEmail"),
                Pick(PlatformSettingRules.SmtpFromName, "FromName"));
        }

        /// <summary>The stored password; one that cannot be decrypted (another Tenant:SecretKey) is not used.</summary>
        private string Unprotect(string stored)
        {
            try
            {
                return _protector.Unprotect(stored);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("The mail password of Platform Admin could not be decrypted ({ExceptionType}); appsettings.json is used", ex.GetType().Name);
                return _config["Smtp:Password"] ?? "";
            }
        }
    }
}
