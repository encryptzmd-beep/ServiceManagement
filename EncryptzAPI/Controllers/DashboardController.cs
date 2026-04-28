using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Dashboard.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _service;
        public DashboardController(IDashboardService service) => _service = service;

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats([FromQuery] int? roleId, [FromQuery] int? technicianId)
        {
            var result = await _service.GetDashboardStats(roleId, technicianId);
            return Ok(result);
        }

        [HttpGet("charts")]
        public async Task<IActionResult> GetChartData([FromQuery] int days = 30)
        {
            var result = await _service.GetChartData(days);
            return Ok(result);
        }
        // ═════════════════════════════════════════════════════════════════════════
        //  CORRECTED ComplaintDetailController  (all convenience endpoints)
        //
        //  CHANGES vs your existing controller:
        //   • Every convenience endpoint now passes UserId = GetUserId() into the
        //     manageRequest so the SP can stamp ComplaintTimeline.ActionBy and
        //     AssignmentAuditLog.ChangedBy with the actual user.
        //   • UpdateComplaint now also forwards Latitude/Longitude/LocationAddress/
        //     LocationName if the UpdateComplaintRequestModel gets those fields
        //     later (currently kept minimal).
        //   • No other behaviour changes — routes and signatures identical.
        // ═════════════════════════════════════════════════════════════════════════

        [HttpPost("manage")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> ManageComplaintDetails([FromBody] ManageComplaintRequestModel request)
        {
            // Stamp the user on every master-endpoint call too
            if (!request.UserId.HasValue) request.UserId = GetUserId();

            var result = await _service.ManageComplaintDetails(request);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("{complaintId}")]
        [Authorize(Roles = "Admin,CompanyAdmin,Technician,Customer")]
        public async Task<IActionResult> GetComplaintDetails_NEW(int complaintId)
        {
            var request = new ManageComplaintRequestModel
            {
                OperationType = "GET",
                ComplaintId = complaintId,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(request);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        }

        // ============================================
        // Convenience Endpoints
        // ============================================

        [HttpPut("complaints/{complaintId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateComplaint(int complaintId, [FromBody] UpdateComplaintRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_COMPLAINT",
                ComplaintId = complaintId,
                Subject = request.Subject,
                Description = request.Description,
                NatureOfJob = request.NatureOfJob,
                Priority = request.Priority,
                Category = request.Category,
                BrandName = request.BrandName,
                ModelNumber = request.ModelNumber,
                PreferredDate = request.PreferredDate,
                PreferredTimeSlot = request.PreferredTimeSlot,
                UserId = GetUserId()    // ← audit who made the edit
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("customers/{customerId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateCustomer(int customerId, [FromBody] UpdateCustomerRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_CUSTOMER",
                CustomerId = customerId,
                CustomerName = request.CustomerName,
                CustomerEmail = request.CustomerEmail,
                CustomerMobile = request.CustomerMobile,
                AlternatePhone = request.AlternatePhone,
                CustomerAddress = request.CustomerAddress,
                City = request.City,
                State = request.State,
                PinCode = request.PinCode,
                Landmark = request.Landmark,
                CustomerLatitude = request.CustomerLatitude,
                CustomerLongitude = request.CustomerLongitude,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("products/{productId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateProduct(int productId, [FromBody] UpdateProductRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_PRODUCT",
                ProductId = productId,
                ProductName = request.ProductName,
                SerialNumber = request.SerialNumber,
                ProductModelNumber = request.ProductModelNumber,
                ProductBrand = request.ProductBrand,
                ProductCategory = request.ProductCategory,
                PurchaseDate = request.PurchaseDate,
                WarrantyExpiryDate = request.WarrantyExpiryDate,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("locations/{complaintId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateLocation(int complaintId, [FromBody] UpdateLocationRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_LOCATION",
                ComplaintId = complaintId,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                LocationAddress = request.LocationAddress,
                LocationName = request.LocationName,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("assignments")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> AssignTechnician([FromBody] AssignTechnicianRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "ASSIGN_TECHNICIAN",
                ComplaintId = request.ComplaintId,
                TechnicianId = request.TechnicianId,
                AssignmentRole = request.AssignmentRole,
                AssignmentNotes = request.AssignmentNotes,
                ScheduledDate = request.ScheduledDate,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                EstimatedDuration = request.EstimatedDuration,
                Priority = request.Priority,
                UserId = GetUserId()   // ← AssignmentAuditLog.ChangedBy
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("assignments/{assignmentId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateAssignment(int assignmentId, [FromBody] UpdateAssignmentRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_ASSIGNMENT",
                AssignmentId = assignmentId,
                TechnicianId = request.TechnicianId,      // ← reassign support
                AssignmentRole = request.AssignmentRole,
                AssignmentNotes = request.AssignmentNotes,
                ScheduledDate = request.ScheduledDate,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                EstimatedDuration = request.EstimatedDuration,
                Priority = request.Priority,
                WorkDone = request.WorkDone,
                PartsUsed = request.PartsUsed,
                CompletionRemarks = request.CompletionRemarks,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("assignments/{assignmentId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UnassignTechnician(int assignmentId)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UNASSIGN_TECHNICIAN",
                AssignmentId = assignmentId,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("spare-parts")]
        [Authorize(Roles = "Admin,CompanyAdmin,Technician")]
        public async Task<IActionResult> AddSparePart([FromBody] AddSparePartRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "ADD_SPARE",
                ComplaintId = request.ComplaintId,
                SparePartId = request.SparePartId,
                TechnicianId = request.TechnicianId,
                SpareQuantity = request.SpareQuantity,
                SpareUrgency = request.SpareUrgency,
                SpareRemarks = request.SpareRemarks,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("spare-parts/{requestId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateSparePart(int requestId, [FromBody] UpdateSparePartRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_SPARE",
                SpareRequestId = requestId,
                SpareQuantity = request.SpareQuantity,
                SpareUrgency = request.SpareUrgency,
                SpareRemarks = request.SpareRemarks,
                SpareStatus = request.SpareStatus,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("spare-parts/{requestId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> DeleteSparePart(int requestId)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "DELETE_SPARE",
                SpareRequestId = requestId,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("comments")]
        [Authorize(Roles = "Admin,CompanyAdmin,Technician")]
        public async Task<IActionResult> AddComment([FromBody] AddCommentRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "ADD_COMMENT",
                ComplaintId = request.ComplaintId,
                CommentText = request.CommentText,
                IsInternal = request.IsInternal,
                UserId = GetUserId()    // ← ComplaintTimeline.ActionBy
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("comments/{commentId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateComment(int commentId, [FromBody] UpdateCommentRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "UPDATE_COMMENT",
                CommentId = commentId,
                CommentText = request.CommentText,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("comments/{commentId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> DeleteComment(int commentId)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "DELETE_COMMENT",
                CommentId = commentId,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("spare-parts/dropdown")]
        [Authorize(Roles = "Admin,CompanyAdmin,Technician")]
        public async Task<IActionResult> GetSparePartsDropdown()
        {
            var result = await _service.GetSparePartsDropdown();
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("technicians/dropdown")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetTechniciansDropdown()
        {
            var result = await _service.GetTechniciansDropdown();
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }
        [HttpPost("complaints/{complaintId}/products")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> CreateProductAndLink(
    int complaintId,
    [FromBody] UpdateProductRequestModel request)
        {
            var manageRequest = new ManageComplaintRequestModel
            {
                OperationType = "CREATE_PRODUCT",
                ComplaintId = complaintId,
                ProductName = request.ProductName,
                SerialNumber = request.SerialNumber,
                ProductModelNumber = request.ProductModelNumber,
                ProductBrand = request.ProductBrand,
                ProductCategory = request.ProductCategory,
                PurchaseDate = request.PurchaseDate,
                WarrantyExpiryDate = request.WarrantyExpiryDate,
                UserId = GetUserId()
            };
            var result = await _service.ManageComplaintDetails(manageRequest);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }
    }
}
