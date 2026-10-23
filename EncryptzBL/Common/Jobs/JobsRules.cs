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

        public const string PhotoKind = "Photo";

        /// <summary>The key of Job Portal in the catalogue (MainDB.dbo.Modules).</summary>
        public const string PortalModuleKey = "JOBPORTAL";

        /// <summary>
        /// Whether Job Portal may answer: it is listed and released. A main database that lists
        /// no personal application at all (before script 21) does not close it.
        /// </summary>
        public static bool PortalOpen(IEnumerable<PersonalAppDto>? apps)
        {
            var list = apps?.Where(a => a != null).ToList();
            if (list == null || list.Count == 0)
                return true;

            var portal = list.FirstOrDefault(a => string.Equals(a.ModuleKey, PortalModuleKey, StringComparison.OrdinalIgnoreCase));
            return portal != null && portal.IsReleased;
        }

        public const int MaxFileBytes = 5 * 1024 * 1024;
        public const int MaxPhotoBytes = 2 * 1024 * 1024;

        private const int FirstYear = 1950;
        private const int MaxFileNameLength = 120;

        public const int MaxRating = 5;
        public const int MaxSubSkills = 20;

        /// <summary>The level a rating stands for: 1-2 Beginner, 3-4 Intermediate, 5 Expert.</summary>
        public static string LevelOf(int rating)
            => rating >= 5 ? "Expert" : rating >= 3 ? "Intermediate" : "Beginner";

        /// <summary>The average of the sub-skill ratings, to one decimal (3.7). 0 without sub-skills.</summary>
        public static double AverageRating(IReadOnlyCollection<JobSubSkillDto> subSkills)
            => subSkills.Count == 0 ? 0 : Math.Round(subSkills.Average(u => (double)u.Rating), 1, MidpointRounding.AwayFromZero);

        /// <summary>The overall rating a skill stores: the average of its sub-skills, rounded (3.5 is 4).</summary>
        public static int OverallRating(IReadOnlyCollection<JobSubSkillDto> subSkills)
            => (int)Math.Round(subSkills.Average(u => (double)u.Rating), MidpointRounding.AwayFromZero);

        private static readonly Regex Email = new(@"^[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""'.]{2,}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Phone = new(@"^[0-9 +()\-]+\z", RegexOptions.CultureInvariant);

        // ── profile ───────────────────────────────────────────────────────────

        /// <param name="requireBirthDate">
        /// A profile the person saves needs a date of birth. Only the profile that is started
        /// for them from the user master (which has none) is taken without it.
        /// </param>
        public static string? ProfileProblem(JobProfileDto? p, DateTime today, bool requireBirthDate = true)
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

            if (requireBirthDate && !p.DateOfBirth.HasValue)
                return "Enter your date of birth";

            if (p.DateOfBirth.HasValue)
            {
                p.DateOfBirth = p.DateOfBirth.Value.Date;
                if (p.DateOfBirth.Value > today.Date || p.DateOfBirth.Value.Year < 1900)
                    return "Enter a valid date of birth";
            }

            return null;
        }

        /// <summary>
        /// The profile a person starts with: what the user master already knows. A value the
        /// profile would refuse is left out, so the person is never handed a profile they
        /// cannot save. Null when nothing usable is known.
        /// </summary>
        public static JobProfileDto? StarterProfile(string? fullName, string? email, string? phone)
        {
            static string Accepted(string? value, Func<string, JobProfileDto> asProfile)
            {
                var text = (value ?? "").Trim();
                return text.Length > 0 && ProfileProblem(asProfile(text), DateTime.MaxValue, requireBirthDate: false) == null ? text : "";
            }

            var starter = new JobProfileDto
            {
                FullName = Accepted(fullName, v => new JobProfileDto { FullName = v }),
                ContactEmail = Accepted(email, v => new JobProfileDto { ContactEmail = v }),
                ContactPhone = Accepted(phone, v => new JobProfileDto { ContactPhone = v })
            };

            return starter.FullName.Length + starter.ContactEmail.Length + starter.ContactPhone.Length == 0 ? null : starter;
        }

        // ── preferences ───────────────────────────────────────────────────────

        public static readonly string[] WorkModes = { "On-site", "Remote", "Hybrid" };

        private const int MaxPreferences = 10;
        private const int MaxPreferenceLength = 100;
        private const int MaxCtc = 999_999_999;

        /// <summary>Tidies the lists (trimmed, no blanks, no repeats, order kept) and checks them.</summary>
        public static string? PreferencesProblem(JobPreferencesDto? p)
        {
            if (p == null)
                return "Nothing to save";

            static List<string> Tidy(List<string>? values)
                => (values ?? new List<string>())
                    .Select(v => (v ?? "").Trim())
                    .Where(v => v.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

            p.Jobs = Tidy(p.Jobs);
            p.Locations = Tidy(p.Locations);
            p.WorkModes = Tidy(p.WorkModes);

            if (p.Jobs.Count > MaxPreferences) return "Choose at most 10 preferred jobs";
            if (p.Locations.Count > MaxPreferences) return "Choose at most 10 preferred locations";
            if (p.Jobs.Any(v => v.Length > MaxPreferenceLength)) return "A preferred job can have at most 100 characters";
            if (p.Locations.Any(v => v.Length > MaxPreferenceLength)) return "A preferred location can have at most 100 characters";

            // the spelling of the list is what is stored
            var modes = p.WorkModes
                .Select(v => WorkModes.FirstOrDefault(m => string.Equals(m, v, StringComparison.OrdinalIgnoreCase)))
                .ToList();
            if (modes.Any(m => m == null)) return "Choose the working mode from the list";
            p.WorkModes = modes.Select(m => m!).ToList();

            if (p.ExpectedCtc.HasValue && (p.ExpectedCtc.Value <= 0 || p.ExpectedCtc.Value > MaxCtc))
                return "Enter the expected CTC as a yearly amount";

            return null;
        }

        // ── interests and hobbies ─────────────────────────────────────────────

        private const int MaxInterests = 15;

        /// <summary>Tidies the lists (trimmed, no blanks, no repeats, order kept) and checks them.</summary>
        public static string? InterestsProblem(JobInterestsDto? i)
        {
            if (i == null)
                return "Nothing to save";

            i.Interests = TidyList(i.Interests);
            i.Hobbies = TidyList(i.Hobbies);

            if (i.Interests.Count > MaxInterests) return "Add at most 15 interests";
            if (i.Hobbies.Count > MaxInterests) return "Add at most 15 hobbies";
            if (i.Interests.Any(v => v.Length > MaxPreferenceLength)) return "An interest can have at most 100 characters";
            if (i.Hobbies.Any(v => v.Length > MaxPreferenceLength)) return "A hobby can have at most 100 characters";

            return null;
        }

        private static List<string> TidyList(List<string>? values)
            => (values ?? new List<string>())
                .Select(v => (v ?? "").Trim())
                .Where(v => v.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

        // ── social media links ────────────────────────────────────────────────

        private const int MaxSocialLinks = 10;
        private const int MaxSocialLinkLength = 400;

        /// <summary>The platform an address belongs to (by its host), and the domains that name it.</summary>
        private static readonly (string Platform, string[] Domains)[] Platforms =
        {
            ("LinkedIn", new[] { "linkedin.com", "lnkd.in" }),
            ("GitHub", new[] { "github.com" }),
            ("GitLab", new[] { "gitlab.com" }),
            ("X", new[] { "x.com", "twitter.com" }),
            ("Facebook", new[] { "facebook.com", "fb.com" }),
            ("Instagram", new[] { "instagram.com" }),
            ("YouTube", new[] { "youtube.com", "youtu.be" }),
            ("Behance", new[] { "behance.net" }),
            ("Dribbble", new[] { "dribbble.com" }),
            ("Medium", new[] { "medium.com" }),
            ("Stack Overflow", new[] { "stackoverflow.com" }),
        };

        public const string WebsitePlatform = "Website";

        /// <summary>LinkedIn, GitHub, ... for an address on one of their sites; Website for any other.</summary>
        public static string PlatformOf(string? url)
        {
            if (!Uri.TryCreate(url ?? "", UriKind.Absolute, out var uri))
                return WebsitePlatform;

            var host = uri.Host.ToLowerInvariant();
            foreach (var (platform, domains) in Platforms)
                if (domains.Any(d => host == d || host.EndsWith("." + d, StringComparison.Ordinal)))
                    return platform;

            return WebsitePlatform;
        }

        /// <summary>
        /// Tidies the links (trimmed, no blanks, no repeated address, order kept), checks that
        /// each is a full https address and names its platform: what a client sent as the
        /// platform is not taken.
        /// </summary>
        public static string? SocialLinksProblem(SaveJobSocialLinksRequest? req)
        {
            if (req == null)
                return "Nothing to save";

            var links = (req.Links ?? new List<JobSocialLinkDto>())
                .Where(l => l != null)
                .Select(l => (l.Url ?? "").Trim())
                .Where(u => u.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (links.Count > MaxSocialLinks) return "Add at most 10 links";
            if (links.Any(u => u.Length > MaxSocialLinkLength)) return "A link can have at most 400 characters";
            if (links.Any(u => !IsHttpsLink(u))) return "A link must start with https:// and be a full address";

            req.Links = links.Select(u => new JobSocialLinkDto { Platform = PlatformOf(u), Url = u }).ToList();
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

            s.SubSkills ??= new List<JobSubSkillDto>();
            foreach (var sub in s.SubSkills)
                sub.Name = (sub?.Name ?? "").Trim();
            // a row left empty in the form is not a sub-skill
            s.SubSkills = s.SubSkills.Where(sub => sub != null && sub.Name.Length > 0).ToList();

            if (s.SubSkills.Count > MaxSubSkills) return "A skill can have up to 20 sub-skills";
            if (s.SubSkills.Any(sub => sub.Name.Length > 100)) return "A sub-skill name is too long";
            if (s.SubSkills.Any(sub => sub.Rating < 1 || sub.Rating > MaxRating)) return "Rate every sub-skill from 1 to 5";
            if (s.SubSkills.GroupBy(sub => sub.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
                return "A sub-skill is in the list twice";

            // with sub-skills the overall rating is theirs, whatever was sent; without them the
            // person rates the skill itself
            if (s.SubSkills.Count > 0)
                s.Rating = OverallRating(s.SubSkills);
            else if (s.Rating < 1 || s.Rating > MaxRating)
                return "Rate the skill from 1 to 5";
            s.Level = LevelOf(s.Rating);

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
            if (kind != ResumeKind && kind != CertificateKind && kind != PhotoKind)
                return "Choose a file";
            if (string.IsNullOrWhiteSpace(fileName) || size <= 0)
                return "Choose a file";

            var extension = Path.GetExtension(SafeFileName(fileName)).ToLowerInvariant();

            byte[]? magic = kind switch
            {
                ResumeKind => extension switch { ".pdf" => PdfMagic, ".doc" => Ole2Magic, ".docx" => ZipMagic, _ => null },
                PhotoKind => extension switch { ".jpg" => JpgMagic, ".jpeg" => JpgMagic, ".png" => PngMagic, _ => null },
                _ => extension switch { ".pdf" => PdfMagic, ".jpg" => JpgMagic, ".jpeg" => JpgMagic, ".png" => PngMagic, _ => null }
            };

            if (magic == null)
                return kind switch
                {
                    ResumeKind => "A resume must be a PDF, DOC or DOCX file",
                    PhotoKind => "A photo must be a JPG or PNG file",
                    _ => "A certificate must be a PDF, JPG or PNG file"
                };

            if (kind == PhotoKind && size > MaxPhotoBytes)
                return "The photo is larger than 2 MB";
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
