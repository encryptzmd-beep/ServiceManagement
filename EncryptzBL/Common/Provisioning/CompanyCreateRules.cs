using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>A create-company request after trimming and checking.</summary>
    public sealed record NewCompany(
        string CompanyName, string CompanyCode, string FirstBranchName,
        string? Address, string? City, string? PhoneNumber);

    /// <summary>
    /// What a user may send to create a company. Free text is only ever passed to
    /// SQL as a parameter, so quotes and brackets are harmless; control characters
    /// and over-long text are refused. The company code is restricted because it is
    /// typed by customers on the portal login.
    /// </summary>
    public static class CompanyCreateRules
    {
        public const string DefaultBranchName = "Head Office";

        private static readonly Regex Code = new(@"^[A-Z0-9][A-Z0-9_-]{1,19}$", RegexOptions.CultureInvariant);

        public static (NewCompany? Company, string? Error) Normalize(
            string? name, string? code, string? branch, string? address, string? city, string? phone)
        {
            var companyName = (name ?? "").Trim();
            if (companyName.Length < 2)
                return (null, "Enter the company name");

            var raw = (code ?? "").Trim();
            // checked before upper-casing: only plain letters may become A-Z
            var companyCode = raw.All(ch => ch < 128) ? raw.ToUpperInvariant() : raw;
            if (!Code.IsMatch(companyCode))
                return (null, "The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit");

            var branchName = string.IsNullOrWhiteSpace(branch) ? DefaultBranchName : branch.Trim();

            var addressText = Optional(address);
            var cityText = Optional(city);
            var phoneText = Optional(phone);

            if (TooLong(companyName, 200) || TooLong(branchName, 200) || TooLong(addressText, 400)
                || TooLong(cityText, 100) || TooLong(phoneText, 30))
                return (null, "One of the values is too long");

            if (HasControl(companyName) || HasControl(branchName) || HasControl(addressText)
                || HasControl(cityText) || HasControl(phoneText))
                return (null, "One of the values contains characters that are not allowed");

            return (new NewCompany(companyName, companyCode, branchName, addressText, cityText, phoneText), null);
        }

        /// <summary>Null when the user may create another company.</summary>
        public static string? LimitMessage(int created, int limit, bool isPlatformAdmin)
        {
            if (isPlatformAdmin)
                return null;

            if (limit <= 0)
                return "Company creation is not available right now";

            if (created < limit)
                return null;

            return limit == 1
                ? "You can create 1 company. You have reached the limit."
                : $"You can create {limit} companies. You have reached the limit.";
        }

        private static string? Optional(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static bool TooLong(string? value, int max) => value != null && value.Length > max;

        private static bool HasControl(string? value) => value != null && value.Any(char.IsControl);
    }
}
