namespace EncryptzBL.Common.Tenant
{
    /// <summary>A MainDB user's ids inside one company database.</summary>
    public class TenantUserMap
    {
        public int MainUserId { get; set; }
        public int TenantUserId { get; set; }
        public int TechnicianId { get; set; }
        public int ProfileId { get; set; }
    }

    /// <summary>
    /// Users, roles and module access are owned by MainDB. A company database only
    /// mirrors the users allowed into the Service module (Users.MainUserId); this
    /// service refreshes that mirror.
    /// </summary>
    public interface ITenantUserSyncService
    {
        /// <summary>
        /// Pushes the company's Service users (with their company role) into the company
        /// database and returns the MainDB -> tenant id map. Throws when the sync cannot run.
        /// </summary>
        Task<List<TenantUserMap>> SyncCompanyUsersAsync(int companyId, int locationId = 0);

        /// <summary>Refreshes only the given MainDB user without deactivating other tenant users.</summary>
        Task<TenantUserMap?> SyncCompanyUserAsync(int companyId, int locationId, int mainUserId);

        /// <summary>Best-effort variant for membership changes: failures are logged, not thrown.</summary>
        Task TrySyncCompanyUsersAsync(int companyId);
    }
}
