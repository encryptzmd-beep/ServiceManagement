using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// The roles a member of a company can have, and how a platform administrator names
    /// the person to add. The same list is offered to a company's own administrator.
    /// </summary>
    public static class CompanyMemberRules
    {
        /// <summary>Admin is the administrator of the company (the tenant admin).</summary>
        public static readonly IReadOnlyList<string> Roles = new[] { "Admin", "Technician", "Storekeeper", "Manager" };

        private static readonly Regex Email = new(@"^[^\s@<>""';]+@[^\s@<>""';]+\.[A-Za-z]{2,}\z", RegexOptions.CultureInvariant);

        /// <summary>The role in its one spelling, or null when it is not a role of a company.</summary>
        public static string? NormalizeRole(string? role)
        {
            var text = (role ?? "").Trim();
            return Roles.FirstOrDefault(r => string.Equals(r, text, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Admin and CompanyAdmin: the roles that have every application of the company.</summary>
        public static bool IsAdministrator(string? role)
            => ModuleAccess.IsCompanyAdminRole(role);

        /// <summary>
        /// What was typed to name a person: an Individual ID (in any form it is written) or an
        /// e-mail address. Exactly one of the two comes back, or the sentence to show.
        /// </summary>
        public static (string? Email, string? IndividualId, string? Problem) Lookup(string? typed)
        {
            const string problem = "Enter the e-mail address or the Individual ID of the person";

            var text = (typed ?? "").Trim();
            if (text.Length == 0 || text.Length > 256)
                return (null, null, problem);

            if (text.Contains('@'))
                return Email.IsMatch(text) ? (text, null, null) : (null, null, problem);

            var id = Common.IndividualId.Normalize(text);
            return id != null ? (null, id, null) : (null, null, problem);
        }
    }
}
