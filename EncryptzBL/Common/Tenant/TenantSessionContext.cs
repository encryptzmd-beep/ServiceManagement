using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Publishes the request's scope to SQL Server SESSION_CONTEXT on a project-DB
    /// connection. The project DB's CompanyId/ProjectId/LocationId column defaults
    /// read it, so every insert is stamped with the caller's scope even when the
    /// proc itself does not take the scope parameters.
    /// (Pooled connections are reset between uses, so this runs on every open.)
    /// </summary>
    public static class TenantSessionContext
    {
        private const string Sql =
            "EXEC sys.sp_set_session_context @key = N'CompanyId',    @value = @CompanyId; " +
            "EXEC sys.sp_set_session_context @key = N'ProjectId',    @value = @ProjectId; " +
            "EXEC sys.sp_set_session_context @key = N'LocationId',   @value = @LocationId; " +
            "EXEC sys.sp_set_session_context @key = N'MainUserId',   @value = @MainUserId; " +
            "EXEC sys.sp_set_session_context @key = N'TenantUserId', @value = @TenantUserId;";

        public static async Task ApplyAsync(SqlConnection conn, TenantContext tenant)
        {
            using var cmd = new SqlCommand(Sql, conn);
            cmd.Parameters.AddWithValue("@CompanyId", tenant.CompanyId);
            cmd.Parameters.AddWithValue("@ProjectId", tenant.ProjectId);
            cmd.Parameters.AddWithValue("@LocationId", tenant.LocationId);
            cmd.Parameters.AddWithValue("@MainUserId", tenant.MainUserId);
            cmd.Parameters.AddWithValue("@TenantUserId", tenant.TenantUserId);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}
