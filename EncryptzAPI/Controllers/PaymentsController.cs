using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using EncryptzBL.Infrastructure.Payments.Modules;
using EncryptzBL.Infrastructure.Technician.modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;

namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly IAuthService _authService;
        private readonly ITechnicianService _technicians;

        public PaymentsController(IPaymentService paymentService, IAuthService authService, ITechnicianService technicians)
        {
            _paymentService = paymentService;
            _authService = authService;
            _technicians = technicians;
        }

        private int GetUserId()
        {
            return User.GetTenantUserId();
        }

        [HttpGet("ServiceCharge")]
        public async Task<IActionResult> GetDefaultServiceCharge()
        {
            var amount = await _paymentService.GetDefaultServiceCharge();
            return Ok(new { data = amount });
        }

        [HttpPut("ServiceCharge")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> UpdateDefaultServiceCharge([FromBody] decimal amount)
        {
            if (amount < 0 || amount > 9_999_999.99m)
                return BadRequest(new { success = false, message = "Service charge must be zero or more" });

            var result = await _paymentService.UpdateDefaultServiceCharge(amount, GetUserId());
            return Ok(result);
        }

        [HttpGet("UPI")]
        public async Task<IActionResult> GetUPIConfigurations()
        {
            var result = await _paymentService.GetUPIConfigurations();
            return Ok(new { data = result });
        }

        [HttpPost("UPI")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> AddUPIConfiguration([FromBody] UPIConfigurationDto dto)
        {
            var result = await _paymentService.AddUPIConfiguration(dto.UpiId, dto.DisplayName, GetUserId());
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("UPI/{id}/Default")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> SetDefaultUPI(int id)
        {
            var result = await _paymentService.SetDefaultUPI(id, GetUserId());
            return Ok(result);
        }

        [HttpPut("UPI/{id}/Toggle")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> ToggleUPIStatus(int id)
        {
            var result = await _paymentService.ToggleUPIStatus(id, GetUserId());
            return Ok(result);
        }

        [HttpDelete("UPI/{id}")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> DeleteUPIConfiguration(int id)
        {
            var result = await _paymentService.DeleteUPIConfiguration(id);
            return Ok(result);
        }

        [HttpGet("Complaint/{complaintId}")]
        public async Task<IActionResult> GetComplaintPayments(int complaintId)
        {
            if (User.IsTechnicianScoped() && !await _technicians.IsComplaintAssignedTo(complaintId, User.GetTechnicianId()))
                return this.Forbidden("This complaint is not assigned to you");

            var result = await _paymentService.GetComplaintPayments(complaintId);
            return Ok(new { data = result });
        }

        [HttpPost("Complaint")]
        public async Task<IActionResult> RecordComplaintPayment([FromBody] RecordPaymentRequest request)
        {
            // the complaint id comes from the body: a technician collects only on the own job
            if (User.IsTechnicianScoped())
            {
                var technicianId = User.GetTechnicianId();
                if (!await _technicians.IsComplaintAssignedTo(request.ComplaintId, technicianId))
                    return this.Forbidden("This complaint is not assigned to you");
                if (!await _technicians.IsCheckedIn(technicianId))
                    return BadRequest(new { success = false, message = "Please check in before recording a payment" });
            }

            var result = await _paymentService.RecordComplaintPayment(request, GetUserId());
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("All")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> GetAllPayments()
        {
            var result = await _paymentService.GetAllPayments();
            return Ok(new { data = result });
        }

        [HttpPut("Update")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> UpdatePayment([FromBody] UpdatePaymentRequest request)
        {
            // Verify password
            var email = User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrEmpty(email)) return Unauthorized("User email not found in token");

            var loginResult = await _authService.Login(email, request.AdminPassword);
            if (loginResult == null)
            {
                return Unauthorized(new { Message = "Invalid admin password. Modification not allowed." });
            }

            var result = await _paymentService.UpdatePayment(request, GetUserId());
            return Ok(result);
        }
        [HttpGet("Allpay")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> GetAllPayments1()
        {
            var result = await _paymentService.GetAllPayments();
            return Ok(new { data = result });
        }

        [HttpPut("Updatepay")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> UpdatePayment1([FromBody] UpdatePaymentRequest request)
        {
            // Verify admin password via auth service
            var email = User.FindFirstValue(ClaimTypes.Email);

            var loginResult = await _authService.Login(email, request.AdminPassword);
            if (loginResult.Data == null )
                return Unauthorized(new { Message = "Invalid admin password. Modification not allowed." });

            var result = await _paymentService.UpdatePayment(request, GetUserId());
            return Ok(result);
        }

        [HttpPut("Verify")]
        [Authorize(Roles = "Admin,CompanyAdmin,Manager")]
        public async Task<IActionResult> VerifyPayment([FromBody] VerifyPaymentRequest request)
        {
            var result = await _paymentService.VerifyPayment(request, GetUserId());
            return Ok(result);
        }

    }
}
