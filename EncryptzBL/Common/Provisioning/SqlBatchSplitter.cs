using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Splits a script at its batch separators: lines that hold nothing but GO.
    /// (GO is a tool command, not SQL: the server does not understand it.)
    /// </summary>
    public static class SqlBatchSplitter
    {
        private static readonly Regex Separator = new(@"^[ \t]*GO[ \t]*$",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        public static IReadOnlyList<string> Split(string script)
        {
            if (string.IsNullOrWhiteSpace(script))
                return Array.Empty<string>();

            var text = script.Replace("\r\n", "\n").Replace('\r', '\n');

            return Separator.Split(text)
                .Select(batch => batch.Trim('\n', ' ', '\t'))
                .Where(batch => batch.Length > 0)
                .ToList();
        }
    }
}
