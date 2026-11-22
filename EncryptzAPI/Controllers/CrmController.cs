using System.Security.Claims;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Crm;
using EncryptzBL.Infrastructure.Products.Modules;
using EncryptzBL.Infrastructure.Settings.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// CRM Lead Management. The person (tenant user), the company and the branch come from the token,
    /// never from the request. A sales user sees only own leads; managers see all.
    /// </summary>
    [ApiController]
    [Route("api/crm")]
    [Authorize]
    [AppModule("CRM")]
    public class CrmController : ControllerBase
    {
        private readonly ICrmService _crm;

        private readonly TenantContext _tenant;
        private readonly IProductMasterService _products;

        public CrmController(ICrmService crm, TenantContext tenant, IProductMasterService products)
        {
            _crm = crm;
            _tenant = tenant;
            _products = products;
        }

        private int Caller() => User.GetTenantUserId();

        // The company comes from TenantContext, which TenantResolutionMiddleware fills from the
        // CompanyId claim, falling back to ClientId: one source for the whole request.
        private int Company() => _tenant.CompanyId;

        private Task<bool> Manager() => _crm.IsManager(Caller(), User.FindFirst(ClaimTypes.Role)?.Value, Company());

        private IActionResult Answer<T>(ApiResponse<T> result) => result.Success ? Ok(result) : BadRequest(result);

        /// <summary>Decided by the token's role, never by the request.</summary>
        private bool IsCompanyAdmin() => ModuleAccess.IsCompanyAdminRole(User.FindFirst(ClaimTypes.Role)?.Value);

        [HttpGet("me")]
        public async Task<IActionResult> Me()
            => Ok(ApiResponse<object>.Ok(new
            {
                userId = Caller(),
                fullName = User.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty,
                isManager = await Manager()
            }));

        [HttpGet("leads")]
        public async Task<IActionResult> GetLeads([FromQuery] LeadFilterDto filter)
            => Answer(await _crm.GetLeads(Caller(), await Manager(), Company(), filter));

        /// <summary>Leads per status for the status tabs of the lead list, under the list's filters.</summary>
        [HttpGet("leads/status-counts")]
        public async Task<IActionResult> GetLeadStatusCounts([FromQuery] LeadFilterDto filter)
            => Answer(await _crm.GetLeadStatusCounts(Caller(), await Manager(), Company(), filter));

        /// <summary>What the caller may do with the lead Excel files now.</summary>
        [HttpGet("leads/data-access")]
        public async Task<IActionResult> GetLeadDataAccess()
            => Answer(await _crm.GetLeadDataAccess(Caller(), await Manager(), Company(), IsCompanyAdmin()));

        [MenuRight("/crm/leads", MenuRightKind.Create)]
        [HttpPost("leads/data-requests")]
        public async Task<IActionResult> RequestLeadData([FromBody] LeadDataRequestDto dto)
            => Answer(await _crm.RequestLeadData(Caller(), await Manager(), Company(), dto));

        [HttpGet("leads/data-requests")]
        public async Task<IActionResult> GetLeadDataRequests()
            => Answer(await _crm.GetLeadDataRequests(Caller(), await Manager(), Company(), IsCompanyAdmin()));

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/data-requests/{id:int}/decide")]
        public async Task<IActionResult> DecideLeadData(int id, [FromBody] LeadDataDecisionDto dto)
            => Answer(await _crm.DecideLeadData(Caller(), await Manager(), Company(), IsCompanyAdmin(), id, dto));

        [HttpGet("leads/export")]
        public async Task<IActionResult> ExportLeads()
            => Answer(await _crm.ExportLeads(Caller(), await Manager(), Company(), IsCompanyAdmin()));

        [MenuRight("/crm/leads", MenuRightKind.Create)]
        [HttpPost("leads/import")]
        public async Task<IActionResult> ImportLeads([FromBody] List<LeadImportRowDto> rows)
            => Answer(await _crm.ImportLeads(Caller(), await Manager(), Company(), IsCompanyAdmin(), rows));

        [HttpGet("leads/{id:int}")]
        public async Task<IActionResult> GetLead(int id)
        {
            var result = await _crm.GetLead(Caller(), await Manager(), Company(), id);
            if (result.Success) return Ok(result);
            return result.Message == "Lead not found" ? NotFound(result) : BadRequest(result);
        }

        [MenuRight("/crm/leads", MenuRightKind.Save, IdProperty = "LeadId")]
        [HttpPost("leads")]
        public async Task<IActionResult> SaveLead([FromBody] LeadSaveDto dto)
            => Answer(await _crm.SaveLead(Caller(), await Manager(), Company(), dto));

        /// <summary>Soft delete: the owner or a manager; never a converted lead (22_CRM_Lead_Delete.sql).</summary>
        [MenuRight("/crm/leads", MenuRightKind.Delete)]
        [HttpDelete("leads/{id:int}")]
        public async Task<IActionResult> DeleteLead(int id)
        {
            var result = await _crm.DeleteLead(Caller(), await Manager(), Company(), id);
            if (result.Success) return Ok(result);
            return result.Message == "Lead not found" ? NotFound(result) : BadRequest(result);
        }

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/status")]
        public async Task<IActionResult> ChangeStatus(int id, [FromBody] StatusChangeDto dto)
            => Answer(await _crm.ChangeStatus(Caller(), await Manager(), Company(), id, dto));

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/reassign")]
        public async Task<IActionResult> Reassign(int id, [FromBody] ReassignDto dto)
            => Answer(await _crm.Reassign(Caller(), await Manager(), Company(), id, dto));

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/follow-ups")]
        public async Task<IActionResult> AddFollowUp(int id, [FromBody] FollowUpSaveDto dto)
            => Answer(await _crm.AddFollowUp(Caller(), await Manager(), Company(), id, dto));

        [HttpGet("leads/{id:int}/convert-preview")]
        public async Task<IActionResult> PreviewConvert(int id, [FromQuery] int quotationId)
            => Answer(await _crm.PreviewConvert(Caller(), await Manager(), Company(), id, quotationId));

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/convert")]
        public async Task<IActionResult> Convert(int id, [FromBody] ConvertRequestDto dto)
            => Answer(await _crm.Convert(Caller(), await Manager(), Company(), id, dto));

        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/link-order")]
        public async Task<IActionResult> LinkOrder(int id, [FromBody] LinkOrderDto dto)
            => Answer(await _crm.LinkOrder(Caller(), await Manager(), Company(), id, dto?.OrderNo ?? "", dto?.QuotationId));

        /// <summary>A manager frees the convert marker of a lead, also one flagged for a check of the sales orders.</summary>
        [MenuRight("/crm/leads", MenuRightKind.Edit)]
        [HttpPost("leads/{id:int}/cancel-convert")]
        public async Task<IActionResult> CancelConvert(int id)
            => Answer(await _crm.ManagerCancelConvert(Caller(), await Manager(), Company(), id));

        [MenuRight("/crm/quotations", MenuRightKind.Save, IdProperty = "QuotationId")]
        [HttpPost("quotations")]
        public async Task<IActionResult> SaveQuotation([FromBody] QuotationSaveDto dto)
            => Answer(await _crm.SaveQuotation(Caller(), await Manager(), Company(), dto));

        /// <summary>Settings > Print for the quotation print; a CRM user need not have the admin Settings screen.</summary>
        [HttpGet("print-settings")]
        public async Task<IActionResult> PrintSettings([FromServices] ISettingsService settings)
        {
            var rows = await settings.GetAll();
            var map = rows.Where(r => r.SettingGroup == "Print")
                .ToDictionary(r => r.SettingKey, r => r.SettingValue ?? string.Empty);
            return Ok(ApiResponse<Dictionary<string, string>>.Ok(map));
        }

        [HttpGet("quotations/{id:int}")]
        public async Task<IActionResult> GetQuotation(int id)
        {
            var result = await _crm.GetQuotation(Caller(), await Manager(), Company(), id);
            if (result.Success) return Ok(result);
            return result.Message == "Quotation not found" ? NotFound(result) : BadRequest(result);
        }

        // previous / next of the toolbar; id 0 = from a new quotation
        [HttpGet("quotations/{id:int}/neighbours")]
        public async Task<IActionResult> GetQuotationNeighbours(int id)
            => Answer(await _crm.GetQuotationNeighbours(Caller(), await Manager(), Company(), id));

        [MenuRight("/crm/quotations", MenuRightKind.Edit)]
        [HttpPost("quotations/{id:int}/revise")]
        public async Task<IActionResult> ReviseQuotation(int id)
            => Answer(await _crm.ReviseQuotation(Caller(), await Manager(), Company(), id));

        [MenuRight("/crm/quotations", MenuRightKind.Edit, DeleteWhenStatus = "Cancelled")]
        [HttpPost("quotations/{id:int}/status")]
        public async Task<IActionResult> SetQuotationStatus(int id, [FromBody] QuotationStatusDto dto)
            => Answer(await _crm.SetQuotationStatus(Caller(), await Manager(), Company(), id, dto?.Status ?? ""));

        [HttpGet("products")]
        public async Task<IActionResult> SearchProducts([FromQuery] string? term, [FromQuery] string? category = null, [FromQuery] int? top = null)
            => Answer(await _crm.SearchProducts(Caller(), await Manager(), Company(), term, category, top));

        [HttpGet("product-categories")]
        public async Task<IActionResult> GetProductCategories()
            => Answer(await _crm.GetProductCategories(Caller(), await Manager(), Company()));

        /// <summary>A new product while writing a lead or a quotation: the Products menu's Create right decides. Only adds.</summary>
        [MenuRight("/products", MenuRightKind.Create)]
        [HttpPost("products")]
        public async Task<IActionResult> CreateProduct([FromBody] ProductMasterRequestDto dto)
            => Answer(await _products.CreateProduct(dto));

        [HttpGet("product-category-master")]
        public async Task<IActionResult> GetProductCategoryMaster()
            => Answer(await _products.GetCategories());

        /// <summary>A new category or sub category from the product popup, on the same right as Products. Never renames or switches off one.</summary>
        [MenuRight("/products", MenuRightKind.Edit)]
        [Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager")]
        [HttpPost("product-category-master")]
        public async Task<IActionResult> AddProductCategory([FromBody] ProductCategorySaveDto dto)
        {
            if (dto == null) return BadRequest(ApiResponse<int>.Fail("Enter the name"));
            dto.CategoryId = 0;
            dto.IsActive = true;
            return Answer(await _products.SaveCategory(dto));
        }

        [HttpGet("masters/{kind}")]
        public async Task<IActionResult> GetMasters(string kind)
            => Answer(await _crm.GetMasters(Caller(), await Manager(), Company(), kind));

        [MenuRight("/crm/settings", MenuRightKind.Edit)]
        [HttpPost("masters/{kind}")]
        public async Task<IActionResult> SaveMaster(string kind, [FromBody] CrmMasterDto dto)
            => Answer(await _crm.SaveMaster(Caller(), await Manager(), Company(), kind, dto));

        [HttpGet("members")]
        public async Task<IActionResult> GetMembers()
            => Answer(await _crm.GetMembers(Caller(), await Manager(), Company()));

        [MenuRight("/crm/settings", MenuRightKind.Edit)]
        [HttpPost("members")]
        public async Task<IActionResult> SaveMember([FromBody] CrmMemberDto dto)
            => Answer(await _crm.SaveMember(Caller(), await Manager(), Company(), dto));

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
            => Answer(await _crm.GetDashboard(Caller(), await Manager(), Company()));

        [HttpGet("board")]
        public async Task<IActionResult> GetBoard([FromQuery(Name = "ownerUserId")] int? owner)
            => Answer(await _crm.GetBoard(Caller(), await Manager(), Company(), owner));

        [HttpGet("quotations")]
        public async Task<IActionResult> GetQuotations([FromQuery] QuotationFilterDto filter)
            => Answer(await _crm.GetQuotations(Caller(), await Manager(), Company(), filter));

        /// <summary>Quotations per status for the status tabs of the quotation list, under the list's filters.</summary>
        [HttpGet("quotations/status-counts")]
        public async Task<IActionResult> GetQuotationStatusCounts([FromQuery] QuotationFilterDto filter)
            => Answer(await _crm.GetQuotationStatusCounts(Caller(), await Manager(), Company(), filter));

        [HttpGet("reports/pipeline")]
        public async Task<IActionResult> PipelineReport([FromQuery(Name = "ownerUserId")] int? owner)
            => Answer(await _crm.PipelineReport(Caller(), await Manager(), Company(), owner));

        [HttpGet("reports/sources")]
        public async Task<IActionResult> SourcesReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
            => Answer(await _crm.SourcesReport(Caller(), await Manager(), Company(), from, to));

        [HttpGet("reports/team")]
        public async Task<IActionResult> TeamReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery(Name = "ownerUserId")] int? owner)
            => Answer(await _crm.TeamReport(Caller(), await Manager(), Company(), from, to, owner));

        [HttpGet("reports/lost-reasons")]
        public async Task<IActionResult> LostReasonsReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery(Name = "ownerUserId")] int? owner)
            => Answer(await _crm.LostReasonsReport(Caller(), await Manager(), Company(), from, to, owner));

        [HttpGet("reports/follow-ups")]
        public async Task<IActionResult> FollowUpReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery(Name = "ownerUserId")] int? owner)
            => Answer(await _crm.FollowUpReport(Caller(), await Manager(), Company(), from, to, owner));

        [HttpGet("reports/conversion")]
        public async Task<IActionResult> ConversionReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? groupBy)
            => Answer(await _crm.ConversionReport(Caller(), await Manager(), Company(), from, to, groupBy));
    }
}
