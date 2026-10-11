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
            Assert.True(ProvisioningWorker.JobTimeout < TimeSpan.FromMinutes(ProvisioningWorker.StuckAfterMinutes));
            Assert.True(ProvisioningWorker.SweepEvery <= TimeSpan.FromMinutes(ProvisioningWorker.StuckAfterMinutes));
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
            public Task<string> GetStatusAsync(int companyId) => throw new NotSupportedException();
            public Task<int> FailStuckAsync(int olderThanMinutes) => throw new NotSupportedException();
        }
    }
}
