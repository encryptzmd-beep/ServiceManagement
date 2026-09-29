namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Per-request tenant state. Registered as Scoped and populated by
    /// TenantResolutionMiddleware from the validated JWT claims. Business data
    /// access (DbHelper) reads <see cref="ServiceDbConnectionString"/> from here,
    /// so every request is routed to the correct client's ServiceDB.
    /// </summary>
    public class TenantContext
    {
        /// <summary>Companies.CompanyId of the current company (used to scope/stamp business rows).</summary>
        public int CompanyId { get; set; }

        /// <summary>Projects.ProjectId of the current project.</summary>
        public int ProjectId { get; set; }

        /// <summary>Projects.ProjectKey — the routing key that resolves this project's DB.</summary>
        public string? ProjectKey { get; set; }

        /// <summary>LocationId scoping the current request's rows (locations live in the project DB).</summary>
        public int LocationId { get; set; }

        /// <summary>MainDB Users.UserId of the caller (the identity that logged in).</summary>
        public int MainUserId { get; set; }

        /// <summary>
        /// The caller's Users.UserId inside the project DB (mirror row linked by Users.MainUserId).
        /// This — not <see cref="MainUserId"/> — is what business procs expect as @UserId/@ActionBy.
        /// </summary>
        public int TenantUserId { get; set; }

        /// <summary>The caller's Technicians.TechnicianId in the project DB (0 when not a technician).</summary>
        public int TechnicianId { get; set; }

        /// <summary>Resolved connection string to the client's ServiceDB.</summary>
        public string? ServiceDbConnectionString { get; set; }

        /// <summary>True once a client key has been resolved to a ServiceDB.</summary>
        public bool IsResolved => !string.IsNullOrEmpty(ServiceDbConnectionString);
    }
}
