using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Report.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,Manager")]
    public class ReportController : ControllerBase
    {
        private readonly IReportService _service;
        public ReportController(IReportService service) => _service = service;

        [HttpGet("complaint-summary")]
        public async Task<IActionResult> GetComplaintSummary([FromQuery] ReportFilterDto filter)
        {
            var result = await _service.GetComplaintSummary(filter);
            return Ok(result);
        }
        // Controller
        [HttpGet("productivity")]
        public async Task<IActionResult> GetProductivityReport(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            if (!startDate.HasValue || !endDate.HasValue)
                return BadRequest("Start date and end date are required.");

            var result = await _service.GetProductivityReport(
                startDate.Value,
                endDate.Value
            );

            return Ok(result);
        }
        [HttpGet("technician-performance")]
        public async Task<IActionResult> GetTechnicianPerformance([FromQuery] ReportFilterDto filter)
        {
            var result = await _service.GetTechnicianPerformance(filter);
            return Ok(result);
        }
        [HttpGet("sla-compliance")]
        public async Task<IActionResult> GetSlaCompliance(
         [FromQuery] DateTime? startDate,
         [FromQuery] DateTime? endDate)
        {
            if (!startDate.HasValue || !endDate.HasValue)
                return BadRequest("Start date and end date are required.");

            var result = await _service.GetSlaCompliance(startDate.Value, endDate.Value);
            return Ok(result);
        }

    }
}
