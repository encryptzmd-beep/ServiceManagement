using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        public AuthController(IAuthService authService) => _authService = authService;

        [HttpPost("send-otp")]
        public async Task<IActionResult> SendOtp([FromBody] OtpRequestDto dto)
            => Ok(await _authService.GenerateOtp(dto.MobileNumber));

        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtp([FromBody] OtpValidateDto dto)
            => Ok(await _authService.ValidateOtp(dto.MobileNumber, dto.OtpCode));

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
            => Ok(await _authService.Login(dto.Email, dto.Password));

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
            => Ok(await _authService.Register(dto));

        [HttpGet("menus/{roleId}")]
        [Authorize]
        public async Task<IActionResult> GetMenus(int roleId)
            => Ok(await _authService.GetMenusByRole(roleId));

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var result = await _authService.GetUsers();
            return Ok(result);
        }

        [HttpPost("users/save")]
        public async Task<IActionResult> SaveUser([FromBody] SaveUserRequest req)
        {
            var result = await _authService.SaveUser(req);
            return Ok(result);
        }

        // ── ROLES ─────────────────────────────

        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            var result = await _authService.GetRoles();
            return Ok(result);
        }

        [HttpPost("roles/save")]
        public async Task<IActionResult> SaveRole([FromBody] SaveRoleRequest req)
        {
            var result = await _authService.SaveRole(req);
            return Ok(result);
        }

        // ── MENU ACCESS ───────────────────────

        [HttpGet("menu-access/{roleId}")]
        public async Task<IActionResult> GetMenuAccess(int roleId)
        {
            var result = await _authService.GetMenuAccess(roleId);
            return Ok(result);
        }

        [HttpPost("menu-access/save-bulk")]
        public async Task<IActionResult> SaveMenuAccessBulk([FromBody] SaveMenuAccessBulkRequest req)
        {
            var result = await _authService.SaveMenuAccessBulk(req);
            return Ok(result);
        }
        // Controllers/AuthController.cs (ADD THESE NEW ACTIONS)

        #region Multi-Company Actions

        [HttpPost("self-register")]
        public async Task<IActionResult> SelfRegister([FromBody] SelfRegisterDto dto)
        {
            var result = await _authService.SelfRegister(dto);
            return Ok(result);
        }

        [HttpPost("login-v2")]
        public async Task<IActionResult> LoginWithCompanies([FromBody] LoginRequestDto dto)
        {
            var result = await _authService.LoginWithCompanies(dto.Email, dto.Password);
            return Ok(result);
        }

        [HttpPost("select-company")]
        [AllowAnonymous]
        public async Task<IActionResult> SelectCompany([FromBody] SelectCompanyRequestDto dto)
        {
            var result = await _authService.SelectCompany(dto.UserId, dto.CompanyId);
            return Ok(result);
        }

        [HttpGet("user-companies")]
        [Authorize]
        public async Task<IActionResult> GetUserCompanies()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetUserCompanies(userId);
            return Ok(result);
        }

        [HttpPost("invite-user")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> InviteUser([FromBody] InviteUserRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.InviteUser(companyId, dto.Email, dto.RoleInCompany, userId, dto.Remarks);
            return Ok(result);
        }

        [AllowAnonymous]
        [HttpPost("accept-invitation")]
        public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationRequestDto dto)
        {
            var result = await _authService.AcceptInvitation(dto.Token, dto.UserId);
            return Ok(result);
        }
        // CompanyController.cs - ADD THIS METHOD (based on your existing pattern)

        [HttpDelete("invitations/{invitationId}/reject")]
        [Authorize]
        public async Task<IActionResult> RejectInvitation(int invitationId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.RejectInvitation(invitationId, userId);
            return Ok(result);
        }
        [HttpGet("pending-invitations")]
        public async Task<IActionResult> GetPendingInvitations([FromQuery] string email)
        {
            var result = await _authService.GetPendingInvitations(email);
            return Ok(result);
        }

        [HttpGet("check-user")]
        public async Task<IActionResult> CheckUserExists([FromQuery] string email)
        {
            var result = await _authService.CheckUserExists(email);
            return Ok(result);
        }

        [HttpGet("company-users")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetCompanyUsers()
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.GetCompanyUsers(companyId);
            return Ok(result);
        }

        [HttpGet("available-roles")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetAvailableRoles()
        {
            var result = await _authService.GetAvailableRoles();
            return Ok(result);
        }

        [HttpPost("create-company")]
        public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CreateCompany(dto.CompanyName, dto.CompanyCode, userId);
            return Ok(result);
        }

        #endregion

        #region Customer Portal Actions

        [HttpPost("customer/register")]
        public async Task<IActionResult> CustomerRegister([FromBody] CustomerRegisterDto dto)
        {
            var result = await _authService.CustomerRegister(dto);
            return Ok(result);
        }

        [HttpPost("customer/login")]
        public async Task<IActionResult> CustomerLogin([FromBody] CustomerLoginRequestDto dto)
        {
            var result = await _authService.CustomerLogin(dto.Email, dto.Password);
            return Ok(result);
        }

        [HttpGet("customer/dashboard")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetCustomerDashboard()
        {
            var customerPortalId = int.Parse(User.FindFirst("CustomerPortalId")?.Value ?? "0");
            var result = await _authService.GetCustomerDashboard(customerPortalId);
            return Ok(result);
        }

        #endregion

        #region Helper

        private int GetCurrentCompanyId()
        {
            var companyIdClaim = User.FindFirst("CompanyId")?.Value;
            return companyIdClaim != null ? int.Parse(companyIdClaim) : 0;
        }
        [HttpGet("users/search")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> SearchUsers([FromQuery] string searchTerm)
        {
            var result = await _authService.SearchUsers(searchTerm);
            return Ok(result);
        }
        #endregion
    }
}
