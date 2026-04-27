using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Technician.modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Security.Claims;
using EncryptzBL.Common;



namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TechnicianController : ControllerBase
    {
        private readonly ITechnicianService _service;
        private readonly IWebHostEnvironment _env;
        public TechnicianController(ITechnicianService service, IWebHostEnvironment env)
        {
            _service = service;
            _env = env;
        }
        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] TechnicianFilterDto filter)
        {
            var result = await _service.GetAll(filter);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetById(id);
            if (result == null) return NotFound(ApiResponse<string>.Fail("Technician not found"));
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Create([FromBody] TechnicianCreateDto dto)
        {
            var result = await _service.Create(dto);
            if (!result.Success) return BadRequest(result);
            return CreatedAtAction(nameof(GetById), new { id = result.Data }, result);
        }

        [HttpPut]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Update([FromBody] TechnicianUpdateDto dto)
        {
            var result = await _service.Update(dto);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.Delete(id);
            return Ok(result);
        }
        [HttpPost("assign")]
        public async Task<IActionResult> Assign([FromBody] AssignTechnicianDto dto)
            => Ok(await _service.AssignTechnician(dto, UserId));

        [HttpGet("audit-log/{complaintId}")]
        public async Task<IActionResult> GetAuditLog(int complaintId)
            => Ok(await _service.GetAuditLog(complaintId));

        [HttpPost("complete-assignment")]
        public async Task<IActionResult> CompleteAssignment([FromBody] CompleteAssignmentDto dto)
           => Ok(await _service.CompleteAssignment(dto, UserId));

        [HttpGet("complaints-lookup")]
        public async Task<IActionResult> GetComplaintsForAssignment([FromQuery] string search = null)
        => Ok(await _service.GetComplaintsForAssignment(search));

        [HttpGet("active-assignments")]
        public async Task<IActionResult> GetActiveAssignments()
            => Ok(await _service.GetActiveAssignments());

        [HttpPost("unassign")]

        public async Task<IActionResult> UnAssignTechnician([FromBody] UnAssignTechnicianRequest request)
        {
            if (request.AssignmentId <= 0)
                return BadRequest(new { success = false, message = "Invalid assignment ID" });

            // Get logged-in user ID from JWT claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("UserId")?.Value;

            if (!int.TryParse(userIdClaim, out int userId))
                return Unauthorized(new { success = false, message = "Invalid user token" });

            var response = await _service.UnAssignTechnicianAsync(
                request.AssignmentId,
                userId,
                request.Reason
            );

            if (response.Result == -1)
                return BadRequest(new { success = false, message = response.Message });

            return Ok(new { success = response.Success, message = response.Message });
        }


        // GET api/technician/work-orders/{technicianId}
        [HttpGet("{technicianId}/work-orders")]
        public async Task<IActionResult> GetWorkOrders(int technicianId)
        {
            var data = await _service.GetWorkOrders(technicianId);
            return Ok(new { success = true, data });
        }

        // POST api/technician/update-status
        [HttpPost("update-status")]
        public async Task<IActionResult> UpdateStatus([FromBody] ServiceUpdateDto dto)
        {
            if (dto.AssignmentId <= 0)
                return BadRequest(new { success = false, message = "Invalid assignment ID" });

            var validStatuses = new[] { "InProgress", "Completed" };
            if (!validStatuses.Contains(dto.Status))
                return BadRequest(new { success = false, message = "Invalid status. Use: InProgress or Completed" });

            var result = await _service.UpdateAssignmentStatus(dto, UserId);
            return Ok(new { success = result.Success, message = result.Message });
        }

        //// POST api/technician/unassign
        //[HttpPost("unassign")]
        //public async Task<IActionResult> UnAssign([FromBody] UnAssignTechnicianRequest request)
        //{
        //    if (request.AssignmentId <= 0)
        //        return BadRequest(new { success = false, message = "Invalid assignment ID" });

        //    var response = await _service.UnAssignTechnicianAsync(
        //        request.AssignmentId, UserId, request.Reason);

        //    if (!response.Success)
        //        return BadRequest(new { success = false, message = response.Message });

        //    return Ok(new { success = true, message = response.Message });
        //}
        [HttpGet("work-order-details/{assignmentId}")]
        public async Task<IActionResult> GetWorkOrderDetails(int assignmentId)
        {
            var detail = await _service.GetWorkOrderDetails(assignmentId);
            if (detail == null)
                return NotFound(new { success = false, message = "Assignment not found" });

            return Ok(new { success = true, data = detail });
        }

        [HttpPost("{technicianId}/upload-image")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadImage(
            int technicianId,
            [FromForm] IFormFile file,
            [FromForm] int complaintId,
            [FromForm] string imageType = "Other")
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "No file provided" });

            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowed.Contains(ext))
                return BadRequest(new { success = false, message = "Only JPG, PNG, and WEBP files are allowed" });

            // Convert file to base64 data URI
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var bytes = ms.ToArray();
            var base64 = Convert.ToBase64String(bytes);
            var contentType = file.ContentType ?? "image/jpeg";
            var dataUri = $"data:{contentType};base64,{base64}";

            var result = await _service.SaveServiceImage(new ServiceImageSaveDto
            {
                ComplaintId = complaintId,
                TechnicianId = technicianId,
                ImageType = imageType,
                ImageData = dataUri,
                ImageName = file.FileName,
                ContentType = contentType
            });

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            return Ok(new
            {
                success = true,
                message = result.Message,
                imageId = result.Data
            });
        }

    }
}
