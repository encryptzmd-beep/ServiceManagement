using EncryptzAPI.Provisioning;
using EncryptzBL.Common.Provisioning;
using Xunit;

namespace EncryptzTests
{
    public class ProvisioningQueueTests
    {
        [Fact]
        public async Task Companies_come_out_in_the_order_they_went_in()
        {
            var queue = new ProvisioningQueue();
            queue.Enqueue(3);
            queue.Enqueue(9);

            Assert.Equal(3, await queue.Reader.ReadAsync());
            Assert.Equal(9, await queue.Reader.ReadAsync());
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void A_company_without_an_id_is_not_queued(int companyId)
        {
            var queue = new ProvisioningQueue();
            queue.Enqueue(companyId);

            Assert.False(queue.Reader.TryRead(out _));
        }

        [Fact]
        public void The_job_time_out_ends_before_the_sweeper_gives_a_job_up()
        {
            var stuckAfter = TimeSpan.FromMinutes(ProvisioningWorker.StuckAfterMinutes);

            Assert.True(ProvisioningWorker.JobTimeout < stuckAfter);
            Assert.True(ProvisioningWorker.SweepEvery <= stuckAfter);

            // the invariant: a job that times out still has five minutes for its clean-up
            // (the drop: connect 15 s + command 120 s) before the sweeper gives it up
            Assert.True(ProvisioningWorker.JobTimeout + TimeSpan.FromMinutes(5) <= stuckAfter);

            Assert.Equal(TimeSpan.FromMinutes(12), ProvisioningWorker.JobTimeout);
            Assert.Equal(20, ProvisioningWorker.StuckAfterMinutes);
        }

        // -- one round of the sweeper --

        private static ProvisioningWorker Worker(ProvisioningQueue queue, WorkerLogger logger)
            => new(queue, null!, logger);   // a round is handed its store: no scope is opened

        [Fact]
        public async Task The_pick_up_of_waiting_jobs_is_tried_again_each_round_until_it_has_worked_once()
        {
            var queue = new ProvisioningQueue();
            var logger = new WorkerLogger();
            var worker = Worker(queue, logger);
            var store = new SweepStore { QueuedFailures = 2, Queued = new[] { 4 } };

            await worker.SweepOnceAsync(store, CancellationToken.None);
            await worker.SweepOnceAsync(store, CancellationToken.None);
            Assert.False(queue.Reader.TryRead(out _));
            Assert.Equal(2, store.QueuedCalls);

            await worker.SweepOnceAsync(store, CancellationToken.None);   // works now
            Assert.Equal(3, store.QueuedCalls);
            Assert.True(queue.Reader.TryRead(out var companyId));
            Assert.Equal(4, companyId);

            await worker.SweepOnceAsync(store, CancellationToken.None);   // not asked again
            Assert.Equal(3, store.QueuedCalls);
            Assert.False(queue.Reader.TryRead(out _));

            Assert.Equal(4, store.FailStuckCalls);                        // the stuck jobs are checked in every round
            Assert.Equal(new[] { ProvisioningWorker.StuckAfterMinutes }, store.FailStuckArguments.Distinct());
        }

        [Fact]
        public async Task A_round_that_fails_is_logged_as_a_warning_with_the_error_type_and_message_only()
        {
            var logger = new WorkerLogger();
            var worker = Worker(new ProvisioningQueue(), logger);
            var store = new SweepStore { QueuedFailures = 1, FailStuckThrows = new TimeoutException("the main database did not answer") };

            await worker.SweepOnceAsync(store, CancellationToken.None);

            Assert.Empty(logger.Exceptions);   // never the exception object: no stack trace every 5 minutes
            Assert.Equal(2, logger.Lines.Count);
            Assert.All(logger.Levels, level => Assert.Equal(Microsoft.Extensions.Logging.LogLevel.Warning, level));
            Assert.Contains(logger.Lines, line => line.Contains("InvalidOperationException") && line.Contains("no table"));
            Assert.Contains(logger.Lines, line => line.Contains("TimeoutException") && line.Contains("the main database did not answer"));
        }

        [Fact]
        public async Task A_round_during_shutdown_stops_without_logging_an_error()
        {
            var logger = new WorkerLogger();
            var worker = Worker(new ProvisioningQueue(), logger);
            var store = new SweepStore();
            using var stopping = new CancellationTokenSource();
            stopping.Cancel();

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => worker.SweepOnceAsync(store, stopping.Token));

            Assert.Empty(logger.Lines);
            Assert.Equal(0, store.QueuedCalls);
            Assert.Equal(0, store.FailStuckCalls);
        }

