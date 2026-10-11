using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common
{
    /// <summary>
    /// Tenant-aware DB executor. Resolves its connection string per request from
    /// <see cref="TenantContext"/>, so every business call is routed to the current
    /// client's ServiceDB. Registered as Scoped; the connection string is read at
    /// call time (not in the constructor) so it is valid after tenant resolution.
    /// </summary>
    public class DbHelper : SqlDbHelper
    {
        private readonly TenantContext _tenant;

        public DbHelper(TenantContext tenant)
        {
            _tenant = tenant;
        }

        /// <summary>The resolved tenant scope for the current request (company/project/location).</summary>
        public TenantContext Tenant => _tenant;

        protected override string ConnectionString =>
            _tenant.ServiceDbConnectionString ?? throw new TenantScopeRequiredException();

        protected override Task OnConnectionOpenedAsync(SqlConnection conn)
            => TenantSessionContext.ApplyAsync(conn, _tenant);
    }
}
