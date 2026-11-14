using System.Text.RegularExpressions;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Jobs
{
    /// <summary>
    /// What a consultancy may write about its clients, its candidates and its placements.
    /// Every method returns the sentence that is shown, or null when the entry is fine, and
    /// trims the entry. Who may write it and the limits per company are checked elsewhere.
    /// </summary>
    public static class ConsultancyRules
    {
        public static readonly string[] Stages = { "New", "Contacted", "Interview", "Placed", "NotSuitable" };
        public static readonly string[] FeeStatuses = { "Pending", "Invoiced", "Paid" };

        /// <summary>The years of experience a candidate can be filtered by (script PersonalDB/21); "none" = not added (script 23).</summary>
        public static readonly string[] ExperienceBands = { "none", "0-1", "1-3", "3-5", "5-10", "10+" };

        /// <summary>
        /// A list filter of the candidate search as the JSON array the database takes: trimmed, without
        /// blanks and repeats, at most 20 values of at most 100 characters; with <paramref name="allowed"/>
        /// only those (in their spelling). Null when nothing is left: no filter.
        /// </summary>
        public static string? FilterList(IEnumerable<string>? values, IReadOnlyCollection<string>? allowed = null)
        {
            var list = (values ?? Enumerable.Empty<string>())
                .Select(v => (v ?? "").Trim())
                .Where(v => v.Length > 0 && v.Length <= 100)
                .Select(v => allowed == null ? v : allowed.FirstOrDefault(a => string.Equals(a, v, StringComparison.OrdinalIgnoreCase)))
                .Where(v => v != null)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(20)
                .ToList();
            return list.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(list);
        }

        private const int MaxAmount = 1_000_000_000;

        private static readonly Regex Email = new(@"^[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""'.]{2,}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Phone = new(@"^[0-9 +()\-]{6,30}\z", RegexOptions.CultureInvariant);

        public static string? ClientProblem(ConsultClientDto? c)
        {
            if (c == null) return "Nothing to save";

            c.Name = (c.Name ?? "").Trim();
            c.ContactPerson = (c.ContactPerson ?? "").Trim();
            c.Phone = (c.Phone ?? "").Trim();
            c.Email = (c.Email ?? "").Trim();
            c.City = (c.City ?? "").Trim();
            c.Industry = (c.Industry ?? "").Trim();
            c.Notes = (c.Notes ?? "").Trim();

            if (c.Name.Length == 0) return "Enter the name of the client";
            if (c.Name.Length > 200 || c.ContactPerson.Length > 200) return "The name is too long";
            if (c.City.Length > 100 || c.Industry.Length > 100) return "The city or the industry is too long";
            if (c.Notes.Length > 2000) return "The notes are too long";
            if (c.Email.Length > 0 && (c.Email.Length > 256 || !Email.IsMatch(c.Email))) return "Enter a valid e-mail address";
            if (c.Phone.Length > 0 && !Phone.IsMatch(c.Phone)) return "Enter a valid phone number";
            return null;
        }

        /// <summary>The stage in its one spelling ("New" when nothing was chosen), or null when it is not in the list.</summary>
        public static string? Stage(string? stage)
        {
            var text = (stage ?? "").Trim();
            return text.Length == 0 ? "New" : Stages.FirstOrDefault(s => string.Equals(s, text, StringComparison.OrdinalIgnoreCase));
        }

        public static string? TalentProblem(TalentSaveRequest? t)
        {
            if (t == null) return "Nothing to save";
            var stage = Stage(t.Stage);
            if (stage == null) return "Choose the stage from the list";
            t.Stage = stage;
            t.Note = (t.Note ?? "").Trim();
            return t.Note.Length > 1000 ? "The note can have at most 1000 characters" : null;
        }

        public static readonly string[] CandidateSources = { "Walk-in", "Referral", "Job board", "Social media", "E-mail", "Other" };

        /// <summary>An e-mail as a key for duplicates: trimmed, lower case ('' when none).</summary>
        public static string EmailKey(string? email) => (email ?? "").Trim().ToLowerInvariant();

        /// <summary>
        /// A phone as a key for duplicates: its digits, the last 10 of them, so that "+91 98470 12345",
        /// "098470-12345" and "9847012345" are the same number ('' when there are fewer than 6 digits).
        /// </summary>
        public static string PhoneKey(string? phone)
        {
            var digits = new string((phone ?? "").Where(char.IsAsciiDigit).ToArray());
            if (digits.Length < 6) return "";
            return digits.Length > 10 ? digits.Substring(digits.Length - 10) : digits;
        }

        /// <summary>What is wrong with a candidate the company adds (null when nothing). The text is tidied.</summary>
        public static string? OwnCandidateProblem(OwnCandidateDto? c)
        {
            if (c == null) return "Nothing to save";

            c.FullName = (c.FullName ?? "").Trim();
            c.Headline = (c.Headline ?? "").Trim();
            c.Email = (c.Email ?? "").Trim();
            c.Phone = (c.Phone ?? "").Trim();
            c.City = (c.City ?? "").Trim();
            c.Skills = string.Join(", ", (c.Skills ?? "").Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase));
            c.PreferredJobs = (c.PreferredJobs ?? "").Trim();
            c.Source = (c.Source ?? "").Trim();
            c.Notes = (c.Notes ?? "").Trim();
            c.Stage = Stages.FirstOrDefault(s => string.Equals(s, c.Stage, StringComparison.OrdinalIgnoreCase)) ?? "New";

            if (c.FullName.Length == 0) return "Enter the name of the candidate";
            if (c.FullName.Length > 200 || c.Headline.Length > 200) return "The name or the headline is too long";
            if (c.Email.Length == 0 && c.Phone.Length == 0) return "Enter an e-mail or a phone number";
            if (c.Email.Length > 0 && (c.Email.Length > 256 || !Email.IsMatch(c.Email))) return "Enter a valid e-mail address";
            if (c.Phone.Length > 0 && (!Phone.IsMatch(c.Phone) || PhoneKey(c.Phone).Length == 0)) return "Enter a valid phone number";
            if (c.City.Length > 100) return "The city is too long";
            if (c.ExperienceYears is < 0 or > 60) return "Experience is from 0 to 60 years";
            if (c.Skills.Length > 1000) return "The skills are too long";
            if (c.PreferredJobs.Length > 500) return "The jobs looked for are too long";
            if (c.Source.Length > 0 && !CandidateSources.Contains(c.Source)) return "Choose where you met the candidate";
            if (c.Notes.Length > 2000) return "The notes can have at most 2000 characters";
            if (c.ExperienceYears.HasValue) c.ExperienceYears = Math.Round(c.ExperienceYears.Value, 1);
            return null;
        }

        public static string? InviteProblem(CandidateInviteRequest? i)
        {
            if (i == null || i.PostingId <= 0) return "Choose one of your open jobs";
            i.Message = (i.Message ?? "").Trim();
            return i.Message.Length > 500 ? "The message can have at most 500 characters" : null;
        }

        public static string? PlacementProblem(PlacementSaveRequest? p)
        {
            if (p == null) return "Nothing to save";

            p.CandidateName = (p.CandidateName ?? "").Trim();
            p.JobTitle = (p.JobTitle ?? "").Trim();
            p.Notes = (p.Notes ?? "").Trim();

            var named = p.CandidateKey.HasValue && p.CandidateKey.Value != Guid.Empty
                        || p.ApplicationId is > 0
                        || p.CandidateName.Length > 0;
            if (!named || p.JobTitle.Length == 0 || p.JoinDate == default)
                return "Enter the candidate, the job and the joining date";

            if (p.CandidateName.Length > 200 || p.JobTitle.Length > 200) return "The name or the job is too long";
            if (p.Notes.Length > 1000) return "The notes are too long";

            p.JoinDate = p.JoinDate.Date;
            if (p.JoinDate.Year < 2000 || p.JoinDate.Year > 2100) return "Enter a valid joining date";

            if (p.AnnualCtc is <= 0 or > MaxAmount) return "Enter the CTC per year as an amount, or leave it empty";
            if (p.FeeAmount is < 0 or > MaxAmount) return "Enter the fee as an amount, or leave it empty";

            var fee = FeeStatuses.FirstOrDefault(s => string.Equals(s, (p.FeeStatus ?? "").Trim(), StringComparison.OrdinalIgnoreCase));
            if (fee == null) return "Choose the state of the fee from the list";
            p.FeeStatus = fee;

            if (p.GuaranteeUntil.HasValue)
            {
                p.GuaranteeUntil = p.GuaranteeUntil.Value.Date;
                if (p.GuaranteeUntil.Value < p.JoinDate) return "The replacement guarantee cannot end before the joining date";
            }

            return null;
        }
    }
}
