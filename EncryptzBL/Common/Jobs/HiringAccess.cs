using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Jobs
{
    /// <summary>
    /// Who may publish jobs for a company and see its applicants. This is the ONE place
    /// that decides it.
    ///
    /// Publishing jobs is the first page of the commercial application Job Consultancy:
    /// the person must be a member of the company, the company must have the application,
    /// and the person must have been given it (administrators of the company always have
    /// it). It is the rule of every commercial application (ModuleAccess), read from the
    /// main database on every call and never from the token, so a company that loses the
    /// application, or a person who loses the access, loses the jobs at once.
    /// </summary>
    public static class HiringAccess
    {
        /// <summary>The key of Job Consultancy in the catalogue (MainDB.dbo.Modules).</summary>
        public const string ModuleKey = "JOBCONSULTANCY";

        public const string NotMember = "You are not a member of this company";
        public const string NotReleased = "Job Consultancy is not available yet";
        public const string NotSubscribed = "Job Consultancy is not part of your company's subscription";
        public const string NoAccess = "You don't have access to Job Consultancy. Ask your administrator";

        /// <summary>The caller's membership of that company, or null when they are not a member.</summary>
        public static CompanyResponseDto? Membership(IEnumerable<CompanyResponseDto>? companies, int companyId)
            => companyId <= 0 ? null : companies?.FirstOrDefault(c => c != null && c.CompanyId == companyId);

        /// <summary>
        /// Why this person may not manage the jobs of the company, or null when they may.
        /// <paramref name="modules"/> is what the catalogue says for this person in this company.
        /// </summary>
        public static string? Refusal(CompanyResponseDto? membership, IEnumerable<ModuleDto>? modules)
        {
            if (membership == null || string.IsNullOrWhiteSpace(membership.CompanyName))
                return NotMember;

            var module = modules?.FirstOrDefault(m => m != null && string.Equals(m.ModuleKey, ModuleKey, StringComparison.OrdinalIgnoreCase));

            return module?.State switch
            {
                nameof(ModuleState.Available) => null,
                nameof(ModuleState.NotSubscribed) => NotSubscribed,
                nameof(ModuleState.NoAccess) => NoAccess,
                // not in the catalogue, not released, or a state this code does not know
                _ => NotReleased
            };
        }

        /// <summary>The message is one of the refusals above: the API answers it with 403.</summary>
        public static bool IsRefusal(string? message)
            => message is NotMember or NotReleased or NotSubscribed or NoAccess;
    }
}
