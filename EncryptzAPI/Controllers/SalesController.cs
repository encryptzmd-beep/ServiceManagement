using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Sales.Modules;
using EncryptzBL.Infrastructure.Settings.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Sales Order (bill) -> Despatch -> "New Installation" complaint -> warranty.
    ///   GET    api/Sales/customers?search=        customer master picker
    ///   POST   api/Sales/customers                create / update a customer of the master
    ///   GET    api/Sales/orders/next-number
    ///   GET    api/Sales/orders?searchTerm=&status=&pageNumber=&pageSize=
    ///   GET    api/Sales/orders/{id}               bill + lines (+ warranty) + despatch
    ///   POST   api/Sales/orders                    save bill (insert / update while Billed)
    ///   POST   api/Sales/orders/{id}/cancel
    ///   GET    api/Sales/despatches?searchTerm=&pageNumber=&pageSize=
    ///   GET    api/Sales/despatches/{id}           despatch + units with warranty + complaint
    ///   POST   api/Sales/despatches                despatch a bill (Products + installation complaint)
    ///   GET    api/Sales/warranty?search=&customerId=&onlyActive=
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SalesController : ControllerBase
    {
        private readonly ISalesService _svc;
        private readonly ISettingsService _settings;

        public SalesController(ISalesService svc, ISettingsService settings)
        {
            _svc = svc;
            _settings = settings;
        }

        private int UserId => User.GetTenantUserId();

        /// <summary>
        /// Settings of the Sales and Print groups (bill defaults such as the IGST default, the
        /// invoice print header / footer) as key -> value; readable by every sales user.
        /// </summary>
        [HttpGet("settings")]
        public async Task<IActionResult> SalesSettings()
        {
            var rows = await _settings.GetAll();
            var map = rows
                .Where(r => r.SettingGroup is "Sales" or "Print")
                .ToDictionary(r => r.SettingKey, r => r.SettingValue ?? string.Empty);
            return Ok(ApiResponse<Dictionary<string, string>>.Ok(map));
        }

        // ---------------- customer master ----------------
        [HttpGet("customers")]
        public async Task<IActionResult> SearchCustomers([FromQuery] string? search = null, [FromQuery] int top = 50)
            => Ok(ApiResponse<List<SalesCustomerDto>>.Ok(await _svc.SearchCustomers(search, top)));

        [HttpPost("customers")]
        public async Task<IActionResult> SaveCustomer([FromBody] SalesCustomerSaveDto dto)
        {
            var result = await _svc.SaveCustomer(dto);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- sales order ----------------
        [HttpGet("orders/next-number")]
        public async Task<IActionResult> NextOrderNumber()
            => Ok(ApiResponse<string>.Ok(await _svc.GetNextOrderNumber()));

        [HttpGet("orders")]
        public async Task<IActionResult> GetOrders([FromQuery] SalesOrderFilterDto filter)
            => Ok(await _svc.GetOrders(filter));

        [HttpGet("orders/{id:int}")]
        public async Task<IActionResult> GetOrder(int id)
        {
            var result = await _svc.GetOrder(id);
            return result.Success ? Ok(result) : NotFound(result);
        }

        [HttpPost("orders")]
        public async Task<IActionResult> SaveOrder([FromBody] SalesOrderSaveDto dto)
        {
            var result = await _svc.SaveOrder(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        [HttpPost("orders/{id:int}/cancel")]
        public async Task<IActionResult> CancelOrder(int id)
        {
            var result = await _svc.CancelOrder(id, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- despatch ----------------
        [HttpGet("despatches")]
        public async Task<IActionResult> GetDespatches([FromQuery] DespatchFilterDto filter)
            => Ok(await _svc.GetDespatches(filter));

        [HttpGet("despatches/{id:int}")]
        public async Task<IActionResult> GetDespatch(int id)
        {
            var result = await _svc.GetDespatch(id);
            return result.Success ? Ok(result) : NotFound(result);
        }

        [HttpPost("despatches")]
        public async Task<IActionResult> CreateDespatch([FromBody] DespatchCreateDto dto)
        {
            var result = await _svc.CreateDespatch(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- warranty ----------------
        [HttpGet("warranty")]
        public async Task<IActionResult> WarrantyLookup([FromQuery] WarrantyLookupFilterDto filter)
            => Ok(await _svc.WarrantyLookup(filter));
    }
}
