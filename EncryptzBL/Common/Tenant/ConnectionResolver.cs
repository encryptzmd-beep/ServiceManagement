using System.Collections.Concurrent;
using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Singleton resolver. Reads the registry from MainDB using its own short-lived
    /// connection (so it can stay a singleton), decrypts the ServiceDB password, and
    /// builds + caches a connection string per client key.
    /// </summary>
    public class ConnectionResolver : IConnectionResolver
    {
        private readonly string _mainConnectionString;
        private readonly ITenantSecretProtector _protector;
        private readonly ConcurrentDictionary<string, string> _cache = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, ProjectScope> _scopeCache = new(StringComparer.OrdinalIgnoreCase);

        public ConnectionResolver(IConfiguration config, ITenantSecretProtector protector)
        {
            _mainConnectionString = config.GetConnectionString("MainConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:MainConnection is not configured.");
            _protector = protector;
        }

        public async Task<string> GetServiceConnectionAsync(string projectKey)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                throw new ArgumentException("Project key is required to resolve a project DB.", nameof(projectKey));

            if (_cache.TryGetValue(projectKey, out var cached))
                return cached;

            var connStr = await BuildFromRegistryAsync(projectKey);
            _cache[projectKey] = connStr;
            return connStr;
        }

        public async Task<ProjectScope?> GetProjectScopeAsync(string projectKey)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                return null;

            if (_scopeCache.TryGetValue(projectKey, out var cached))
                return cached;

            var scope = new ProjectScope();

            await using (var conn = new SqlConnection(_mainConnectionString))
            {
                await conn.OpenAsync();

                await using var cmd = new SqlCommand(
                                        @"SELECT TOP 1 p.ProjectId, p.CompanyId, p.ProjectKey, c.CompanyName
                      FROM dbo.Projects p
                      INNER JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId AND pc.IsActive = 1
                      INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId AND c.IsActive = 1
                      WHERE p.ProjectKey = @ProjectKey AND p.IsActive = 1", conn);
                cmd.Parameters.AddWithValue("@ProjectKey", projectKey);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return null;

                scope.ProjectId = Convert.ToInt32(reader["ProjectId"]);
                scope.CompanyId = Convert.ToInt32(reader["CompanyId"]);
                scope.ProjectKey = reader["ProjectKey"]?.ToString() ?? projectKey;
                scope.CompanyName = reader["CompanyName"]?.ToString() ?? string.Empty;
            }

            // Locations live in the project's own DB
            var projectDb = new ExplicitDbHelper(await GetServiceConnectionAsync(scope.ProjectKey));
            var locations = await projectDb.ExecuteDataTableAsync("sp_Project_GetLocations", new[]
            {
                SqlParameterHelper.Input("@CompanyId", scope.CompanyId),
                SqlParameterHelper.Input("@ProjectId", scope.ProjectId)
            });

            if (locations.Rows.Count > 0)
                scope.DefaultLocationId = locations.Rows.Cast<DataRow>().Min(r => Convert.ToInt32(r["LocationId"]));

            _scopeCache[projectKey] = scope;
            return scope;
        }

        public void Evict(string projectKey)
        {
            if (!string.IsNullOrWhiteSpace(projectKey))
            {
                _cache.TryRemove(projectKey, out _);
                _scopeCache.TryRemove(projectKey, out _);
            }
        }

        private async Task<string> BuildFromRegistryAsync(string projectKey)
        {
            await using var conn = new SqlConnection(_mainConnectionString);
            await conn.OpenAsync();

            await using var cmd = new SqlCommand("dbo.sp_Project_GetConnection", conn)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("@ProjectKey", projectKey);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                throw new InvalidOperationException($"No active project DB registered for project key '{projectKey}'.");

            var server   = reader["ServerName"]?.ToString();
            var database = reader["DatabaseName"]?.ToString();
            var user     = reader["DbUser"]?.ToString();
            var passEnc  = reader["DbPasswordEnc"]?.ToString();
            var extra    = reader["ExtraOptions"]?.ToString();

            var password = _protector.Unprotect(passEnc ?? string.Empty);

            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server,
                InitialCatalog = database,
                UserID = user,
                Password = password,
                TrustServerCertificate = true,
                MultipleActiveResultSets = true
            };

            var result = builder.ConnectionString;

            // Append any raw extra options that aren't covered above.
            if (!string.IsNullOrWhiteSpace(extra))
                result = result.TrimEnd(';') + ";" + extra.Trim();

            return result;
        }
    }
}
