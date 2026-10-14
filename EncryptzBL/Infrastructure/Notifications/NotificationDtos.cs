namespace EncryptzBL.Infrastructure.Notifications
{
    /// <summary>One notification as the person sees it. It never names who caused it.</summary>
    public class NotificationDto
    {
        public long NotificationId { get; set; }
        /// <summary>The application it comes from: JOBPORTAL, JOBCONSULTANCY, PLATFORM, ...</summary>
        public string App { get; set; } = "";
        public string Kind { get; set; } = "";
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        /// <summary>A page of this site ('' when none).</summary>
        public string Link { get; set; } = "";
        /// <summary>The company it is about, when there is one.</summary>
        public int? CompanyId { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }
    }

    public class NotificationListDto
    {
        public List<NotificationDto> Items { get; set; } = new();
        public int Unread { get; set; }
    }

    public class MarkReadRequest
    {
        /// <summary>One notification; null = all of them.</summary>
        public long? NotificationId { get; set; }
    }

    /// <summary>
    /// Whom to tell what, as a procedure of an application answers it:
    /// Audience 'User' (UserId), 'Company' (the members of CompanyId who may open App there)
    /// or 'PlatformAdmins'.
    /// </summary>
    public sealed record NotificationTarget(string Audience, int UserId, int CompanyId, string App, string Kind,
        string Title, string Body, string Link);
}
