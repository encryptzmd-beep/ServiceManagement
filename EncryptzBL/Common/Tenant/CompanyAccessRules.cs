using System.Net.Mail;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>Who may do what on a company's Users &amp; Roles screen, and what a valid request is.</summary>
    public static class CompanyAccessRules
    {
        public const string NotAllowed = "You do not have access to manage users and roles";
        public const string NotInstalled = "Users & Roles is not set up yet. Run 33_Company_Users_And_Roles.sql in the main database";
        public const int MinPasswordLength = 6;

        /// <summary>The built-in levels a company role can work as, strongest first. Never an administrator.</summary>
        public static readonly IReadOnlyList<string> AccessLevels = new[] { "Manager", "ServiceManager", "Storekeeper", "Technician" };

        public static bool CanManage(bool isPlatformAdmin, bool isMember, bool isTenantAdmin, bool isManager)
            => isPlatformAdmin || (isMember && (isTenantAdmin || isManager));

        /// <summary>Only the tenant admin (or the platform) hands out this access.</summary>
        public static bool CanGrant(bool isPlatformAdmin, bool isMember, bool isTenantAdmin)
            => isPlatformAdmin || (isMember && isTenantAdmin);

        /// <summary>Why this role cannot be saved; null when it can.</summary>
        public static string? RoleProblem(SaveCompanyRoleRequest? req)
        {
            if (req == null) return "The role could not be read";

            var name = req.RoleName?.Trim() ?? "";
            if (name.Length == 0) return "Enter a role name";
            if (name.Length > 100) return "The role name is too long";
            if ((req.Description?.Trim().Length ?? 0) > 300) return "The description is too long";

            if (!AccessLevels.Contains(req.AccessLevel ?? "", StringComparer.Ordinal))
                return "Choose what this role works as";

            if (req.ModuleKeys == null || req.ModuleKeys.Count(k => !string.IsNullOrWhiteSpace(k)) == 0)
                return "Choose at least one module";
            if (req.ModuleKeys.Any(k => (k?.Trim().Length ?? 0) > 50))
                return "Choose modules your company has";

            return InputSanitizer.Validate(("Role name", name), ("Description", req.Description));
        }

        /// <summary>Why this person cannot be saved; null when they can.</summary>
        public static string? UserProblem(SaveCompanyUserRequest? req)
        {
            if (req == null) return "The user could not be read";
            if (req.UserId > 0) return null;   // an existing account keeps its own details

            var email = req.Email?.Trim() ?? "";
            if (!IsEmail(email)) return "Enter a valid email";
            if (email.Length > 256) return "The email is too long";
            if ((req.FullName?.Trim().Length ?? 0) > 200) return "The name is too long";
            if ((req.MobileNumber?.Trim().Length ?? 0) > 20) return "The mobile number is too long";
            if (req.RoleIds == null || req.RoleIds.Count == 0) return "Choose at least one role";
            if (!string.IsNullOrEmpty(req.Password) && req.Password.Length < MinPasswordLength)
                return $"The password must be at least {MinPasswordLength} characters";

            return InputSanitizer.Validate(("Name", req.FullName), ("Mobile number", req.MobileNumber));
        }

        /// <summary>
        /// Someone who was only granted this access cannot raise themselves or reach an administrator.
        /// </summary>
        public static string? TargetRefusal(int actorUserId, int targetUserId, bool actorCanGrant, bool targetIsTenantAdmin)
        {
            if (targetIsTenantAdmin) return "A company administrator cannot be changed here";
            if (!actorCanGrant && actorUserId == targetUserId) return "You cannot change your own access";
            return null;
        }

        /// <summary>What must change so that the member has exactly the wanted branches.</summary>
        public static (List<int> Add, List<int> Remove) BranchChanges(
            IEnumerable<int> current, IEnumerable<int> wanted, IEnumerable<int> known)
        {
            var valid = known.ToHashSet();
            var have = current.Where(valid.Contains).ToHashSet();
            var want = wanted.Where(valid.Contains).ToHashSet();
            return (want.Except(have).OrderBy(x => x).ToList(), have.Except(want).OrderBy(x => x).ToList());
        }

        private static bool IsEmail(string value)
            => value.Length > 3 && MailAddress.TryCreate(value, out var parsed)
               && string.Equals(parsed.Address, value, StringComparison.OrdinalIgnoreCase)
               && value.IndexOf('.', value.IndexOf('@')) > 0;
    }
}
