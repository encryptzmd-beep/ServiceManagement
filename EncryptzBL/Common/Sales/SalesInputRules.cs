using System.Text;
using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Sales
{
    /// <summary>The checks on what is typed in the Sales and Product screens (the screens check the same).</summary>
    public static class SalesInputRules
    {
        private static readonly Regex Email = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));
        private static readonly Regex Pin = new(@"^[1-9]\d{5}$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));
        private static readonly Regex Mobile = new(@"^[6-9]\d{9}$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));

        /// <summary>The 10 digits of an Indian mobile, without +91 or a leading 0; null when it is not one.</summary>
        public static string? NormalizeMobile(string? value)
        {
            var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
            if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
            else if (digits.Length == 11 && digits[0] == '0') digits = digits[1..];
            return Mobile.IsMatch(digits) ? digits : null;
        }

        public static bool IsEmailOrBlank(string? value)
            => string.IsNullOrWhiteSpace(value) || Email.IsMatch(value.Trim());

        public static bool IsPinOrBlank(string? value)
            => string.IsNullOrWhiteSpace(value) || Pin.IsMatch(value.Trim());

        private static readonly Regex Gstin = new(@"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));

        /// <summary>The 15 characters of a GSTIN in capitals; null when blank. Its shape is checked by IsGstinOrBlank.</summary>
        public static string? CleanGstin(string? value)
        {
            var text = (value ?? string.Empty).Replace(" ", "").Trim().ToUpperInvariant();
            return text.Length == 0 ? null : text;
        }

        public static bool IsGstinOrBlank(string? value)
            => CleanGstin(value) is not { } g || Gstin.IsMatch(g);

        /// <summary>A search term for SQL LIKE in which % _ and [ are plain characters.</summary>
        public static string? LikeTerm(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var text = new StringBuilder();
            foreach (var c in value.Trim())
            {
                if (c is '%' or '_' or '[') text.Append('[').Append(c).Append(']');
                else text.Append(c);
            }
            return text.ToString();
        }
    }
}
