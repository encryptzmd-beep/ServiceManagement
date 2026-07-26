using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common
{
    /// <summary>
    /// DB executor bound to the fixed MainDB connection ("MainConnection").
    /// Used by control-plane services (auth, users, roles, menus, companies) that
    /// must run before — or independently of — a client being selected.
    /// </summary>
    public class MainDbHelper : SqlDbHelper
    {
        private readonly string _connectionString;

        public MainDbHelper(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("MainConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:MainConnection is not configured.");
        }

        protected override string ConnectionString => _connectionString;
    }
}
