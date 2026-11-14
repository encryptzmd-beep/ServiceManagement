using EncryptzAPI.Middleware;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// The public job pages (www.../jobs): the open jobs for anybody, without an account,
    /// search engines included. Read only; applying needs a login (api/jobs). Answers may be
    /// kept by browsers and proxies for a short time: they hold nothing about the caller.
    /// </summary>
    [ApiController]
    [Route("api/public/jobs")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.PublicJobs)]
    public class PublicJobsController : ControllerBase
    {
        private readonly IPublicJobsService _jobs;

        public PublicJobsController(IPublicJobsService jobs) => _jobs = jobs;

        private void Cacheable(int seconds) => Response.Headers["Cache-Control"] = $"public, max-age={seconds}";

        [HttpGet]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? city, [FromQuery] string? type,
            [FromQuery] string? mode, [FromQuery] int? page)
        {
            var result = await _jobs.SearchPublicPostings(q, city, type, mode, page);
            if (result.Success) Cacheable(60);
            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetPosting(int id)
        {
            var result = await _jobs.GetPublicPosting(id);
            if (!result.Success) return NotFound(result);
            Cacheable(300);
            return Ok(result);
        }

        /// <summary>The open jobs most like this one, for "Similar jobs" on its page.</summary>
        [HttpGet("{id:int}/related")]
        public async Task<IActionResult> GetRelated(int id)
        {
            var result = await _jobs.GetRelatedPublicPostings(id);
            if (result.Success) Cacheable(300);
            return Ok(result);
        }

        /// <summary>Every open job, for the sitemap the page server builds (/sitemap.xml).</summary>
        [HttpGet("sitemap")]
        public async Task<IActionResult> GetSitemap()
        {
            var result = await _jobs.GetPublicSitemap();
            if (result.Success) Cacheable(600);
            return Ok(result);
        }
    }
}
