//using EncryptzBL.Common;
//using EncryptzBL.DTO_s;
//using EncryptzBL.Infrastructure.Technician.modules;
//using Microsoft.AspNet.Identity;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Mvc;
//using System.Security.Claims;

//[Route("api/service-images")]
//[ApiController]
//[Authorize]
//public class ServiceImageController : ControllerBase
//{
//    private readonly ITechnicianService _svc;
//    private readonly IWebHostEnvironment _env;

//    public ServiceImageController(ITechnicianService svc, IWebHostEnvironment env)
//    {
//        _svc = svc;
//        _env = env;
//    }

//    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

//    // POST api/service-images/upload
//    [HttpPost("upload")]
//    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
//    public async Task<IActionResult> Upload(
//        [FromForm] IFormFile file,
//        [FromForm] int complaintId,
//        [FromForm] int technicianId,
//        [FromForm] string imageType = "Other")
//    {
//        if (file == null || file.Length == 0)
//            return BadRequest(new { success = false, message = "No file provided" });

//        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
//        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
//        if (!allowed.Contains(ext))
//            return BadRequest(new { success = false, message = "Only JPG, PNG, WEBP allowed" });

//        // Save to wwwroot/uploads/service-images/
//        var folder = Path.Combine(_env.WebRootPath, "uploads", "service-images");
//        Directory.CreateDirectory(folder);

//        var fileName = $"{complaintId}_{technicianId}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{ext}";
//        var fullPath = Path.Combine(folder, fileName);

//        using (var stream = new FileStream(fullPath, FileMode.Create))
//            await file.CopyToAsync(stream);

//        var relativePath = $"/uploads/service-images/{fileName}";

//        var result = await _svc.SaveServiceImage(new ServiceImageSaveDto
//        {
//            ComplaintId = complaintId,
//            TechnicianId = technicianId,
//            ImageType = imageType,
//            ImagePath = relativePath
//        });

//        return Ok(new
//        {
//            success = result.Success,
//            message = result.Message,
//            imageId = result.Data,
//            imagePath = relativePath
//        });

//    }
//}