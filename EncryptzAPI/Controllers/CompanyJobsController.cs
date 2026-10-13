using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Job Portal, the company's side: the jobs a company offers and the people who applied.
    /// The person is the main-database user of the token and the company is the company of
    /// the token (the one chosen on the company page); neither is ever a value of the
    /// request. Whether the person may act for the company is decided by the service on
    /// every call (HiringAccess): a refusal is answered with 403.
    /// </summary>
    [ApiController]
    [Route("api/company-jobs")]
    [Authorize]
    public class CompanyJobsController : ControllerBase
    {
        private readonly ICompanyJobsService _jobs;

        public CompanyJobsController(ICompanyJobsService jobs) => _jobs = jobs;

        private int Caller() => MainIdentity.UserId(User);

        /// <summary>The company the token was issued for; 0 when none was chosen yet.</summary>
        private int Company()
            => int.TryParse(User.FindFirst("CompanyId")?.Value, System.Globalization.NumberStyles.None,
                   System.Globalization.CultureInfo.InvariantCulture, out var id) ? id : 0;

        private IActionResult Answer<T>(ApiResponse<T> result)
            => !result.Success && result.Message == HiringAccess.Refused
                ? StatusCode(StatusCodes.Status403Forbidden, result)
                : Ok(result);

        // ── postings ──────────────────────────────────────────────────────────

        [HttpGet("postings")]
        public async Task<IActionResult> GetPostings()
            => Answer(await _jobs.GetCompanyPostings(Caller(), Company()));

        [HttpGet("postings/{id:int}")]
        public async Task<IActionResult> GetPosting(int id)
            => Answer(await _jobs.GetCompanyPosting(Caller(), Company(), id));

        [HttpPost("postings")]
        public async Task<IActionResult> SavePosting([FromBody] JobPostingDto dto)
            => Answer(await _jobs.SaveCompanyPosting(Caller(), Company(), dto));

        [HttpPost("postings/{id:int}/status")]
        public async Task<IActionResult> SetPostingStatus(int id, [FromBody] SetJobStatusRequest? req)
            => Answer(await _jobs.SetCompanyPostingStatus(Caller(), Company(), id, req?.Status));

        [HttpDelete("postings/{id:int}")]
        public async Task<IActionResult> DeletePosting(int id)
            => Answer(await _jobs.DeleteCompanyPosting(Caller(), Company(), id));

        // ── applicants ────────────────────────────────────────────────────────

        [HttpGet("postings/{id:int}/applicants")]
        public async Task<IActionResult> GetApplicants(int id)
            => Answer(await _jobs.GetApplicants(Caller(), Company(), id));

        [HttpGet("postings/{id:int}/applicants/{applicationId:int}")]
        public async Task<IActionResult> GetApplicant(int id, int applicationId)
            => Answer(await _jobs.GetApplicant(Caller(), Company(), id, applicationId));

        /// <summary>The resume of an applicant, as a download. Anything that is not theirs to see is "not found".</summary>
        [HttpGet("postings/{id:int}/applicants/{applicationId:int}/resume")]
        public async Task<IActionResult> GetApplicantResume(int id, int applicationId)
        {
            var result = await _jobs.GetApplicantResume(Caller(), Company(), id, applicationId);
            if (!result.Success || result.Data == null)
                return result.Message == HiringAccess.Refused
                    ? StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.Fail(HiringAccess.Refused))
                    : NotFound(ApiResponse<string>.Fail(result.Message ?? "Not found"));

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, JobsRules.ContentTypeFor(result.Data.FileName), result.Data.FileName);
        }

        [HttpPost("postings/{id:int}/applicants/{applicationId:int}/status")]
        public async Task<IActionResult> SetApplicantStatus(int id, int applicationId, [FromBody] SetJobStatusRequest? req)
            => Answer(await _jobs.SetApplicantStatus(Caller(), Company(), id, applicationId, req?.Status));
    }
}
