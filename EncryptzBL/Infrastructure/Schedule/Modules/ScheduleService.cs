using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;

namespace EncryptzBL.Infrastructure.Schedule.Modules
{
    public class ScheduleService : BaseRepository, IScheduleService
    {
        public ScheduleService(DbHelper db) : base(db) { }

        // 🔥 GET DAILY SCHEDULE
        public async Task<List<ScheduleListItem>> GetDaily(DateTime? date, int? technicianId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ScheduleDate", date),
                SqlParameterHelper.Input("@TechnicianId", technicianId)
            };

            var dt = await GetDataTableAsync("sp_Schedule_GetDaily", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<ScheduleListItem>()
                : new List<ScheduleListItem>();
        }

        // 🔥 CREATE SCHEDULE (Handles Conflict & Max Assignment Logic from SP)
        public async Task<ApiResponse<int>> Create(ScheduleCreateDto dto, int createdBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
                SqlParameterHelper.Input("@ComplaintId", dto.ComplaintId),
                SqlParameterHelper.Input("@ScheduleDate", dto.ScheduleDate),
                SqlParameterHelper.Input("@StartTime", dto.StartTime),
                SqlParameterHelper.Input("@EndTime", dto.EndTime),
                SqlParameterHelper.Input("@TaskType", dto.TaskType),
                SqlParameterHelper.Input("@PriorityLevel", dto.PriorityLevel),
                SqlParameterHelper.Input("@CustomerAddress", dto.CustomerAddress),
                SqlParameterHelper.Input("@CustomerLatitude", dto.CustomerLatitude),
                SqlParameterHelper.Input("@CustomerLongitude", dto.CustomerLongitude),
                SqlParameterHelper.Input("@EstimatedDuration", dto.EstimatedDuration),
                SqlParameterHelper.Input("@Notes", dto.Notes),
                SqlParameterHelper.Input("@CreatedBy", createdBy)
            };

