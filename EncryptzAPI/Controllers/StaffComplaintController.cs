using EncryptzAPI.Middleware;
using EncryptzBL.Common.Service;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Customer.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Office staff register a complaint for a customer who phones in (Complaints › Register Complaint).
    /// The customer is found by mobile or created, exactly as the public quick-complaint page does.
    /// </summary>
    [ApiController]
    [Route("api/staff-complaints")]
    [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager")]
    [AppModule("SERVICE")]
    public class StaffComplaintController : ControllerBase
    {
        private readonly ICustomerService _customers;
        public StaffComplaintController(ICustomerService customers) => _customers = customers;

        // GET api/staff-complaints/customer?mobile=9847012345
        [HttpGet("customer")]
        public async Task<IActionResult> LookupCustomer([FromQuery] string? mobile)
        {
            var normalised = StaffComplaintRules.NormaliseMobile(mobile);
            if (normalised == null)
                return BadRequest(new { success = false, message = StaffComplaintRules.BadMobile });

            var (c, _) = await FindCustomer(normalised);
            return Ok(new
            {
                success = true,
                data = new
                {
                    found = c != null,
                    customerName = c == null ? null : (string.IsNullOrWhiteSpace(c.CustomerName) ? c.FullName : c.CustomerName),
                    email = c?.Email
                }
            });
        }

        // POST api/staff-complaints
        [HttpPost]
        public async Task<IActionResult> Register([FromBody] PublicQuickComplaintRequest_Dto dto)
        {
            if (dto == null)
                return BadRequest(new { success = false, message = StaffComplaintRules.BadMobile });

            var normalised = StaffComplaintRules.NormaliseMobile(dto.MobileNumber);
            var (existing, storedMobile) = normalised == null ? (null, null) : await FindCustomer(normalised);
            var problem = StaffComplaintRules.Problem(dto, existing != null);
            if (problem != null)
                return BadRequest(new { success = false, message = problem });

            // the mobile as the customer has it stored, so the quick complaint finds the same customer
            dto.MobileNumber = storedMobile ?? normalised!;
            var result = await _customers.CreatePublicQuickComplaint(dto);
            if (!result.Success)
                return BadRequest(new { success = false, message = StaffComplaintRules.RefusalOf(result.Message) });
            return Ok(result);
        }

        /// <summary>The customer of this mobile, trying the formats other screens may have stored.</summary>
        private async Task<(EncryptzBL.DTO_s.CustomerDto? Customer, string? StoredMobile)> FindCustomer(string tenDigits)
        {
            foreach (var mobile in StaffComplaintRules.MobileVariants(tenDigits))
            {
                var r = await _customers.CheckByMobile(mobile);
                if (r.Success && r.Data != null) return (r.Data, mobile);
            }
            return (null, null);
        }
    }
}
