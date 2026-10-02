using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Tracking.Modules
{
    public interface ITrackingService
    {
        Task<ApiResponse<long>> LogPosition(TrackingLogDto dto);
        Task<ApiResponse<List<TechnicianLivePosition>>> GetLivePositions();
        Task<ApiResponse<List<TrackingLogEntry>>> GetHistory(int technicianId, DateTime? date);
        // recordedBy: name of the back-office user entering it for the technician (null = the technician)
        Task<ApiResponse<int>> CheckIn(CheckInDto dto, int userId, string? recordedBy = null);
        Task<ApiResponse> CheckOut(CheckOutDto dto, int userId, string? recordedBy = null);
        Task<ApiResponse> RecordSiteArrival(SiteArrivalDto dto, int userId, string? recordedBy = null);
        Task<ApiResponse<List<AttendanceDto>>> GetAttendance(DateTime? from, DateTime? to, int? technicianId);
        Task<ApiResponse<List<TravelReportDto>>> GetTravelReport(DateTime? from, DateTime? to, int? technicianId);

        Task<ApiResponse<List<GeoTrackDto>>> GetGeoTrail(int technicianId, DateTime? date);
    }
}
