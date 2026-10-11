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
        /// <summary>A job ends, and cleans up, before the sweeper would give it up.</summary>
        public static readonly TimeSpan JobTimeout = TimeSpan.FromMinutes(12);
        public const int StuckAfterMinutes = 15;
        public static readonly TimeSpan SweepEvery = TimeSpan.FromMinutes(5);

        private readonly ProvisioningQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ProvisioningWorker> _logger;

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

            await PickUpWaitingJobsAsync();

            await Task.WhenAll(RunJobsAsync(stoppingToken), SweepAsync(stoppingToken));
        }

        /// <summary>
        /// Queues the jobs that were waiting when the API was last stopped. A company
        /// queued twice is harmless: the second run finds nothing to claim and is skipped.
        /// </summary>
        public static async Task<int> EnqueueWaitingAsync(IProvisionStore store, IProvisioningQueue queue)
        {
            var waiting = await store.GetQueuedAsync();
            foreach (var companyId in waiting)
                queue.Enqueue(companyId);
            return waiting.Count;
        }

        private async Task PickUpWaitingJobsAsync()
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var count = await EnqueueWaitingAsync(
                    scope.ServiceProvider.GetRequiredService<IProvisionStore>(), _queue);
                if (count > 0)
                    _logger.LogInformation("Provisioning worker: {Count} waiting set-up(s) picked up at start", count);
            }
            catch (Exception ex)
            {
                // e.g. script 20 has not been run yet: company creation is simply not available
                _logger.LogWarning(ex, "Provisioning worker: the waiting set-ups could not be read at start");
            }
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

                // the creator must exist in the new database before the first login into it
                if (outcome == ProvisionOutcome.Ready)
                    await scope.ServiceProvider.GetRequiredService<ITenantUserSyncService>()
                               .TrySyncCompanyUsersAsync(companyId);
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
                        var failed = await scope.ServiceProvider.GetRequiredService<IProvisionStore>()
                                                .FailStuckAsync(StuckAfterMinutes);
                        if (failed > 0)
                            _logger.LogWarning("Provisioning worker: {Count} interrupted set-up(s) marked as failed", failed);
                    }
                    catch (Exception ex)
                    {
                        // e.g. script 20 has not been run yet: company creation is simply not available
                        _logger.LogWarning(ex, "Provisioning worker: the check for interrupted set-ups failed");
                    }
                }
                while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException) { /* the host is stopping */ }
        }
    }
}
