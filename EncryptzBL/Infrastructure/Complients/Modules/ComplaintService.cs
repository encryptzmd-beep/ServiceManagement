using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System.Data;

namespace EncryptzBL.Infrastructure.Complients.Modules
{
    public class ComplaintService : BaseRepository, IComplaintService
    {
        public ComplaintService(DbHelper db) : base(db) { }

        // 🔥 CREATE
        public async Task<ApiResponse<ComplaintDto>> Create(int customerId, ComplaintCreateDto dto)
        {
            var now = TimeHelper.IndianNow;
            var complaintNumber = $"CMP-{now:yyyyMMdd}-{Guid.NewGuid().ToString()[..4]}";

            var slaDeadline = dto.Priority switch
            {
                "Critical" => now.AddHours(4),
                "High" => now.AddHours(12),
                "Medium" => now.AddHours(24),
                _ => now.AddHours(48)
            };

            var outputId = SqlParameterHelper.Output("@NewId", SqlDbType.Int);

            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId),
                SqlParameterHelper.Input("@ProductId", dto.ProductId),
                SqlParameterHelper.Input("@Subject", dto.Subject),
                SqlParameterHelper.Input("@Description", dto.Description),
                SqlParameterHelper.Input("@Priority", dto.Priority),
                SqlParameterHelper.Input("@ComplaintNumber", complaintNumber),
                SqlParameterHelper.Input("@SLADeadline", slaDeadline),
                outputId
            };

            var rows = await ExecuteAsync("sp_Complaint_Create", parameters);

            if (rows <= 0)
                return ApiResponse<ComplaintDto>.Fail("Failed to create complaint");

            var newId = SqlParameterHelper.GetOutputValue<int>(outputId);

            if (newId <= 0)
                return ApiResponse<ComplaintDto>.Fail("Invalid complaint ID returned");

            var data = await GetByIdInternal(newId);

            return ApiResponse<ComplaintDto>.Ok(data, "Complaint created");
        }

        // 🔥 GET ALL (PAGINATION)
        public async Task<PagedResult<ComplaintListDto>> GetAll(ComplaintFilterDto filter)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@StatusId", filter.StatusId),
                SqlParameterHelper.Input("@Priority", filter.Priority),
                SqlParameterHelper.Input("@FromDate", filter.FromDate),
                SqlParameterHelper.Input("@ToDate", filter.ToDate),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };

            var ds = await GetDataSetAsync("sp_Complaint_GetAll", parameters);

            if (ds == null || ds.Tables.Count == 0)
            {
                return new PagedResult<ComplaintListDto>(
                    new List<ComplaintListDto>(),
                    0,
                    filter.PageNumber,
                    filter.PageSize,
                    0
                );
            }

            var items = ds.Tables[0].ToList<ComplaintListDto>();

            // SP embeds TotalCount via COUNT(*) OVER() on each row (single result set).
            // Fall back to items[0].TotalCount when a second table is not present.
            var totalCount = ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0
                ? Convert.ToInt32(ds.Tables[1].Rows[0]["TotalCount"])
                : (items.Count > 0 ? items[0].TotalCount : 0);

            var totalPages = totalCount > 0
                ? (int)Math.Ceiling(totalCount / (double)filter.PageSize)
                : (items.Count > 0 ? 1 : 0);

            return new PagedResult<ComplaintListDto>(
                items,
                totalCount,
                filter.PageNumber,
                filter.PageSize,
                totalPages
            );
        }

        // 🔥 GET BY ID
        public async Task<ApiResponse<ComplaintDto>> GetById(int id)
        {
            if (id <= 0)
                return ApiResponse<ComplaintDto>.Fail("Invalid complaint id");

            var data = await GetByIdInternal(id);

            return data == null
                ? ApiResponse<ComplaintDto>.Fail("Complaint not found")
                : ApiResponse<ComplaintDto>.Ok(data);
        }

        // 🔒 INTERNAL METHOD
        private async Task<ComplaintDto?> GetByIdInternal(int id)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", id)
            };

            var dt = await GetDataTableAsync("sp_Complaint_GetById", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return null;

            return dt.ToList<ComplaintDto>().FirstOrDefault();
        }

        // 🔥 STATUS LOOKUP
        public async Task<List<ComplaintStatusDto>> GetStatuses()
        {
            var dt = await GetDataTableByQueryAsync(
                "SELECT StatusId, StatusName, StatusColor, ISNULL(SortOrder, 0) AS SortOrder FROM dbo.ComplaintStatuses ORDER BY SortOrder, StatusId");
            return dt.ToList<ComplaintStatusDto>();
        }

        public async Task<ApiResponse> UpdateStatusByName(int id, int userId, string statusName, string? remarks)
        {
            var status = (await GetStatuses())
                .FirstOrDefault(s => string.Equals(s.StatusName, statusName, StringComparison.OrdinalIgnoreCase));
            if (status == null)
                return new ApiResponse(false, $"Status '{statusName}' is not configured");

            return await UpdateStatus(id, userId, new ComplaintUpdateStatusDto { StatusId = status.StatusId, Remarks = remarks });
        }

        // 🔥 UPDATE STATUS
        public async Task<ApiResponse> UpdateStatus(int id, int userId, ComplaintUpdateStatusDto dto)
        {
            // an id that is not a status of this database would only fail on the foreign key
            if (!(await GetStatuses()).Any(s => s.StatusId == dto.StatusId))
                return new ApiResponse(false, "Unknown complaint status");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", id),
                SqlParameterHelper.Input("@ActionBy", userId),
                SqlParameterHelper.Input("@StatusId", dto.StatusId),
                SqlParameterHelper.Input("@Remarks", dto.Remarks)
            };

            // The proc runs with NOCOUNT ON, so "rows affected" is always -1 and a status
            // change that worked was reported as failed. Existence is checked instead.
            var found = await GetDataTableByQueryAsync(
                "SELECT TOP 1 1 AS Found FROM dbo.Complaints WHERE ComplaintId = @ComplaintId",
                new[] { SqlParameterHelper.Input("@ComplaintId", id) });
            if (found.Rows.Count == 0)
                return new ApiResponse(false, "Complaint not found");

            await ExecuteAsync("sp_Complaint_UpdateStatus", parameters);

            return new ApiResponse(true, "Status updated");
        }

        // 🔥 CONFIRM CLOSURE
        public async Task<ApiResponse> ConfirmClosure(int complaintId, int customerId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", complaintId),
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var rows = await ExecuteAsync("sp_Complaint_ConfirmClosure", parameters);

            return rows > 0
                ? new ApiResponse(true, "Complaint closed with customer confirmation")
                : new ApiResponse(false, "Complaint not found");
        }

        // 🔥 GET BY CUSTOMER
        public async Task<List<ComplaintDto>> GetByCustomer(int customerId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var dt = await GetDataTableAsync("sp_Complaint_GetByCustomer", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<ComplaintDto>()
                : new List<ComplaintDto>();
        }
    }
}