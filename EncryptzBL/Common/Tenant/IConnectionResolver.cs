namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// The company a tenant key identifies, plus its first active branch.
    /// ProjectKey is the tenant key and ProjectId the tenant scope id
    /// (Companies.TenantScopeId): the names predate company-level routing.
    /// </summary>
    public class ProjectScope
    {
        public string ProjectKey { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public int ProjectId { get; set; }
        public int DefaultLocationId { get; set; }
    }

    /// <summary>
    /// Resolves a tenant key (Companies.TenantKey) to that company's database
    /// connection string from the company's own row in MainDB. Only an active
    /// company whose database is Ready resolves. Results are cached; call
    /// <see cref="Evict"/> when the row changes.
    /// </summary>
    public interface IConnectionResolver
    {
        Task<string> GetServiceConnectionAsync(string projectKey);

        /// <summary>
        /// Company of a tenant key and its first active branch. Used for requests that
        /// carry only the key (public customer-portal endpoints).
        /// Returns null when the key is unknown, inactive or not Ready.
        /// </summary>
        Task<ProjectScope?> GetProjectScopeAsync(string projectKey);

        /// <summary>Drop a cached entry (after the company's connection changes).</summary>
        void Evict(string projectKey);
    }
}
