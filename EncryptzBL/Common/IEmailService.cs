using System.Threading.Tasks;

namespace EncryptzBL.Common
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string body, bool isHtml = true);
    }
}
