using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Spareparts.Modules;
using EncryptzBL.Infrastructure.Technician.modules;
using Microsoft.AspNet.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;



    [Route("api/spare-parts")]
    [ApiController]
    [Authorize]
    public class SparePartController : ControllerBase
    {
        private readonly ISparePartService _svc;
        private readonly ITechnicianService _technicians;
        public SparePartController(ISparePartService svc, ITechnicianService technicians)
        {
            _svc = svc;
            _technicians = technicians;
        }

        /// <summary>
        /// A technician raises spare requests only as himself, for a complaint assigned to
        /// him, while checked in. Returns the error result, or null when the request may go on.
        /// </summary>
        private async Task<IActionResult?> GuardTechnicianRequest(SparePartRequestCreateDto dto)
        {
            if (!User.IsTechnicianScoped()) return null;

            dto.TechnicianId = User.GetTechnicianId();   // never the id from the body
            if (!await _technicians.IsComplaintAssignedTo(dto.ComplaintId, dto.TechnicianId))
                return this.Forbidden("This complaint is not assigned to you");
            if (!await _technicians.IsCheckedIn(dto.TechnicianId))
                return BadRequest(new { success = false, message = "Please check in before requesting spare parts" });

            return null;
        }

        private int UserId => User.GetTenantUserId();
    // GET  api/spare-parts/dashboard-summary
    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary()
    {
        if (User.IsTechnicianScoped()) return this.Forbidden();

        var data = await _svc.GetDashboardSummary();
        return Ok(new { success = true, data });
    }

    // GET  api/spare-parts/admin?status=Requested&urgencyLevel=Critical&page=1&pageSize=20
    [HttpGet("admin")]
    public async Task<IActionResult> GetAdminRequests(
        [FromQuery] string? status = null,
        [FromQuery] string? urgencyLevel = null,
        [FromQuery] int? complaintId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (User.IsTechnicianScoped()) return this.Forbidden();

        var filter = new SpareFilterDto
        {
            Status = status,
            UrgencyLevel = urgencyLevel,
            ComplaintId = complaintId,
            PageNumber = page,
            PageSize = pageSize
        };
        var data = await _svc.GetAdminRequests(filter);
        return Ok(new
        {
            success = true,
            data,
            totalCount = data.FirstOrDefault()?.TotalCount ?? 0,
            page,
            pageSize
        });
    }

    // GET  api/spare-parts/by-complaint/{complaintId}
    [HttpGet("by-complaint/{complaintId}")]
    public async Task<IActionResult> GetByComplaint(int complaintId)
    {
        if (User.IsTechnicianScoped() && !await _technicians.IsComplaintAssignedTo(complaintId, User.GetTechnicianId()))
            return this.Forbidden("This complaint is not assigned to you");

        var data = await _svc.GetByComplaint(complaintId);
        return Ok(new { success = true, data });
    }

    // PATCH api/spare-parts/request/{id}/status
    [HttpPatch("request/{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateSpareStatusDto dto)
    {
        var valid = new[] { "Approved", "Rejected", "Dispatched", "Used" };
        if (!valid.Contains(dto.Status))
            return BadRequest(new { success = false, message = "Invalid status" });

        // approving / rejecting / dispatching is back office; a technician only reports
        // the own part as used
        if (User.IsTechnicianScoped()
            && (dto.Status != "Used" || await _svc.GetRequestTechnicianId(id) != User.GetTechnicianId()))
            return this.Forbidden();

        if (dto.Status == "Rejected" && string.IsNullOrWhiteSpace(dto.RejectReason))
            return BadRequest(new { success = false, message = "A reason is required to reject a request" });
        if (dto.UnitPrice is < 0 or > 9_999_999.99m)
            return BadRequest(new { success = false, message = "Unit cost is out of range" });
        if (InputSanitizer.ContainsMarkup(dto.RejectReason))
            return BadRequest(new { success = false, message = "Reason must not contain HTML or script content" });

        var result = await _svc.UpdateRequestStatus(id, dto.Status, UserId,
            dto.RejectReason, dto.UnitPrice, dto.ApproveWithoutStock);

        // needsStockConfirmation: the UI asks "approve anyway?" and resends with approveWithoutStock
        return Ok(new { success = result.Success, message = result.Message, needsStockConfirmation = result.NeedsStockConfirmation });
    }

    // POST api/spare-parts/bulk-status
    [HttpPost("bulk-status")]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkStatusDto dto)
    {
        if (dto.RequestIds == null || dto.RequestIds.Count == 0)
            return BadRequest(new { success = false, message = "No request IDs provided" });

        var valid = new[] { "Approved", "Rejected", "Dispatched", "Used" };
        if (!valid.Contains(dto.Status))
            return BadRequest(new { success = false, message = "Invalid status" });

        if (User.IsTechnicianScoped()) return this.Forbidden();
        if (dto.Status == "Rejected" && string.IsNullOrWhiteSpace(dto.RejectReason))
            return BadRequest(new { success = false, message = "A reason is required to reject requests" });

        var result = await _svc.BulkUpdateStatus(dto.RequestIds, dto.Status, UserId, dto.RejectReason);
        return Ok(new { success = result.Success, message = result.Message });
    }
    // GET api/spare-parts?search=belt&page=1&pageSize=50
    [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var data = await _svc.GetAll(search, page, pageSize);
            return Ok(data);             // returns plain array — matches Angular Array.isArray check
        }

        // GET api/spare-parts/requests?technicianId=5&complaintId=
        [HttpGet("requests")]
        public async Task<IActionResult> GetRequests(
            [FromQuery] int? technicianId,
            [FromQuery] int? complaintId)
        {
            if (User.IsTechnicianScoped()) technicianId = User.GetTechnicianId();   // own requests only

            var data = await _svc.GetRequests(technicianId, complaintId);
            return Ok(data);
    }

    // POST api/spare-parts/request
    [HttpPost("requestspare")]
    public async Task<IActionResult> CreateRequest([FromBody] List<SparePartRequestCreateDto> dtos)
    {
        if (dtos == null || dtos.Count == 0)
            return BadRequest(new { success = false, message = "No items provided" });

        foreach (var dto in dtos)
        {
            if (dto.ComplaintId <= 0)
                return BadRequest(new { success = false, message = "Invalid complaint ID" });

            if (dto.Quantity <= 0)
                return BadRequest(new { success = false, message = "Quantity must be > 0" });

            // ✅ Allow BOTH cases:
            // 1. Master part → SparePartId exists
            // 2. Custom part → SparePartId null but name required
            if ((dto.SparePartId == null || dto.SparePartId <= 0)
                && string.IsNullOrWhiteSpace(dto.CustomPartName))
            {
                return BadRequest(new { success = false, message = "Part name required" });
            }

            if (dto.TechnicianId <= 0)
                dto.TechnicianId = User.GetTechnicianId();

            var denied = await GuardTechnicianRequest(dto);
            if (denied != null) return denied;
        }

        var results = new List<int>();

        foreach (var dto in dtos)
        {
            var result = await _svc.CreateRequest(dto);

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            results.Add(result.Data);
        }

        return Ok(new
        {
            success = true,
            message = "Requests created successfully",
            requestIds = results
        });
    }

    [HttpPost("request")]
    public async Task<IActionResult> CreateRequest([FromBody] SparePartRequestCreateDto dto)
    {
        if (dto.ComplaintId <= 0) return BadRequest(new { success = false, message = "Invalid complaint ID" });
        if (dto.Quantity <= 0) return BadRequest(new { success = false, message = "Quantity must be > 0" });
        if ((dto.SparePartId == null || dto.SparePartId <= 0) && string.IsNullOrWhiteSpace(dto.CustomPartName))
            return BadRequest(new { success = false, message = "Part name required" });

        // Inject logged-in user as technician if not provided
        if (dto.TechnicianId <= 0) dto.TechnicianId = User.GetTechnicianId();

        var denied = await GuardTechnicianRequest(dto);
        if (denied != null) return denied;

        var result = await _svc.CreateRequest(dto);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, message = result.Message, requestId = result.Data });
    }

    // PATCH api/spare-parts/request/{id}/status
    //[HttpPatch("request/{id}/status")]
    //public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateSpareStatusDto dto)
    //{
    //    var valid = new[] { "Approved", "Rejected", "Dispatched", "Used" };
    //    if (!valid.Contains(dto.Status))
    //        return BadRequest(new { success = false, message = $"Invalid status. Use: {string.Join(", ", valid)}" });

    //    var result = await _svc.UpdateRequestStatus(id, dto.Status, UserId);
    //    return Ok(new { success = result.Success, message = result.Message });
    //}
    // GET: api/SparePart
    [HttpGet("spare")]
    public async Task<IActionResult> GetAllspare([FromQuery] SparePartFilter_Model filter)
    {
        var data = await _svc.GetAllSpareParts(filter);
        return Ok(data);
    }

    // GET: api/SparePart/{id}
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,CompanyAdmin")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _svc.GetSparePartById(id);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // POST: api/SparePart
    [HttpPost]
    [Authorize(Roles = "Admin,CompanyAdmin")]
    public async Task<IActionResult> Create([FromBody] SparePartRequest_Model request)
    {
        var result = await _svc.CreateSparePart(request);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // PUT: api/SparePart/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,CompanyAdmin")]
    public async Task<IActionResult> Update(int id, [FromBody] SparePartRequest_Model request)
    {
        request.SparePartId = id;
        var result = await _svc.UpdateSparePart(request);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // DELETE: api/SparePart/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,CompanyAdmin")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _svc.DeleteSparePart(id);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // POST: api/SparePart/bulk-delete
    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin,CompanyAdmin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteRequest request)
    {
        var result = await _svc.BulkDeleteSpareParts(request.Ids);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // GET: api/SparePart/dropdown
    [HttpGet("dropdown")]
    [Authorize(Roles = "Admin,CompanyAdmin,Technician")]
    public async Task<IActionResult> GetDropdown()
    {
        var result = await _svc.GetSparePartDropdown();
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }
}


    

public class BulkDeleteRequest
{
    public string Ids { get; set; }
}


// Inline DTO for status update
public class UpdateSpareStatusDto
{
    public string Status { get; set; } = string.Empty;
    /// <summary>Required when Status is Rejected.</summary>
    public string? RejectReason { get; set; }
    /// <summary>Cost per unit, fixed at approval (defaults to the catalog price).</summary>
    public decimal? UnitPrice { get; set; }
    /// <summary>Approve a catalog part although the stock is short (to be purchased).</summary>
    public bool ApproveWithoutStock { get; set; }
}
