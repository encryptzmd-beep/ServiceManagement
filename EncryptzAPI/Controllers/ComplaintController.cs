using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Complients.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ComplaintController : ControllerBase
    {
        private readonly IComplaintService _svc;
        private readonly DbHelper _db; // Use DbHelper instead of AppDbContext

        public ComplaintController(IComplaintService svc, DbHelper db)
        {
            _svc = svc;
            _db = db;
        }

        private int GetUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        }

        // 🔹 Helper: Get CustomerId from UserId (SP based)
        private async Task<int?> GetCustomerId()
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", GetUserId())
            };

            var dt = await _db.ExecuteDataTableAsync("sp_GetCustomerIdByUserId", parameters);

            if (dt.Rows.Count == 0)
                return null;

            return Convert.ToInt32(dt.Rows[0]["CustomerId"]);
        }

        // 🔹 CREATE (Matches: Create(int customerId, ComplaintCreateDto dto))
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ComplaintCreateDto dto)
        {
            var customerId = await GetCustomerId();

            if (customerId == null)
                return BadRequest(new ApiResponse(false, "Customer not found"));

            var result = await _svc.Create(customerId.Value, dto);
            return Ok(result);
        }

        // 🔹 GET ALL (Matches interface)
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] ComplaintFilterDto filter)
        {
            var result = await _svc.GetAll(filter);
            return Ok(result);
        }

        // 🔹 GET BY ID
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _svc.GetById(id);
            return Ok(result);
        }

        // 🔹 UPDATE STATUS (Matches: UpdateStatus(int id, int userId, dto))
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] ComplaintUpdateStatusDto dto)
        {
            var result = await _svc.UpdateStatus(id, GetUserId(), dto);
            return Ok(result);
        }

        // 🔹 CONFIRM CLOSURE (Matches: ConfirmClosure(int complaintId, int customerId))
        [HttpPost("{id}/confirm-closure")]
        public async Task<IActionResult> ConfirmClosure(int id)
        {
            var customerId = await GetCustomerId();

            if (customerId == null)
                return BadRequest(new ApiResponse(false, "Customer not found"));

            var result = await _svc.ConfirmClosure(id, customerId.Value);
            return Ok(result);
        }

        // 🔹 GET MY COMPLAINTS (Matches: GetByCustomer(int customerId))
        [HttpGet("my-complaints")]
        public async Task<IActionResult> GetMyComplaints()
        {
            var customerId = await GetCustomerId();

            if (customerId == null)
                return BadRequest(new ApiResponse(false, "Customer not found"));

            var result = await _svc.GetByCustomer(customerId.Value);
            return Ok(result);
        }
    }
}