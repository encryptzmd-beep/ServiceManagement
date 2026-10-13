using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Jobs
{
    /// <summary>
    /// What a company may put into a job posting, and the lists the states come from.
    /// Every method returns the sentence that is shown, or null when the entry is fine.
    /// The moves between states and the limits are checked by the database.
    /// </summary>
    public static class JobPostingRules
    {
        public static readonly string[] EmploymentTypes = { "Full-time", "Part-time", "Contract", "Internship" };

        /// <summary>The states a company can move a posting to.</summary>
        public static readonly string[] PostingMoves = { "Open", "Closed" };

        /// <summary>The states a company can give an application. Withdrawn is the person's own.</summary>
        public static readonly string[] ApplicantStates = { "Applied", "Shortlisted", "Rejected", "Hired" };

        public const int PageSize = 20;

        private const int MaxYears = 60;
        private const int MaxSalary = 100_000_000;
        private const int MaxNote = 1000;
        private const int MaxSearch = 100;

        /// <summary>The value in the spelling of the list, or null when it is not in it.</summary>
        public static string? InList(string[] list, string? value)
        {
            var text = (value ?? "").Trim();
            return list.FirstOrDefault(v => string.Equals(v, text, StringComparison.OrdinalIgnoreCase));
        }

        public static string? PostingProblem(JobPostingDto? p)
        {
            if (p == null)
                return "Nothing to save";

            p.Title = (p.Title ?? "").Trim();
            p.City = (p.City ?? "").Trim();
            p.Skills = (p.Skills ?? "").Trim();
            p.Description = (p.Description ?? "").Trim();

            if (p.Title.Length == 0 || p.City.Length == 0 || p.Description.Length == 0)
                return "Enter the title, the city and the description of the job";
            if (p.Title.Length > 200) return "The title is too long";
            if (p.City.Length > 100) return "The city is too long";
            if (p.Skills.Length > 400) return "The skills are too long";
            if (p.Description.Length > 4000) return "The description is too long";

            var type = InList(EmploymentTypes, p.EmploymentType);
            if (type == null) return "Choose the type of employment";
            p.EmploymentType = type;

            var mode = InList(JobsRules.WorkModes, p.WorkMode);
            if (mode == null) return "Choose the working mode";
            p.WorkMode = mode;

            if (p.ExperienceMinYears is < 0 or > MaxYears || p.ExperienceMaxYears is < 0 or > MaxYears)
                return "Enter the experience in years, from 0 to 60";
            if (p.ExperienceMinYears.HasValue && p.ExperienceMaxYears.HasValue && p.ExperienceMinYears > p.ExperienceMaxYears)
                return "The least experience cannot be more than the most";

            if (p.SalaryMin is <= 0 or > MaxSalary || p.SalaryMax is <= 0 or > MaxSalary)
                return "Enter the salary per month as an amount, or leave it empty";
            if (p.SalaryMin.HasValue && p.SalaryMax.HasValue && p.SalaryMin > p.SalaryMax)
                return "The lowest salary cannot be more than the highest";

            if (p.ClosesOn.HasValue)
            {
                p.ClosesOn = p.ClosesOn.Value.Date;
                if (p.ClosesOn.Value.Year < 2000 || p.ClosesOn.Value.Year > 2100)
                    return "Enter a valid closing date";
            }

            return null;
        }

        /// <summary>The note of an application, trimmed; null when it is too long.</summary>
        public static string? Note(string? note)
        {
            var text = (note ?? "").Trim();
            return text.Length > MaxNote ? null : text;
        }

        /// <summary>What is searched for, cut to what the database takes.</summary>
        public static string SearchText(string? text)
        {
            var value = (text ?? "").Trim();
            return value.Length > MaxSearch ? value.Substring(0, MaxSearch) : value;
        }

        public static int Page(int? page) => page is > 0 and < 100_000 ? page.Value : 1;
    }
}
