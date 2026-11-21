using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>The caller's own rights in one module, so the screens can disable what is not allowed.</summary>
    [ApiController]
    [Route("api/menu-rights")]
    [Authorize]
    public class MenuRightsController : ControllerBase
    {
        private static readonly string[] Modules = { "SERVICE", "CRM", "JOBCONSULTANCY" };

        private readonly IMenuRightsService _rights;

        public MenuRightsController(IMenuRightsService rights) => _rights = rights;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string? module)
        {
            var key = (module ?? "").Trim().ToUpperInvariant();
            if (!Modules.Contains(key)) return BadRequest(ApiResponse<string>.Fail("Unknown module"));

            var companyId = int.TryParse(User.FindFirst("CompanyId")?.Value, out var id) ? id : 0;
            var rights = await _rights.GetRights(MainIdentity.UserId(User), companyId, key, User.FindFirst("PlatformAdmin")?.Value == "true");

            return Ok(ApiResponse<object>.Ok(new
            {
                fullAccess = rights.FullAccess,
                items = rights.Rows.Values.Select(r => new { path = r.Path, r.CanView, r.CanCreate, r.CanEdit, r.CanDelete })
            }));
        }
    }
}
