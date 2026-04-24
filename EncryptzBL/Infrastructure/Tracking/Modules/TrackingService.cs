using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Tracking.Modules;
using System.Data;

namespace EncryptzBL.Infrastructure.Tracking.Modules
{
    public class TrackingService : BaseRepository, ITrackingService
    {
        public TrackingService(DbHelper db) : base(db) { }

        // ── Log Position ──────────────────────────────────────────────────────
        public async Task<ApiResponse<long>> LogPosition(TrackingLogDto dto)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
                SqlParameterHelper.Input("@Latitude",     dto.Latitude),
                SqlParameterHelper.Input("@Longitude",    dto.Longitude),
                SqlParameterHelper.Input("@Accuracy",     dto.Accuracy     ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@Speed",        dto.Speed        ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@BatteryLevel", dto.BatteryLevel ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@SessionId",    dto.SessionId    ?? (object)DBNull.Value)
            };

            var dt = await GetDataTableAsync("sp_Tracking_LogPosition", p);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<long>.Fail("Log position failed");

            var logId = Convert.ToInt64(dt.Rows[0]["LogId"]);
            return ApiResponse<long>.Ok(logId, "Position logged");
        }

        // ── Get Live Positions ────────────────────────────────────────────────
        public async Task<ApiResponse<List<TechnicianLivePosition>>> GetLivePositions()
        {
            var dt = await GetDataTableAsync("sp_Tracking_GetLivePositions", null);
            var list = dt != null ? dt.ToList<TechnicianLivePosition>() : new List<TechnicianLivePosition>();
            return ApiResponse<List<TechnicianLivePosition>>.Ok(list);
        }

        // ── Get Tracking History ──────────────────────────────────────────────
        public async Task<ApiResponse<List<TrackingLogEntry>>> GetHistory(int technicianId, DateTime? date)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", technicianId),
                SqlParameterHelper.Input("@Date",         date ?? (object)DBNull.Value)
            };

            var dt = await GetDataTableAsync("sp_Tracking_GetHistory", p);
            var list = dt != null ? dt.ToList<TrackingLogEntry>() : new List<TrackingLogEntry>();
            return ApiResponse<List<TrackingLogEntry>>.Ok(list);
        }

        // ── Check In ─────────────────────────────────────────────────────────
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

        // ── Check Out ─────────────────────────────────────────────────────────
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

        // ── Record Site Arrival ───────────────────────────────────────────────
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

            var message = dt.Rows[0]["Message"]?.ToString() ?? "Site arrival recorded";
            return new ApiResponse(true, message);
        }

        // ── Get Attendance ────────────────────────────────────────────────────
        public async Task<ApiResponse<List<AttendanceDto>>> GetAttendance(
            DateTime? from, DateTime? to, int? technicianId)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", technicianId ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@FromDate",     from         ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ToDate",       to           ?? (object)DBNull.Value)
            };

            var dt = await GetDataTableAsync("sp_Technician_GetAttendance", p);
            var list = dt != null ? dt.ToList<AttendanceDto>() : new List<AttendanceDto>();
            return ApiResponse<List<AttendanceDto>>.Ok(list);
        }

        // ── Get Travel Report ─────────────────────────────────────────────────
        public async Task<ApiResponse<List<TravelReportDto>>> GetTravelReport(
            DateTime? from, DateTime? to, int? technicianId)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", technicianId ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@FromDate",     from         ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ToDate",       to           ?? (object)DBNull.Value)
            };

            var dt = await GetDataTableAsync("sp_Technician_TravelReport", p);
            var list = dt != null ? dt.ToList<TravelReportDto>() : new List<TravelReportDto>();
            return ApiResponse<List<TravelReportDto>>.Ok(list);
        }
        public async Task<ApiResponse<List<GeoTrackDto>>> GetGeoTrail(int technicianId, DateTime? date)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@TechnicianId", technicianId),
        SqlParameterHelper.Input("@Date",         date ?? (object)DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_Tracking_GetGeoTrail", p);
            var list = dt != null ? dt.ToList<GeoTrackDto>() : new List<GeoTrackDto>();
            return ApiResponse<List<GeoTrackDto>>.Ok(list);
        }
    }
}