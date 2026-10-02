using System.Text.RegularExpressions;

namespace EncryptzBL.Common
{
    /// <summary>
    /// Server-side check for free-text input. The Angular views escape what they show,
    /// but the same rows are read by reports, e-mails and exports too, so markup is
    /// refused before it is stored.
    /// </summary>
    public static class InputSanitizer
    {
        // an opening / closing tag or comment ("<img", "</p", "<!--"), or a javascript: URL
        private static readonly Regex Markup = new(
            @"<[a-zA-Z/!?]|javascript\s*:",
            RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

        public static bool ContainsMarkup(string? value)
            => !string.IsNullOrEmpty(value) && Markup.IsMatch(value);

        /// <summary>
        /// Validation message for the first field that holds markup; null when all are clean.
        /// </summary>
        public static string? Validate(params (string Field, string? Value)[] fields)
        {
            foreach (var (field, value) in fields)
            {
                if (ContainsMarkup(value))
                    return $"{field} must not contain HTML or script content";
            }
            return null;
        }
    }
}
