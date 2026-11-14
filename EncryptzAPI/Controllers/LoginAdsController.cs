using EncryptzBL.Common.LoginAds;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.LoginAds;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>A login ad as the Platform Admin form sends it: the texts and dates plus an optional image.</summary>
    public class SaveLoginAdForm : SaveLoginAdRequest
    {
        public IFormFile? File { get; set; }
    }

    /// <summary>
    /// The advertisement slides of the sign-in and register pages. Anonymous: those pages
    /// are shown before anyone signs in. Only slides shown today are served.
    /// </summary>
    [ApiController]
    [Route("api/loginads")]
    [AllowAnonymous]
    public class LoginAdsController : ControllerBase
    {
        private readonly ILoginAdService _ads;

        public LoginAdsController(ILoginAdService ads)
        {
            _ads = ads;
        }

        [HttpGet("")]
        public async Task<IActionResult> List()
        {
            Response.Headers["Cache-Control"] = "public, max-age=60";
            return Ok(await _ads.ListPublic());
        }

        /// <summary>The image of a slide shown today. Its address carries the image version, so it may be kept a day.</summary>
        [HttpGet("{id:int}/image")]
        public async Task<IActionResult> Image(int id)
        {
            var image = await _ads.GetPublicImage(id);
            if (image == null)
                return NotFound();

            // the type is from our own list, never from the upload
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "public, max-age=86400";
            return File(image.Content, LoginAdRules.ContentTypeFor(image.FileName));
        }
    }
}
