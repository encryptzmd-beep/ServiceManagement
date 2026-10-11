using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// The name of a company's database. It is made from the company id only, so
    /// nothing a user typed can ever be part of a database name.
    /// </summary>
    public static class TenantDatabaseName
    {
        private const string Prefix = "EncryptzTenant_";
        private static readonly Regex Generated = new(@"^EncryptzTenant_[0-9]{6,10}\z", RegexOptions.CultureInvariant);

        public static string For(int companyId)
        {
            if (companyId <= 0)
                throw new ArgumentOutOfRangeException(nameof(companyId));

            return Prefix + companyId.ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
        }

        /// <summary>True only for a name <see cref="For"/> can produce.</summary>
        public static bool IsGenerated(string? name)
        {
            if (string.IsNullOrEmpty(name) || !Generated.IsMatch(name))
                return false;

            return long.TryParse(name.AsSpan(Prefix.Length), System.Globalization.NumberStyles.None,
                       System.Globalization.CultureInfo.InvariantCulture, out var id)
                   && id > 0 && id <= int.MaxValue
                   && For((int)id) == name;
        }
    }
}
