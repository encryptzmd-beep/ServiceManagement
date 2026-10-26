using System.Security.Claims;
using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Platform Admin, Verification: the certificates people uploaded and the jobs companies
    /// want to publish, checked by a platform administrator. Nobody else gets in: the caller
    /// must be a main-database user with the PlatformAdmin claim, and the screen must be
    /// unlocked like every other screen of Platform Admin.
    /// </summary>
    [ApiController]
    [Route("api/platform/verification")]
    [Authorize]
    [PlatformUnlocked]
    public class VerificationController : ControllerBase
    {
        private readonly IVerificationService _verification;

        public VerificationController(IVerificationService verification) => _verification = verification;

        /// <summary>The platform administrator who is logged in, or 0 for anybody else.</summary>
        private int Admin()
            => User.FindFirst("PlatformAdmin")?.Value == "true" ? MainIdentity.UserId(User) : 0;

        private string AdminName() => User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private IActionResult NotAdmin()
            => StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail("Only a platform administrator can verify"));

        [HttpGet]
        public async Task<IActionResult> GetQueue()
            => Admin() == 0 ? NotAdmin() : Ok(await _verification.GetVerificationQueue(Admin()));

        /// <summary>The file of a certificate that waits, to look at it. Always a download the browser must not sniff.</summary>
        [HttpGet("certificates/{id:int}/file")]
        public async Task<IActionResult> GetCertificateFile(int id)
        {
            if (Admin() == 0) return NotAdmin();

            var result = await _verification.GetCertificateFileForReview(Admin(), id);
            if (!result.Success || result.Data == null)
                return NotFound(ApiResponse<string>.Fail(result.Message ?? "Not found"));

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, JobsRules.ContentTypeFor(result.Data.FileName), result.Data.FileName);
        }

        [HttpPost("certificates/{id:int}")]
        public async Task<IActionResult> DecideCertificate(int id, [FromBody] VerificationDecisionRequest? req)
            => Admin() == 0 ? NotAdmin() : Ok(await _verification.DecideCertificate(Admin(), id, req?.Approve ?? false, req?.Note, AdminName()));

        [HttpPost("postings/{id:int}")]
        public async Task<IActionResult> DecidePosting(int id, [FromBody] VerificationDecisionRequest? req)
            => Admin() == 0 ? NotAdmin() : Ok(await _verification.DecidePosting(Admin(), id, req?.Approve ?? false, req?.Note, AdminName()));

        /// <summary>People to verify: show = waiting (not verified), verified or all.</summary>
        [HttpGet("people")]
        public async Task<IActionResult> GetPeople([FromQuery] string? q, [FromQuery] string? show, [FromQuery] int? page)
            => Admin() == 0 ? NotAdmin() : Ok(await _verification.GetPeopleForReview(Admin(), q, show, page));

        /// <summary>Approve = verify the person; otherwise the tick is taken away (a note is needed).</summary>
        [HttpPost("people/{key:guid}")]
        public async Task<IActionResult> DecidePerson(Guid key, [FromBody] VerificationDecisionRequest? req)
            => Admin() == 0 ? NotAdmin() : Ok(await _verification.DecidePerson(Admin(), key, req?.Approve ?? false, req?.Note, AdminName()));
    }
}
