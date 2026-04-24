using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.CustomerPortal.Modules
{
    public interface ICustomerPortalService
    {
        Task<PagedResponse<CustomerComplaint>> GetMyComplaints(int customerId, int? statusFilter, int page, int size);
        Task<ComplaintTrackingDetail> TrackComplaint(string complaintNo, int customerId);
        Task<ApiResponse<object>> CreateRequest(ServiceRequestCreateDto dto, int customerId);
    }
}
