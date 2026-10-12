using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// New_Tenant_Database.sql as the API runs it. The script is written for a person:
    /// one batch creates #TenantSettings and inserts values that are edited by hand.
    /// The API leaves that batch out and supplies the table itself, with parameters,
    /// on the same connection. If the script ever changes shape this class refuses it,
    /// so a database is never built with settings nobody chose.
    /// </summary>
    public sealed class TenantScript
    {
        /// <summary>Must have exactly the columns the script's own settings table has.</summary>
        public const string CreateSettingsTableSql =
            "CREATE TABLE #TenantSettings (CompanyId INT NOT NULL, ProjectId INT NOT NULL, "
            + "LocationName NVARCHAR(200) NOT NULL, LocationCode NVARCHAR(50) NULL, "
            + "LocationCity NVARCHAR(100) NULL, CopyLookupsFrom SYSNAME NULL);";

        public const string InsertSettingsSql =
            "INSERT INTO #TenantSettings (CompanyId, ProjectId, LocationName, LocationCode, LocationCity, CopyLookupsFrom) "
            + "VALUES (@CompanyId, @ProjectId, @LocationName, @LocationCode, @LocationCity, @CopyLookupsFrom);";

        private static readonly string[] ExpectedColumns =
            { "CompanyId", "ProjectId", "LocationName", "LocationCode", "LocationCity", "CopyLookupsFrom" };

        private static readonly Regex SettingsTable = new(
            @"CREATE\s+TABLE\s+#TenantSettings\s*\((?<columns>.*?)\)\s*;",
            RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);

        private static readonly Regex LineComment = new(@"--[^\n]*", RegexOptions.CultureInvariant);

        private static readonly Regex DatabaseLevel = new(
            @"^\s*((CREATE|ALTER|DROP)\s+DATABASE\b|USE\s+\[)",
            RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.CultureInvariant);

        private TenantScript(IReadOnlyList<string> batches) => Batches = batches;

        /// <summary>Every batch of the script except the hand-edited settings batch.</summary>
        public IReadOnlyList<string> Batches { get; }

        /// <summary>Where the script is shipped: next to the API's binaries.</summary>
        public static string DefaultPath
            => Path.Combine(AppContext.BaseDirectory, "Database", "ProjectDB", "New_Tenant_Database.sql");

        public static TenantScript Load(string path) => Parse(File.ReadAllText(path));

        /// <summary>
        /// The script, read when it is first needed and kept from then on. PublicationOnly:
        /// a read that failed is NOT remembered (the default mode would rethrow the first
        /// exception for the life of the API), so a file that was missing or locked once is
        /// read again at the next attempt.
        /// </summary>
        public static Lazy<TenantScript> LoadLazily(string path)
            => new(() => Load(path), LazyThreadSafetyMode.PublicationOnly);

        public static TenantScript Parse(string text)
        {
            var all = SqlBatchSplitter.Split(text);
            var settings = all.Where(b => SettingsTable.IsMatch(b)).ToList();

            if (settings.Count != 1)
                throw new InvalidOperationException(
                    $"The tenant script must have exactly one settings batch (CREATE TABLE #TenantSettings); found {settings.Count}.");

            var columns = SettingsColumns(settings[0]);
            if (!columns.SequenceEqual(ExpectedColumns, StringComparer.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    "The settings table of the tenant script has other columns than the API supplies: " + string.Join(", ", columns));

            var batches = all.Where(b => !ReferenceEquals(b, settings[0])).ToList();

            // The database is chosen by the connection: the script must not pick or change one.
            var offending = batches.FirstOrDefault(b => DatabaseLevel.IsMatch(b));
            if (offending != null)
                throw new InvalidOperationException("The tenant script contains a database-level statement (CREATE/ALTER/DROP DATABASE or USE).");

            return new TenantScript(batches);
        }

        private static List<string> SettingsColumns(string batch)
        {
            var body = LineComment.Replace(SettingsTable.Match(batch).Groups["columns"].Value, "");

            return body.Split(',')
                .Select(part => part.Trim().Split(new[] { ' ', '\t', '\n' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "")
                .Where(name => name.Length > 0)
                .ToList();
        }

        private static readonly Regex Blanks = new(@"\s+", RegexOptions.CultureInvariant);
        private static readonly Regex BlanksAroundBrackets = new(@"\s*([(),])\s*", RegexOptions.CultureInvariant);
        private static readonly Regex AfterBracket = new(@"\)(?=[^)\s])", RegexOptions.CultureInvariant);

        /// <summary>
        /// The columns of the first CREATE TABLE #TenantSettings in the text, one entry per
        /// column: "NAME TYPE NULL" or "NAME TYPE(LENGTH) NOT NULL", in upper case, comments
        /// and extra blanks removed. For the test that holds <see cref="CreateSettingsTableSql"/>
        /// against the real script, so a changed type or length is noticed.
        /// </summary>
        internal static IReadOnlyList<string> SettingsColumnDefinitions(string text)
        {
            var match = SettingsTable.Match(LineComment.Replace((text ?? "").Replace("\r\n", "\n").Replace('\r', '\n'), ""));
            if (!match.Success)
                throw new InvalidOperationException("No CREATE TABLE #TenantSettings (...); in the text.");

            var columns = new List<string>();
            var depth = 0;
            var current = new System.Text.StringBuilder();

            // a comma inside brackets belongs to a type, e.g. DECIMAL(10, 2)
            foreach (var ch in match.Groups["columns"].Value)
            {
                if (ch == '(') depth++;
                else if (ch == ')') depth--;

                if (ch == ',' && depth == 0)
                {
                    columns.Add(current.ToString());
                    current.Clear();
                }
                else
                    current.Append(ch);
            }
            columns.Add(current.ToString());

            return columns
                .Select(column => BlanksAroundBrackets.Replace(Blanks.Replace(column, " ").Trim(), "$1"))
                .Select(column => AfterBracket.Replace(column, ") ").ToUpperInvariant())
                .Where(column => column.Length > 0)
                .ToList();
        }
    }
}
