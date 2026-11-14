using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>A certificate as it is posted: its fields and, when given, its file.</summary>
    public class JobCertificateForm
    {
        public int CertificateId { get; set; }
        public string? Title { get; set; }
        public string? Issuer { get; set; }
        public DateTime? IssuedOn { get; set; }
        public IFormFile? File { get; set; }
    }

    /// <summary>
    /// Job Portal (personal application): the profile of the person who is logged in.
    /// A login is enough, no company is needed. The user is always the main-database user
    /// of the token (never a customer-portal token, never a value of the request), and the
    /// procedures of the Personal DB limit every statement to that user.
    /// </summary>
    [ApiController]
    [Route("api/jobs")]
    [Authorize]
    public class JobsController : ControllerBase
    {
        /// <summary>A little above the 5 MB a file may have: the form fields travel with it.</summary>
        private const long UploadLimit = JobsRules.MaxFileBytes + 256 * 1024;

        private readonly IJobsService _jobs;

        public JobsController(IJobsService jobs) => _jobs = jobs;

        /// <summary>0 for anybody who is not a logged-in user of the main database: the service refuses 0.</summary>
        private int Caller() => MainIdentity.UserId(User);

        // ── the page ──────────────────────────────────────────────────────────

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
            => Ok(await _jobs.GetPage(Caller()));

        [HttpPost("profile")]
        public async Task<IActionResult> SaveProfile([FromBody] JobProfileDto dto)
            => Ok(await _jobs.SaveProfile(Caller(), dto));

        [HttpPost("profile/visible")]
        public async Task<IActionResult> SetVisible([FromBody] SetJobVisibilityRequest req)
            => Ok(await _jobs.SetVisible(Caller(), req?.IsVisible ?? false));

        [HttpPost("preferences")]
        public async Task<IActionResult> SavePreferences([FromBody] JobPreferencesDto dto)
            => Ok(await _jobs.SavePreferences(Caller(), dto));

        [HttpPost("interests")]
        public async Task<IActionResult> SaveInterests([FromBody] JobInterestsDto dto)
            => Ok(await _jobs.SaveInterests(Caller(), dto));

        [HttpPost("social-links")]
        public async Task<IActionResult> SaveSocialLinks([FromBody] SaveJobSocialLinksRequest req)
            => Ok(await _jobs.SaveSocialLinks(Caller(), req));

        // ── experience ────────────────────────────────────────────────────────

        [HttpPost("experience")]
        public async Task<IActionResult> SaveExperience([FromBody] JobExperienceDto dto)
            => Ok(await _jobs.SaveExperience(Caller(), dto));

        [HttpDelete("experience/{id:int}")]
        public async Task<IActionResult> DeleteExperience(int id)
            => Ok(await _jobs.DeleteExperience(Caller(), id));

        // ── education ─────────────────────────────────────────────────────────

        [HttpPost("education")]
        public async Task<IActionResult> SaveEducation([FromBody] JobEducationDto dto)
            => Ok(await _jobs.SaveEducation(Caller(), dto));

        [HttpDelete("education/{id:int}")]
        public async Task<IActionResult> DeleteEducation(int id)
            => Ok(await _jobs.DeleteEducation(Caller(), id));

        // ── skills ────────────────────────────────────────────────────────────

        [HttpPost("skills")]
        public async Task<IActionResult> SaveSkill([FromBody] JobSkillDto dto)
            => Ok(await _jobs.SaveSkill(Caller(), dto));

        [HttpDelete("skills/{id:int}")]
        public async Task<IActionResult> DeleteSkill(int id)
            => Ok(await _jobs.DeleteSkill(Caller(), id));

        [HttpGet("skills/suggest")]
        public async Task<IActionResult> SuggestSkills([FromQuery] string? q)
            => Ok(await _jobs.SuggestSkills(Caller(), q));

        [HttpGet("skills/subskills")]
        public async Task<IActionResult> CatalogSubSkills([FromQuery] string? skill)
            => Ok(await _jobs.CatalogSubSkills(Caller(), skill));

        // ── certificates ──────────────────────────────────────────────────────

        [HttpPost("certificates")]
        [RequestSizeLimit(UploadLimit)]
        public async Task<IActionResult> SaveCertificate([FromForm] JobCertificateForm form)
        {
            var (upload, problem) = await ReadAsync(form?.File);
            if (problem != null)
                return Ok(ApiResponse<int>.Fail(problem));

            var dto = new JobCertificateDto
            {
                CertificateId = form?.CertificateId ?? 0,
                Title = form?.Title ?? "",
                Issuer = form?.Issuer ?? "",
                IssuedOn = form?.IssuedOn
            };

            return Ok(await _jobs.SaveCertificate(Caller(), dto, upload));
        }

        [HttpDelete("certificates/{id:int}")]
        public async Task<IActionResult> DeleteCertificate(int id)
            => Ok(await _jobs.DeleteCertificate(Caller(), id));

        // ── resume ────────────────────────────────────────────────────────────

        [HttpPost("resume")]
        [RequestSizeLimit(UploadLimit)]
        public async Task<IActionResult> SaveResume(IFormFile? file)
        {
            var (upload, problem) = await ReadAsync(file);
            if (problem != null)
                return Ok(ApiResponse<int>.Fail(problem));

            return Ok(await _jobs.SaveResume(Caller(), upload));
        }

        [HttpDelete("resume")]
        public async Task<IActionResult> DeleteResume()
            => Ok(await _jobs.DeleteResume(Caller()));

        // ── photo ─────────────────────────────────────────────────────────────

        [HttpPost("photo")]
        [RequestSizeLimit(UploadLimit)]
        public async Task<IActionResult> SavePhoto(IFormFile? file)
        {
            var (upload, problem) = await ReadAsync(file);
            if (problem != null)
                return Ok(ApiResponse<int>.Fail(problem));

            return Ok(await _jobs.SavePhoto(Caller(), upload));
        }

        [HttpDelete("photo")]
        public async Task<IActionResult> DeletePhoto()
            => Ok(await _jobs.DeletePhoto(Caller()));

        /// <summary>The photo of the caller as an image; 204 when there is none.</summary>
        [HttpGet("photo")]
        public async Task<IActionResult> GetPhoto()
        {
            var result = await _jobs.GetPhoto(Caller());
            if (!result.Success || result.Data == null)
                return NoContent();

            // only JPG and PNG are stored as a photo; the type is from our own list
            var type = JobsRules.ContentTypeFor(result.Data.FileName);
            if (type != "image/jpeg" && type != "image/png")
                return NoContent();

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, type);
        }

        // ── the shareable link of the profile ─────────────────────────────────

        [HttpGet("profile/share")]
        public async Task<IActionResult> GetShare()
            => Ok(await _jobs.GetShare(Caller()));

        [HttpPost("profile/share")]
        public async Task<IActionResult> SetShare([FromBody] SetJobProfileShareRequest? req)
            => Ok(await _jobs.SetShare(Caller(), req?.On ?? false));

        // ── files ─────────────────────────────────────────────────────────────

        /// <summary>One file of the caller. A file of somebody else is "not found", like a file that does not exist.</summary>
        [HttpGet("files/{id:int}")]
        public async Task<IActionResult> GetFile(int id)
        {
            var result = await _jobs.GetFile(Caller(), id);
            if (!result.Success || result.Data == null)
                return NotFound(ApiResponse<string>.Fail(result.Message ?? "Not found"));

            // always a download, with a type from our own list: the browser must never
            // decide for itself what an uploaded file is and show it in the page
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, JobsRules.ContentTypeFor(result.Data.FileName), result.Data.FileName);
        }

        /// <summary>
        /// The bytes of an upload, or the reason it is not taken. The size is checked on the
        /// declared length before anything is read into memory.
        /// </summary>
        private static async Task<(JobUpload? Upload, string? Problem)> ReadAsync(IFormFile? file)
        {
            if (file == null)
                return (null, null);

            if (file.Length <= 0)
                return (null, "Choose a file");
            if (file.Length > JobsRules.MaxFileBytes)
                return (null, "The file is larger than 5 MB");

            using var memory = new MemoryStream((int)file.Length);
            await file.CopyToAsync(memory);
            return (new JobUpload(file.FileName ?? "", memory.ToArray()), null);
        }
    }
}
