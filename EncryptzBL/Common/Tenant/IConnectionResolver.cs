namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Resolves a project key (== Projects.ProjectKey) to that project's DB
    /// connection string by reading MainDB.dbo.ProjectConnections. Results are
    /// cached; call <see cref="Evict"/> when a registry row changes.
    /// </summary>
    public interface IConnectionResolver
    {
        Task<string> GetServiceConnectionAsync(string projectKey);

        /// <summary>Drop a cached connection string (after registry update).</summary>
        void Evict(string projectKey);
    }
}
