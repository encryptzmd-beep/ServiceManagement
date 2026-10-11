using EncryptzBL.Common.Tenant;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Provisioning;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ICompanyProvisioningService _provisioning;
        public AuthController(IAuthService authService, ICompanyProvisioningService provisioning)
        {
            _authService = authService;
            _provisioning = provisioning;
        }

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
            var result = await _authService.SaveUser(req, GetCurrentCompanyId(), userId);
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

        [HttpDelete("roles/{roleId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteRole(int roleId)
        {
            var result = await _authService.DeleteRole(roleId);
            if (!result.Success) return BadRequest(result);
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

        // ── MODULE / BRANCH SCOPING (Company -> Modules -> Branches) ──────

        [HttpGet("modules")]
        [Authorize]
        public async Task<IActionResult> GetModules()
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            return Ok(await _authService.GetModules(userId, companyId));
        }

        /// <summary>For the deployed UI: the Service module as the company's one "project".</summary>
        [HttpGet("projects")]
        [Authorize]
        public async Task<IActionResult> GetProjects([FromQuery] int companyId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetProjects(userId, companyId);
            return Ok(result);
        }

        /// <summary>
        /// Branches of the selected company. The company comes from the token.
        /// projectId is ignored (sent by the deployed UI).
        /// </summary>
        [HttpGet("locations")]
        [Authorize]
        public async Task<IActionResult> GetLocations([FromQuery] string? moduleKey = null, [FromQuery] int projectId = 0)
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetLocations(userId, companyId, ModuleOrService(moduleKey));
            return Ok(result);
        }

        [HttpPost("set-scope")]
        [Authorize]
        public async Task<IActionResult> SetScope([FromBody] SetScopeRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            // the company comes from the token, like modules and locations; the body cannot move it
            var (companyId, error) = ScopeCompany.Resolve(GetCurrentCompanyId(), dto.CompanyId);
            if (error != null)
                return Ok(ApiResponse<LoginResponseDto>.Fail(error));

            var result = await _authService.SetScope(userId, companyId, ModuleOrService(dto.ModuleKey), dto.LocationId);
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

        [Authorize]
        [HttpPost("accept-invitation")]
        public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.AcceptInvitation(dto.Token, userId);
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

        // Any logged-in user (the identity token is enough): this is how a company comes to exist.
        [HttpPost("create-company")]
        [Authorize]
        [EnableRateLimiting(RateLimitPolicies.CompanyCreation)]
        public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyRequest req)
            => Ok(await _provisioning.CreateCompany(req, CurrentUserId(), IsPlatformAdmin()));

        [HttpPost("companies/{companyId}/retry-provision")]
        [Authorize]
        [EnableRateLimiting(RateLimitPolicies.CompanyCreation)]
        public async Task<IActionResult> RetryProvision(int companyId)
            => Ok(await _provisioning.RetryProvision(companyId, CurrentUserId(), IsPlatformAdmin()));

        [HttpGet("company-creation")]
        [Authorize]
        public async Task<IActionResult> GetCompanyCreation()
            => Ok(await _provisioning.GetCreationState(CurrentUserId(), IsPlatformAdmin()));

        private int CurrentUserId()
            => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        // the same claim PlatformController.Actor() reads
        private bool IsPlatformAdmin()
            => User.FindFirst("PlatformAdmin")?.Value == "true";

        #endregion

        #region Customer Portal Actions

        // Anonymous by design (the login page needs it before anyone is signed in),
        // so it is rate limited to stop company codes being enumerated.
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.PublicLookup)]
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

        private static string ModuleOrService(string? moduleKey)
            => string.IsNullOrWhiteSpace(moduleKey) ? ModuleAccess.ServiceModuleKey : moduleKey.Trim().ToUpperInvariant();

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
