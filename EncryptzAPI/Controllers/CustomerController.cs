using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Customer.Modules;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    [CustomerPortal]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _svc;
        private readonly IConnectionResolver _connectionResolver;

        public CustomerController(ICustomerService svc, IConnectionResolver connectionResolver)
        {
            _svc = svc;
            _connectionResolver = connectionResolver;
        }
        private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        /// <summary>Largest page a customer list returns in one request.</summary>
        private const int MaxCustomerPageSize = 100;

        // ============================================
        // AUTHENTICATION (Public endpoints - no Authorize)
        // ============================================

        [HttpGet("tenant-info")]
        [AllowAnonymous]
        public async Task<IActionResult> GetTenantInfo()
        {
            var projectKey = Request.Headers[TenantResolutionMiddleware.ProjectKeyHeader].FirstOrDefault() ?? string.Empty;
            var scope = await _connectionResolver.GetProjectScopeAsync(projectKey);
            if (scope == null)
                return BadRequest(ApiResponse<string>.Fail("Unknown project"));

            return Ok(ApiResponse<string>.Ok(scope.CompanyName));
        }

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

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] CustomerForgotPasswordDto dto)
            => Ok(await _svc.RequestCustomerPasswordReset(dto.Email));

        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] CustomerResetPasswordDto dto)
            => Ok(await _svc.ResetCustomerPassword(dto.Email, dto.OtpCode, dto.NewPassword));

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

        // also read by the public complaint page, before anyone is signed in
        [HttpGet("complaint-categories")]
        [AllowAnonymous]
        public async Task<IActionResult> GetComplaintCategories()
            => Ok(await _svc.GetComplaintCategories());

        [HttpPost("complaints")]
        public async Task<IActionResult> CreateComplaint([FromBody] ComplaintCreateDto dto)
        {
            var result = await _svc.CreateComplaint(GetUserId(), dto);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("complaints/{id}")]
        public async Task<IActionResult> UpdateComplaint(int id, [FromBody] ComplaintUpdateDto dto)
            => Ok(await _svc.UpdateComplaint(GetUserId(), id, dto));

        [HttpDelete("complaints/{id}")]
        public async Task<IActionResult> DeleteComplaint(int id)
            => Ok(await _svc.DeleteComplaint(GetUserId(), id));

        [HttpPost("complaints/{id}/confirm-closure")]
        public async Task<IActionResult> ConfirmClosure(int id)
            => Ok(await _svc.ConfirmClosure(GetUserId(), id));


        [HttpPost("quick-complaint")]
        public async Task<IActionResult> SubmitQuickComplaint([FromBody] QuickComplaintRequest_Dto request)
        => Ok(await _svc.CreateQuickComplaint(GetUserId(), request));
        // No [FromForm], use [FromBody] instead
        // Rest of the code remains the same


        // page / size below 1 are refused with 400 by PagingGuardFilter
        [HttpGet("my-complaints")]
        public async Task<IActionResult> GetMyComplaints([FromQuery] int? statusFilter, [FromQuery] int page = 1, [FromQuery] int size = 10)
            => Ok(await _svc.GetMyComplaints(GetUserId(), statusFilter, page, Math.Min(size, MaxCustomerPageSize)));

        [HttpGet("complaints/{id}")]
        public async Task<IActionResult> GetComplaintDetail(int id)
            => Ok(await _svc.GetComplaintDetail(id, GetUserId()));


        [HttpPost("get-existing-user-companies")]
        [AllowAnonymous]
        public async Task<IActionResult> GetExistingUserCompanies([FromBody] InsertCustomerForExistingUserDto dto)
        {
            var result = await _svc.GetExistingUserCompanies(dto.UserId, dto.Password);
            return Ok(result);
        }

        [HttpPost("insert-customer-for-existing-user")]
        [AllowAnonymous]
        public async Task<IActionResult> InsertCustomerForExistingUser([FromBody] InsertCustomerForExistingUserDto dto)
        {
            var result = await _svc.InsertCustomerForExistingUser(dto);
            return Ok(result);
        }

        [HttpPost("public-quick-complaint")]
        [AllowAnonymous]
        public async Task<IActionResult> PublicQuickComplaint([FromBody] PublicQuickComplaintRequest_Dto dto)
        {
            var result = await _svc.CreatePublicQuickComplaint(dto);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }



        [HttpPost("complaints/{id}/images")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadComplaintImage(
     int id,
     [FromForm] IFormFile file,
     [FromForm] string imageType = "complaint")
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file");

            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (!allowed.Contains(Path.GetExtension(file.FileName).ToLowerInvariant()))
                return BadRequest(ApiResponse<string>.Fail("Only JPG, PNG, and WEBP files are allowed"));

            // the complaint id comes from the URL: it has to be one of the customer's own
            var complaint = await _svc.GetComplaintDetail(id, GetUserId());
            if (!complaint.Success)
                return NotFound(ApiResponse<string>.Fail("Complaint not found"));

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