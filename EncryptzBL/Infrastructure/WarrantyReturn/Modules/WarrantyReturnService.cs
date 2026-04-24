using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.WarrantyReturn.Modules
{
    public class WarrantyReturnService : BaseRepository, IWarrantyReturnService
    {
        public WarrantyReturnService(DbHelper db) : base(db) { }

        // 🔥 GET ALL (Pagination + Filter)
        public async Task<PagedResponse<WarrantyReturnListItem>> GetAll(WarrantyReturnFilterDto filter)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", filter.SearchTerm),
                SqlParameterHelper.Input("@StatusFilter", filter.StatusFilter),
                SqlParameterHelper.Input("@ReturnTypeFilter", filter.ReturnTypeFilter),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };

            var dt = await GetDataTableAsync("sp_WarrantyReturn_GetAll", parameters);
            var items = dt.ToList<WarrantyReturnListItem>();

            var totalCount = items.FirstOrDefault()?.TotalCount ?? 0;

            return new PagedResponse<WarrantyReturnListItem>
            {
                Items = items ?? new List<WarrantyReturnListItem>(),
                TotalCount = totalCount,
                PageNumber = filter.PageNumber,
                PageSize = filter.PageSize
            };
        }

        // 🔥 GET BY ID
        public async Task<WarrantyReturnListItem> GetById(int returnId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ReturnId", returnId)
            };

            var dt = await GetDataTableAsync("sp_WarrantyReturn_GetById", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<WarrantyReturnListItem>().FirstOrDefault()
                : null;
        }

        // 🔥 CREATE WARRANTY RETURN
        public async Task<ApiResponse<object>> Create(WarrantyReturnCreateDto dto, int createdBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", dto.ComplaintId),
                SqlParameterHelper.Input("@CustomerId", dto.CustomerId),
                SqlParameterHelper.Input("@ProductId", dto.ProductId),
                SqlParameterHelper.Input("@ProductSerialNo", dto.ProductSerialNo),
                SqlParameterHelper.Input("@WarrantyStartDate", dto.WarrantyStartDate),
                SqlParameterHelper.Input("@WarrantyEndDate", dto.WarrantyEndDate),
                SqlParameterHelper.Input("@ReturnReason", dto.ReturnReason),
                SqlParameterHelper.Input("@ReturnType", dto.ReturnType),
                SqlParameterHelper.Input("@PickupAddress", dto.PickupAddress),
                SqlParameterHelper.Input("@CreatedBy", createdBy)
            };

            var dt = await GetDataTableAsync("sp_WarrantyReturn_Create", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<object>.Fail("Warranty return creation failed");

            var returnId = Convert.ToInt32(dt.Rows[0]["ReturnId"]);
            var returnNo = dt.Rows[0]["ReturnNo"]?.ToString();
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Created";

            var data = new
            {
                ReturnId = returnId,
                ReturnNo = returnNo
            };

            return ApiResponse<object>.Ok(data, message);
        }

        // 🔥 UPDATE STATUS (Enterprise Workflow)
        public async Task<ApiResponse<int>> UpdateStatus(WarrantyReturnStatusDto dto, int modifiedBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ReturnId", dto.ReturnId),
                SqlParameterHelper.Input("@StatusId", dto.StatusId),
                SqlParameterHelper.Input("@ApprovedBy", modifiedBy), // matches your SP logic
                SqlParameterHelper.Input("@ResolutionNotes", dto.ResolutionNotes),
                SqlParameterHelper.Input("@TrackingNumber", dto.TrackingNumber),
                SqlParameterHelper.Input("@RefundAmount", dto.RefundAmount),
                SqlParameterHelper.Input("@ModifiedBy", modifiedBy)
            };

            var dt = await GetDataTableAsync("sp_WarrantyReturn_UpdateStatus", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Status update failed");

            var id = Convert.ToInt32(dt.Rows[0]["ReturnId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Status updated";

            return ApiResponse<int>.Ok(id, message);
        }
    }
}
