using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// What an entry of the application catalogue may look like. The database checks what
    /// needs the stored rows (duplicate key, key and type of an existing entry).
    /// </summary>
    public static class ApplicationRules
    {
        public const string Personal = "Personal";
        public const string Commercial = "Commercial";

        // sizes of dbo.Modules
        private const int MaxName = 150, MaxDescription = 400, MaxIcon = 100, MaxFamily = 100, MaxRoute = 200;

        /// <summary>Null when the entry may be saved. The fields of <paramref name="dto"/> are trimmed and normalised.</summary>
        public static string? Problem(ApplicationDto? dto)
        {
            if (dto == null)
                return "Key and name are required";

            dto.ModuleName = (dto.ModuleName ?? "").Trim();
            dto.Description = (dto.Description ?? "").Trim();
            dto.Icon = (dto.Icon ?? "").Trim();
            dto.Family = (dto.Family ?? "").Trim();
            dto.RoutePath = (dto.RoutePath ?? "").Trim();

            var key = ModuleAdminRules.NormalizeKey(dto.ModuleKey);
            if (key == null)
                return "The key may hold letters, digits and _ only";
            dto.ModuleKey = key;

            if (dto.ModuleName.Length == 0)
                return "Key and name are required";
            if (dto.ModuleName.Length > MaxName)
                return "The name is too long";
            if (dto.Description.Length > MaxDescription)
                return "The description is too long";
            if (dto.Icon.Length > MaxIcon)
                return "The icon name is too long";
            if (dto.Family.Length > MaxFamily)
                return "The family is too long";

            var type = (dto.AppType ?? "").Trim();
            if (string.Equals(type, Personal, StringComparison.OrdinalIgnoreCase))
                dto.AppType = Personal;
            else if (string.Equals(type, Commercial, StringComparison.OrdinalIgnoreCase))
                dto.AppType = Commercial;
            else
                return "Choose Personal or Commercial";

            if (dto.RoutePath.Length > MaxRoute)
                return "The route is too long";
            if (dto.RoutePath.Length > 0 && !IsLocalPath(dto.RoutePath))
                return "The route must start with / and hold letters, digits, - _ and / only";

            if (dto.AppType == Personal && dto.IsReleased && dto.RoutePath.Length == 0)
                return "A personal application needs a route before it is released";

            return null;
        }

        /// <summary>A path inside the application: never another site, never a query.</summary>
        private static bool IsLocalPath(string path)
        {
            if (path[0] != '/' || path.StartsWith("//", StringComparison.Ordinal))
                return false;

            foreach (var ch in path)
            {
                var allowed = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
                              || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == '/';
                if (!allowed)
                    return false;
            }

            return true;
        }
    }
}
