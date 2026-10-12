using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// Creates, builds and (for a failed attempt) drops a company database on the
    /// server of the job. The only text ever concatenated into SQL here is a database
    /// name that <see cref="TenantDatabaseName.IsGenerated"/> accepts.
    /// An error that leaves this class carries its text only, without the connection
    /// string and without the password.
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

        /// <summary>
        /// Reads and checks the tenant script (once for the life of the API). Throws when the
        /// file is missing or does not have the expected shape, so the caller can stop before
        /// a database exists.
        /// </summary>
        public void EnsureReady()
        {
            if (!_script.Value.FollowUps.Any(f => string.Equals(f.FileName, "10_Branch_Access.sql", StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("The tenant script 10_Branch_Access.sql was not shipped with the API.");
        }

        public async Task<bool> DatabaseExistsAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            var connectionString = Master(job);
            try
            {
                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync(ct);

                await using var cmd = new SqlCommand("SELECT DB_ID(@Name);", conn);
                cmd.Parameters.AddWithValue("@Name", databaseName);

                var id = await cmd.ExecuteScalarAsync(ct);
                return id != null && id != DBNull.Value;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw Wrapped(ex, connectionString, job, ct);
            }
        }

        public async Task CreateDatabaseAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            var sql = CreateDatabaseSql(databaseName);
            var connectionString = Master(job);
            try
            {
                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync(ct);

                await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 120 };
                await cmd.ExecuteNonQueryAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw Wrapped(ex, connectionString, job, ct);
            }
        }

        public async Task BuildTenantAsync(ProvisionJob job, string databaseName, CancellationToken ct)
        {
            var script = _script.Value;   // throws when the shipped script does not have the expected shape

            // One connection for everything: #TenantSettings lives in the session.
            // Not pooled, so nothing keeps the database open if it has to be dropped.
            var connectionString = Tenant(job, Checked(databaseName));
            try
            {
                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync(ct);

                // Before the first batch: the script must run in the database this attempt
                // created and nowhere else, whatever the connection settings say.
                await using (var current = new SqlCommand("SELECT DB_NAME();", conn))
                    EnsureConnectedTo((await current.ExecuteScalarAsync(ct))?.ToString(), databaseName);

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
                        // a cancelled command comes back as a SqlException too: it is a cancellation
                        if (ct.IsCancellationRequested) throw new OperationCanceledException(ct);

                        // the script's own safety checks raise an error and switch NOEXEC on: stop at once
                        throw new InvalidOperationException($"Tenant script batch {number} of {script.Batches.Count} failed: {ex.Message}");
                    }
                }

                foreach (var followUp in script.FollowUps)
                {
                    var part = 0;
                    foreach (var batch in followUp.Batches)
                    {
                        part++;
                        ct.ThrowIfCancellationRequested();

                        try
                        {
                            await using var cmd = new SqlCommand(batch, conn) { CommandTimeout = BatchTimeoutSeconds };
                            await cmd.ExecuteNonQueryAsync(ct);
                        }
                        catch (SqlException ex)
                        {
                            // a cancelled command comes back as a SqlException too: it is a cancellation
                            if (ct.IsCancellationRequested) throw new OperationCanceledException(ct);

                            throw new InvalidOperationException($"Tenant script {followUp.FileName} batch {part} of {followUp.Batches.Count} failed: {ex.Message}");
                        }
                    }
                }

                await VerifyAsync(conn, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw Wrapped(ex, connectionString, job, ct);
            }
        }

        /// <summary>Refuses to go on when the open connection is not in the expected database.</summary>
        internal static void EnsureConnectedTo(string? actualDatabase, string expectedDatabase)
        {
            if (!string.Equals(actualDatabase, expectedDatabase, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    $"The connection is not in the database {expectedDatabase}. The tenant script was not run.");
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
                      AND OBJECT_ID('dbo.UserLocationAccess') IS NOT NULL AND OBJECT_ID('dbo.sp_Branch_GetForUser') IS NOT NULL
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
            var sql = DropDatabaseSql(databaseName);
            var connectionString = Master(job);
            try
            {
                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 120 };
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw Safe(ex, connectionString, job);
            }
        }

        /// <summary>Not pooled: no idle connection keeps a database open when it has to be dropped.</summary>
        internal static string Master(ProvisionJob job) => ConnectionString(job, "master");

        /// <summary>Not pooled, for the same reason.</summary>
        internal static string Tenant(ProvisionJob job, string databaseName) => ConnectionString(job, databaseName);

        private static string ConnectionString(ProvisionJob job, string databaseName)
        {
            try
            {
                // set after the typed options are read: they cannot switch pooling on, and
                // they cannot choose another database (Database=X) for the create, the
                // drop or the tenant script
                return new SqlConnectionStringBuilder(
                           TenantConnectionString.Build(job.ServerName, databaseName, job.AdminUser, job.AdminPassword, job.ExtraOptions))
                       { InitialCatalog = databaseName, Pooling = false, ConnectTimeout = 15 }.ConnectionString;
            }
            catch (Exception)
            {
                // the text of this error can quote parts of the connection string: never pass it on
                throw new InvalidOperationException("The connection settings of the database server are not valid.");
            }
        }

        /// <summary>
        /// What leaves this class as an error: the text only, with the connection string and
        /// the password taken out, and without the original exception (its details can carry both).
        /// </summary>
        private static InvalidOperationException Safe(Exception ex, string connectionString, ProvisionJob job)
            => new(WithoutSecrets(ex.Message, connectionString, job));

        /// <summary>
        /// What a cancellable step throws instead of the error it caught. When the token was
        /// cancelled the error IS the cancellation (the driver reports a cancelled command as an
        /// ordinary error), so it is recorded as "cancelled or timed out" and not as server text.
        /// </summary>
        internal static Exception Wrapped(Exception ex, string connectionString, ProvisionJob job, CancellationToken ct)
            => ct.IsCancellationRequested
                ? new OperationCanceledException(ct)
                : Safe(ex, connectionString, job);

        internal static string WithoutSecrets(string? message, string connectionString, ProvisionJob job)
        {
            var text = message ?? "";

            if (!string.IsNullOrEmpty(connectionString))
                text = text.Replace(connectionString, "***", StringComparison.OrdinalIgnoreCase);
            if (!string.IsNullOrEmpty(job.AdminPassword))
                text = text.Replace(job.AdminPassword, "***", StringComparison.OrdinalIgnoreCase);

            return text;
        }
    }
}
