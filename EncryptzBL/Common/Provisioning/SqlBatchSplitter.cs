using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Splits a script at its batch separators: lines that hold nothing but GO.
    /// (GO is a tool command, not SQL: the server does not understand it.)
    /// </summary>
    public static class SqlBatchSplitter
    {
        // A separator sits on EVERY line of the script, so its end is "the line ends here":
        // before a line feed or at the very end of the text. (A plain \z would only ever
        // find a GO on the last line.)
        private static readonly Regex Separator = new(@"^[ \t]*GO[ \t]*(?=\n|\z)",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        private const char ByteOrderMark = (char)0xFEFF;

        public static IReadOnlyList<string> Split(string script)
        {
            if (string.IsNullOrWhiteSpace(script))
                return Array.Empty<string>();

            // a byte order mark that survived reading the file is not SQL
            var text = script.TrimStart(ByteOrderMark).Replace("\r\n", "\n").Replace('\r', '\n');

            return Separator.Split(text)
                .Select(batch => batch.Trim('\n', ' ', '\t'))
                .Where(batch => batch.Length > 0)
                .ToList();
        }
    }
}
