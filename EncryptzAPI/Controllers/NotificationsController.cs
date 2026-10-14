using EncryptzBL.Common;
using EncryptzBL.Infrastructure.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// The notifications of the logged-in user, of every application (main database). A login
    /// is enough, with or without a company. The user is always the main-database user of the
    /// token, never a value of the request. New ones arrive at once over NotificationHub.
    /// </summary>
    [ApiController]
    [Route("api/notifications")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _notices;

        public NotificationsController(INotificationService notices) => _notices = notices;

        /// <summary>0 for anybody who is not a logged-in user of the main database: the service refuses 0.</summary>
        private int Caller() => MainIdentity.UserId(User);

        [HttpGet]
        public async Task<IActionResult> GetMine()
            => Ok(await _notices.ListMine(Caller()));

        [HttpPost("read")]
        public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest? req)
            => Ok(await _notices.MarkRead(Caller(), req?.NotificationId));
    }
}
