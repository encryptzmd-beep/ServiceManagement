using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Schedule.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;


namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ScheduleController : ControllerBase
    {
        private readonly IScheduleService _service;
        public ScheduleController(IScheduleService service) => _service = service;

        private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        [HttpGet("daily")]
        public async Task<IActionResult> GetDaily([FromQuery] DateTime? date, [FromQuery] int? technicianId)
        {
            var result = await _service.GetDaily(date, technicianId);
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Create([FromBody] ScheduleCreateDto dto)
        {
            var result = await _service.Create(dto, GetUserId());
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
        [HttpGet("schedule-board")]
        [Authorize]
        public async Task<IActionResult> GetScheduleBoard(
     [FromQuery] DateTime scheduleDate)
        {
            var result = await _service.GetScheduleBoardReport(scheduleDate);

            return Ok(result);
        }

        [HttpPut]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Update([FromBody] ScheduleUpdateDto dto)
        {
            var result = await _service.Update(dto, GetUserId());
            return Ok(result);
        }

        [HttpGet("conflicts")]
        public async Task<IActionResult> DetectConflicts([FromQuery] DateTime? date)
        {
            var result = await _service.DetectConflicts(date);
            return Ok(result);
        }

        [HttpPost("conflicts/resolve")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> ResolveConflict([FromBody] ConflictResolveDto dto)
        {
            var result = await _service.ResolveConflict(dto, GetUserId());
            return Ok(result);
        }
    }
}
