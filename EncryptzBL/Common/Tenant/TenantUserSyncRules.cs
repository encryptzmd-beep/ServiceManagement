namespace EncryptzBL.Common.Tenant
{
    /// <summary>What the user sync may send to a company database.</summary>
    public static class TenantUserSyncRules
    {
        /// <summary>
        /// A full sync deactivates every mirrored user and technician that is not in the list,
        /// so a list without users is never sent: it would deactivate everybody.
        /// </summary>
        public static bool ShouldSkipFullSync(int userCount)
            => userCount <= 0;
    }
}