            var dt = await GetDataTableAsync("sp_Schedule_Create", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Schedule creation failed");

            var scheduleId = Convert.ToInt32(dt.Rows[0]["ScheduleId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Created";

            // SP returns -1 = Conflict, -2 = Max assignments reached
            if (scheduleId < 0)
                return ApiResponse<int>.Fail(message);

            return ApiResponse<int>.Ok(scheduleId, message);
        }

        // 🔥 UPDATE SCHEDULE
        public async Task<ApiResponse<int>> Update(ScheduleUpdateDto dto, int modifiedBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ScheduleId", dto.ScheduleId),
                SqlParameterHelper.Input("@ScheduleDate", dto.ScheduleDate),
                SqlParameterHelper.Input("@StartTime", dto.StartTime),
                SqlParameterHelper.Input("@EndTime", dto.EndTime),
                SqlParameterHelper.Input("@TaskType", dto.TaskType),
                SqlParameterHelper.Input("@PriorityLevel", dto.PriorityLevel),
                SqlParameterHelper.Input("@StatusId", dto.StatusId),
                SqlParameterHelper.Input("@Notes", dto.Notes),
                SqlParameterHelper.Input("@ModifiedBy", modifiedBy)
            };

            var dt = await GetDataTableAsync("sp_Schedule_Update", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Update failed");

            var id = Convert.ToInt32(dt.Rows[0]["ScheduleId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Updated";

            return ApiResponse<int>.Ok(id, message);
        }

        // 🔥 DETECT SCHEDULE CONFLICTS (Returns List Only)
        public async Task<List<ScheduleConflictItem>> DetectConflicts(DateTime? date)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ScheduleDate", date)
            };

            var dt = await GetDataTableAsync("sp_ScheduleConflict_Detect", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<ScheduleConflictItem>()
                : new List<ScheduleConflictItem>();
        }

        // 🔥 RESOLVE CONFLICT
        public async Task<ApiResponse<int>> ResolveConflict(ConflictResolveDto dto, int resolvedBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ConflictId", dto.ConflictId),
                SqlParameterHelper.Input("@Resolution", dto.Resolution),
                SqlParameterHelper.Input("@ResolvedBy", resolvedBy)
            };

            var dt = await GetDataTableAsync("sp_ScheduleConflict_Resolve", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Conflict resolution failed");

            var conflictId = Convert.ToInt32(dt.Rows[0]["ConflictId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Resolved";

            return ApiResponse<int>.Ok(conflictId, message);
        }
        // Service
        public async Task<ApiResponse<List<TechnicianScheduleBoardDto>>> GetScheduleBoardReport(
     DateTime scheduleDate)
        {
            try
            {
                var parameters = new[]
                {
            SqlParameterHelper.Input("@ScheduleDate", scheduleDate.Date)
        };

                var dt = await GetDataTableAsync("sp_Schedule_GetBoardReport", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<List<TechnicianScheduleBoardDto>>.Ok(
                        new List<TechnicianScheduleBoardDto>(),
                        "No schedules found"
                    );
                }

                var rows = dt.Rows.Cast<DataRow>().Select(r => new
                {
                    TechnicianId = r["TechnicianId"] == DBNull.Value ? 0 : Convert.ToInt32(r["TechnicianId"]),
                    TechnicianName = r["TechnicianName"]?.ToString() ?? "",

                    ScheduleId = r["ScheduleId"] == DBNull.Value ? 0 : Convert.ToInt32(r["ScheduleId"]),
                    ComplaintNumber = r["ComplaintNumber"]?.ToString() ?? "",
                    CustomerName = r["CustomerName"]?.ToString() ?? "",

                    City = r["City"]?.ToString() ?? "",
                    Address = r["Address"]?.ToString() ?? "",
                    Landmark = r["Landmark"]?.ToString() ?? "",

                    Latitude = r["Latitude"] == DBNull.Value
                        ? (decimal?)null
                        : Convert.ToDecimal(r["Latitude"]),

                    Longitude = r["Longitude"] == DBNull.Value
                        ? (decimal?)null
                        : Convert.ToDecimal(r["Longitude"]),

                    ProductName = r["ProductName"]?.ToString() ?? "",

                    StartTime = r["StartTime"]?.ToString() ?? "",
                    EndTime = r["EndTime"]?.ToString() ?? "",

                    StatusId = r["StatusId"] == DBNull.Value ? 0 : Convert.ToInt32(r["StatusId"]),
                    StatusName = r["StatusName"]?.ToString() ?? "",

                    TimeSlot = r["TimeSlot"]?.ToString()?.ToLower() ?? "morning",

                    IsFuture = r["IsFuture"] != DBNull.Value &&
                               Convert.ToBoolean(r["IsFuture"]),

                    IsFree = r.Table.Columns.Contains("IsFree")
                             && r["IsFree"] != DBNull.Value
                             && Convert.ToBoolean(r["IsFree"])
                }).ToList();

                var result = rows
                    .GroupBy(x => new { x.TechnicianId, x.TechnicianName })
                    .Select(g => new TechnicianScheduleBoardDto
                    {
                        TechnicianId = g.Key.TechnicianId,
                        TechnicianName = g.Key.TechnicianName,

                        Items = g.Select(x => new TechnicianScheduleBoardItemDto
                        {
                            ScheduleId = x.ScheduleId,
                            ComplaintNumber = x.ComplaintNumber,
                            CustomerName = x.CustomerName,
                            City = x.City,
                            Address = x.Address,
                            Landmark = x.Landmark,
                            Latitude = x.Latitude,
                            Longitude = x.Longitude,
                            ProductName = x.ProductName,
                            StartTime = x.StartTime,
                            EndTime = x.EndTime,
                            StatusId = x.StatusId,
                            StatusName = x.StatusName,
                            TimeSlot = string.IsNullOrWhiteSpace(x.TimeSlot)
                                ? "morning"
                                : x.TimeSlot,
                            IsFuture = x.IsFuture,
                            IsFree = x.IsFree
                        })
                        .OrderBy(x => x.StartTime)
                        .ToList()
                    })
                    .OrderBy(x => x.TechnicianName)
                    .ToList();

                return ApiResponse<List<TechnicianScheduleBoardDto>>.Ok(
                    result,
                    "Schedule board report loaded successfully"
                );
            }
            catch (Exception ex)
            {
                return ApiResponse<List<TechnicianScheduleBoardDto>>.Fail(
                    $"Failed to load schedule board report: {ex.Message}"
                );
            }
        }
    }
}
