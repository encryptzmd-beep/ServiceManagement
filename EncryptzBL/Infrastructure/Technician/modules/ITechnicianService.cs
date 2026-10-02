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
        Task<List<ComplaintAutoCompleteDto>> GetComplaintsForAssignment(string searchTerm, bool includeClosed = false);
        Task<List<WorkOrderDto>> GetWorkOrders(int technicianId);
        Task<ApiResponse> UpdateAssignmentStatus(ServiceUpdateDto dto, int userId);
        Task<UnAssignTechnicianResponse> UnAssignTechnicianAsync(int assignmentId, int unAssignedBy, string? reason);

        // ── ownership / attendance checks for the technician-scoped endpoints ──
        /// <summary>Technician the assignment belongs to; null when it does not exist.</summary>
        Task<int?> GetAssignmentTechnicianId(int assignmentId);
        /// <summary>Has the technician a (not removed) assignment on this complaint?</summary>
        Task<bool> IsComplaintAssignedTo(int complaintId, int technicianId);
        /// <summary>Is the technician checked in today (attendance open, not checked out)?</summary>
        Task<bool> IsCheckedIn(int technicianId);
        /// <summary>Has the complaint of this assignment at least one service image?</summary>
        Task<bool> HasServiceImage(int assignmentId);
    }
}
