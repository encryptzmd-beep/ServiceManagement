using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Common
{
    public class DbTransactionHelper : IDisposable
    {
        public SqlConnection Connection { get; private set; }
        public SqlTransaction Transaction { get; private set; }

        private readonly string _connectionString;

        public DbTransactionHelper(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task BeginAsync()
        {
            Connection = new SqlConnection(_connectionString);
            await Connection.OpenAsync();
            Transaction = Connection.BeginTransaction();
        }

        public async Task CommitAsync()
        {
            await Transaction.CommitAsync();
            await Connection.CloseAsync();
        }

        public async Task RollbackAsync()
        {
            await Transaction.RollbackAsync();
            await Connection.CloseAsync();
        }

        public void Dispose()
        {
            Transaction?.Dispose();
            Connection?.Dispose();
        }
    }
}
