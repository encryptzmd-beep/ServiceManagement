using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Which branches of a company a member may work in. The rows live in the
    /// company's own database, keyed on the main user id; company administrators
    /// have every branch and no rows.
    /// </summary>
    public static class BranchAccessRules
    {
        public const string NotInstalledMessage = "Branch access is not set up in this company's database yet";
        public const string NoAccessMessage = "You do not have access to this branch";
        public const string UnknownBranchMessage = "Invalid branch for this company";

        public static bool HasEveryBranch(string? roleInCompany)
            => ModuleAccess.IsCompanyAdminRole(roleInCompany);

        /// <summary>Why a branch cannot be entered; null when it can.</summary>
        public static string? EntryRefusal(bool branchFound, bool hasAccess)
        {
            if (!branchFound) return UnknownBranchMessage;
            return hasAccess ? null : NoAccessMessage;
        }

        /// <summary>Why this member's branches cannot be changed; null when they can.</summary>
        public static string? ChangeRefusal(ProjectAccessDto? member, int actorUserId)
        {
            if (member == null)
                return "The user is not an active member of the company";

            return HasEveryBranch(member.RoleInCompany)
                ? "Company administrators have every branch. Change the role instead."
                : null;
        }

        /// <summary>Members whose first branches the company database must be asked to set (once each).</summary>
        public static List<int> MemberIdsToInitialise(IEnumerable<ProjectAccessDto> members)
            => members.Where(m => !HasEveryBranch(m.RoleInCompany))
                      .Select(m => m.UserId)
                      .Distinct()
                      .OrderBy(id => id)
                      .ToList();

        /// <summary>The Branch Access screen: every member, with the branches given to them.</summary>
        public static BranchAccessDto Build(
            IEnumerable<ProjectAccessDto> members,
            IEnumerable<BranchDto> branches,
            IEnumerable<(int MainUserId, int LocationId)> granted)
        {
            var branchList = branches.ToList();
            var known = branchList.Select(b => b.LocationId).ToHashSet();
            var byUser = granted
                .Where(g => known.Contains(g.LocationId))
                .GroupBy(g => g.MainUserId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.LocationId).Distinct().OrderBy(id => id).ToList());

            var users = members
                .GroupBy(m => m.UserId).Select(g => g.First())
                .OrderBy(m => m.FullName, StringComparer.OrdinalIgnoreCase).ThenBy(m => m.UserId)
                .Select(m =>
                {
                    var all = HasEveryBranch(m.RoleInCompany);
                    return new BranchAccessUserDto
                    {
                        UserId = m.UserId,
                        FullName = m.FullName,
                        Email = m.Email,
                        RoleInCompany = m.RoleInCompany,
                        AllBranches = all,
                        LocationIds = all || !byUser.TryGetValue(m.UserId, out var ids) ? new List<int>() : ids
                    };
                })
                .ToList();

            return new BranchAccessDto { Branches = branchList, Users = users };
        }
    }
}
