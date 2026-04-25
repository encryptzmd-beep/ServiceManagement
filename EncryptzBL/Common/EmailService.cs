using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace EncryptzBL.Common
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendEmailAsync(string to, string subject, string body, bool isHtml = true)
        {
            var smtpSection = _config.GetSection("Smtp");
            var host = smtpSection["Host"];
            var port = int.Parse(smtpSection["Port"] ?? "587");
            var userName = smtpSection["UserName"];
            var password = smtpSection["Password"];
            var fromEmail = smtpSection["FromEmail"];
            var fromName = smtpSection["FromName"];
            var enableSsl = bool.Parse(smtpSection["EnableSsl"] ?? "true");

            using (var client = new SmtpClient(host, port))
            {
                client.Credentials = new NetworkCredential(userName, password);
                client.EnableSsl = enableSsl;

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = isHtml
                };
                mailMessage.To.Add(to);

                await client.SendMailAsync(mailMessage);
            }
        }
    }
}
