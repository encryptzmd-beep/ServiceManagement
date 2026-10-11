using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Creates, builds and (for a failed attempt) drops a company database on the
    /// server of the job. The only text ever concatenated into SQL here is a database
    /// name that <see cref="TenantDatabaseName.IsGenerated"/> accepts.
    /// </summary>
    public sealed class SqlTenantDatabaseServer : ITenantDatabaseServer
    {
        /// <summary>Per batch of the tenant script.</summary>
        public const int BatchTimeoutSeconds = 300;

        private readonly Lazy<TenantScript> _script;

        public SqlTenantDatabaseServer(Lazy<TenantScript> script) => _script = script;

        internal static string CreateDatabaseSql(string databaseName)
            => $"CREATE DATABASE [{Checked(databaseName)}];";

        internal static string DropDatabaseSql(string databaseName)
        {
            var name = Checked(databaseName);
            return $"IF DB_ID(N'{name}') IS NOT NULL BEGIN "
                 + $"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; "
                 + $"DROP DATABASE [{name}]; END";
        }

        private static string Checked(string databaseName)
            => TenantDatabaseName.IsGenerated(databaseName)
                ? databaseName
                : throw new InvalidOperationException("Not a generated tenant database name.");

        public async Task<bool> DatabaseExistsAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            await using var conn = new SqlConnection(Master(job));
            await conn.OpenAsync(ct);

            await using var cmd = new SqlCommand("SELECT DB_ID(@Name);", conn);
            cmd.Parameters.AddWithValue("@Name", databaseName);

            var id = await cmd.ExecuteScalarAsync(ct);
            return id != null && id != DBNull.Value;
        }

        public async Task CreateDatabaseAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            await using var conn = new SqlConnection(Master(job));
            await conn.OpenAsync(ct);

            await using var cmd = new SqlCommand(CreateDatabaseSql(databaseName), conn) { CommandTimeout = 120 };
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public async Task BuildTenantAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            var script = _script.Value;   // throws when the shipped script does not have the expected shape

            // One connection for everything: #TenantSettings lives in the session.
            // Not pooled, so nothing keeps the database open if it has to be dropped.
            await using var conn = new SqlConnection(Tenant(job, Checked(databaseName)));
            await conn.OpenAsync(ct);

            // A parameterised command runs inside sp_executesql, where a temporary table
            // would vanish at once: create it with a plain command, fill it with parameters.
            await using (var create = new SqlCommand(TenantScript.CreateSettingsTableSql, conn))
                await create.ExecuteNonQueryAsync(ct);

            await using (var insert = new SqlCommand(TenantScript.InsertSettingsSql, conn))
            {
                insert.Parameters.AddWithValue("@CompanyId", job.CompanyId);
                insert.Parameters.AddWithValue("@ProjectId", job.TenantScopeId);
                insert.Parameters.Add("@LocationName", System.Data.SqlDbType.NVarChar, 200).Value = job.FirstBranchName;
                insert.Parameters.Add("@LocationCode", System.Data.SqlDbType.NVarChar, 50).Value = DBNull.Value;
                insert.Parameters.Add("@LocationCity", System.Data.SqlDbType.NVarChar, 100).Value = DBNull.Value;
                insert.Parameters.Add("@CopyLookupsFrom", System.Data.SqlDbType.NVarChar, 128).Value =
                    string.IsNullOrWhiteSpace(job.LookupSourceDb) ? DBNull.Value : job.LookupSourceDb.Trim();
                await insert.ExecuteNonQueryAsync(ct);
            }

            var number = 0;
            foreach (var batch in script.Batches)
            {
                number++;
                ct.ThrowIfCancellationRequested();

                try
                {
                    await using var cmd = new SqlCommand(batch, conn) { CommandTimeout = BatchTimeoutSeconds };
                    await cmd.ExecuteNonQueryAsync(ct);
                }
                catch (SqlException ex)
                {
                    // the script's own safety checks raise an error and switch NOEXEC on: stop at once
                    throw new InvalidOperationException($"Tenant script batch {number} of {script.Batches.Count} failed: {ex.Message}", ex);
                }
            }

            await VerifyAsync(conn, ct);
        }

        /// <summary>The same readiness test "Test connection" uses, plus the first branch.</summary>
        private static async Task VerifyAsync(SqlConnection conn, CancellationToken ct)
        {
            // the script ends with SET NOEXEC OFF, but be sure before asking
            await using (var off = new SqlCommand("SET NOEXEC OFF;", conn))
                await off.ExecuteNonQueryAsync(ct);

            const string sql = @"SELECT
                CASE WHEN OBJECT_ID('dbo.Locations') IS NOT NULL
                      AND OBJECT_ID('dbo.sp_Project_GetLocations') IS NOT NULL
                      AND OBJECT_ID('dbo.sp_Location_Validate') IS NOT NULL
                      AND OBJECT_ID('dbo.sp_Tenant_SyncUsers') IS NOT NULL
                      AND COL_LENGTH('dbo.Users', 'MainUserId') IS NOT NULL
                     THEN 1 ELSE 0 END;";

            await using (var ready = new SqlCommand(sql, conn))
            {
                if (Convert.ToInt32(await ready.ExecuteScalarAsync(ct)) != 1)
                    throw new InvalidOperationException("The tenant script ran but the database is not complete.");
            }

            await using var branches = new SqlCommand("SELECT COUNT(*) FROM dbo.Locations WHERE IsActive = 1;", conn);
            if (Convert.ToInt32(await branches.ExecuteScalarAsync(ct)) < 1)
                throw new InvalidOperationException("The tenant script ran but no branch was created.");
        }

        public async Task DropDatabaseAsync(ProvisionJob job, string databaseName)
        {
            await using var conn = new SqlConnection(Master(job));
            await conn.OpenAsync();

            await using var cmd = new SqlCommand(DropDatabaseSql(databaseName), conn) { CommandTimeout = 120 };
            await cmd.ExecuteNonQueryAsync();
        }

        private static string Master(ProvisionJob job)
            => new SqlConnectionStringBuilder(
                   TenantConnectionString.Build(job.ServerName, "master", job.AdminUser, job.AdminPassword, job.ExtraOptions))
               { Pooling = false, ConnectTimeout = 15 }.ConnectionString;

        private static string Tenant(ProvisionJob job, string databaseName)
            => new SqlConnectionStringBuilder(
                   TenantConnectionString.Build(job.ServerName, databaseName, job.AdminUser, job.AdminPassword, job.ExtraOptions))
               { Pooling = false, ConnectTimeout = 15 }.ConnectionString;
    }
}
