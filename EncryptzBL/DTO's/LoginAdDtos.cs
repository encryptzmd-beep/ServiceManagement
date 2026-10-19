namespace EncryptzBL.DTO_s
{
    // ── Login Ads (MainDB script 25): the advertisement slides of the sign-in page ──

    /// <summary>A slide as the platform administrator sees it (no image bytes).</summary>
    public class LoginAdDto
    {
        public int LoginAdId { get; set; }
        public int SortOrder { get; set; }
        public string Tag { get; set; } = "";
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        public string ButtonText { get; set; } = "";
        public string LinkUrl { get; set; } = "";
        public DateTime? ShowFrom { get; set; }
        public DateTime? ShowUntil { get; set; }
        public bool IsActive { get; set; }
        public int ImageVersion { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>A slide shown today, as the sign-in page gets it (anonymous, no image bytes).</summary>
    public class PublicLoginAdDto
    {
        public int LoginAdId { get; set; }
        public string Tag { get; set; } = "";
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        public string ButtonText { get; set; } = "";
        public string LinkUrl { get; set; } = "";
        public int ImageVersion { get; set; }
    }

    /// <summary>The texts and dates of a slide to save; the image comes separately.</summary>
    public class SaveLoginAdRequest
    {
        /// <summary>0 adds a slide.</summary>
        public int LoginAdId { get; set; }
        public string? Tag { get; set; }
        public string? Title { get; set; }
        public string? Body { get; set; }
        public string? ButtonText { get; set; }
        public string? LinkUrl { get; set; }
        public DateTime? ShowFrom { get; set; }
        public DateTime? ShowUntil { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class SetLoginAdActiveRequest
    {
        public bool IsActive { get; set; }
    }

    /// <summary>The stored image of a slide.</summary>
    public sealed record LoginAdImage(string FileName, string ContentType, byte[] Content);
}
