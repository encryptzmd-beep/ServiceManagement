using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Jobs
{
    /// <summary>
    /// Who may publish jobs for a company and see its applicants. This is the ONE place
    /// that decides it.
    ///
    /// Now: an administrator of the company. The membership is read from the main database
    /// on every call, never from the token, so a person who lost the role loses the jobs at
    /// once. Later, when a commercial application owns hiring (Payroll, Job Consultancy),
    /// the company's subscription to it and the person's access to it are checked here.
    /// </summary>
    public static class HiringAccess
    {
        public const string Refused = "Only an administrator of the company can manage its jobs";

        /// <summary>The caller's membership of that company, or null when they are not a member.</summary>
        public static CompanyResponseDto? Membership(IEnumerable<CompanyResponseDto>? companies, int companyId)
            => companyId <= 0 ? null : companies?.FirstOrDefault(c => c != null && c.CompanyId == companyId);

        public static bool MayManage(CompanyResponseDto? membership)
            => membership != null
               && !string.IsNullOrWhiteSpace(membership.CompanyName)
               && CompanyMemberRules.IsAdministrator(membership.RoleInCompany);
    }
}
