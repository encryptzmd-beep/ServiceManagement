using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.CustomerPortal.Modules
{
    public class CustomerPortalService : BaseRepository, ICustomerPortalService
    {
        public CustomerPortalService(DbHelper db) : base(db) { }

        // 🔥 GET MY COMPLAINTS (PAGINATION + FILTER)
        public async Task<PagedResponse<CustomerComplaint>> GetMyComplaints(
            int UserID, int? statusFilter, int page, int size)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserID", UserID),
                SqlParameterHelper.Input("@StatusFilter", statusFilter),
                SqlParameterHelper.Input("@PageNumber", page),
                SqlParameterHelper.Input("@PageSize", size)
            };

            var dt = await GetDataTableAsync("sp_CustomerPortal_GetMyComplaints", parameters);

            var items = dt.Rows.Count > 0
                ? dt.ToList<CustomerComplaint>()
                : new List<CustomerComplaint>();

            return new PagedResponse<CustomerComplaint>
            {
                Items = items,
                TotalCount = items.FirstOrDefault()?.TotalCount ?? 0,
                PageNumber = page,
                PageSize = size
            };
        }

        // 🔹 Reusable: Get CustomerId from UserId
        private async Task<int?> GetCustomerId(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_GetCustomerIdByUserId", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return null;

            return Convert.ToInt32(dt.Rows[0]["CustomerId"]);
        }
        // 🔥 TRACK COMPLAINT (MULTIPLE RESULT SET: DETAILS + HISTORY)
        public async Task<ComplaintTrackingDetail> TrackComplaint(string complaintNo, int UserID)
        {
            var customerId = await GetCustomerId(UserID);
          
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintNo", complaintNo),
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var ds = await GetDataSetAsync("sp_CustomerPortal_TrackComplaint", parameters);

            if (ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return null;

            // Table 0 → Complaint Detail
            var detail = ds.Tables[0].ToList<ComplaintTrackingDetail>().FirstOrDefault();

            if (detail != null && ds.Tables.Count > 1)
            {
                // Table 1 → Status History
                detail.StatusHistory = ds.Tables[1].Rows.Count > 0
                    ? ds.Tables[1].ToList<StatusHistoryItem>()
                    : new List<StatusHistoryItem>();
            }

            return detail;
        }

        // 🔥 CREATE SERVICE REQUEST
        public async Task<ApiResponse<object>> CreateRequest(ServiceRequestCreateDto dto, int customerId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId),
                SqlParameterHelper.Input("@ProductId", dto.ProductId),
                SqlParameterHelper.Input("@RequestType", dto.RequestType),
                SqlParameterHelper.Input("@Subject", dto.Subject),
                SqlParameterHelper.Input("@Description", dto.Description),
                SqlParameterHelper.Input("@PreferredDate", dto.PreferredDate),
                SqlParameterHelper.Input("@PreferredTimeSlot", dto.PreferredTimeSlot)
            };

            var dt = await GetDataTableAsync("sp_CustomerPortal_CreateRequest", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<object>.Fail("Request creation failed");

            var requestId = Convert.ToInt32(dt.Rows[0]["RequestId"]);
            var requestNo = dt.Rows[0]["RequestNo"]?.ToString();
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Service request submitted";

            return ApiResponse<object>.Ok(new
            {
                RequestId = requestId,
                RequestNo = requestNo
            }, message);
        }
    }
}
