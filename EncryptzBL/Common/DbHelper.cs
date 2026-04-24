using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;

namespace EncryptzBL.Common
{
    public class DbHelper
    {
        private readonly string _connectionString;

        public DbHelper(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }
        private SqlCommand CreateCommand(
    SqlConnection conn,
    string commandText,
    SqlParameter[] parameters,
    CommandType commandType,
    SqlTransaction transaction = null)
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
        private SqlCommand CreateCommand(SqlConnection conn, string spName, SqlParameter[] parameters, SqlTransaction transaction = null)
        {
            var cmd = new SqlCommand(spName, conn)
            {
                CommandType = CommandType.StoredProcedure
            };

            if (transaction != null)
                cmd.Transaction = transaction;

            if (parameters != null && parameters.Length > 0)
                cmd.Parameters.AddRange(parameters);

            return cmd;
        }

        // 🔹 DataTable
        public async Task<DataTable> ExecuteDataTableAsync(string spName, SqlParameter[] parameters = null, SqlTransaction transaction = null)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = CreateCommand(conn, spName, parameters, transaction);
            using var reader = await cmd.ExecuteReaderAsync();

            var dt = new DataTable();
            dt.Load(reader);
            return dt;
        }

        // 🔹 DataSet (Multiple Result Sets)
        public async Task<DataSet> ExecuteDataSetAsync(string spName, SqlParameter[] parameters = null)
        {
            using var conn = new SqlConnection(_connectionString);
            using var cmd = new SqlCommand(spName, conn)
            {
                CommandType = CommandType.StoredProcedure
            };

            if (parameters != null)
                cmd.Parameters.AddRange(parameters);

            using var da = new SqlDataAdapter(cmd);
            var ds = new DataSet();

            await conn.OpenAsync();
            da.Fill(ds);

            return ds;
        }

        // 🔹 Scalar (Return single value)
        public async Task<object> ExecuteScalarAsync(string spName, SqlParameter[] parameters = null)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = CreateCommand(conn, spName, parameters);
            return await cmd.ExecuteScalarAsync();
        }

        // 🔹 NonQuery (Insert/Update/Delete + Output Params)
        public async Task<int> ExecuteNonQueryAsync(string spName, SqlParameter[] parameters = null)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = CreateCommand(conn, spName, parameters);
            return await cmd.ExecuteNonQueryAsync();
        }
        public async Task<int> ExecuteQueryAsync(string query, SqlParameter[] parameters = null)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = CreateCommand(conn, query, parameters, CommandType.Text);
            return await cmd.ExecuteNonQueryAsync();
        }
        public async Task<DataTable> ExecuteQueryDataTableAsync(string query, SqlParameter[] parameters = null)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

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
