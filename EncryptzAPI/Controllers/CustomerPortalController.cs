using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.CustomerPortal.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;


namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Customer")]
    public class CustomerPortalController : ControllerBase
    {
        private readonly ICustomerPortalService _service;
        public CustomerPortalController(ICustomerPortalService service) => _service = service;

        private int GetUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        }
    
        [HttpGet("complaints")]
        public async Task<IActionResult> GetMyComplaints([FromQuery] int? statusFilter, [FromQuery] int page = 1, [FromQuery] int size = 10)
        {
            var result = await _service.GetMyComplaints(GetUserId(), statusFilter, page, size);
            return Ok(result);
        }

        [HttpGet("track/{complaintNo}")]
        public async Task<IActionResult> TrackComplaint(string complaintNo)
        {
            var result = await _service.TrackComplaint(complaintNo, GetUserId());
            if (result == null) return NotFound(ApiResponse<string>.Fail("Complaint not found"));
            return Ok(result);
        }

        [HttpPost("request")]
        public async Task<IActionResult> CreateRequest([FromBody] ServiceRequestCreateDto dto)
        {
            var result = await _service.CreateRequest(dto, GetUserId());
            return Ok(result);
        }
    }
}
