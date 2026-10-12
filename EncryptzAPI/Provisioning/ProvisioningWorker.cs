using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Tenant;

namespace EncryptzAPI.Provisioning
{
    /// <summary>
    /// Builds company databases one at a time, outside any request (the tenant script
    /// has about 1,470 batches and can outlast a proxy time-out), and gives up jobs
    /// that were interrupted.
    /// </summary>
    public sealed class ProvisioningWorker : BackgroundService
    {
        // THE TIMING RULE: JobTimeout + 5 minutes <= StuckAfterMinutes.
        // A job that runs into its time-out still has to clean up (ask the main database,
        // drop its database: connect 15 s + command 120 s, record the failure). It must be
        // done with that before the sweeper gives the job up, and long before a retry can
        // overtake it (sp_Provision_Retry: 30 minutes after the attempt started).
        // Change one of the two values only together with the other; a test holds the rule.

        /// <summary>After this time a running job is cancelled and cleans up.</summary>
        public static readonly TimeSpan JobTimeout = TimeSpan.FromMinutes(12);

        /// <summary>
        /// The sweeper gives up a claimed job this long after it was claimed (queued jobs:
        /// 8 times as long). At least JobTimeout + 5 minutes: see the rule above.
        /// </summary>
        public const int StuckAfterMinutes = 20;

        public static readonly TimeSpan SweepEvery = TimeSpan.FromMinutes(5);

        private readonly ProvisioningQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ProvisioningWorker> _logger;

        /// <summary>The jobs that were waiting when the API started have been queued (once is enough).</summary>
        private bool _waitingPickedUp;

        public ProvisioningWorker(ProvisioningQueue queue, IServiceScopeFactory scopes, ILogger<ProvisioningWorker> logger)
        {
            _queue = queue;
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // let the host finish starting before the first database call
            await Task.Yield();

            // the first round of the sweeper runs at once: it picks up the waiting jobs
            await Task.WhenAll(RunJobsAsync(stoppingToken), SweepAsync(stoppingToken));
        }

        /// <summary>
        /// Queues the jobs that were waiting when the API was last stopped. A company
        /// queued twice is harmless: the second run finds nothing to claim and is skipped.
        /// Nothing is queued once the host is stopping (the store call itself takes no token).
        /// </summary>
        public static async Task<int> EnqueueWaitingAsync(
            IProvisionStore store, IProvisioningQueue queue, CancellationToken stoppingToken = default)
        {
            stoppingToken.ThrowIfCancellationRequested();

            var waiting = await store.GetQueuedAsync();

            stoppingToken.ThrowIfCancellationRequested();

            foreach (var companyId in waiting)
                queue.Enqueue(companyId);
            return waiting.Count;
        }

        private async Task RunJobsAsync(CancellationToken stoppingToken)
        {
            try
            {
                await foreach (var companyId in _queue.Reader.ReadAllAsync(stoppingToken))
                    await RunOneAsync(companyId, stoppingToken);
            }
            catch (OperationCanceledException) { /* the host is stopping */ }
        }

        private async Task RunOneAsync(int companyId, CancellationToken stoppingToken)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(JobTimeout);

                var provisioner = scope.ServiceProvider.GetRequiredService<TenantProvisioner>();
                var outcome = await provisioner.RunAsync(companyId, timeout.Token);

                // the provisioner has cleaned up and recorded what it could
                if (stoppingToken.IsCancellationRequested)
                    _logger.LogInformation(
                        "Provisioning worker: the host is stopping; the set-up of company {CompanyId} ended as {Outcome}",
                        companyId, outcome);

                // the creator must exist in the new database before the first login into it
                if (outcome == ProvisionOutcome.Ready)
                    await scope.ServiceProvider.GetRequiredService<ITenantUserSyncService>()
                               .TrySyncCompanyUsersAsync(companyId);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Provisioning worker: the host is stopping; the set-up of company {CompanyId} was interrupted", companyId);
            }
            catch (Exception ex)
            {
                // never let one job stop the worker
                _logger.LogError(ex, "Provisioning worker: job of company {CompanyId} ended unexpectedly", companyId);
            }
        }

        private async Task SweepAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var timer = new PeriodicTimer(SweepEvery);
                do
                {
                    try
                    {
                        using var scope = _scopes.CreateScope();
                        await SweepOnceAsync(scope.ServiceProvider.GetRequiredService<IProvisionStore>(), stoppingToken);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        // the store could not even be made: same quiet warning as below
                        _logger.LogWarning("Provisioning worker: the sweeper round failed ({ErrorType}: {ErrorMessage})",
                            ex.GetType().Name, ex.Message);
                    }
                }
                while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException) { /* the host is stopping */ }
        }

        /// <summary>
        /// One round of the sweeper: picks up the jobs that were waiting at start (tried again
        /// in every round until it has worked once), then gives up the interrupted ones.
        /// A failure is a warning with the error type and message only: it repeats every
        /// <see cref="SweepEvery"/> while script 20 has not been run, and a stack trace each
        /// time would drown the log. Throws only when the host is stopping.
        /// </summary>
        public async Task SweepOnceAsync(IProvisionStore store, CancellationToken stoppingToken)
        {
            stoppingToken.ThrowIfCancellationRequested();

            if (!_waitingPickedUp)
            {
                try
                {
                    var count = await EnqueueWaitingAsync(store, _queue, stoppingToken);
                    _waitingPickedUp = true;
                    if (count > 0)
                        _logger.LogInformation("Provisioning worker: {Count} waiting set-up(s) picked up", count);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    // e.g. script 20 has not been run yet: company creation is simply not available
                    _logger.LogWarning("Provisioning worker: the waiting set-ups could not be read ({ErrorType}: {ErrorMessage}). It is tried again in the next round.",
                        ex.GetType().Name, ex.Message);
                }
            }

            stoppingToken.ThrowIfCancellationRequested();

            try
            {
                var failed = await store.FailStuckAsync(StuckAfterMinutes);
                if (failed > 0)
                    _logger.LogWarning("Provisioning worker: {Count} interrupted set-up(s) marked as failed", failed);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning("Provisioning worker: the check for interrupted set-ups failed ({ErrorType}: {ErrorMessage})",
                    ex.GetType().Name, ex.Message);
            }
        }
    }
}
