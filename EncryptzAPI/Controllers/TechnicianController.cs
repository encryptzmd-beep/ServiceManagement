using EncryptzAPI.Middleware;
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
        private readonly IConfiguration _config;
        public TechnicianController(ITechnicianService service, IWebHostEnvironment env, IConfiguration config)
        {
            _service = service;
            _env = env;
            _config = config;
        }

        /// <summary>WorkOrders:RequireCompletionPhoto (default true): no completion without a service photo.</summary>
        private bool RequireCompletionPhoto
            => !string.Equals(_config["WorkOrders:RequireCompletionPhoto"], "false", StringComparison.OrdinalIgnoreCase);
        private int UserId => User.GetTenantUserId();

        private const string CheckInRequired = "Please check in before working on a job";

        /// <summary>
        /// Technicians may only touch their own assignment; back office any.
        /// Returns the error result, or null when the caller may go on.
        /// </summary>
        private async Task<IActionResult?> GuardAssignment(int assignmentId, bool requireCheckIn = false)
        {
            if (!User.IsTechnicianScoped()) return null;

            var owner = await _service.GetAssignmentTechnicianId(assignmentId);
            if (owner == null)
                return NotFound(new { success = false, message = "Assignment not found" });
            if (owner != User.GetTechnicianId())
                return this.Forbidden("This work order is assigned to another technician");

            if (requireCheckIn && !await _service.IsCheckedIn(owner.Value))
                return BadRequest(new { success = false, message = CheckInRequired });

            return null;
        }

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
        {
            // dispatching is a back-office action
            if (User.IsTechnicianScoped()) return this.Forbidden();
            return Ok(await _service.AssignTechnician(dto, UserId));
        }

        [HttpGet("audit-log/{complaintId}")]
        public async Task<IActionResult> GetAuditLog(int complaintId)
            => Ok(await _service.GetAuditLog(complaintId));

        [HttpPost("complete-assignment")]
        public async Task<IActionResult> CompleteAssignment([FromBody] CompleteAssignmentDto dto)
        {
            var denied = await GuardAssignment(dto.AssignmentId, requireCheckIn: true);
            if (denied != null) return denied;
            return Ok(await _service.CompleteAssignment(dto, UserId));
        }

        [HttpGet("complaints-lookup")]
        public async Task<IActionResult> GetComplaintsForAssignment([FromQuery] string search = null, [FromQuery] bool includeClosed = false)
        => Ok(await _service.GetComplaintsForAssignment(search, includeClosed));

        [HttpGet("active-assignments")]
        public async Task<IActionResult> GetActiveAssignments()
            => Ok(await _service.GetActiveAssignments());

        [HttpPost("unassign")]

        public async Task<IActionResult> UnAssignTechnician([FromBody] UnAssignTechnicianRequest request)
        {
            if (request.AssignmentId <= 0)
                return BadRequest(new { success = false, message = "Invalid assignment ID" });

            // a technician may hand back (put on hold) only the own work order
            var denied = await GuardAssignment(request.AssignmentId);
            if (denied != null) return denied;

            // Get logged-in user ID from JWT claims
            var userId = UserId;

            if (userId <= 0)
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
            // the id comes from the URL: a technician may only ask for the own list
            if (!User.CanActAsTechnician(technicianId))
                return this.Forbidden("You can only view your own work orders");

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

            var denied = await GuardAssignment(dto.AssignmentId, requireCheckIn: true);
            if (denied != null) return denied;

            if (dto.Status == "Completed")
            {
                if (string.IsNullOrWhiteSpace(dto.WorkDone))
                    return BadRequest(new { success = false, message = "Work performed is required to complete a work order" });

                // the screen uploads the photos first, then completes
                if (RequireCompletionPhoto && User.IsTechnicianScoped() && !await _service.HasServiceImage(dto.AssignmentId))
                    return BadRequest(new { success = false, message = "Upload at least one service photo before completing the work order" });
            }

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
            var denied = await GuardAssignment(assignmentId);
            if (denied != null) return denied;

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

            // the technician id comes from the URL and the complaint id from the form:
            // a technician uploads only as himself, and only to a complaint assigned to him
            if (User.IsTechnicianScoped())
            {
                if (!User.CanActAsTechnician(technicianId))
                    return this.Forbidden("You can only upload images as yourself");
                if (!await _service.IsComplaintAssignedTo(complaintId, technicianId))
                    return this.Forbidden("This complaint is not assigned to you");
            }

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
