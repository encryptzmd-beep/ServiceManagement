using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Complients.Modules
{
    public interface IComplaintService
    {
        Task<ApiResponse<ComplaintDto>> Create(int customerId, ComplaintCreateDto dto);
        Task<PagedResult<ComplaintListDto>> GetAll(ComplaintFilterDto filter);
        Task<ApiResponse<ComplaintDto>> GetById(int id);
        Task<ApiResponse> UpdateStatus(int id, int userId, ComplaintUpdateStatusDto dto);
        /// <summary>Complaint statuses of the current tenant database (id, name, colour).</summary>
        Task<List<ComplaintStatusDto>> GetStatuses();
        /// <summary>Sets the status by its NAME (e.g. "OnHold"): the id is looked up in the tenant database.</summary>
        Task<ApiResponse> UpdateStatusByName(int id, int userId, string statusName, string? remarks);
        Task<ApiResponse> ConfirmClosure(int complaintId, int customerId);
        Task<List<ComplaintDto>> GetByCustomer(int customerId);
    }
}
