using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Technician.modules
{
    public interface ITechnicianService
    {
        Task<ApiResponse<int>> SaveServiceImage(ServiceImageSaveDto dto);
        Task<WorkOrderDetailDto?> GetWorkOrderDetails(int assignmentId);
        Task<object> GetAll(TechnicianFilterDto filter);
        Task<TechnicianDetail> GetById(int technicianId);
        Task<ApiResponse<int>> Create(TechnicianCreateDto dto);
        Task<ApiResponse<int>> Update(TechnicianUpdateDto dto);
        Task<ApiResponse<int>> Delete(int profileId);
        Task<ApiResponse<int>> AssignTechnician(AssignTechnicianDto dto, int userId);
        Task<List<AuditLogDto>> GetAuditLog(int complaintId);
        Task<ApiResponse<int>> CompleteAssignment(CompleteAssignmentDto dto, int userId);
        Task<List<ActiveAssignmentDto>> GetActiveAssignments();
        Task<List<ComplaintAutoCompleteDto>> GetComplaintsForAssignment(string searchTerm);
        Task<List<WorkOrderDto>> GetWorkOrders(int technicianId);
        Task<ApiResponse> UpdateAssignmentStatus(ServiceUpdateDto dto, int userId);
        Task<UnAssignTechnicianResponse> UnAssignTechnicianAsync(int assignmentId, int unAssignedBy, string? reason);
    }
}
