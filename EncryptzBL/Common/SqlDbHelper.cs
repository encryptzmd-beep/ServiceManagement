using Microsoft.Data.SqlClient;
using System.Data;

namespace EncryptzBL.Common
{
    /// <summary>
    /// Shared ADO.NET stored-procedure executor. The connection string is supplied
    /// by subclasses at call time via <see cref="ConnectionString"/>:
    ///   - <see cref="DbHelper"/> resolves it per-request from the tenant's ServiceDB.
    ///   - <see cref="MainDbHelper"/> uses the fixed MainDB connection.
    /// </summary>
    public abstract class SqlDbHelper
    {
        /// <summary>The connection string to use for the current operation.</summary>
        protected abstract string ConnectionString { get; }

        /// <summary>Runs right after a connection is opened, before the command executes.</summary>
        protected virtual Task OnConnectionOpenedAsync(SqlConnection conn) => Task.CompletedTask;

        private SqlCommand CreateCommand(
            SqlConnection conn,
            string commandText,
            SqlParameter[]? parameters,
            CommandType commandType,
            SqlTransaction? transaction = null)
        {
            var cmd = new SqlCommand(commandText, conn)
            {
                CommandType = commandType
            };

            if (transaction != null)
                cmd.Transaction = transaction;

            if (parameters != null && parameters.Length > 0)
                cmd.Parameters.AddRange(parameters);

            return cmd;
        }

        private SqlCommand CreateCommand(SqlConnection conn, string spName, SqlParameter[]? parameters, SqlTransaction? transaction = null)
            => CreateCommand(conn, spName, parameters, CommandType.StoredProcedure, transaction);

        // 🔹 DataTable
        public async Task<DataTable> ExecuteDataTableAsync(string spName, SqlParameter[]? parameters = null, SqlTransaction? transaction = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);

            using var cmd = CreateCommand(conn, spName, parameters, transaction);
            using var reader = await cmd.ExecuteReaderAsync();

            var dt = new DataTable();
            dt.Load(reader);
            return dt;
        }

        // 🔹 DataSet (Multiple Result Sets)
        public async Task<DataSet> ExecuteDataSetAsync(string spName, SqlParameter[]? parameters = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            using var cmd = new SqlCommand(spName, conn)
            {
                CommandType = CommandType.StoredProcedure
            };

            if (parameters != null)
                cmd.Parameters.AddRange(parameters);

            using var da = new SqlDataAdapter(cmd);
            var ds = new DataSet();

            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);
            da.Fill(ds);

            return ds;
        }

        // 🔹 Scalar (Return single value)
        public async Task<object?> ExecuteScalarAsync(string spName, SqlParameter[]? parameters = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);

            using var cmd = CreateCommand(conn, spName, parameters);
            return await cmd.ExecuteScalarAsync();
        }

        // 🔹 NonQuery (Insert/Update/Delete + Output Params)
        public async Task<int> ExecuteNonQueryAsync(string spName, SqlParameter[]? parameters = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);

            using var cmd = CreateCommand(conn, spName, parameters);
            return await cmd.ExecuteNonQueryAsync();
        }

        public async Task<int> ExecuteQueryAsync(string query, SqlParameter[]? parameters = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);

            using var cmd = CreateCommand(conn, query, parameters, CommandType.Text);
            return await cmd.ExecuteNonQueryAsync();
        }

        public async Task<DataTable> ExecuteQueryDataTableAsync(string query, SqlParameter[]? parameters = null)
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            await OnConnectionOpenedAsync(conn);

            using var cmd = new SqlCommand(query, conn)
            {
                CommandType = CommandType.Text
            };

            if (parameters != null)
                cmd.Parameters.AddRange(parameters);

            using var reader = await cmd.ExecuteReaderAsync();

            var dt = new DataTable();
            dt.Load(reader);
            return dt;
        }
    }
}
