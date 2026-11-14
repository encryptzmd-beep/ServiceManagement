using EncryptzAPI.Middleware;
using EncryptzBL.Common.Jobs;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// A profile a person shared (www.../p/code): for anybody with the link, no login. Only
    /// while the person keeps the link on; never the email, phone, date of birth or resume.
    /// Answers are never kept by browsers or proxies (switching the link off works at once)
    /// and search engines are told not to index them.
    /// </summary>
    [ApiController]
    [Route("api/public/profiles")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.PublicJobs)]
    public class PublicProfilesController : ControllerBase
    {
        private readonly IPublicJobsService _jobs;

        public PublicProfilesController(IPublicJobsService jobs) => _jobs = jobs;

        private void Private()
        {
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        }

        [HttpGet("{code}")]
        public async Task<IActionResult> GetProfile(string code)
        {
            Private();
            var result = await _jobs.GetPublicProfile(code);
            return result.Success ? Ok(result) : NotFound(result);
        }

        /// <summary>The photo of a shared profile; 404 when there is none or the link is off.</summary>
        [HttpGet("{code}/photo")]
        public async Task<IActionResult> GetPhoto(string code)
        {
            Private();
            var result = await _jobs.GetPublicProfilePhoto(code);
            if (!result.Success || result.Data == null)
                return NotFound();

            // only JPG and PNG are stored as a photo; the type is from our own list
            var type = JobsRules.ContentTypeFor(result.Data.FileName);
            if (type != "image/jpeg" && type != "image/png")
                return NotFound();

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(result.Data.Content, type);
        }
    }
}
