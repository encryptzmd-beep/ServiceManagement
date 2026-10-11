using System.Globalization;
using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>A create-company request after trimming and checking.</summary>
    public sealed record NewCompany(
        string CompanyName, string CompanyCode, string FirstBranchName,
        string? Address, string? City, string? PhoneNumber);

    /// <summary>
    /// What a user may send to create a company. Free text is only ever passed to
    /// SQL as a parameter, so quotes and brackets are harmless; control and
    /// invisible characters and over-long text are refused. The company code is restricted because it is
    /// typed by customers on the portal login.
    /// </summary>
    public static class CompanyCreateRules
    {
        public const string DefaultBranchName = "Head Office";

        private static readonly Regex Code = new(@"^[A-Z0-9][A-Z0-9_-]{1,19}\z", RegexOptions.CultureInvariant);

        public static (NewCompany? Company, string? Error) Normalize(
            string? name, string? code, string? branch, string? address, string? city, string? phone)
        {
            var companyName = (name ?? "").Trim();
            // a name made only of signs or invisible characters is not a name
            if (companyName.Length < 2 || !HasLetterOrDigit(companyName))
                return (null, "Enter the company name");

            var raw = (code ?? "").Trim();
            // checked before upper-casing: only plain letters may become A-Z
            var companyCode = raw.All(ch => ch < 128) ? raw.ToUpperInvariant() : raw;
            if (!Code.IsMatch(companyCode))
                return (null, "The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit");

            var branchName = string.IsNullOrWhiteSpace(branch) ? DefaultBranchName : branch.Trim();
            if (!HasLetterOrDigit(branchName))
                return (null, "Enter the branch name");

            var addressText = Optional(address);
            var cityText = Optional(city);
            var phoneText = Optional(phone);

            if (TooLong(companyName, 200) || TooLong(branchName, 200) || TooLong(addressText, 400)
                || TooLong(cityText, 100) || TooLong(phoneText, 30))
                return (null, "One of the values is too long");

            if (HasForbidden(companyName) || HasForbidden(branchName) || HasForbidden(addressText)
                || HasForbidden(cityText) || HasForbidden(phoneText))
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

        /// <summary>A name must have something a person can read: at least one letter or digit.</summary>
        private static bool HasLetterOrDigit(string value)
        {
            for (var i = 0; i < value.Length; i++)
            {
                // the (string, index) form reads a surrogate pair as one character
                if (char.IsLetterOrDigit(value, i))
                    return true;
            }

            return false;
        }

        private const char ZeroWidthNonJoiner = (char)0x200C;
        private const char ZeroWidthJoiner = (char)0x200D;

        /// <summary>
        /// Control characters, invisible formatting characters (direction overrides,
        /// zero-width spaces, ...), line and paragraph separators, private-use and
        /// unassigned characters, and half a surrogate pair. The two joiners stay
        /// allowed: Malayalam and other Indic scripts are written with them.
        /// </summary>
        private static bool HasForbidden(string? value)
        {
            if (value == null)
                return false;

            for (var i = 0; i < value.Length; i++)
            {
                var ch = value[i];

                if (char.IsHighSurrogate(ch))
                {
                    if (i + 1 >= value.Length || !char.IsLowSurrogate(value[i + 1]))
                        return true;                                    // unpaired

                    if (IsForbidden(CharUnicodeInfo.GetUnicodeCategory(value, i)))
                        return true;                                    // the pair as one character

                    i++;
                    continue;
                }

                if (char.IsLowSurrogate(ch))
                    return true;                                        // unpaired

                if (ch == ZeroWidthNonJoiner || ch == ZeroWidthJoiner)
                    continue;

                if (IsForbidden(CharUnicodeInfo.GetUnicodeCategory(ch)))
                    return true;
            }

            return false;
        }

        private static bool IsForbidden(UnicodeCategory category)
            => category is UnicodeCategory.Control
                or UnicodeCategory.Format
                or UnicodeCategory.LineSeparator
                or UnicodeCategory.ParagraphSeparator
                or UnicodeCategory.Surrogate
                or UnicodeCategory.PrivateUse
                or UnicodeCategory.OtherNotAssigned;
    }
}
