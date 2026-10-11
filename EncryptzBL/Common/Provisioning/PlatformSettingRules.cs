using System.Globalization;
using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>The platform settings that exist and what their values may be.</summary>
    public static class PlatformSettingRules
    {
        /// <summary>How many companies one user may create (platform administrators are exempt).</summary>
        public const string MaxCompaniesPerUser = "MaxCompaniesPerUser";

        /// <summary>
        /// A database on the tenant server whose lookup rows (roles, statuses, settings,
        /// menus) a new company database starts with. Empty = the script's built-in defaults.
        /// </summary>
        public const string TenantLookupSourceDb = "TenantLookupSourceDb";

        private static readonly Regex DatabaseName = new(@"^[A-Za-z0-9_]{1,128}$", RegexOptions.CultureInvariant);
        private static readonly string[] SystemDatabases = { "master", "model", "msdb", "tempdb" };

        /// <summary>The value to store, or the reason it is refused.</summary>
        public static (string? Value, string? Error) Validate(string? key, string? value)
        {
            var text = (value ?? "").Trim();

            switch (key)
            {
                case MaxCompaniesPerUser:
                    return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n <= 100
                        ? (n.ToString(CultureInfo.InvariantCulture), null)
                        : (null, "Enter a number from 0 to 100");

                case TenantLookupSourceDb:
                    if (text.Length == 0)
                        return ("", null);

                    if (!DatabaseName.IsMatch(text)
                        || SystemDatabases.Contains(text, StringComparer.OrdinalIgnoreCase))
                        return (null, "Enter the plain name of a company database, or leave it empty");

                    return (text, null);

                default:
                    return (null, "Unknown setting");
            }
        }
    }
}
