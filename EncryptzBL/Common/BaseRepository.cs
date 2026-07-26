using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;

namespace EncryptzBL.Common
{
    public abstract class BaseRepository
    {
        protected readonly SqlDbHelper _db;

        protected BaseRepository(SqlDbHelper db)
        {
            _db = db;
        }

        // ── Tenant scope (business/service-DB repositories only) ──────────────
        // Available when _db is the tenant DbHelper. Control-plane repos (AuthService
        // on MainDbHelper) don't use these.

        private TenantContext Tenant =>
            (_db as DbHelper)?.Tenant
            ?? throw new InvalidOperationException(
                "Tenant scope is only available on business (tenant-DB) repositories.");

        /// <summary>Current company id (from the resolved token scope).</summary>
        protected int CompanyId => Tenant.CompanyId;
        /// <summary>Current project id.</summary>
        protected int ProjectId => Tenant.ProjectId;
        /// <summary>Current location id.</summary>
        protected int LocationId => Tenant.LocationId;

        /// <summary>
        /// Prepends @CompanyId, @ProjectId, @LocationId (from TenantContext) to a proc's
        /// parameters. Use for every business SP call:
        ///   await GetListAsync&lt;X&gt;("sp_X_GetList", Scoped());
        ///   await ExecuteAsync("sp_X_Save", Scoped(SqlParameterHelper.Input("@Name", name)));
        /// </summary>
        protected SqlParameter[] Scoped(params SqlParameter[] extra)
        {
            var t = Tenant;
            var head = new[]
            {
                SqlParameterHelper.Input("@CompanyId", t.CompanyId),
                SqlParameterHelper.Input("@ProjectId", t.ProjectId),
                SqlParameterHelper.Input("@LocationId", t.LocationId)
            };
            return (extra != null && extra.Length > 0) ? head.Concat(extra).ToArray() : head;
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
