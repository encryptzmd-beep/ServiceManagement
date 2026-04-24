using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;

namespace EncryptzBL.Common
{
    public abstract class BaseRepository
    {
        protected readonly DbHelper _db;

        protected BaseRepository(DbHelper db)
        {
            _db = db;
        }

        protected async Task<List<T>> GetListAsync<T>(string sp, SqlParameter[] parameters = null) where T : new()
        {
            var dt = await _db.ExecuteDataTableAsync(sp, parameters);
            return dt.ToList<T>();
        }

        protected async Task<T> GetSingleAsync<T>(string sp, SqlParameter[] parameters = null) where T : new()
        {
            var dt = await _db.ExecuteDataTableAsync(sp, parameters);
            return dt.ToList<T>().FirstOrDefault();
        }

        protected async Task<int> ExecuteAsync(string sp, SqlParameter[] parameters = null)
        {
            return await _db.ExecuteNonQueryAsync(sp, parameters);
        }

        protected async Task<DataSet> GetDataSetAsync(string sp, SqlParameter[] parameters = null)
        {
            return await _db.ExecuteDataSetAsync(sp, parameters);
        }

        protected async Task<object> ExecuteScalarAsync(string sp, SqlParameter[] parameters = null)
        {
            return await _db.ExecuteScalarAsync(sp, parameters);
        }
        protected async Task<DataTable> GetDataTableAsync(string sp, SqlParameter[] parameters = null)
        {
            return await _db.ExecuteDataTableAsync(sp, parameters);
        }
        protected async Task<DataTable> GetDataTableByQueryAsync(string query, SqlParameter[] parameters = null)
        {
            return await _db.ExecuteQueryDataTableAsync(query, parameters);
        }

    }


}
