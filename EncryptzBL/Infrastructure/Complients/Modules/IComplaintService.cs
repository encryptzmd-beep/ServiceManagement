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
        Task<ApiResponse> ConfirmClosure(int complaintId, int customerId);
        Task<List<ComplaintDto>> GetByCustomer(int customerId);
    }
}
