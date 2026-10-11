using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>Builds the connection string of a tenant database from the parts kept on its company row.</summary>
    public static class TenantConnectionString
    {
        public static string Build(string? server, string? database, string? user, string? password, string? extraOptions)
        {
            if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(user))
                throw new InvalidOperationException("The tenant database connection is incomplete.");

            // The builder quotes each value, so a name cannot spill into another keyword.
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server.Trim(),
                InitialCatalog = database.Trim(),
                UserID = user.Trim(),
                Password = password ?? string.Empty,
                TrustServerCertificate = true,
                MultipleActiveResultSets = true
            };

            var result = builder.ConnectionString;

            // Raw options an administrator typed for this database (e.g. a timeout).
            if (!string.IsNullOrWhiteSpace(extraOptions))
                result = result.TrimEnd(';') + ";" + extraOptions.Trim().Trim(';');

            return result;
        }
    }
}
