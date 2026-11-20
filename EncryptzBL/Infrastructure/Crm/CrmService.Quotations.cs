using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Crm
{
    public sealed partial class CrmService
    {
        private const string QuotationNotFound = "Quotation not found";

        // the lines go to crm.sp_Quotation_Save as camelCase JSON (the OPENJSON paths of 14_CRM.sql)
        private static readonly JsonSerializerOptions ItemsJsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        public Task<ApiResponse<int>> SaveQuotation(int userId, bool isManager, int companyId, QuotationSaveDto dto)
            => Guard(async () =>
            {
                var problem = CrmRules.QuotationProblem(dto);
                if (problem != null) return ApiResponse<int>.Fail(problem);
                if (dto.LeadId <= 0) return ApiResponse<int>.Fail(LeadNotFound);

                if (dto.QuotationId > 0)
                {
                    var existing = await ReadQuotation(userId, isManager, companyId, dto.QuotationId);
                    if (existing == null || existing.LeadId != dto.LeadId) return ApiResponse<int>.Fail(QuotationNotFound);
                    var editProblem = CrmRules.QuotationEditProblem(existing.Status);
                    if (editProblem != null) return ApiResponse<int>.Fail(editProblem);
                }

                // the amounts of every line and the totals are worked out here, as the Sales Order screen does
                var t = CrmRules.Totals(dto.Items, dto.IsInterState);
                var itemsJson = JsonSerializer.Serialize(dto.Items, ItemsJsonOptions);

                var dt = await GetDataTableAsync("crm.sp_Quotation_Save", new[]
                {
                    In("@CompanyId", companyId), In("@QuotationId", dto.QuotationId), In("@LeadId", dto.LeadId), In("@UserId", userId),
                    In("@IsManager", isManager), In("@LocationId", LocationId), In("@QuoteDate", dto.QuoteDate.Date),
                    In("@ValidUntil", dto.ValidUntil?.Date), In("@IsInterState", dto.IsInterState), In("@SubTotal", t.SubTotal),
                    In("@DiscountTotal", t.DiscountTotal), In("@TaxableTotal", t.TaxableTotal), In("@CGST", t.CGST), In("@SGST", t.SGST),
                    In("@IGST", t.IGST), In("@GrandTotal", t.GrandTotal), In("@Terms", dto.Terms), In("@ItemsJson", itemsJson)
                });
                return ToResponse(Answer(dt));
            });

        public Task<ApiResponse<QuotationDto>> GetQuotation(int userId, bool isManager, int companyId, int quotationId)
            => Guard(async () =>
            {
                var q = await ReadQuotation(userId, isManager, companyId, quotationId);
                return q == null ? ApiResponse<QuotationDto>.Fail(QuotationNotFound) : ApiResponse<QuotationDto>.Ok(q);
            });

        public Task<ApiResponse<NeighboursDto>> GetQuotationNeighbours(int userId, bool isManager, int companyId, int quotationId)
            => Guard(async () =>
            {
                var dt = await GetDataTableAsync("crm.sp_Quotation_Neighbours", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@QuotationId", Math.Max(0, quotationId))
                });
                var n = dt.Rows.Count > 0 ? dt.ToList<NeighboursDto>().First() : new NeighboursDto();
                return ApiResponse<NeighboursDto>.Ok(n);
            });

        private async Task<QuotationDto?> ReadQuotation(int userId, bool isManager, int companyId, int quotationId)
        {
            var ds = await GetDataSetAsync("crm.sp_Quotation_Get", new[]
            {
                In("@CompanyId", companyId), In("@QuotationId", quotationId), In("@UserId", userId),
                In("@IsManager", isManager), In("@LocationId", LocationId)
            });
            if (ds.Tables.Count == 0) return null;

            var q = ds.Tables[0].ToList<QuotationDto>().FirstOrDefault();
            if (q == null) return null;
            if (ds.Tables.Count > 1) q.Items = ds.Tables[1].ToList<QuotationItemDto>();
            return q;
        }

        public Task<ApiResponse<int>> ReviseQuotation(int userId, bool isManager, int companyId, int quotationId)
            => Guard(async () =>
            {
                var dt = await GetDataTableAsync("crm.sp_Quotation_Revise", new[]
                {
                    In("@CompanyId", companyId), In("@QuotationId", quotationId), In("@UserId", userId),
                    In("@IsManager", isManager), In("@LocationId", LocationId)
                });
                return ToResponse(Answer(dt));
            });

        public Task<ApiResponse<int>> SetQuotationStatus(int userId, bool isManager, int companyId, int quotationId, string status)
            => Guard(async () =>
            {
                // crm.sp_Quotation_SetStatus also moves the lead to Quotation in the same transaction when it is earlier in the
                // flow (CrmRules.AutoStatusAfterQuoteSent), so the quotation and the lead never disagree
                var dt = await GetDataTableAsync("crm.sp_Quotation_SetStatus", new[]
                {
                    In("@CompanyId", companyId), In("@QuotationId", quotationId), In("@UserId", userId),
                    In("@IsManager", isManager), In("@LocationId", LocationId), In("@Status", (status ?? "").Trim())
                });
                return ToResponse(Answer(dt));
            });

        public Task<ApiResponse<List<CrmProductDto>>> SearchProducts(int userId, bool isManager, int companyId, string? term, string? category = null, int? top = null)
            => Guard(async () =>
            {
                var dt = await GetDataTableAsync("crm.sp_Product_Search", new[]
                {
                    In("@CompanyId", companyId), In("@Search", string.IsNullOrWhiteSpace(term) ? null : term.Trim()), In("@Top", Math.Clamp(top ?? 20, 1, 100)),
                    In("@Category", string.IsNullOrWhiteSpace(category) ? null : category.Trim())
                });
                return ApiResponse<List<CrmProductDto>>.Ok(dt.ToList<CrmProductDto>());
            });

        public Task<ApiResponse<List<string>>> GetProductCategories(int userId, bool isManager, int companyId)
            => Guard(async () =>
            {
                var dt = await GetDataTableAsync("crm.sp_Product_Categories", new[] { In("@CompanyId", companyId) });
                var list = dt.Rows.Cast<System.Data.DataRow>().Select(r => Convert.ToString(r["Category"]) ?? "")
                    .Where(s => s.Length > 0).ToList();
                return ApiResponse<List<string>>.Ok(list);
            });

        public Task<ApiResponse<PagedResult<QuotationListRowDto>>> GetQuotations(int userId, bool isManager, int companyId, QuotationFilterDto f)
            => Guard(async () =>
            {
                f ??= new QuotationFilterDto();
                if (f.From.HasValue && f.To.HasValue && f.From.Value.Date > f.To.Value.Date)
                    return ApiResponse<PagedResult<QuotationListRowDto>>.Fail("The From date is after the To date");
                var page = f.Page < 1 ? 1 : f.Page;
                var size = f.PageSize < 1 ? 25 : Math.Min(f.PageSize, 200);

                var dt = await GetDataTableAsync("crm.sp_Quotation_List", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId),
                    In("@Search", f.Search), In("@Status", f.Status), In("@From", f.From?.Date), In("@To", f.To?.Date),
                    In("@Page", page), In("@PageSize", size)
                });

                var items = dt.ToList<QuotationListRowDto>();
                var total = items.Count > 0 ? items[0].TotalCount : 0;
                var pages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)size);
                return ApiResponse<PagedResult<QuotationListRowDto>>.Ok(new PagedResult<QuotationListRowDto>(items, total, page, size, pages), "Success", total);
            });

        /// <summary>Quotations per status for the list's status tabs: the list's filters except the status (crm.sp_Quotation_StatusCounts).</summary>
        public Task<ApiResponse<List<LeadStatusCountDto>>> GetQuotationStatusCounts(int userId, bool isManager, int companyId, QuotationFilterDto f)
            => Guard(async () =>
            {
                f ??= new QuotationFilterDto();
                if (f.From.HasValue && f.To.HasValue && f.From.Value.Date > f.To.Value.Date)
                    return ApiResponse<List<LeadStatusCountDto>>.Fail("The From date is after the To date");

                var dt = await GetDataTableAsync("crm.sp_Quotation_StatusCounts", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId),
                    In("@Search", f.Search), In("@From", f.From?.Date), In("@To", f.To?.Date)
                });
                return ApiResponse<List<LeadStatusCountDto>>.Ok(dt.ToList<LeadStatusCountDto>());
            });
    }
}
