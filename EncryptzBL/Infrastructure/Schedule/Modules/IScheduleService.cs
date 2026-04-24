using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Schedule.Modules
{
    public interface IScheduleService
    {
        Task<List<ScheduleListItem>> GetDaily(DateTime? date, int? technicianId);
        Task<ApiResponse<int>> Create(ScheduleCreateDto dto, int createdBy);
        Task<ApiResponse<int>> Update(ScheduleUpdateDto dto, int modifiedBy);
        Task<List<ScheduleConflictItem>> DetectConflicts(DateTime? date);
        Task<ApiResponse<int>> ResolveConflict(ConflictResolveDto dto, int resolvedBy);
        Task<ApiResponse<List<TechnicianScheduleBoardDto>>> GetScheduleBoardReport(DateTime scheduleDate);
    }
}
