using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Customer.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _svc;

        public CustomerController(ICustomerService svc)
        {
            _svc = svc;
        }
        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        // ============================================
        // AUTHENTICATION (Public endpoints - no Authorize)
        // ============================================

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromBody] CustomerRegister_Dto dto)
        {
            var result = await _svc.Register_Customer(dto);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] CustomerLogin_Dto dto)
        {
            var result = await _svc.Login(dto);
            if (!result.Success) return Unauthorized(result);
            return Ok(result);
        }

        // ============================================
        // PROFILE
        // ============================================

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var result = await _svc.GetProfile_Customer(UserId);
            if (!result.Success) return NotFound(result);
            return Ok(result);
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] CustomerProfileUpdate_Dto dto)
        {
            var result = await _svc.UpdateProfile(UserId, dto);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        // ============================================
        // DASHBOARD
        // ============================================

        [HttpGet("dashboard/stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            // First get customerId from userId
            var customerId = await GetCustomerIdFromUserId();
            if (customerId == null)
                return NotFound(ApiResponse<string>.Fail("Customer not found"));

            var result = await _svc.GetDashboardStats(customerId.Value);
            if (!result.Success) return NotFound(result);
            return Ok(result);
        }

        [HttpGet("menus")]
        public async Task<IActionResult> GetMenus()
        {
            // First get customerId from userId
            var customerId = await GetCustomerIdFromUserId();
            if (customerId == null)
                return NotFound(ApiResponse<string>.Fail("Customer not found"));

            var result = await _svc.GetMenus(customerId.Value);
            return Ok(result);
        }

   
        [HttpGet("get-or-create-profile")]
        public async Task<IActionResult> GetOrCreateProfile()
        {
            var result = await _svc.GetOrCreateProfile(UserId);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("check-by-mobile/{mobile}")]
        [AllowAnonymous]
        public async Task<IActionResult> CheckByMobile(string mobile)
        {
            var result = await _svc.CheckByMobile(mobile);
            if (!result.Success) return NotFound(result);
            return Ok(result);
        }

        private async Task<int?> GetCustomerIdFromUserId()
        {
            // You need to implement this method or inject a service to get customerId
            // Option 1: Call a service method to get customerId
            var profile = await _svc.GetProfile_Customer(UserId);
            if (profile.Success && profile.Data != null)
                return profile.Data.CustomerId;

            return null;
        }
        private int GetUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        }

 
        // 🔹 GET MY PRODUCTS
        [HttpGet("products")]
        public async Task<IActionResult> GetProducts()
        {
            var result = await _svc.GetProducts(GetUserId());
            return Ok(result);
        }

        // 🔹 ADD PRODUCT
        [HttpPost("products")]
        public async Task<IActionResult> AddProduct([FromBody] ProductCreateDto dto)
        {
            var result = await _svc.AddProduct(GetUserId(), dto);
            return Ok(result);
        }




        [HttpGet("product-master")]
        public async Task<IActionResult> GetProductMaster([FromQuery] string search = null, [FromQuery] string category = null)
    => Ok(await _svc.GetProductMaster(search, category));


        [HttpPost("complaints")]
        public async Task<IActionResult> CreateComplaint([FromBody] ComplaintCreateDto dto)
            => Ok(await _svc.CreateComplaint(GetUserId(), dto));


        [HttpPost("quick-complaint")]
        public async Task<IActionResult> SubmitQuickComplaint([FromBody] QuickComplaintRequest_Dto request)
        => Ok(await _svc.CreateQuickComplaint(GetUserId(), request));
        // No [FromForm], use [FromBody] instead
        // Rest of the code remains the same


        [HttpGet("my-complaints")]
        public async Task<IActionResult> GetMyComplaints([FromQuery] int? statusFilter, [FromQuery] int page = 1, [FromQuery] int size = 10)
            => Ok(await _svc.GetMyComplaints(GetUserId(), statusFilter, page, size));

        [HttpGet("complaints/{id}")]
        public async Task<IActionResult> GetComplaintDetail(int id)
            => Ok(await _svc.GetComplaintDetail(id, GetUserId()));


        [HttpPost("get-existing-user-companies")]
        [AllowAnonymous]
        public async Task<IActionResult> GetExistingUserCompanies([FromBody] InsertCustomerForExistingUserDto dto)
        {
            var result = await _svc.GetExistingUserCompanies(dto.UserId);
            return Ok(result);
        }

        [HttpPost("insert-customer-for-existing-user")]
        [AllowAnonymous]
        public async Task<IActionResult> InsertCustomerForExistingUser([FromBody] InsertCustomerForExistingUserDto dto)
        {
            var result = await _svc.InsertCustomerForExistingUser(dto);
            return Ok(result);
        }



        [HttpPost("complaints/{id}/images")]
        public async Task<IActionResult> UploadComplaintImage(
     int id,
     [FromForm] IFormFile file,
     [FromForm] string imageType = "complaint")
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file");

            // 🔥 Convert to Base64
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var bytes = ms.ToArray();
            var base64 = Convert.ToBase64String(bytes);

            var result = await _svc.UploadComplaintImage(
                id,
                null, // no need path
                imageType,
                GetUserId(),
                base64,
                file.FileName,
                file.ContentType
            );

            return Ok(result);
        }
    }
}