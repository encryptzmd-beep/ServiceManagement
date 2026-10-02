using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Tracking.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TrackingController : ControllerBase
    {
        private readonly ITrackingService _svc;
        public TrackingController(ITrackingService svc) => _svc = svc;

        private int UserId => User.GetTenantUserId();

        /// <summary>Name of the back-office user when the entry is made FOR the technician; null when the technician records it himself.</summary>
        private string? RecordedBy(int technicianId)
            => User.GetTechnicianId() == technicianId
                ? null
                : User.FindFirstValue(ClaimTypes.Name) ?? "admin";

        // The position comes from the device and cannot be proven server-side; obviously
        // invalid values (out of range, the 0/0 "no fix" point) are refused.
        private static bool IsValidPosition(decimal latitude, decimal longitude)
            => latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180
               && !(latitude == 0 && longitude == 0);

        private IActionResult InvalidPosition()
            => BadRequest(new { success = false, message = "A valid location is required" });

        // ── Check In ─────────────────────────────────────────────────────────
        // FIXED: Was [HttpPost("checkin")] using JWT UserId only.
        // Now accepts {technicianId} from route so admin panel can check in
        // a selected technician (matches checkout/site-arrival pattern).
        [HttpPost("{technicianId}/checkin")]
        public async Task<IActionResult> CheckIn(int technicianId, [FromBody] CheckInDto dto)
        {
            if (!User.CanActAsTechnician(technicianId)) return this.Forbidden("You can only check in as yourself");
            var recordedBy = RecordedBy(technicianId);
            if (recordedBy == null && !IsValidPosition(dto.Latitude, dto.Longitude)) return InvalidPosition();

            var result = await _svc.CheckIn(dto, technicianId, recordedBy);
            return Ok(result);
        }

        // ── Check Out ────────────────────────────────────────────────────────
        [HttpPost("{technicianId}/checkout")]
        public async Task<IActionResult> CheckOut(int technicianId, [FromBody] CheckOutDto dto)
        {
            if (!User.CanActAsTechnician(technicianId)) return this.Forbidden("You can only check out as yourself");
            var recordedBy = RecordedBy(technicianId);
            if (recordedBy == null && !IsValidPosition(dto.Latitude, dto.Longitude)) return InvalidPosition();

            var result = await _svc.CheckOut(dto, technicianId, recordedBy);
            return Ok(result);
        }

        // ── Site Arrival ─────────────────────────────────────────────────────
        [HttpPost("{technicianId}/site-arrival")]
        public async Task<IActionResult> SiteArrival(int technicianId, [FromBody] SiteArrivalDto dto)
        {
            if (!User.CanActAsTechnician(technicianId)) return this.Forbidden("You can only record your own site arrival");
            if (!IsValidPosition(dto.Latitude, dto.Longitude)) return InvalidPosition();

            var result = await _svc.RecordSiteArrival(dto, technicianId, RecordedBy(technicianId));
            return Ok(result);
        }

        // ── Log Position ─────────────────────────────────────────────────────
        [HttpPost("log")]
        public async Task<IActionResult> LogPosition([FromBody] TrackingLogDto dto)
        {
            // a technician logs only the own position, whatever id the body carries
            if (User.IsTechnicianScoped()) dto.TechnicianId = User.GetTechnicianId();
            if (!IsValidPosition(dto.Latitude, dto.Longitude)) return InvalidPosition();

            var result = await _svc.LogPosition(dto);
            return Ok(result);
        }

        // ── Get Live Positions ───────────────────────────────────────────────
        [HttpGet("live")]
        public async Task<IActionResult> GetLivePositions()
        {
            // where every technician is right now: back office only
            if (User.IsTechnicianScoped()) return this.Forbidden();

            var result = await _svc.GetLivePositions();
            return Ok(result);
        }

        // ── Get Tracking History (raw position logs) ─────────────────────────
        [HttpGet("history/{technicianId}")]
        public async Task<IActionResult> GetHistory(int technicianId, [FromQuery] DateTime? date)
        {
            if (!User.CanActAsTechnician(technicianId)) return this.Forbidden();

            var result = await _svc.GetHistory(technicianId, date);
            return Ok(result);
        }

        // ══════════════════════════════════════════════════════════════════════
        // NEW: Get Geo Trail — event-based timeline with type + address
        // ──────────────────────────────────────────────────────────────────────
        // GET api/tracking/{technicianId}/geo-trail?date=2026-03-22
        // Returns: ApiResponse<List<GeoTrackDto>>
        //
        // Combines check-in/out, site arrivals, work start/complete, transit
        // events into a unified timeline. Each event has eventType and address.
        // The frontend geo-map component consumes this endpoint.
        // ══════════════════════════════════════════════════════════════════════
        [HttpGet("{technicianId}/geo-trail")]
        public async Task<IActionResult> GetGeoTrail(int technicianId, [FromQuery] DateTime? date)
        {
            if (!User.CanActAsTechnician(technicianId)) return this.Forbidden();

            var result = await _svc.GetGeoTrail(technicianId, date);
            return Ok(result);
        }

        // ── Get Attendance ───────────────────────────────────────────────────
        [HttpGet("attendance")]
        public async Task<IActionResult> GetAttendance(
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? technicianId)
        {
            if (User.IsTechnicianScoped()) technicianId = User.GetTechnicianId();   // own records only

            var result = await _svc.GetAttendance(fromDate, toDate, technicianId);
            return Ok(result);
        }

        // ── Get Travel Report ────────────────────────────────────────────────
        [HttpGet("travel-report")]
        public async Task<IActionResult> GetTravelReport(
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? technicianId)
        {
            if (User.IsTechnicianScoped()) technicianId = User.GetTechnicianId();   // own records only

            var result = await _svc.GetTravelReport(fromDate, toDate, technicianId);
            return Ok(result);
        }
    }
}