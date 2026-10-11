using System.Threading.Channels;
using EncryptzBL.Common.Provisioning;

namespace EncryptzAPI.Provisioning
{
    /// <summary>
    /// Companies waiting for their database, inside this process. Nothing is lost
    /// for good when the process stops: the company stays Provisioning, the worker
    /// picks it up again at the next start, or the sweeper marks it Failed and its
    /// creator can retry.
    /// </summary>
    public sealed class ProvisioningQueue : IProvisioningQueue
    {
        private readonly Channel<int> _channel = Channel.CreateUnbounded<int>(
            new UnboundedChannelOptions { SingleReader = true });

        public ChannelReader<int> Reader => _channel.Reader;

        public void Enqueue(int companyId)
        {
            if (companyId > 0)
                _channel.Writer.TryWrite(companyId);
        }
    }
}
