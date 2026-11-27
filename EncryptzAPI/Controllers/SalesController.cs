using EncryptzBL.Common.Tenant;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Sales;
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
    ///   POST   api/Sales/orders                    save a sales order (insert / update before Billed)
    ///   POST   api/Sales/orders/{id}/status        Sales Order -> Sales Confirmed -> Billed (needs an Invoice PDF)
    ///   POST   api/Sales/orders/{id}/cancel
    ///   GET    api/Sales/despatches?searchTerm=&pageNumber=&pageSize=
    ///   GET    api/Sales/despatches/{id}           despatch + units with warranty + complaint
    ///   POST   api/Sales/despatches                despatch a bill (Products + installation complaint)
    ///   GET    api/Sales/warranty?search=&customerId=&onlyActive=
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    [AppModule("SERVICE")]
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

        // ---------------- transporter master ----------------
        [HttpGet("transporters")]
        public async Task<IActionResult> GetTransporters([FromQuery] bool includeInactive = false)
            => Ok(ApiResponse<List<TransporterDto>>.Ok(await _svc.GetTransporters(includeInactive)));

        [MenuRight("/sales/despatch", MenuRightKind.Save, IdProperty = "TransporterId", AllowRole = "Storekeeper")]
        [HttpPost("transporters")]
        public async Task<IActionResult> SaveTransporter([FromBody] TransporterDto dto)
        {
            var result = await _svc.SaveTransporter(dto);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- customer master ----------------
        [HttpGet("customers")]
        public async Task<IActionResult> SearchCustomers([FromQuery] string? search = null, [FromQuery] int top = 50)
            => Ok(ApiResponse<List<SalesCustomerDto>>.Ok(await _svc.SearchCustomers(search, top)));

        [MenuRight("/sales/orders", MenuRightKind.Save, IdProperty = "CustomerId")]
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

        // previous / next of the toolbar; id 0 = from a new bill
        [HttpGet("orders/{id:int}/neighbours")]
        public async Task<IActionResult> GetOrderNeighbours(int id)
            => Ok(await _svc.GetOrderNeighbours(id));

        [HttpGet("orders/{id:int}")]
        public async Task<IActionResult> GetOrder(int id)
        {
            var result = await _svc.GetOrder(id);
            return result.Success ? Ok(result) : NotFound(result);
        }

        [MenuRight("/sales/orders", MenuRightKind.Save, IdProperty = "SalesOrderId")]
        [HttpPost("orders")]
        public async Task<IActionResult> SaveOrder([FromBody] SalesOrderSaveDto dto)
        {
            var result = await _svc.SaveOrder(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        /// <summary>Sales Order → Sales Confirmed → Billed; Billed needs an Invoice PDF attached, and sends the order to Despatch.</summary>
        [MenuRight("/sales/orders", MenuRightKind.Edit)]
        [HttpPost("orders/{id:int}/status")]
        public async Task<IActionResult> SetOrderStatus(int id, [FromBody] SalesOrderStatusDto dto)
        {
            var result = await _svc.SetOrderStatus(id, dto?.Status, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        [MenuRight("/sales/orders", MenuRightKind.Delete)]
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

        [MenuRight("/sales/despatch", MenuRightKind.Create)]
        [HttpPost("despatches")]
        public async Task<IActionResult> CreateDespatch([FromBody] DespatchCreateDto dto)
        {
            var result = await _svc.CreateDespatch(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- spare and repaired parts, same Despatch screen ----------------
        [HttpGet("service-despatches")]
        [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager,Storekeeper")]
        public async Task<IActionResult> GetServiceDespatches([FromQuery] ServiceDespatchFilterDto filter)
        {
            var result = await _svc.GetServiceDespatches(filter);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        [MenuRight("/sales/despatch", MenuRightKind.Create, AllowRole = "Storekeeper")]
        [HttpPost("service-despatches")]
        [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager,Storekeeper")]
        public async Task<IActionResult> CreateServiceDespatch([FromBody] ServiceDespatchCreateDto dto)
        {
            var result = await _svc.CreateServiceDespatch(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        /// <summary>The missing mode and reference of an older spare or repair despatch.</summary>
        [MenuRight("/sales/despatch", MenuRightKind.Edit, AllowRole = "Storekeeper")]
        [HttpPost("service-despatches/details")]
        [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager,Storekeeper")]
        public async Task<IActionResult> AddServiceDespatchDetails([FromBody] ServiceDespatchCreateDto dto)
        {
            var result = await _svc.AddServiceDespatchDetails(dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        /// <summary>The missing mode and reference of an older sales despatch.</summary>
        [MenuRight("/sales/despatch", MenuRightKind.Edit)]
        [HttpPost("despatches/{id:int}/details")]
        [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager")]
        public async Task<IActionResult> AddDespatchDetails(int id, [FromBody] DespatchDetailsDto dto)
        {
            var result = await _svc.AddDespatchDetails(id, dto, UserId);
            return result.Success ? Ok(result) : BadRequest(result);
        }

        // ---------------- documents of a bill (PDF) ----------------
        [HttpGet("orders/{id:int}/documents")]
        public async Task<IActionResult> GetDocuments(int id)
            => Ok(await _svc.GetDocuments(id));

        [MenuRight("/sales/orders", MenuRightKind.Edit, OrMenuPath = "/sales/despatch")]
        [HttpPost("orders/{id:int}/documents")]
        [RequestSizeLimit(SalesDocumentRules.MaxFileBytes + 256 * 1024)]
        public async Task<IActionResult> AddDocument(int id, IFormFile? file, [FromForm] string? documentType, [FromForm] int? despatchId)
        {
            if (file == null || file.Length <= 0) return Ok(ApiResponse<int>.Fail("Choose a PDF file."));
            if (file.Length > SalesDocumentRules.MaxFileBytes) return Ok(ApiResponse<int>.Fail("The file is larger than 10 MB."));

            using var memory = new MemoryStream((int)file.Length);
            await file.CopyToAsync(memory);
            return Ok(await _svc.SaveDocument(id, despatchId, documentType, file.FileName, memory.ToArray(), UserId));
        }

        [HttpGet("documents/{id:int}/file")]
        public async Task<IActionResult> GetDocumentFile(int id)
        {
            var result = await _svc.GetDocumentFile(id);
            if (!result.Success || result.Data == null) return NotFound(result);

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, no-store";
            return File(result.Data.Content, "application/pdf", result.Data.FileName);
        }

        [MenuRight("/sales/orders", MenuRightKind.Delete, OrMenuPath = "/sales/despatch")]
        [HttpDelete("documents/{id:int}")]
        public async Task<IActionResult> DeleteDocument(int id)
            => Ok(await _svc.DeleteDocument(id, UserId));

        // ---------------- warranty ----------------
        [HttpGet("warranty")]
        public async Task<IActionResult> WarrantyLookup([FromQuery] WarrantyLookupFilterDto filter)
            => Ok(await _svc.WarrantyLookup(filter));
    }
}
