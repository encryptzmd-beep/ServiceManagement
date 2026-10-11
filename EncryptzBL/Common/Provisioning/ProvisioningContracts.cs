namespace EncryptzBL.Common.Provisioning
{
    /// <summary>Everything the worker needs to build one company's database.</summary>
    public sealed class ProvisionJob
    {
        public int CompanyId { get; init; }
        /// <summary>Value the tenant database stores in its ProjectId columns (1 for a new company).</summary>
        public int TenantScopeId { get; init; }
        public string FirstBranchName { get; init; } = "";
        /// <summary>Companies.ProvisionStatus when the job was read.</summary>
        public string Status { get; init; } = "";
        public string ServerName { get; init; } = "";
        public string AdminUser { get; init; } = "";
        /// <summary>Decrypted. Never log it, never store it.</summary>
        public string AdminPassword { get; init; } = "";
        public string ExtraOptions { get; init; } = "";
        /// <summary>Database to copy lookup rows from; empty = the script's defaults.</summary>
        public string LookupSourceDb { get; init; } = "";
    }

    public enum ProvisionOutcome
    {
        Ready,
        Failed,
        /// <summary>The company is not waiting for a database (unknown, or not Provisioning).</summary>
        Skipped
    }

    /// <summary>The main-database side of a provisioning job.</summary>
    public interface IProvisionStore
    {
        Task<ProvisionJob?> GetJobAsync(int companyId);

        /// <summary>Marks the company Ready. False when it is no longer Provisioning (the job was given up).</summary>
        Task<bool> CompleteAsync(int companyId, string databaseName);

        Task FailAsync(int companyId, string error);

        /// <summary>Gives up jobs that have been Provisioning for longer than the given time. Returns how many.</summary>
        Task<int> FailStuckAsync(int olderThanMinutes);
    }

    /// <summary>The SQL server a company database is created on.</summary>
    public interface ITenantDatabaseServer
    {
        Task<bool> DatabaseExistsAsync(ProvisionJob job, string databaseName, CancellationToken ct);
        Task CreateDatabaseAsync(ProvisionJob job, string databaseName, CancellationToken ct);

        /// <summary>Runs the tenant script in the database and checks the result. Throws when anything is wrong.</summary>
        Task BuildTenantAsync(ProvisionJob job, string databaseName, CancellationToken ct);

        /// <summary>Clean-up of a failed attempt. Not cancellable on purpose.</summary>
        Task DropDatabaseAsync(ProvisionJob job, string databaseName);
    }

    /// <summary>Hands a company to the background worker.</summary>
    public interface IProvisioningQueue
    {
        void Enqueue(int companyId);
    }
}
