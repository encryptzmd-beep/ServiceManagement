using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// The name of a company's database: EZ_TEN_ and the company code, for example
    /// EZ_TEN_ACME. The code is what a user typed, so only the alphabet of a company code
    /// (A-Z, 0-9, - and _, 2 to 20 characters, starting with a letter or digit) can ever
    /// become part of a database name: nothing that could close the brackets or quotes
    /// the name is written in. Company codes are unique, so the names are too.
    /// The name is fixed when the database is built; changing the code later does not
    /// rename the database.
    /// </summary>
    public static class TenantDatabaseName
    {
        public const string Prefix = "EZ_TEN_";

        // the same alphabet as CompanyCreateRules.Code
        private static readonly Regex Code = new(@"^[A-Z0-9][A-Z0-9_-]{1,19}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Generated = new(@"^EZ_TEN_[A-Z0-9][A-Z0-9_-]{1,19}\z", RegexOptions.CultureInvariant);

        /// <summary>The database name for a company code, or null when the code cannot be one.</summary>
        public static string? TryFor(string? companyCode)
        {
            var raw = (companyCode ?? "").Trim(' ', '\t');
            // checked before upper-casing: only plain letters may become A-Z
            if (raw.Length == 0 || raw.Any(ch => ch >= 128))
                return null;

            var code = raw.ToUpperInvariant();
            return Code.IsMatch(code) ? Prefix + code : null;
        }

        /// <summary>True only for a name <see cref="TryFor"/> can produce.</summary>
        public static bool IsGenerated(string? name)
            => !string.IsNullOrEmpty(name) && Generated.IsMatch(name);
    }
}
