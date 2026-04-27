using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Technician.modules;
using System.Data;
using static System.Net.WebRequestMethods;

namespace EncryptzBL.Infrastructure.Technician.Modules
{
    public class TechnicianService : BaseRepository, ITechnicianService
    {
        public TechnicianService(DbHelper db) : base(db) { }


        public async Task<object> GetAll(TechnicianFilterDto filter)
        {
            var p = new[] {
        SqlParameterHelper.Input("@SearchTerm", string.IsNullOrEmpty(filter.SearchTerm) ? (object)DBNull.Value : filter.SearchTerm),
        SqlParameterHelper.Input("@StatusFilter", filter.StatusFilter ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
        SqlParameterHelper.Input("@PageSize", filter.PageSize),
        SqlParameterHelper.Input("@SortBy", filter.SortBy ?? "FullName"),
        SqlParameterHelper.Input("@SortDir", filter.SortDir ?? "ASC")
    };
            var items = await GetListAsync<TechnicianListItem>("sp_Technician_GetAll", p);
            var totalCount = items.FirstOrDefault()?.TotalCount ?? 0;
            return new { items, totalCount };
        }
  
        public async Task<List<TravelReportDto>> GetTravelReport(DateOnly from, DateOnly to)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@FromDate", from.ToDateTime(TimeOnly.MinValue)),
        SqlParameterHelper.Input("@ToDate", to.ToDateTime(TimeOnly.MaxValue))
    };

            var dt = await GetDataTableAsync("sp_Technician_TravelReport", parameters);

            return dt != null ? dt.ToList<TravelReportDto>() : new List<TravelReportDto>();
        }
        public async Task<TechnicianDetail> GetById(int technicianId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", technicianId)
            };

            var ds = await GetDataSetAsync("sp_Technician_GetById", parameters);

            if (ds == null || ds.Tables.Count == 0)
                return null;

            var tech = ds.Tables[0].ToList<TechnicianDetail>().FirstOrDefault();

            //if (tech != null)
            //{
            //    Table[1] = Skills
            //    tech.Skills = (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
            //        ? ds.Tables[1].ToList<TechnicianSkill>()
            //        : new List<TechnicianSkill>();

            //    Table[2] = Recent Schedules
            //    tech.RecentSchedules = (ds.Tables.Count > 2 && ds.Tables[2].Rows.Count > 0)
            //        ? ds.Tables[2].ToList<ScheduleListItem>()
            //        : new List<ScheduleListItem>();
            //}

