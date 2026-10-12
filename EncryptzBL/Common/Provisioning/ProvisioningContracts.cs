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

    /// <summary>
    /// The answer of the main database when an attempt gives its job up and asks whether
    /// it may drop the database it built (sp_Provision_Abandon, one statement).
    /// MayDrop is true only when, at that moment, the job was this attempt's, the company
    /// was still waiting for its first database and NO company named the database; the
    /// company is then Failed and the attempt keeps the job until it releases it.
    /// The rest says what the company looks like now, so the caller can tell why not:
    /// Attempt is null while the job is queued or released, DatabaseName is "" while the
    /// company has no database, UsedByAnother says that another company names the database.
    /// </summary>
    public sealed record AbandonResult(bool MayDrop, string Status, Guid? Attempt, string DatabaseName, bool UsedByAnother);

    /// <summary>The main-database side of a provisioning job.</summary>
    public interface IProvisionStore
    {
        /// <summary>Claims the company's job. Null when there is nothing to do: unknown company, not Provisioning, or another run already has it.</summary>
        Task<ProvisionJob?> BeginAsync(int companyId);

        /// <summary>Marks the company Ready. False when this attempt no longer owns the job.</summary>
        Task<bool> CompleteAsync(ProvisionJob job, string databaseName);

        /// <summary>
        /// Marks the company Failed and releases the job, when this attempt still owns it
        /// (also when the sweeper or <see cref="AbandonAsync"/> marked it Failed meanwhile:
        /// the attempt's own reason replaces that text). The last thing an attempt does:
        /// only then can it be retried.
        /// </summary>
        Task FailAsync(ProvisionJob job, string error);

        /// <summary>
        /// Gives the job up and says, decided in the same statement, whether this attempt may
        /// drop the database it built. Null when the company does not exist. The ONLY thing
        /// that allows a drop is <see cref="AbandonResult.MayDrop"/> being true.
        /// </summary>
        Task<AbandonResult?> AbandonAsync(ProvisionJob job, string databaseName);

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
        /// <summary>
        /// Makes sure everything a build needs besides the server is there (the tenant
        /// script can be read and has the expected shape). Called before anything is
        /// created; throws when it is not.
        /// </summary>
        void EnsureReady();

        Task<bool> DatabaseExistsAsync(ProvisionJob job, string databaseName, CancellationToken ct);
        Task CreateDatabaseAsync(ProvisionJob job, string databaseName, CancellationToken ct);

        /// <summary>Runs the tenant script in the database and checks the result. Throws when anything is wrong.</summary>
        Task BuildTenantAsync(ProvisionJob job, string databaseName, CancellationToken ct);

        /// <summary>
        /// Clean-up of a failed attempt. Not cancellable on purpose. Only TenantProvisioner
        /// calls it, and only after <see cref="IProvisionStore.AbandonAsync"/> answered that
        /// it may (the attempt owns the job and no company names this database).
        /// </summary>
        Task DropDatabaseAsync(ProvisionJob job, string databaseName);
    }

    /// <summary>Hands a company to the background worker.</summary>
    public interface IProvisioningQueue
    {
        void Enqueue(int companyId);
    }
}
