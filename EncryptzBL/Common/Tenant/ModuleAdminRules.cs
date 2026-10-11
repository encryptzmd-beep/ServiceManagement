using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Who may administer modules, and what a module key may look like.
    /// The platform decides which modules a company has; the company's own
    /// administrators decide which of their members may open them.
    /// </summary>
    public static class ModuleAdminRules
    {
        private const int MaxKeyLength = 50;   // Modules.ModuleKey NVARCHAR(50)

        /// <summary>Upper-cased, trimmed key, or null when it is not a possible module key.</summary>
        public static string? NormalizeKey(string? moduleKey)
        {
            if (string.IsNullOrWhiteSpace(moduleKey))
                return null;

            var key = moduleKey.Trim().ToUpperInvariant();
            if (key.Length > MaxKeyLength)
                return null;

            foreach (var ch in key)
            {
                var allowed = (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_';
                if (!allowed)
                    return null;
            }

            return key;
        }

        /// <summary>Switching a module on or off is a platform (subscription) decision.</summary>
        public static bool CanSwitchModules(PlatformActor actor)
            => actor.IsPlatformAdmin;

        public static bool CanViewModules(PlatformActor actor, int companyId)
            => companyId > 0 && actor.CanManageCompany(companyId);

        public static bool CanManageAccess(PlatformActor actor, int companyId)
            => companyId > 0 && actor.CanManageCompany(companyId);
    }
}