            return tech;
        }


        public async Task<ApiResponse<int>> Create(TechnicianCreateDto dto)
        {
            var p = new[] {
        SqlParameterHelper.Input("@FullName", dto.FullName),
        SqlParameterHelper.Input("@Email", dto.Email ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber),
        SqlParameterHelper.Input("@Specialization", dto.Specialization),
        SqlParameterHelper.Input("@ExperienceYears", dto.ExperienceYears),
        SqlParameterHelper.Input("@CertificationDetails", dto.CertificationDetails ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@MaxDailyAssignments", dto.MaxDailyAssignments),
        SqlParameterHelper.Input("@JoinDate", dto.JoinDate ?? (object)DBNull.Value)
    };
            var dt = await GetDataTableAsync("sp_Technician_Create", p);
            if (dt.Rows.Count == 0) return ApiResponse<int>.Fail("Creation failed");
            var profileId = Convert.ToInt32(dt.Rows[0]["ProfileId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Created";
            if (profileId == -1) return ApiResponse<int>.Fail(message);
            return ApiResponse<int>.Ok(profileId, message);
        }


        public async Task<ApiResponse<int>> Update(TechnicianUpdateDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ProfileId", dto.ProfileId),
                SqlParameterHelper.Input("@Specialization", dto.Specialization),
                SqlParameterHelper.Input("@ExperienceYears", dto.ExperienceYears),
                SqlParameterHelper.Input("@CertificationDetails", dto.CertificationDetails),
                SqlParameterHelper.Input("@MaxDailyAssignments", dto.MaxDailyAssignments),
                SqlParameterHelper.Input("@AvailabilityStatus", dto.AvailabilityStatus)
            };

            var dt = await GetDataTableAsync("sp_Technician_Update", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Update failed");

            var id = Convert.ToInt32(dt.Rows[0]["ProfileId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Updated";

            return ApiResponse<int>.Ok(id, message);
        }
        public async Task<ApiResponse<int>> CompleteAssignment(CompleteAssignmentDto dto, int userId)
        {
            var p = new[] {
        SqlParameterHelper.Input("@AssignmentId", dto.AssignmentId),
        SqlParameterHelper.Input("@CompletedBy", userId),
        SqlParameterHelper.Input("@Remarks", dto.Remarks ?? (object)DBNull.Value)
    };
            var dt = await GetDataTableAsync("sp_Complaint_CompleteAssignment", p);
            var row = dt.Rows.Count > 0 ? dt.Rows[0] : null;
            if (row == null) return ApiResponse<int>.Fail("Completion failed");
            var result = Convert.ToInt32(row["Result"]);
            if (result < 0) return ApiResponse<int>.Fail(row["Message"]?.ToString());
            return ApiResponse<int>.Ok(result, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<int>> Delete(int profileId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ProfileId", profileId)
            };

            var dt = await GetDataTableAsync("sp_Technician_Delete", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Delete failed");

            var id = Convert.ToInt32(dt.Rows[0]["ProfileId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Deleted";

            return ApiResponse<int>.Ok(id, message);
        }
        public async Task<ApiResponse<int>> AssignTechnician(AssignTechnicianDto dto, int userId)
        {
            var p = new[] {
        SqlParameterHelper.Input("@ComplaintId", dto.ComplaintId),
        SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
        SqlParameterHelper.Input("@AssignmentRole", dto.AssignmentRole),
        SqlParameterHelper.Input("@AssignedBy", userId),
        SqlParameterHelper.Input("@Priority", dto.Priority ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@Notes", dto.Notes ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@ScheduledDate", dto.ScheduledDate ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@StartTime", dto.StartTime ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@EndTime", dto.EndTime ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@EstimatedDuration", dto.EstimatedDuration ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@TimeSlot", dto.TimeSlot ?? (object)DBNull.Value)
    };
            var dt = await GetDataTableAsync("sp_Complaint_AssignTechnician", p);
            var row = dt.Rows.Count > 0 ? dt.Rows[0] : null;
            if (row == null) return ApiResponse<int>.Fail("Assignment failed");
            var id = Convert.ToInt32(row["AssignmentId"]);
            if (id < 0) return ApiResponse<int>.Fail(row["Message"]?.ToString());
            return ApiResponse<int>.Ok(id, row["Message"]?.ToString());
        }

        public async Task<List<AuditLogDto>> GetAuditLog(int complaintId)
        {
            var p = new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) };
            return await GetListAsync<AuditLogDto>("sp_Complaint_GetAuditLog", p);
        }

        // ============================================================
        // ADD these methods to TechnicianService.cs
        // ============================================================

        public async Task<List<ComplaintAutoCompleteDto>> GetComplaintsForAssignment(string searchTerm)
        {
            var p = new[] {
        SqlParameterHelper.Input("@SearchTerm", string.IsNullOrEmpty(searchTerm) ? (object)DBNull.Value : searchTerm)
    };
            return await GetListAsync<ComplaintAutoCompleteDto>("sp_Complaint_GetForAssignment", p);
        }

        public async Task<List<ActiveAssignmentDto>> GetActiveAssignments()
        {
            return await GetListAsync<ActiveAssignmentDto>("sp_Assignment_GetActive");
        }


        public async Task<UnAssignTechnicianResponse> UnAssignTechnicianAsync(
    int assignmentId,
    int unAssignedBy,
    string? reason)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@AssignmentId", assignmentId),
        SqlParameterHelper.Input("@UnAssignedBy", unAssignedBy),
        SqlParameterHelper.Input("@Reason", string.IsNullOrEmpty(reason) ? (object)DBNull.Value : reason)
    };

            var result = await GetSingleAsync<UnAssignTechnicianResponse>(
                "sp_Complaint_UnAssignTechnician",
                p
            );

            return result ?? new UnAssignTechnicianResponse
            {
                Result = -99,
                Message = "No response from database"
            };
        }

        public async Task<List<WorkOrderDto>> GetWorkOrders(int technicianId)
        {
            var p = new[] { SqlParameterHelper.Input("@TechnicianId", technicianId) };
            return await GetListAsync<WorkOrderDto>("sp_Technician_GetWorkOrders", p);
        }

        public async Task<ApiResponse> UpdateAssignmentStatus(ServiceUpdateDto dto, int userId)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@AssignmentId",      dto.AssignmentId),
        SqlParameterHelper.Input("@Status",            dto.Status),
        SqlParameterHelper.Input("@UpdatedBy",         userId),
        SqlParameterHelper.Input("@Remarks",           (object?)dto.Remarks ?? DBNull.Value),
        SqlParameterHelper.Input("@WorkDone",          (object?)dto.WorkDone ?? DBNull.Value),
        SqlParameterHelper.Input("@PartsUsed",         (object?)dto.PartsUsed ?? DBNull.Value),
        SqlParameterHelper.Input("@CustomerFeedback",  (object?)dto.CustomerFeedback ?? DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_Assignment_UpdateStatus", p);
            if (dt == null || dt.Rows.Count == 0)
                return new ApiResponse(false, "Update failed");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";
            return new ApiResponse(result == 1, message);
        }


        // ─── Tracking methods (add to TrackingService.cs) ────────────────────────────

        public async Task<ApiResponse<int>> CheckIn(CheckInDto dto, int userId)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@TechnicianId", userId),
        SqlParameterHelper.Input("@Latitude",     dto.Latitude),
        SqlParameterHelper.Input("@Longitude",    dto.Longitude),
        SqlParameterHelper.Input("@Address",      dto.Address ?? (object)DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_Technician_CheckIn", p);
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Check-in failed");

            var attendanceId = Convert.ToInt32(dt.Rows[0]["AttendanceId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Checked in";

            return attendanceId == 0
                ? ApiResponse<int>.Fail(message)
                : ApiResponse<int>.Ok(attendanceId, message);
        }

        public async Task<ApiResponse> CheckOut(CheckOutDto dto, int userId)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@TechnicianId", userId),
        SqlParameterHelper.Input("@Latitude",     dto.Latitude),
        SqlParameterHelper.Input("@Longitude",    dto.Longitude),
        SqlParameterHelper.Input("@Address",      dto.Address ?? (object)DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_Technician_CheckOut", p);
            if (dt == null || dt.Rows.Count == 0)
                return new ApiResponse(false, "Checkout failed");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Checked out";
            return new ApiResponse(result == 1, message);
        }

        public async Task<ApiResponse> RecordSiteArrival(SiteArrivalDto dto, int userId)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@TechnicianId", userId),
        SqlParameterHelper.Input("@ComplaintId",  dto.ComplaintId),
        SqlParameterHelper.Input("@Latitude",     dto.Latitude),
        SqlParameterHelper.Input("@Longitude",    dto.Longitude),
        SqlParameterHelper.Input("@Address",      dto.Address ?? (object)DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_Technician_RecordSiteArrival", p);
            if (dt == null || dt.Rows.Count == 0)
                return new ApiResponse(false, "Site arrival failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "Recorded";
            return new ApiResponse(true, message);
        }

        public async Task<ApiResponse<List<AttendanceDto>>> GetAttendance(
            DateTime? from, DateTime? to, int? techId)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@TechnicianId", techId   ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@FromDate",     from     ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@ToDate",       to       ?? (object)DBNull.Value)
    };

            var list = await GetListAsync<AttendanceDto>("sp_Technician_GetAttendance", p);
            return ApiResponse<List<AttendanceDto>>.Ok(list);
        }
        public async Task<WorkOrderDetailDto?> GetWorkOrderDetails(int assignmentId)
        {
            var p = new[] { SqlParameterHelper.Input("@AssignmentId", assignmentId) };
            var ds = await GetDataSetAsync("sp_WorkOrder_GetDetails", p);

            if (ds == null || ds.Tables.Count == 0) return null;

            var detail = ds.Tables[0].ToList<WorkOrderDetailDto>().FirstOrDefault();
            if (detail == null) return null;

            detail.Timeline = ds.Tables.Count > 1
                ? ds.Tables[1].ToList<WorkOrderTimelineDto>()
                : new List<WorkOrderTimelineDto>();

            detail.Images = ds.Tables.Count > 2
                ? ds.Tables[2].ToList<ServiceImageItemDto>()
                : new List<ServiceImageItemDto>();

            detail.RepairDetails = ds.Tables.Count > 3
                ? ds.Tables[3].ToList<WorkOrderRepairDetailDto>()
                : new List<WorkOrderRepairDetailDto>();

            return detail;
        }


        public async Task<ApiResponse<int>> SaveServiceImage(ServiceImageSaveDto dto)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@ComplaintId",  dto.ComplaintId),
        SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
        SqlParameterHelper.Input("@ImageType",    dto.ImageType),
        SqlParameterHelper.Input("@ImagePath",    (object?)dto.ImagePath ?? DBNull.Value),
        SqlParameterHelper.Input("@ImageData",    (object?)dto.ImageData ?? DBNull.Value),
        SqlParameterHelper.Input("@ImageName",    (object?)dto.ImageName ?? DBNull.Value),
        SqlParameterHelper.Input("@ContentType",  (object?)dto.ContentType ?? DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_ServiceImage_Save", p);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Save failed");

            var id = Convert.ToInt32(dt.Rows[0]["ImageId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Saved";

            return ApiResponse<int>.Ok(id, message);
        }
    }



}