using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common
{
    /// <summary>
    /// Tenant-aware transaction scope over the current client's ServiceDB.
    /// Resolves its connection string from <see cref="TenantContext"/> at Begin time.
    /// (For MainDB transactions, use a dedicated main-scoped helper instead — a single
    /// transaction cannot span MainDB and a ServiceDB.)
    /// </summary>
    public class DbTransactionHelper : IDisposable
    {
        public SqlConnection? Connection { get; private set; }
        public SqlTransaction? Transaction { get; private set; }

        private readonly TenantContext _tenant;

        public DbTransactionHelper(TenantContext tenant)
        {
            _tenant = tenant;
        }

        public async Task BeginAsync()
        {
            var connectionString = _tenant.ServiceDbConnectionString
                ?? throw new InvalidOperationException(
                    "No ServiceDB resolved for this request; cannot begin a transaction.");

            Connection = new SqlConnection(connectionString);
            await Connection.OpenAsync();
            await TenantSessionContext.ApplyAsync(Connection, _tenant);
            Transaction = Connection.BeginTransaction();
        }

        public async Task CommitAsync()
        {
            await Transaction!.CommitAsync();
            await Connection!.CloseAsync();
        }

        public async Task RollbackAsync()
        {
            await Transaction!.RollbackAsync();
            await Connection!.CloseAsync();
        }

        public void Dispose()
        {
            Transaction?.Dispose();
            Connection?.Dispose();
        }
    }
}
