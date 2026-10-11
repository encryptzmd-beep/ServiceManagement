using System.Collections.Concurrent;
using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Singleton resolver. Reads a company's registry row from MainDB with its own
    /// short-lived connection (so it can stay a singleton), decrypts the database
    /// password, and builds + caches the connection string per tenant key.
    /// </summary>
    public class ConnectionResolver : IConnectionResolver
    {
        private sealed record TenantEntry(string TenantKey, int CompanyId, string CompanyName, int ScopeId, string ConnectionString);

        private readonly string _mainConnectionString;
        private readonly ITenantSecretProtector _protector;
        private readonly ConcurrentDictionary<string, TenantEntry> _cache = new(StringComparer.OrdinalIgnoreCase);
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
                throw new ArgumentException("A tenant key is required to resolve a company database.", nameof(projectKey));

            var entry = await GetEntryAsync(projectKey)
                ?? throw new InvalidOperationException("No active company database is registered for this key.");

            return entry.ConnectionString;
        }

        public async Task<ProjectScope?> GetProjectScopeAsync(string projectKey)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                return null;

            if (_scopeCache.TryGetValue(projectKey, out var cached))
                return cached;

            var entry = await GetEntryAsync(projectKey);
            if (entry == null)
                return null;

            var scope = new ProjectScope
            {
                ProjectKey = entry.TenantKey,
                CompanyId = entry.CompanyId,
                CompanyName = entry.CompanyName,
                ProjectId = entry.ScopeId
            };

            // Branches live in the company's own DB
            var tenantDb = new ExplicitDbHelper(entry.ConnectionString);
            var locations = await tenantDb.ExecuteDataTableAsync("sp_Project_GetLocations", new[]
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

        private async Task<TenantEntry?> GetEntryAsync(string tenantKey)
        {
            if (_cache.TryGetValue(tenantKey, out var cached))
                return cached;

            var entry = await LoadFromRegistryAsync(tenantKey);
            if (entry != null)
                _cache[tenantKey] = entry;

            return entry;
        }

        private async Task<TenantEntry?> LoadFromRegistryAsync(string tenantKey)
        {
            await using var conn = new SqlConnection(_mainConnectionString);
            await conn.OpenAsync();

            await using var cmd = new SqlCommand("dbo.sp_Tenant_GetConnection", conn)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("@TenantKey", tenantKey);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return null;

            var password = _protector.Unprotect(reader["DbPasswordEnc"]?.ToString() ?? string.Empty);

            var connectionString = TenantConnectionString.Build(
                reader["ServerName"]?.ToString(),
                reader["DatabaseName"]?.ToString(),
                reader["DbUser"]?.ToString(),
                password,
                reader["ExtraOptions"]?.ToString());

            return new TenantEntry(
                reader["TenantKey"]?.ToString() ?? tenantKey,
                Convert.ToInt32(reader["CompanyId"]),
                reader["CompanyName"]?.ToString() ?? string.Empty,
                Convert.ToInt32(reader["TenantScopeId"]),
                connectionString);
        }
    }
}
