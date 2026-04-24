using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CompanyController : ControllerBase
    {
        private readonly IAuthService _authService;
        public CompanyController(IAuthService authService) => _authService = authService;

        // ============================================
        // COMPANY USER MANAGEMENT
        // ============================================

        [HttpGet("users")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetCompanyUsers()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.GetCompanyUsersWithDetails(companyId);
            return Ok(result);
        }

        [HttpPut("users/{targetUserId}/role")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> UpdateUserRole(int targetUserId, [FromBody] UpdateUserRoleDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.UpdateUserRoleInCompany(companyId, targetUserId, dto.NewRole, userId);
            return Ok(result);
        }

        [HttpDelete("users/{targetUserId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> RemoveUserFromCompany(int targetUserId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.RemoveUserFromCompany(companyId, targetUserId, userId);
            return Ok(result);
        }

        // ============================================
        // INVITATIONS (ADDED MISSING ENDPOINT)
        // ============================================

        [HttpPost("invite")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> InviteUser([FromBody] InviteUserRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.InviteUser(companyId, dto.Email, dto.RoleInCompany, userId, dto.Remarks);
            return Ok(result);
        }
   
        [HttpGet("invitations")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetPendingInvitations()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.GetPendingInvitationsForCompany(companyId);
            return Ok(result);
        }

        [HttpDelete("invitations/{invitationId}")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> CancelInvitation(int invitationId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CancelInvitation(invitationId, userId);
            return Ok(result);
        }

        // ============================================
        // JOIN REQUESTS
        // ============================================

        [HttpGet("requests")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetPendingJoinRequests()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.GetPendingJoinRequests(companyId);
            return Ok(result);
        }

        [HttpPost("requests")]
        [Authorize]
        public async Task<IActionResult> CreateJoinRequest([FromBody] CreateJoinRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CreateJoinRequest(userId, dto.CompanyId, dto.RequestedRole, dto.Remarks);
            return Ok(result);
        }

        [HttpPut("requests/{requestId}/approve")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> ApproveJoinRequest(int requestId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.ApproveJoinRequest(requestId, companyId, userId);
            return Ok(result);
        }

        [HttpPut("requests/{requestId}/reject")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> RejectJoinRequest(int requestId, [FromBody] string reason)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var companyId = await GetCurrentCompanyId();

            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var result = await _authService.RejectJoinRequest(requestId, companyId, userId, reason);
            return Ok(result);
        }

        // ============================================
        // COMPANY LIST
        // ============================================

        [HttpGet("all")]
        [Authorize]
        public async Task<IActionResult> GetAllCompanies()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetAllCompaniesForUser(userId);
            return Ok(result);
        }

        [HttpGet("available-roles")]
        [Authorize(Roles = "Admin,CompanyAdmin")]
        public async Task<IActionResult> GetAvailableRoles()
        {
            var result = await _authService.GetAvailableRoles();
            return Ok(result);
        }

        // ============================================
        // CREATE COMPANY (DISABLED)
        // ============================================

        [HttpPost("create")]
        public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CreateCompany(dto.CompanyName, dto.CompanyCode, userId);
            return Ok(result);
        }
        [HttpGet("my-requests")]
        [Authorize]
        public async Task<IActionResult> GetMyJoinRequests()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetMyJoinRequests(userId);
            return Ok(result);
        }

        [HttpDelete("requests/{requestId}")]
        [Authorize]
        public async Task<IActionResult> CancelMyJoinRequest(int requestId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.CancelJoinRequest(requestId, userId);
            return Ok(result);
        }
        // ============================================
        // HELPER METHODS
        // ============================================

        private async Task<int> GetCurrentCompanyId()
        {
            var companyIdClaim = User.FindFirst("CompanyId")?.Value;
            return companyIdClaim != null ? int.Parse(companyIdClaim) : 0;
        }
    }
}