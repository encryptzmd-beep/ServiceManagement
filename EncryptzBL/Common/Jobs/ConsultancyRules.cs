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
