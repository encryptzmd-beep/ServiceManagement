namespace EncryptzBL.Common.Tenant
{
    /// <summary>A MainDB user's ids inside one project DB.</summary>
    public class TenantUserMap
    {
        public int MainUserId { get; set; }
        public int TenantUserId { get; set; }
        public int TechnicianId { get; set; }
        public int ProfileId { get; set; }
    }

    /// <summary>
    /// Users, roles and project access are owned by MainDB. A project DB only mirrors
    /// the users allowed into it (Users.MainUserId); this service refreshes that mirror.
    /// </summary>
    public interface ITenantUserSyncService
    {
        /// <summary>
        /// Pushes the project's MainDB users (with their company role) into the project DB
        /// and returns the MainDB -> project DB id map. Throws when the sync cannot run.
        /// </summary>
        Task<List<TenantUserMap>> SyncProjectUsersAsync(int projectId, int locationId = 0);

        /// <summary>Refreshes only the selected MainDB user without deactivating other tenant users.</summary>
        Task<TenantUserMap?> SyncProjectUserAsync(int projectId, int locationId, int mainUserId);

        /// <summary>Best-effort variant for membership changes: failures are logged, not thrown.</summary>
        Task TrySyncProjectUsersAsync(int projectId);

        /// <summary>Best-effort sync of every active project of a company.</summary>
        Task TrySyncCompanyProjectsAsync(int companyId);
    }
}
