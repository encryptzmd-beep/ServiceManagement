using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Job Consultancy (commercial application): candidates, clients and placements. The person
    /// is the main-database user of the token and the company is the company of the token;
    /// neither is ever a value of the request. Whether the company has Job Consultancy and the
    /// person may use it is decided by the service on every call (HiringAccess): a refusal is
    /// answered with 403. A candidate is named by a random key, never by a user id.
    /// </summary>
    [ApiController]
    [Route("api/consultancy")]
    [Authorize]
    public class ConsultancyController : ControllerBase
    {
        private readonly IConsultancyService _consultancy;

        public ConsultancyController(IConsultancyService consultancy) => _consultancy = consultancy;

        private int Caller() => MainIdentity.UserId(User);

        private int Company()
            => int.TryParse(User.FindFirst("CompanyId")?.Value, System.Globalization.NumberStyles.None,
                   System.Globalization.CultureInfo.InvariantCulture, out var id) ? id : 0;

        private IActionResult Answer<T>(ApiResponse<T> result)
            => !result.Success && HiringAccess.IsRefusal(result.Message)
                ? StatusCode(StatusCodes.Status403Forbidden, result)
                : Ok(result);

        // ── clients ───────────────────────────────────────────────────────────

        [HttpGet("clients")]
        public async Task<IActionResult> GetClients()
            => Answer(await _consultancy.GetClients(Caller(), Company()));

        [HttpPost("clients")]
        public async Task<IActionResult> SaveClient([FromBody] ConsultClientDto dto)
            => Answer(await _consultancy.SaveClient(Caller(), Company(), dto));

        [HttpDelete("clients/{id:int}")]
        public async Task<IActionResult> DeleteClient(int id)
            => Answer(await _consultancy.DeleteClient(Caller(), Company(), id));

        [HttpGet("posting-clients")]
        public async Task<IActionResult> GetPostingClients()
            => Answer(await _consultancy.GetPostingClients(Caller(), Company()));

        [HttpPost("postings/{id:int}/client")]
        public async Task<IActionResult> SetPostingClient(int id, [FromBody] SetPostingClientRequest? req)
            => Answer(await _consultancy.SetPostingClient(Caller(), Company(), id, req?.ClientId));

        // ── candidates ────────────────────────────────────────────────────────

        [HttpGet("candidates")]
        public async Task<IActionResult> SearchCandidates([FromQuery] string? q, [FromQuery] string? city, [FromQuery] int? years,
            [FromQuery] string? mode, [FromQuery] bool pool, [FromQuery] int? page)
            => Answer(await _consultancy.SearchCandidates(Caller(), Company(), q, city, years, mode, pool, page));

        [HttpGet("candidates/{key:guid}")]
        public async Task<IActionResult> GetCandidate(Guid key)
            => Answer(await _consultancy.GetCandidate(Caller(), Company(), key));

        /// <summary>The resume of a candidate, as a download. Anything that is not theirs to see is "not found".</summary>
        [HttpGet("candidates/{key:guid}/resume")]
        public async Task<IActionResult> GetCandidateResume(Guid key)
        {
            var result = await _consultancy.GetCandidateResume(Caller(), Company(), key);
            if (!result.Success || result.Data == null)
                return HiringAccess.IsRefusal(result.Message)
                    ? StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail(result.Message!))
                    : NotFound(ApiResponse<string>.Fail(result.Message ?? "Not found"));

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, JobsRules.ContentTypeFor(result.Data.FileName), result.Data.FileName);
        }

        [HttpPost("candidates/{key:guid}/pool")]
        public async Task<IActionResult> SaveTalent(Guid key, [FromBody] TalentSaveRequest? req)
            => Answer(await _consultancy.SaveTalent(Caller(), Company(), key, req ?? new TalentSaveRequest()));

        [HttpDelete("candidates/{key:guid}/pool")]
        public async Task<IActionResult> RemoveTalent(Guid key)
            => Answer(await _consultancy.RemoveTalent(Caller(), Company(), key));

        [HttpPost("candidates/{key:guid}/invite")]
        public async Task<IActionResult> InviteCandidate(Guid key, [FromBody] CandidateInviteRequest? req)
            => Answer(await _consultancy.InviteCandidate(Caller(), Company(), key, req ?? new CandidateInviteRequest()));

        // ── placements ────────────────────────────────────────────────────────

        [HttpGet("placements")]
        public async Task<IActionResult> GetPlacements()
            => Answer(await _consultancy.GetPlacements(Caller(), Company()));

        [HttpPost("placements")]
        public async Task<IActionResult> SavePlacement([FromBody] PlacementSaveRequest req)
            => Answer(await _consultancy.SavePlacement(Caller(), Company(), req));

        [HttpDelete("placements/{id:int}")]
        public async Task<IActionResult> DeletePlacement(int id)
            => Answer(await _consultancy.DeletePlacement(Caller(), Company(), id));
    }
}
