using System.Security.Claims;
using EncryptzBL.Common;
using EncryptzBL.Infrastructure.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace EncryptzAPI.Hubs
{
    /// <summary>
    /// The open pages of a logged-in user listen here for their notifications, whatever
    /// application they come from. The hub only sends: a page never sends anything to it.
    /// A person is in a group of their own (main-database user id of the token); a token
    /// that is not a main-database login (a customer-portal token) is not let in.
    /// </summary>
    [Authorize]
    public sealed class NotificationHub : Hub
    {
        public const string Path = "/hubs/notifications";

        /// <summary>The message a page receives: one NotificationDto.</summary>
        public const string Message = "notification";

        public static string? GroupFor(ClaimsPrincipal? user)
        {
            var id = MainIdentity.UserId(user);
            return id > 0 ? NotificationRules.GroupOf(id) : null;
        }

        public override async Task OnConnectedAsync()
        {
            var group = GroupFor(Context.User);
            if (group == null)
            {
                Context.Abort();
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, group);
            await base.OnConnectedAsync();
        }
    }

    /// <summary>Sends a notification to the open pages of one person.</summary>
    public sealed class HubNotificationPush : INotificationPush
    {
        private readonly IHubContext<NotificationHub> _hub;

        public HubNotificationPush(IHubContext<NotificationHub> hub) => _hub = hub;

        public Task PushAsync(int userId, NotificationDto notification)
            => _hub.Clients.Group(NotificationRules.GroupOf(userId)).SendAsync(NotificationHub.Message, notification);
    }
}
