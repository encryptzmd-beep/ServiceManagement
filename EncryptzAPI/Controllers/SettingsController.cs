using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Settings.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;


namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class SettingsController : ControllerBase
    {
        private readonly ISettingsService _service;
        public SettingsController(ISettingsService service) => _service = service;

        private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string group = null)
        {
            var result = await _service.GetAll(group);
            return Ok(result);
        }

        [HttpPut]
        public async Task<IActionResult> Update([FromBody] SettingUpdateDto dto)
        {
            var result = await _service.Update(dto, GetUserId());
            return Ok(result);
        }

        [HttpPut("bulk")]
        public async Task<IActionResult> BulkUpdate([FromBody] BulkSettingsUpdateDto dto)
        {
            var result = await _service.BulkUpdate(dto, GetUserId());
            return Ok(result);
        }
    }
}
