using System.Security.Claims;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Users &amp; Roles of the selected company, outside the modules. Open to the tenant admin
    /// and to members the tenant admin granted it; the service checks this on every call.
    /// </summary>
    [ApiController]
    [Route("api/company-access")]
    [Authorize]
    public class CompanyAccessController : ControllerBase
    {
        private readonly ICompanyAccessService _service;

        public CompanyAccessController(ICompanyAccessService service) => _service = service;

        [HttpGet("me")]
        public async Task<IActionResult> GetMe() => Ok(await _service.GetMe(Actor()));

        [HttpGet]
        public async Task<IActionResult> GetOverview() => Ok(await _service.GetOverview(Actor()));

        [HttpPost("roles")]
        public async Task<IActionResult> SaveRole([FromBody] SaveCompanyRoleRequest req)
            => Ok(await _service.SaveRole(req, Actor()));

        [HttpDelete("roles/{companyRoleId:int}")]
        public async Task<IActionResult> DeleteRole(int companyRoleId)
            => Ok(await _service.DeleteRole(companyRoleId, Actor()));

        [HttpPost("users")]
        public async Task<IActionResult> SaveUser([FromBody] SaveCompanyUserRequest req)
            => Ok(await _service.SaveUser(req, Actor()));

        [HttpPost("managers")]
        public async Task<IActionResult> SetManager([FromBody] SetCompanyManagerRequest req)
            => Ok(await _service.SetManager(req, Actor()));

        /// <summary>Who is calling and for which company: from the token, never from the body.</summary>
        private PlatformActor Actor() => new()
        {
            UserId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0,
            UserName = User.FindFirst(ClaimTypes.Name)?.Value ?? "",
            IsPlatformAdmin = User.FindFirst("PlatformAdmin")?.Value == "true",
            CompanyId = int.TryParse(User.FindFirst("CompanyId")?.Value, out var company) ? company : 0
        };
    }
}
