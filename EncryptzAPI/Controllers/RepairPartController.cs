using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.RepairPart.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Linq;
using System;

namespace EncryptzAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RepairPartController : ControllerBase
    {
        private readonly IRepairPartService _service;
        private readonly IWebHostEnvironment _env;

        public RepairPartController(IRepairPartService service, IWebHostEnvironment env)
        {
            _service = service;
            _env = env;
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] RepairPartRequestCreateDto dto)
        {
            var result = await _service.CreateRequest(dto);
            return Ok(result);
        }

        [HttpPost("upload-image")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadImage(
            [FromForm] IFormFile file,
            [FromForm] int repairRequestId,
            [FromForm] string imageType = "Other")
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "No file provided" });

            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowed.Contains(ext))
                return BadRequest(new { success = false, message = "Only JPG, PNG, and WEBP files are allowed" });

            string base64String;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                var bytes = ms.ToArray();
                var contentType = file.ContentType;
                base64String = $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
            }

            var result = await _service.SaveImage(repairRequestId, base64String, imageType);

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            return Ok(new
            {
                success = true,
                message = result.Message,
                imageId = result.Data
            });
        }

        [HttpGet("request/{repairRequestId}/images")]
        public async Task<IActionResult> GetImages(int repairRequestId)
        {
            var result = await _service.GetImagesByRequest(repairRequestId);
            return Ok(result);
        }

        [HttpGet("image/{imageId}")]
        public async Task<IActionResult> GetImageBase64(int imageId)
        {
            var result = await _service.GetImageBase64(imageId);
            return Ok(result);
        }

        [HttpPatch("request/{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateRepairStatusDto dto)
        {
            var result = await _service.UpdateStatus(id, dto.Status, dto.Notes);
            return Ok(result);
        }
    }

    public class UpdateRepairStatusDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
