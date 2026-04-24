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
            var complaintNumber = $"CMP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4]}";

            var slaDeadline = dto.Priority switch
            {
                "Critical" => DateTime.UtcNow.AddHours(4),
                "High" => DateTime.UtcNow.AddHours(12),
                "Medium" => DateTime.UtcNow.AddHours(24),
                _ => DateTime.UtcNow.AddHours(48)
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

            var totalCount = ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0
                ? Convert.ToInt32(ds.Tables[1].Rows[0]["TotalCount"])
                : 0;

            return new PagedResult<ComplaintListDto>(
                items,
                totalCount,
                filter.PageNumber,
                filter.PageSize,
                (int)Math.Ceiling(totalCount / (double)filter.PageSize)
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

        // 🔥 UPDATE STATUS
        public async Task<ApiResponse> UpdateStatus(int id, int userId, ComplaintUpdateStatusDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", id),
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@StatusId", dto.StatusId),
                SqlParameterHelper.Input("@Remarks", dto.Remarks)
            };

            var rows = await ExecuteAsync("sp_Complaint_UpdateStatus", parameters);

            return rows > 0
                ? new ApiResponse(true, "Status updated")
                : new ApiResponse(false, "Complaint not found or update failed");
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