        [Fact]
        public async Task A_store_that_is_cancelled_by_the_shutdown_is_not_reported_as_a_failure()
        {
            var logger = new WorkerLogger();
            var worker = Worker(new ProvisioningQueue(), logger);
            using var stopping = new CancellationTokenSource();
            var store = new SweepStore { OnFailStuck = () => { stopping.Cancel(); throw new OperationCanceledException(); } };

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => worker.SweepOnceAsync(store, stopping.Token));

            Assert.Empty(logger.Lines);
        }

        [Fact]
        public async Task Waiting_jobs_are_not_queued_once_the_host_is_stopping()
        {
            var queue = new ProvisioningQueue();
            using var stopping = new CancellationTokenSource();
            stopping.Cancel();

            await Assert.ThrowsAnyAsync<OperationCanceledException>(
                () => ProvisioningWorker.EnqueueWaitingAsync(new WaitingStore(new[] { 5, 2 }), queue, stopping.Token));
            Assert.False(queue.Reader.TryRead(out _));
        }

        private sealed class SweepStore : IProvisionStore
        {
            public int QueuedFailures, QueuedCalls, FailStuckCalls;
            public int[] Queued = Array.Empty<int>();
            public Exception? FailStuckThrows;
            public Action? OnFailStuck;
            public readonly List<int> FailStuckArguments = new();

            public Task<IReadOnlyList<int>> GetQueuedAsync()
            {
                QueuedCalls++;
                if (QueuedCalls <= QueuedFailures) throw new InvalidOperationException("no table");
                return Task.FromResult<IReadOnlyList<int>>(Queued);
            }

            public Task<int> FailStuckAsync(int olderThanMinutes)
            {
                FailStuckCalls++;
                FailStuckArguments.Add(olderThanMinutes);
                OnFailStuck?.Invoke();
                if (FailStuckThrows != null) throw FailStuckThrows;
                return Task.FromResult(0);
            }

            public Task<ProvisionJob?> BeginAsync(int companyId) => throw new NotSupportedException();
            public Task<bool> CompleteAsync(ProvisionJob job, string databaseName) => throw new NotSupportedException();
            public Task FailAsync(ProvisionJob job, string error) => throw new NotSupportedException();
            public Task<AbandonResult?> AbandonAsync(ProvisionJob job, string databaseName) => throw new NotSupportedException();
        }

        private sealed class WorkerLogger : Microsoft.Extensions.Logging.ILogger<ProvisioningWorker>
        {
            public readonly List<string> Lines = new();
            public readonly List<Microsoft.Extensions.Logging.LogLevel> Levels = new();
            public readonly List<Exception> Exceptions = new();

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;
            public void Log<TState>(Microsoft.Extensions.Logging.LogLevel logLevel, Microsoft.Extensions.Logging.EventId eventId,
                TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                Lines.Add(formatter(state, exception));
                Levels.Add(logLevel);
                if (exception != null) Exceptions.Add(exception);
            }
        }

        [Fact]
        public async Task Jobs_waiting_at_start_are_queued_in_order()
        {
            var queue = new ProvisioningQueue();
            var count = await ProvisioningWorker.EnqueueWaitingAsync(new WaitingStore(new[] { 5, 2, 8 }), queue);

            Assert.Equal(3, count);
            Assert.Equal(5, await queue.Reader.ReadAsync());
            Assert.Equal(2, await queue.Reader.ReadAsync());
            Assert.Equal(8, await queue.Reader.ReadAsync());
        }

        [Fact]
        public async Task A_store_that_cannot_be_read_is_reported_to_the_caller()
        {
            var queue = new ProvisioningQueue();
            await Assert.ThrowsAsync<InvalidOperationException>(
                () => ProvisioningWorker.EnqueueWaitingAsync(new WaitingStore(null), queue));
            Assert.False(queue.Reader.TryRead(out _));
        }

        private sealed class WaitingStore : IProvisionStore
        {
            private readonly int[]? _ids;
            public WaitingStore(int[]? ids) => _ids = ids;

            public Task<IReadOnlyList<int>> GetQueuedAsync() =>
                _ids == null ? throw new InvalidOperationException("no table") : Task.FromResult<IReadOnlyList<int>>(_ids);

            public Task<ProvisionJob?> BeginAsync(int companyId) => throw new NotSupportedException();
            public Task<bool> CompleteAsync(ProvisionJob job, string databaseName) => throw new NotSupportedException();
            public Task FailAsync(ProvisionJob job, string error) => throw new NotSupportedException();
            public Task<AbandonResult?> AbandonAsync(ProvisionJob job, string databaseName) => throw new NotSupportedException();
            public Task<int> FailStuckAsync(int olderThanMinutes) => throw new NotSupportedException();
        }
    }
}
