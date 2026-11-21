namespace EncryptzBL.Common.Tenant
{
    /// <summary>What an action needs on its menu. Save: Create for a new record, Edit for an existing one.</summary>
    public enum MenuRightKind { Create, Edit, Delete, Save }

    public sealed record MenuRightRow(string Path, bool CanView, bool CanCreate, bool CanEdit, bool CanDelete);

    /// <summary>The rules of user rights, apart from where the rights are read.</summary>
    public static class MenuRightRules
    {
        /// <summary>The database holds both "sales/orders" and "/complaints/list".</summary>
        public static string NormalizePath(string? path) => (path ?? "").Trim().Trim('/').ToLowerInvariant();

        public static string ModuleOf(string path)
        {
            var p = NormalizePath(path);
            if (p == "crm" || p.StartsWith("crm/")) return "CRM";
            if (p == "consultancy" || p.StartsWith("consultancy/")) return "JOBCONSULTANCY";
            return "SERVICE";
        }

        /// <summary>A missing row, or a right not ticked, is no access. Every right needs View as well.</summary>
        public static bool Has(MenuRightRow? row, MenuRightKind kind, bool? isNewRecord = null)
        {
            if (row == null || !row.CanView) return false;
            return kind switch
            {
                MenuRightKind.Create => row.CanCreate,
                MenuRightKind.Edit => row.CanEdit,
                MenuRightKind.Delete => row.CanDelete,
                // the kind of record is not known: both rights are needed
                MenuRightKind.Save => isNewRecord == true ? row.CanCreate : isNewRecord == false ? row.CanEdit : row.CanCreate && row.CanEdit,
                _ => false
            };
        }
    }
}
