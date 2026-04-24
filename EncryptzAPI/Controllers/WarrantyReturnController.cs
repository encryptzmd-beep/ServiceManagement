using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.WarrantyReturn.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;


namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WarrantyReturnController : ControllerBase
    {
        private readonly IWarrantyReturnService _service;
        public WarrantyReturnController(IWarrantyReturnService service) => _service = service;

        private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] WarrantyReturnFilterDto filter)
        {
            var result = await _service.GetAll(filter);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetById(id);
            if (result == null) return NotFound(ApiResponse<string>.Fail("Warranty return not found"));
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] WarrantyReturnCreateDto dto)
        {
            var result = await _service.Create(dto, GetUserId());
            return CreatedAtAction(nameof(GetById), new { id = ((dynamic)result.Data).ReturnId }, result);
        }

        [HttpPut("status")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> UpdateStatus([FromBody] WarrantyReturnStatusDto dto)
        {
            var result = await _service.UpdateStatus(dto, GetUserId());
            return Ok(result);
        }
    }
}
