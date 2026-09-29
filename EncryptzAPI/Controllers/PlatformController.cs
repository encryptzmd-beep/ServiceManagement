using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Platform administration (MainDB): companies, projects and their database,
    /// locations, project access and the menu tree.
    ///
    /// A platform administrator (global role Admin -> PlatformAdmin claim) manages every
    /// company. A company's own Admin / CompanyAdmin manages that company only; the
    /// service enforces it per operation.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PlatformController : ControllerBase
    {
        private readonly IPlatformService _service;
        private readonly IPlatformUnlockService _unlock;

        public PlatformController(IPlatformService service, IPlatformUnlockService unlock)
        {
            _service = service;
            _unlock = unlock;
        }

        // ── ACCESS CODE (the only endpoints that work while the screen is locked) ──

        [HttpGet("otp/status")]
        public IActionResult UnlockStatus()
            => Ok(new { success = true, unlocked = _unlock.IsUnlocked(Request.Headers[PlatformUnlockedAttribute.HeaderName].FirstOrDefault(), Actor().UserId) });

        [HttpPost("otp/send")]
        public async Task<IActionResult> SendOtp()
            => Ok(await _unlock.SendOtp(Actor()));

        [HttpPost("otp/verify")]
        public async Task<IActionResult> VerifyOtp([FromBody] PlatformOtpRequest req)
            => Ok(await _unlock.VerifyOtp(Actor(), req?.Code));

        // ── COMPANIES ─────────────────────────────

        [PlatformUnlocked]
        [HttpGet("companies")]
        public async Task<IActionResult> GetCompanies()
            => Ok(await _service.GetCompanies(Actor()));

        [PlatformUnlocked]
        [HttpPost("companies/save")]
        public async Task<IActionResult> SaveCompany([FromBody] PlatformCompanyDto dto)
            => Ok(await _service.SaveCompany(dto, Actor()));

        // ── PROJECTS + DATABASE ───────────────────

        [PlatformUnlocked]
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int companyId = 0)
            => Ok(await _service.GetProjects(companyId, Actor()));

        [PlatformUnlocked]
        [HttpPost("projects/save")]
        public async Task<IActionResult> SaveProject([FromBody] SaveProjectRequest req)
            => Ok(await _service.SaveProject(req, Actor()));

        [PlatformUnlocked]
        [HttpPost("projects/test-connection")]
        public async Task<IActionResult> TestConnection([FromBody] SaveProjectRequest req)
            => Ok(await _service.TestConnection(req, Actor()));

        // ── LOCATIONS ─────────────────────────────

        [PlatformUnlocked]
        [HttpGet("projects/{projectId}/locations")]
        public async Task<IActionResult> GetLocations(int projectId)
            => Ok(await _service.GetLocations(projectId, Actor()));

        [PlatformUnlocked]
        [HttpPost("projects/{projectId}/locations/save")]
        public async Task<IActionResult> SaveLocation(int projectId, [FromBody] PlatformLocationDto dto)
            => Ok(await _service.SaveLocation(projectId, dto, Actor()));

        // ── PROJECT ACCESS ────────────────────────

        [PlatformUnlocked]
        [HttpGet("projects/{projectId}/access")]
        public async Task<IActionResult> GetProjectAccess(int projectId)
            => Ok(await _service.GetProjectAccess(projectId, Actor()));

        [PlatformUnlocked]
        [HttpPost("projects/{projectId}/access")]
        public async Task<IActionResult> SetProjectAccess(int projectId, [FromBody] SetProjectAccessRequest req)
            => Ok(await _service.SetProjectAccess(projectId, req, Actor()));

        // ── MENU TREE ─────────────────────────────

        [PlatformUnlocked]
        [HttpGet("menus")]
        public async Task<IActionResult> GetMenus()
            => Ok(await _service.GetMenus(Actor()));

        [PlatformUnlocked]
        [HttpPost("menus/save")]
        public async Task<IActionResult> SaveMenu([FromBody] PlatformMenuDto dto)
            => Ok(await _service.SaveMenu(dto, Actor()));

        // ── HELPER ────────────────────────────────

        private PlatformActor Actor()
        {
            var companyId = int.TryParse(User.FindFirst("CompanyId")?.Value, out var c) ? c : 0;

            return new PlatformActor
            {
                UserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0"),
                UserName = User.FindFirst(ClaimTypes.Name)?.Value ?? "",
                IsPlatformAdmin = User.FindFirst("PlatformAdmin")?.Value == "true",
                // the role claim of a company token is the role IN that company
                IsCompanyAdmin = companyId > 0 && (User.IsInRole("Admin") || User.IsInRole("CompanyAdmin")),
                CompanyId = companyId
            };
        }
    }
}
