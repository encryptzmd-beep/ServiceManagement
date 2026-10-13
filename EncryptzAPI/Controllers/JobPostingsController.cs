using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Job Portal (personal application): job postings as a person uses them - search, save,
    /// apply, follow. A login is enough, no company is needed. The user is always the
    /// main-database user of the token, never a value of the request.
    /// </summary>
    [ApiController]
    [Route("api/jobs")]
    [Authorize]
    public class JobPostingsController : ControllerBase
    {
        private readonly IJobPostingsService _postings;

        public JobPostingsController(IJobPostingsService postings) => _postings = postings;

        /// <summary>0 for anybody who is not a logged-in user of the main database: the service refuses 0.</summary>
        private int Caller() => MainIdentity.UserId(User);

        [HttpGet("postings")]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? city, [FromQuery] string? type,
            [FromQuery] string? mode, [FromQuery] int? page)
            => Ok(await _postings.SearchPostings(Caller(), q, city, type, mode, page));

        [HttpGet("postings/{id:int}")]
        public async Task<IActionResult> GetPosting(int id)
            => Ok(await _postings.GetPosting(Caller(), id));

        [HttpPost("postings/{id:int}/apply")]
        public async Task<IActionResult> Apply(int id, [FromBody] JobApplyRequest? req)
            => Ok(await _postings.Apply(Caller(), id, req?.Note));

        [HttpPost("postings/{id:int}/save")]
        public async Task<IActionResult> Save(int id)
            => Ok(await _postings.SetSaved(Caller(), id, true));

        [HttpDelete("postings/{id:int}/save")]
        public async Task<IActionResult> Unsave(int id)
            => Ok(await _postings.SetSaved(Caller(), id, false));

        [HttpGet("applications")]
        public async Task<IActionResult> GetApplications()
            => Ok(await _postings.GetMyApplications(Caller()));

        [HttpPost("applications/{id:int}/withdraw")]
        public async Task<IActionResult> Withdraw(int id)
            => Ok(await _postings.Withdraw(Caller(), id));

        [HttpGet("saved")]
        public async Task<IActionResult> GetSaved()
            => Ok(await _postings.GetSavedPostings(Caller()));
    }
}
