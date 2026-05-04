using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using EncryptzBL.Infrastructure.Payments.Modules;
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

        public PaymentsController(IPaymentService paymentService, IAuthService authService)
        {
            _paymentService = paymentService;
            _authService = authService;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(userIdStr, out var id) ? id : 0;
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
            var result = await _paymentService.GetComplaintPayments(complaintId);
            return Ok(new { data = result });
        }

        [HttpPost("Complaint")]
        public async Task<IActionResult> RecordComplaintPayment([FromBody] RecordPaymentRequest request)
        {
            var result = await _paymentService.RecordComplaintPayment(request, GetUserId());
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
            if (loginResult == null )
                return Unauthorized(new { Message = "Invalid admin password. Modification not allowed." });

            var result = await _paymentService.UpdatePayment(request, GetUserId());
            return Ok(result);
        }

    }
}
