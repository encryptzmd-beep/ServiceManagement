namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Everything the worker needs to build one company's database. A job only
    /// exists once it is claimed: whoever holds one is the only run for that company.
    /// </summary>
    public sealed class ProvisionJob
    {
        public int CompanyId { get; init; }
        /// <summary>Identity of this claim (Companies.ProvisionAttempt). A later attempt has another one.</summary>
        public Guid Attempt { get; init; }
        /// <summary>Value the tenant database stores in its ProjectId columns (1 for a new company).</summary>
        public int TenantScopeId { get; init; }
        public string FirstBranchName { get; init; } = "";
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
        /// <summary>There was no job to claim (unknown company, not Provisioning, or another run has it).</summary>
        Skipped
    }

    /// <summary>The main-database side of a provisioning job.</summary>
    public interface IProvisionStore
    {
        /// <summary>Claims the company's job. Null when there is nothing to do: unknown company, not Provisioning, or another run already has it.</summary>
        Task<ProvisionJob?> BeginAsync(int companyId);

        /// <summary>Marks the company Ready. False when this attempt no longer owns the job.</summary>
        Task<bool> CompleteAsync(ProvisionJob job, string databaseName);

        /// <summary>Marks the company Failed, when this attempt still owns the job.</summary>
        Task FailAsync(ProvisionJob job, string error);

        /// <summary>Companies.ProvisionStatus now ("" when the company does not exist).</summary>
        Task<string> GetStatusAsync(int companyId);

        /// <summary>
        /// Gives up claimed jobs that have been running for longer than the given time, and
        /// queued jobs nobody picked up for eight times as long. Returns how many.
        /// </summary>
        Task<int> FailStuckAsync(int olderThanMinutes);

        /// <summary>Jobs that are queued in the database but in nobody's memory (after a restart).</summary>
        Task<IReadOnlyList<int>> GetQueuedAsync();
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
