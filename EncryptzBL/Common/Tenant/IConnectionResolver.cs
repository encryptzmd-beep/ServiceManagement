namespace EncryptzBL.Common.Tenant
{
    /// <summary>The company/project a key identifies, plus the project's default location.</summary>
    public class ProjectScope
    {
        public string ProjectKey { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public int ProjectId { get; set; }
        public int DefaultLocationId { get; set; }
    }

    /// <summary>
    /// Resolves a project key (== Projects.ProjectKey) to that project's DB
    /// connection string by reading MainDB.dbo.ProjectConnections. Results are
    /// cached; call <see cref="Evict"/> when a registry row changes.
    /// </summary>
    public interface IConnectionResolver
    {
        Task<string> GetServiceConnectionAsync(string projectKey);

        /// <summary>
        /// Company/project ids of a project key and its first active location. Used for
        /// requests that carry only the key (public customer-portal endpoints).
        /// Returns null when the key is unknown or inactive.
        /// </summary>
        Task<ProjectScope?> GetProjectScopeAsync(string projectKey);

        /// <summary>Drop a cached connection string (after registry update).</summary>
        void Evict(string projectKey);
    }
}
