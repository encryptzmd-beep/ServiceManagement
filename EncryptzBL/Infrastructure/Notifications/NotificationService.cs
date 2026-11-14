using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Notifications
{
    /// <summary>Sends a notification to the open pages of one person at once (SignalR in the API).</summary>
    public interface INotificationPush
    {
        Task PushAsync(int userId, NotificationDto notification);
    }

    /// <summary>The notifications of every application, in the main database (MainDB script 24).</summary>
    public interface INotificationService
    {
        /// <summary>Writes the notifications and sends them. Never fails the caller: what goes wrong is logged.</summary>
        Task SendAsync(IReadOnlyCollection<NotificationTarget> targets);

        Task<ApiResponse<NotificationListDto>> ListMine(int userId);

        /// <summary>One notification, or all of them (null), as read. Answers how many are unread now.</summary>
        Task<ApiResponse<int>> MarkRead(int userId, long? notificationId);
    }

    public sealed class NotificationService : BaseRepository, INotificationService
    {
        private const string NotAvailable = "Notifications are not available right now";

        private readonly INotificationPush _push;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(MainDbHelper db, INotificationPush push, ILogger<NotificationService> logger) : base(db)
        {
            _push = push;
            _logger = logger;
        }

        private static SqlParameter In(string name, object? value)
            => SqlParameterHelper.Input(name, value ?? DBNull.Value);

        public async Task SendAsync(IReadOnlyCollection<NotificationTarget> targets)
        {
            foreach (var target in targets)
            {
                DataTable? added;
                try
                {
                    added = target.Audience switch
                    {
                        NotificationRules.ToUser => await GetDataTableAsync("dbo.sp_Notification_AddForUsers", new[]
                        {
                            In("@UserIds", JsonSerializer.Serialize(new[] { target.UserId })),
                            In("@App", target.App), In("@Kind", target.Kind), In("@Title", target.Title),
                            In("@Body", target.Body), In("@Link", target.Link), In("@CompanyId", null)
                        }),
                        NotificationRules.ToCompany => await GetDataTableAsync("dbo.sp_Notification_AddForModule", new[]
                        {
                            In("@CompanyId", target.CompanyId), In("@ModuleKey", target.App),
                            In("@App", target.App), In("@Kind", target.Kind), In("@Title", target.Title),
                            In("@Body", target.Body), In("@Link", target.Link)
                        }),
                        NotificationRules.ToPlatformAdmins => await GetDataTableAsync("dbo.sp_Notification_AddForPlatformAdmins", new[]
                        {
                            In("@App", target.App), In("@Kind", target.Kind), In("@Title", target.Title),
                            In("@Body", target.Body), In("@Link", target.Link)
                        }),
                        _ => null
                    };
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // what was done is done; only the notification is lost, and the log says why
                    _logger.LogError(ex, "Notifications: writing a {Kind} notification of {App} failed ({ErrorType})",
                        target.Kind, target.App, ex.GetType().Name);
                    continue;
                }

                if (added == null)
                    continue;

                foreach (DataRow row in added.Rows)
                {
                    try
                    {
                        await _push.PushAsync(Convert.ToInt32(row["UserId"]), Map(row, isRead: false));
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        // the person sees it on the next visit of the page
                        _logger.LogWarning(ex, "Notifications: sending notification {Id} at once failed", row["NotificationId"]);
                    }
                }
            }
        }

        public async Task<ApiResponse<NotificationListDto>> ListMine(int userId)
        {
            if (userId <= 0)
                return ApiResponse<NotificationListDto>.Fail("Please log in again");

            try
            {
                var ds = await GetDataSetAsync("dbo.sp_Notification_ListMine", new[] { In("@UserId", userId), In("@Top", 50) });
                var result = new NotificationListDto();
                if (ds == null || ds.Tables.Count == 0)
                    return ApiResponse<NotificationListDto>.Ok(result);

                result.Items = ds.Tables[0].Rows.Cast<DataRow>()
                    .Select(r => Map(r, Convert.ToBoolean(r["IsRead"]))).ToList();
                if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                    result.Unread = Convert.ToInt32(ds.Tables[1].Rows[0]["Unread"]);

                return ApiResponse<NotificationListDto>.Ok(result);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Notifications: reading them failed for user {UserId} ({ErrorType})", userId, ex.GetType().Name);
                return ApiResponse<NotificationListDto>.Fail(NotAvailable);
            }
        }

        public async Task<ApiResponse<int>> MarkRead(int userId, long? notificationId)
        {
            if (userId <= 0)
                return ApiResponse<int>.Fail("Please log in again");

            try
            {
                var dt = await GetDataTableAsync("dbo.sp_Notification_MarkRead", new[]
                {
                    In("@UserId", userId),
                    In("@NotificationId", notificationId is > 0 ? notificationId : null)
                });
                var unread = dt != null && dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["Unread"]) : 0;
                return ApiResponse<int>.Ok(unread);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Notifications: marking them read failed for user {UserId} ({ErrorType})", userId, ex.GetType().Name);
                return ApiResponse<int>.Fail(NotAvailable);
            }
        }

        private static NotificationDto Map(DataRow r, bool isRead) => new()
        {
            NotificationId = Convert.ToInt64(r["NotificationId"]),
            App = r["App"]?.ToString() ?? "",
            Kind = r["Kind"]?.ToString() ?? "",
            Title = r["Title"]?.ToString() ?? "",
            Body = r["Body"]?.ToString() ?? "",
            Link = NotificationRules.SafeLink(r["Link"]?.ToString()),
            CompanyId = r["CompanyId"] == DBNull.Value ? null : Convert.ToInt32(r["CompanyId"]),
            CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
            IsRead = isRead
        };
    }
}
