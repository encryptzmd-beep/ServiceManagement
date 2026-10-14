using System.Data;

namespace EncryptzBL.Infrastructure.Notifications
{
    public static class NotificationRules
    {
        public const string ToUser = "User";
        public const string ToCompany = "Company";
        public const string ToPlatformAdmins = "PlatformAdmins";

        /// <summary>The SignalR group of one person's open pages.</summary>
        public static string GroupOf(int userId) => "user:" + userId.ToString(System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>
        /// Only a page of this site is handed out as a link: a path that starts with one "/".
        /// "//host" and "/\host" are read by browsers as another site.
        /// </summary>
        public static string SafeLink(string? link)
        {
            var text = (link ?? "").Trim();
            if (text.Length < 1 || text.Length > 300 || text[0] != '/')
                return "";
            if (text.Length > 1 && (text[1] == '/' || text[1] == '\\'))
                return "";
            return text;
        }

        /// <summary>
        /// The "whom to tell" set of a procedure, read into targets. A row that cannot be
        /// delivered (no person, no company, an unknown audience, no title) is left out.
        /// </summary>
        public static List<NotificationTarget> Targets(DataTable? set)
        {
            var list = new List<NotificationTarget>();
            if (set == null || !set.Columns.Contains("Audience") || !set.Columns.Contains("Title"))
                return list;

            foreach (DataRow row in set.Rows)
            {
                var audience = Text(row, "Audience");
                var title = Text(row, "Title").Trim();
                var userId = Number(row, "UserId");
                var companyId = Number(row, "CompanyId");

                if (title.Length == 0)
                    continue;
                if (audience == ToUser && userId <= 0)
                    continue;
                if (audience == ToCompany && companyId == 0)
                    continue;
                if (audience is not (ToUser or ToCompany or ToPlatformAdmins))
                    continue;

                list.Add(new NotificationTarget(audience, audience == ToUser ? userId : 0, companyId,
                    Text(row, "App"), Text(row, "Kind"), title, Text(row, "Body"), SafeLink(Text(row, "Link"))));
            }

            return list;
        }

        private static string Text(DataRow row, string column)
            => row.Table.Columns.Contains(column) && row[column] != DBNull.Value ? row[column]?.ToString() ?? "" : "";

        private static int Number(DataRow row, string column)
            => row.Table.Columns.Contains(column) && row[column] != DBNull.Value ? Convert.ToInt32(row[column]) : 0;
    }
}
