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
        [Authorize(Roles = "Admin,CompanyAdmin")]   // creates a login WITH a role: never anonymous (self-register has no role)
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
            => Ok(await _authService.Register(dto));

        [AllowAnonymous]
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto dto)
            => Ok(await _authService.ForgotPasswordAsync(dto));

        [AllowAnonymous]
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto dto)
            => Ok(await _authService.ResetPasswordAsync(dto));

        [AllowAnonymous]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto dto)
        {
            // Try to extract user ID from token
          
         if (string.IsNullOrEmpty(dto.Username))
            {
                return Unauthorized(ApiResponse<string>.Fail("Unauthorized or Username missing"));
            }
            
            return Ok(await _authService.ChangePasswordAsync(dto));
        }

        // ── MY PROFILE ────────────────────────

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            return Ok(await _authService.GetMyProfile(userId, GetCurrentCompanyId()));
        }

        [HttpPut("me")]
        [Authorize]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            return Ok(await _authService.UpdateMyProfile(userId, GetCurrentCompanyId(), dto));
        }

        [HttpPost("me/change-password")]
        [Authorize]
        public async Task<IActionResult> ChangeMyPassword([FromBody] ChangeMyPasswordDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            return Ok(await _authService.ChangeMyPassword(userId, dto));
        }

        [HttpGet("menus/{roleId}")]
        [Authorize]
        public async Task<IActionResult> GetMenus(int roleId)
            => Ok(await _authService.GetMenusByRole(roleId));

        [HttpGet("users")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetUsers()
        {
            var result = await _authService.GetUsers(GetCurrentCompanyId());
            return Ok(result);
        }

        [HttpPost("users/save")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> SaveUser([FromBody] SaveUserRequest req)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var projectId = int.Parse(User.FindFirst("ProjectId")?.Value ?? "0");
            var result = await _authService.SaveUser(req, GetCurrentCompanyId(), projectId, userId);
            return Ok(result);
        }

        // ── ROLES ─────────────────────────────

        [HttpGet("roles")]
        [Authorize]
        public async Task<IActionResult> GetRoles()
        {
            var result = await _authService.GetRoles();
            return Ok(result);
        }

        [HttpPost("roles/save")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SaveRole([FromBody] SaveRoleRequest req)
        {
            var result = await _authService.SaveRole(req);
            return Ok(result);
        }

        // ── MENU ACCESS ───────────────────────

        [HttpGet("menu-access/{roleId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetMenuAccess(int roleId)
        {
            var result = await _authService.GetMenuAccess(roleId);
            return Ok(result);
        }

        [HttpPost("menu-access/save-bulk")]
        [Authorize(Roles = "Admin")]
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
        [Authorize]
        public async Task<IActionResult> SelectCompany([FromBody] SelectCompanyRequestDto dto)
        {
            // The user is the one who logged in (token), never a userId sent by the client
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.SelectCompany(userId, dto.CompanyId);
            return Ok(result);
        }

        // ── PROJECT / LOCATION SCOPING (Client -> Projects -> Locations) ──────

        [HttpGet("projects")]
        [Authorize]
        public async Task<IActionResult> GetProjects([FromQuery] int companyId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetProjects(userId, companyId);
            return Ok(result);
        }

        [HttpGet("locations")]
        [Authorize]
        public async Task<IActionResult> GetLocations([FromQuery] int projectId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetLocations(userId, projectId);
            return Ok(result);
        }

        [HttpPost("set-scope")]
        [Authorize]
        public async Task<IActionResult> SetScope([FromBody] SetScopeRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.SetScope(userId, dto.CompanyId, dto.ProjectId, dto.LocationId);
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

            var result = await _authService.InviteUser(companyId, dto.Email, dto.RoleInCompany, userId, dto.projectID, dto.Remarks);
            return Ok(result);
        }

        [Authorize]
        [HttpPost("accept-invitation")]
        public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.AcceptInvitation(dto.Token, userId, dto.projectId);
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
        [Authorize]
        public async Task<IActionResult> GetPendingInvitations()
        {
            // Only the logged-in user's own invitations
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? "";
            var result = await _authService.GetPendingInvitations(email);
            return Ok(result);
        }

        [HttpGet("check-user")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
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
        [Authorize]
        public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CreateCompany(dto.CompanyName, dto.CompanyCode, userId);
            return Ok(result);
        }

        #endregion

        #region Customer Portal Actions

        [AllowAnonymous]
        [HttpGet("customer/resolve-tenant")]
        public async Task<IActionResult> ResolveCustomerTenant([FromQuery] string companyCode)
            => Ok(await _authService.ResolveCustomerTenant(companyCode));

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
