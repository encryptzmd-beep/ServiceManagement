using System.Data;
using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Notifications;
using EncryptzBL.Infrastructure.Sales.Modules;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Crm
{
    /// <summary>CRM on the company (tenant) database: leads, follow-ups, masters and the sales team.</summary>
    public sealed partial class CrmService : BaseRepository, ICrmService
    {
        /// <summary>Said when the company database has no CRM tables yet (ProjectDB/14 was not run).</summary>
        public const string CrmNotSetUp = "CRM is not set up in your company's database yet. Ask Encryptz to finish it";

        private const string ManagerOnly = "Only a CRM manager can do this";

        private readonly ISalesService _sales;
        private readonly INotificationService _notifications;
        private readonly ILogger<CrmService> _logger;

        public CrmService(DbHelper db, ISalesService sales, INotificationService notifications, ILogger<CrmService> logger) : base(db)
        {
            _sales = sales;
            _notifications = notifications;
            _logger = logger;
        }

        private static SqlParameter In(string name, object? value) => SqlParameterHelper.Input(name, value!);

        private static string Text(DataRow r, string column)
            => r.Table.Columns.Contains(column) ? r[column]?.ToString() ?? "" : "";

        private static (bool Success, string Message, int Id) Answer(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return (false, "Could not save. Please try again", 0);

            var row = dt.Rows[0];
            var id = dt.Columns.Contains("Id") && row["Id"] != DBNull.Value ? Convert.ToInt32(row["Id"]) : 0;
            return (Convert.ToInt32(row["Success"]) == 1, row["Message"]?.ToString() ?? "", id);
        }

        private static ApiResponse<int> ToResponse((bool Success, string Message, int Id) a)
            => a.Success ? ApiResponse<int>.Ok(a.Id, a.Message) : ApiResponse<int>.Fail(a.Message);

        /// <summary>A company database from before ProjectDB/14 has no crm procedures: say so instead of failing.</summary>
        private static async Task<ApiResponse<T>> Guard<T>(Func<Task<ApiResponse<T>>> work)
        {
            try
            {
                return await work();
            }
            catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)
            {
                return ApiResponse<T>.Fail(CrmNotSetUp);
            }
        }

        /// <summary>A company admin is a manager; so is an active member marked manager.</summary>
        public async Task<bool> IsManager(int userId, string? role, int companyId)
        {
            if (ModuleAccess.IsCompanyAdminRole(role)) return true;
            if (userId <= 0 || companyId <= 0) return false;

            try
            {
                var dt = await GetDataTableAsync("crm.sp_IsManager", new[] { In("@CompanyId", companyId), In("@UserId", userId) });
                return dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["IsManager"]) == 1;
            }
            catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)
            {
                return false;
            }
        }

        // ── masters (lead sources, lost reasons) ──────────────────────────────

        private static (string List, string Save, string IdColumn, string IdParameter)? Master(string? kind) => kind?.Trim().ToLowerInvariant() switch
        {
            "sources" => ("crm.sp_Source_List", "crm.sp_Source_Save", "LeadSourceId", "@LeadSourceId"),
            "lost-reasons" => ("crm.sp_LostReason_List", "crm.sp_LostReason_Save", "LostReasonId", "@LostReasonId"),
            _ => null
        };

        public Task<ApiResponse<List<CrmMasterDto>>> GetMasters(int userId, bool isManager, int companyId, string kind)
            => Guard(async () =>
            {
                var m = Master(kind);
                if (m == null) return ApiResponse<List<CrmMasterDto>>.Fail("Unknown list");

                var dt = await GetDataTableAsync(m.Value.List, new[] { In("@CompanyId", companyId), In("@ActiveOnly", !isManager) });
                var items = dt.Rows.Cast<DataRow>().Select(r => new CrmMasterDto
                {
                    Id = Convert.ToInt32(r[m.Value.IdColumn]),
                    Name = Text(r, "Name"),
                    SortOrder = Convert.ToInt32(r["SortOrder"]),
                    IsActive = Convert.ToInt32(r["IsActive"]) == 1
                }).ToList();
                return ApiResponse<List<CrmMasterDto>>.Ok(items);
            });

        public Task<ApiResponse<int>> SaveMaster(int userId, bool isManager, int companyId, string kind, CrmMasterDto dto)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);
                var m = Master(kind);
                if (m == null) return ApiResponse<int>.Fail("Unknown list");
                if (dto == null || string.IsNullOrWhiteSpace(dto.Name)) return ApiResponse<int>.Fail("Enter the name");
                if (dto.Name.Trim().Length > 100) return ApiResponse<int>.Fail("The name is too long");

                var dt = await GetDataTableAsync(m.Value.Save, new[]
                {
                    In("@CompanyId", companyId), In(m.Value.IdParameter, dto.Id), In("@Name", dto.Name.Trim()), In("@SortOrder", dto.SortOrder), In("@IsActive", dto.IsActive)
                });
                return ToResponse(Answer(dt));
            });

        // ── the sales team ────────────────────────────────────────────────────

        public Task<ApiResponse<CrmMemberListDto>> GetMembers(int userId, bool isManager, int companyId)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<CrmMemberListDto>.Fail(ManagerOnly);

                var ds = await GetDataSetAsync("crm.sp_Member_List", new[] { In("@CompanyId", companyId) });
                var result = new CrmMemberListDto();
                if (ds.Tables.Count > 0)
                    result.Members = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new CrmMemberDto
                    {
                        UserId = Convert.ToInt32(r["UserId"]),
                        FullName = Text(r, "FullName"),
                        IsManager = Convert.ToInt32(r["IsManager"]) == 1,
                        IsActive = Convert.ToInt32(r["IsActive"]) == 1
                    }).ToList();
                if (ds.Tables.Count > 1)
                    result.Available = ds.Tables[1].Rows.Cast<DataRow>().Select(r => new CrmUserOptionDto
                    {
                        UserId = Convert.ToInt32(r["UserId"]),
                        FullName = Text(r, "FullName"),
                        Email = Text(r, "Email")
                    }).ToList();
                return ApiResponse<CrmMemberListDto>.Ok(result);
            });

        public Task<ApiResponse<int>> SaveMember(int userId, bool isManager, int companyId, CrmMemberDto dto)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);
                if (dto == null || dto.UserId <= 0) return ApiResponse<int>.Fail("Choose a user of the company");

                var dt = await GetDataTableAsync("crm.sp_Member_Save", new[]
                {
                    In("@CompanyId", companyId), In("@MemberUserId", dto.UserId),
                    In("@MemberIsManager", dto.IsManager), In("@IsActive", dto.IsActive)
                });
                return ToResponse(Answer(dt));
            });
    }
}
