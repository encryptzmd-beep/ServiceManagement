using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Job Consultancy, the candidates a company adds itself: kept in the company's own database,
    /// never public, never on Job Portal. The person is the main-database user of the token and the
    /// company is the company of the token; whether the company has Job Consultancy and the person
    /// may use it is decided by the service on every call (HiringAccess): a refusal is a 403.
    /// </summary>
    [ApiController]
    [Route("api/consultancy/own-candidates")]
    [Authorize]
    public class OwnCandidatesController : ControllerBase
    {
        private const long UploadLimit = JobsRules.MaxFileBytes + 256 * 1024;

        private readonly IOwnCandidatesService _candidates;

        public OwnCandidatesController(IOwnCandidatesService candidates) => _candidates = candidates;

        private int Caller() => MainIdentity.UserId(User);

        private int Company()
            => int.TryParse(User.FindFirst("CompanyId")?.Value, System.Globalization.NumberStyles.None,
                   System.Globalization.CultureInfo.InvariantCulture, out var id) ? id : 0;

        private IActionResult Answer<T>(ApiResponse<T> result)
            => !result.Success && HiringAccess.IsRefusal(result.Message)
                ? StatusCode(StatusCodes.Status403Forbidden, result)
                : Ok(result);

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? q, [FromQuery] int? page)
            => Answer(await _candidates.GetOwnCandidates(Caller(), Company(), q, page));

        /// <summary>The company's candidates who already have this e-mail or phone: the form warns before saving.</summary>
        [HttpGet("duplicates")]
        public async Task<IActionResult> GetDuplicates([FromQuery] int? id, [FromQuery] string? email, [FromQuery] string? phone)
            => Answer(await _candidates.FindDuplicates(Caller(), Company(), id ?? 0, email, phone));

        [HttpPost]
        public async Task<IActionResult> Save([FromBody] OwnCandidateDto? dto)
            => Answer(await _candidates.SaveOwnCandidate(Caller(), Company(), dto ?? new OwnCandidateDto()));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
            => Answer(await _candidates.DeleteOwnCandidate(Caller(), Company(), id));

        [HttpPost("{id:int}/resume")]
        [RequestSizeLimit(UploadLimit)]
        public async Task<IActionResult> SaveResume(int id, IFormFile? file)
        {
            if (file == null || file.Length <= 0)
                return Ok(ApiResponse<int>.Fail("Choose a file"));
            if (file.Length > JobsRules.MaxFileBytes)
                return Ok(ApiResponse<int>.Fail("The file is larger than 5 MB"));

            using var memory = new MemoryStream((int)file.Length);
            await file.CopyToAsync(memory);
            return Answer(await _candidates.SaveOwnCandidateResume(Caller(), Company(), id, new JobUpload(file.FileName ?? "", memory.ToArray())));
        }

        [HttpDelete("{id:int}/resume")]
        public async Task<IActionResult> DeleteResume(int id)
            => Answer(await _candidates.SaveOwnCandidateResume(Caller(), Company(), id, null));

        /// <summary>The resume, always as a download the browser must not sniff.</summary>
        [HttpGet("{id:int}/resume")]
        public async Task<IActionResult> GetResume(int id)
        {
            var result = await _candidates.GetOwnCandidateResume(Caller(), Company(), id);
            if (!result.Success || result.Data == null)
                return HiringAccess.IsRefusal(result.Message)
                    ? StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail(result.Message!))
                    : NotFound(ApiResponse<string>.Fail(result.Message ?? "Not found"));

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, JobsRules.ContentTypeFor(result.Data.FileName), result.Data.FileName);
        }
    }
}
