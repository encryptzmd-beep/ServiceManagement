using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.LoginAds
{
    /// <summary>
    /// What an advertisement of the sign-in page may hold. Every check returns the sentence
    /// the administrator is shown, or null when the entry is fine.
    /// </summary>
    public static class LoginAdRules
    {
        public const int MaxImageBytes = 2 * 1024 * 1024;

        private const int MaxTag = 40;
        private const int MaxTitle = 120;
        private const int MaxBody = 250;
        private const int MaxButtonText = 30;
        private const int MaxLinkUrl = 500;

        private static readonly byte[] JpgMagic = { 0xFF, 0xD8, 0xFF };
        private static readonly byte[] PngMagic = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] RiffMagic = "RIFF"u8.ToArray();
        private static readonly byte[] WebpMagic = "WEBP"u8.ToArray();   // at byte 8

        /// <summary>
        /// Checks an uploaded image: the extension, the size, and that the first bytes are what
        /// the extension promises (a web page or a program renamed to .png is refused).
        /// </summary>
        public static string? ImageProblem(string? fileName, long size, ReadOnlySpan<byte> head)
        {
            if (string.IsNullOrWhiteSpace(fileName) || size <= 0)
                return "Choose an image";

            var extension = Path.GetExtension(fileName.Trim()).ToLowerInvariant();
            if (extension != ".jpg" && extension != ".jpeg" && extension != ".png" && extension != ".webp")
                return "The image must be a JPG, PNG or WebP file";

            if (size > MaxImageBytes)
                return "The image is larger than 2 MB";

            var matches = extension switch
            {
                ".png" => head.StartsWith(PngMagic),
                ".webp" => head.Length >= 12 && head.StartsWith(RiffMagic) && head.Slice(8, 4).SequenceEqual(WebpMagic),
                _ => head.StartsWith(JpgMagic)
            };

            return matches ? null : "The content of the file does not match its type";
        }

        /// <summary>
        /// A full http or https address and nothing else: no other scheme (javascript:, data:),
        /// no user name in it, no blanks. The sign-in page puts it into a link.
        /// </summary>
        public static bool IsWebLink(string? url)
        {
            if (string.IsNullOrEmpty(url))
                return false;
            if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                return false;
            if (url.Any(ch => char.IsWhiteSpace(ch) || char.IsControl(ch) || ch == '"' || ch == '<' || ch == '>'))
                return false;

            return Uri.TryCreate(url, UriKind.Absolute, out var uri)
                   && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                   && uri.Host.Length > 0
                   && uri.UserInfo.Length == 0;
        }

        /// <summary>Checks the texts and dates of a slide; trims the texts and drops the time of the dates.</summary>
        public static string? SaveProblem(SaveLoginAdRequest? r)
        {
            if (r == null)
                return "Nothing to save";

            r.Tag = (r.Tag ?? "").Trim();
            r.Title = (r.Title ?? "").Trim();
            r.Body = (r.Body ?? "").Trim();
            r.ButtonText = (r.ButtonText ?? "").Trim();
            r.LinkUrl = (r.LinkUrl ?? "").Trim();
            r.ShowFrom = r.ShowFrom?.Date;
            r.ShowUntil = r.ShowUntil?.Date;

            if (r.Tag.Length > MaxTag) return "The tag is too long";
            if (r.Title.Length > MaxTitle) return "The headline is too long";
            if (r.Body.Length > MaxBody) return "The short text is too long";
            if (r.ButtonText.Length > MaxButtonText) return "The button text is too long";
            if (r.LinkUrl.Length > MaxLinkUrl) return "The link is too long";
            if (r.LinkUrl.Length > 0 && !IsWebLink(r.LinkUrl)) return "The link must start with http:// or https://";

            if (r.ShowFrom.HasValue && r.ShowUntil.HasValue && r.ShowUntil < r.ShowFrom)
                return "'Show until' is before 'Show from'";

            return null;
        }

        /// <summary>The content type an image is served with: from this list only, never from the upload.</summary>
        public static string ContentTypeFor(string? fileName)
            => Path.GetExtension(fileName ?? "").ToLowerInvariant() switch
            {
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };
    }
}
