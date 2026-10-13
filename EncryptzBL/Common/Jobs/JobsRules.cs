using System.Text.RegularExpressions;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Jobs
{
    /// <summary>
    /// What a person may put into their Job Portal profile. Every method returns the
    /// sentence the person is shown, or null when the entry is fine, and trims the entry.
    /// The limits per user (how many rows) are checked by the database.
    /// </summary>
    public static class JobsRules
    {
        public const string ResumeKind = "Resume";
        public const string CertificateKind = "Certificate";

        public const int MaxFileBytes = 5 * 1024 * 1024;

        private const int FirstYear = 1950;
        private const int MaxFileNameLength = 120;

        private static readonly string[] Levels = { "Beginner", "Intermediate", "Expert" };

        private static readonly Regex Email = new(@"^[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""'.]{2,}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Phone = new(@"^[0-9 +()\-]+\z", RegexOptions.CultureInvariant);

        // ── profile ───────────────────────────────────────────────────────────

        public static string? ProfileProblem(JobProfileDto? p, DateTime today)
        {
            if (p == null)
                return "Nothing to save";

            p.FullName = (p.FullName ?? "").Trim();
            p.Headline = (p.Headline ?? "").Trim();
            p.Summary = (p.Summary ?? "").Trim();
            p.City = (p.City ?? "").Trim();
            p.ContactEmail = (p.ContactEmail ?? "").Trim();
            p.ContactPhone = (p.ContactPhone ?? "").Trim();

            if (p.FullName.Length > 200) return "The name is too long";
            if (p.Headline.Length > 200) return "The headline is too long";
            if (p.Summary.Length > 2000) return "The summary is too long";
            if (p.City.Length > 100) return "The city is too long";

            if (p.ContactEmail.Length > 0 && (p.ContactEmail.Length > 256 || !Email.IsMatch(p.ContactEmail)))
                return "Enter a valid contact email";

            if (p.ContactPhone.Length > 0)
            {
                var digits = p.ContactPhone.Count(ch => ch >= '0' && ch <= '9');
                if (p.ContactPhone.Length > 30 || !Phone.IsMatch(p.ContactPhone) || digits < 6 || digits > 15)
                    return "Enter a valid contact phone number";
            }

            if (p.DateOfBirth.HasValue)
            {
                p.DateOfBirth = p.DateOfBirth.Value.Date;
                if (p.DateOfBirth.Value > today.Date || p.DateOfBirth.Value.Year < 1900)
                    return "Enter a valid date of birth";
            }

            return null;
        }

        // ── experience ────────────────────────────────────────────────────────

        public static string? ExperienceProblem(JobExperienceDto? e, DateTime today)
        {
            if (e == null)
                return "Nothing to save";

            e.Organisation = (e.Organisation ?? "").Trim();
            e.Title = (e.Title ?? "").Trim();
            e.Description = (e.Description ?? "").Trim();

            if (e.Organisation.Length == 0 || e.Title.Length == 0)
                return "Enter the organisation and your title";
            if (e.Organisation.Length > 200 || e.Title.Length > 200)
                return "The organisation or the title is too long";
            if (e.Description.Length > 2000)
                return "The description is too long";

            var thisMonth = new DateTime(today.Year, today.Month, 1);

            if (e.StartMonth.Year < FirstYear)
                return "Enter a valid start month";
            e.StartMonth = new DateTime(e.StartMonth.Year, e.StartMonth.Month, 1);
            if (e.StartMonth > thisMonth)
                return "The start cannot be in the future";

            if (e.EndMonth.HasValue)
            {
                e.EndMonth = new DateTime(e.EndMonth.Value.Year, e.EndMonth.Value.Month, 1);
                if (e.EndMonth.Value < e.StartMonth)
                    return "The end cannot be before the start";
                if (e.EndMonth.Value > thisMonth)
                    return "The end cannot be in the future. Leave it empty for a current job";
            }

            return null;
        }

        // ── education ─────────────────────────────────────────────────────────

        public static string? EducationProblem(JobEducationDto? e, int currentYear)
        {
            if (e == null)
                return "Nothing to save";

            e.Institution = (e.Institution ?? "").Trim();
            e.Course = (e.Course ?? "").Trim();
            e.FieldOfStudy = (e.FieldOfStudy ?? "").Trim();

            if (e.Institution.Length == 0 || e.Course.Length == 0)
                return "Enter the institution and the course";
            if (e.Institution.Length > 200 || e.Course.Length > 200 || e.FieldOfStudy.Length > 200)
                return "The institution, the course or the field is too long";

            if (e.StartYear.HasValue && (e.StartYear < FirstYear || e.StartYear > currentYear))
                return "Enter a valid start year";
            // a course that is still running ends in the future
            if (e.EndYear.HasValue && (e.EndYear < FirstYear || e.EndYear > currentYear + 10))
                return "Enter a valid end year";
            if (e.StartYear.HasValue && e.EndYear.HasValue && e.EndYear < e.StartYear)
                return "The end year cannot be before the start year";

            return null;
        }

        // ── skills ────────────────────────────────────────────────────────────

        public static string? SkillProblem(JobSkillDto? s)
        {
            if (s == null)
                return "Nothing to save";

            s.SkillName = (s.SkillName ?? "").Trim();
            s.EvidenceUrl = (s.EvidenceUrl ?? "").Trim();

            if (s.SkillName.Length == 0) return "Enter the skill";
            if (s.SkillName.Length > 100) return "The skill name is too long";

            var level = Levels.FirstOrDefault(l => string.Equals(l, (s.Level ?? "").Trim(), StringComparison.OrdinalIgnoreCase));
            if (level == null) return "Choose a level";
            s.Level = level;

            if (s.EvidenceUrl.Length > 400) return "The link is too long";
            if (s.EvidenceUrl.Length > 0 && !IsHttpsLink(s.EvidenceUrl))
                return "The link must start with https:// and be a full address";

            return null;
        }

        /// <summary>
        /// A full https address and nothing else: no other scheme (javascript:, data:, http:),
        /// no user name in it, no blanks. The UI puts it into a link.
        /// </summary>
        public static bool IsHttpsLink(string? url)
        {
            if (string.IsNullOrEmpty(url) || !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                return false;
            if (url.Any(ch => char.IsWhiteSpace(ch) || char.IsControl(ch) || ch == '"' || ch == '<' || ch == '>'))
                return false;

            return Uri.TryCreate(url, UriKind.Absolute, out var uri)
                   && uri.Scheme == Uri.UriSchemeHttps
                   && uri.Host.Length > 0
                   && uri.Host.Contains('.')
                   && uri.UserInfo.Length == 0;
        }

        // ── certificates ──────────────────────────────────────────────────────

        public static string? CertificateProblem(JobCertificateDto? c, DateTime today)
        {
            if (c == null)
                return "Nothing to save";

            c.Title = (c.Title ?? "").Trim();
            c.Issuer = (c.Issuer ?? "").Trim();

            if (c.Title.Length == 0) return "Enter the title of the certificate";
            if (c.Title.Length > 200 || c.Issuer.Length > 200) return "The title or the issuer is too long";

            if (c.IssuedOn.HasValue)
            {
                c.IssuedOn = c.IssuedOn.Value.Date;
                if (c.IssuedOn.Value > today.Date) return "The date cannot be in the future";
                if (c.IssuedOn.Value.Year < 1900) return "Enter a valid date";
            }

            return null;
        }

        // ── files ─────────────────────────────────────────────────────────────

        private static readonly byte[] PdfMagic = { 0x25, 0x50, 0x44, 0x46 };                              // %PDF
        private static readonly byte[] JpgMagic = { 0xFF, 0xD8, 0xFF };
        private static readonly byte[] PngMagic = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] Ole2Magic = { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 };     // .doc
        private static readonly byte[] ZipMagic = { 0x50, 0x4B, 0x03, 0x04 };                              // .docx

        /// <summary>
        /// Checks an upload: the kind, the extension allowed for that kind, the size, and that
        /// the first bytes are what the extension promises (a program or a web page renamed
        /// to .pdf is refused).
        /// </summary>
        public static string? FileProblem(string kind, string? fileName, long size, ReadOnlySpan<byte> head)
        {
            if (kind != ResumeKind && kind != CertificateKind)
                return "Choose a file";
            if (string.IsNullOrWhiteSpace(fileName) || size <= 0)
                return "Choose a file";

            var extension = Path.GetExtension(SafeFileName(fileName)).ToLowerInvariant();

            byte[]? magic = kind == ResumeKind
                ? extension switch { ".pdf" => PdfMagic, ".doc" => Ole2Magic, ".docx" => ZipMagic, _ => null }
                : extension switch { ".pdf" => PdfMagic, ".jpg" => JpgMagic, ".jpeg" => JpgMagic, ".png" => PngMagic, _ => null };

            if (magic == null)
                return kind == ResumeKind
                    ? "A resume must be a PDF, DOC or DOCX file"
                    : "A certificate must be a PDF, JPG or PNG file";

            if (size > MaxFileBytes)
                return "The file is larger than 5 MB";

            if (head.Length < magic.Length || !head.Slice(0, magic.Length).SequenceEqual(magic))
                return "The content of the file does not match its type";

            return null;
        }

        /// <summary>The name without any folder, without control characters or quotes, at most 120 characters.</summary>
        public static string SafeFileName(string? fileName)
        {
            var name = (fileName ?? "").Trim();
            var cut = name.LastIndexOfAny(new[] { '/', '\\' });
            if (cut >= 0)
                name = name.Substring(cut + 1);

            name = new string(name.Select(ch => char.IsControl(ch) || ch == '"' || ch == ':' || ch == '*' || ch == '?' || ch == '<' || ch == '>' || ch == '|' ? '_' : ch).ToArray()).Trim();

            if (name.Length > MaxFileNameLength)
            {
                var extension = Path.GetExtension(name);
                if (extension.Length > 10) extension = "";
                name = name.Substring(0, MaxFileNameLength - extension.Length) + extension;
            }

            return name.Length == 0 ? "file" : name;
        }

        /// <summary>The content type a download is served with: from this list only, never from the upload.</summary>
        public static string ContentTypeFor(string? fileName)
            => Path.GetExtension(fileName ?? "").ToLowerInvariant() switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => "application/octet-stream"
            };

        // ── completeness ──────────────────────────────────────────────────────

        /// <summary>How complete the profile is, 0 to 100.</summary>
        public static int Completeness(JobProfilePageDto? page)
        {
            if (page == null)
                return 0;

            var p = page.Profile ?? new JobProfileDto();
            var score = 0;

            if (!string.IsNullOrWhiteSpace(p.FullName)) score += 10;
            if (!string.IsNullOrWhiteSpace(p.Headline)) score += 15;
            if (!string.IsNullOrWhiteSpace(p.Summary)) score += 15;
            if (!string.IsNullOrWhiteSpace(p.City)) score += 5;
            if (!string.IsNullOrWhiteSpace(p.ContactEmail) || !string.IsNullOrWhiteSpace(p.ContactPhone)) score += 5;
            if (page.Experience?.Count > 0) score += 15;
            if (page.Education?.Count > 0) score += 10;
            if (page.Skills?.Count >= 3) score += 10;
            if (page.Resume != null) score += 15;

            return score;
        }
    }
}
