using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Text.Json;

namespace EncryptzBL.Infrastructure.Sales.Modules
{
    public class SalesService : BaseRepository, ISalesService
    {
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public SalesService(DbHelper db) : base(db) { }

        // =====================================================================
        // Customer master
        // =====================================================================
        public async Task<List<SalesCustomerDto>> SearchCustomers(string? searchTerm, int top = 50)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", Clean(searchTerm)),
                SqlParameterHelper.Input("@Top", top)
            };
            return await GetListAsync<SalesCustomerDto>("sp_Sales_Customer_Search", p);
        }

        public async Task<ApiResponse<SalesCustomerSaveResultDto>> SaveCustomer(SalesCustomerSaveDto dto)
        {
            if (dto == null) return ApiResponse<SalesCustomerSaveResultDto>.Fail("No customer data.");
            if (string.IsNullOrWhiteSpace(dto.CustomerName)) return ApiResponse<SalesCustomerSaveResultDto>.Fail("Customer name is required.");
            if (string.IsNullOrWhiteSpace(dto.MobileNumber)) return ApiResponse<SalesCustomerSaveResultDto>.Fail("Mobile number is required.");

            var p = new[]
            {
                SqlParameterHelper.Input("@CustomerId", dto.CustomerId),
                SqlParameterHelper.Input("@CustomerName", dto.CustomerName.Trim()),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber.Trim()),
                SqlParameterHelper.Input("@Email", Clean(dto.Email)),
                SqlParameterHelper.Input("@AlternatePhone", Clean(dto.AlternatePhone)),
                SqlParameterHelper.Input("@Address", Clean(dto.Address)),
                SqlParameterHelper.Input("@City", Clean(dto.City)),
                SqlParameterHelper.Input("@State", Clean(dto.State)),
                SqlParameterHelper.Input("@PinCode", Clean(dto.PinCode)),
                SqlParameterHelper.Input("@Landmark", Clean(dto.Landmark)),
                SqlParameterHelper.Input("@GSTIN", Clean(dto.GSTIN)),
                SqlParameterHelper.Input("@Latitude", dto.Latitude),
                SqlParameterHelper.Input("@Longitude", dto.Longitude)
            };

            var dt = await GetDataTableAsync("sp_Sales_Customer_Save", p);
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<SalesCustomerSaveResultDto>.Fail("No response from the database.");

            var row = dt.Rows[0];
            if (Convert.ToInt32(row["Success"]) != 1)
                return ApiResponse<SalesCustomerSaveResultDto>.Fail(row["Message"]?.ToString() ?? "Customer could not be saved.");

            var customerId = Convert.ToInt32(row["CustomerId"]);
            var result = new SalesCustomerSaveResultDto
            {
                CustomerId = customerId,
                IsNew = Convert.ToInt32(row["IsNew"]) == 1
            };

            // return the saved row so the screen can fill the billing details
            var list = await GetListAsync<SalesCustomerDto>("sp_Sales_Customer_Search", new[]
            {
                SqlParameterHelper.Input("@SearchTerm", dto.MobileNumber.Trim()),
                SqlParameterHelper.Input("@Top", 10)
            });
            result.Customer = list.FirstOrDefault(c => c.CustomerId == customerId);

            return ApiResponse<SalesCustomerSaveResultDto>.Ok(result, row["Message"]?.ToString() ?? "Saved");
        }

        // =====================================================================
        // Sales order
        // =====================================================================
        public async Task<string> GetNextOrderNumber()
        {
            var dt = await GetDataTableAsync("sp_SalesOrder_NextNumber");
            return dt != null && dt.Rows.Count > 0 ? dt.Rows[0]["OrderNo"]?.ToString() ?? string.Empty : string.Empty;
        }

        public async Task<ApiResponse<SalesOrderSaveResultDto>> SaveOrder(SalesOrderSaveDto dto, int userId)
        {
            if (dto == null) return ApiResponse<SalesOrderSaveResultDto>.Fail("No bill data.");
            if (dto.CustomerId <= 0) return ApiResponse<SalesOrderSaveResultDto>.Fail("Select a customer first.");

            var items = (dto.Items ?? new())
                .Where(i => i != null && !string.IsNullOrWhiteSpace(i.ProductName))
                .ToList();
            if (items.Count == 0) return ApiResponse<SalesOrderSaveResultDto>.Fail("Add at least one product line.");
            if (items.Any(i => i.Qty < 1)) return ApiResponse<SalesOrderSaveResultDto>.Fail("Quantity must be at least 1.");
            if (items.Any(i => i.Rate < 0 || i.DiscountAmount < 0 || i.GstPercent < 0))
                return ApiResponse<SalesOrderSaveResultDto>.Fail("Rate, discount and GST cannot be negative.");

            var p = new[]
            {
                SqlParameterHelper.Input("@SalesOrderId", dto.SalesOrderId),
                SqlParameterHelper.Input("@OrderDate", dto.OrderDate.Date),
                SqlParameterHelper.Input("@CustomerId", dto.CustomerId),
                SqlParameterHelper.Input("@PaymentMode", Clean(dto.PaymentMode)),
                SqlParameterHelper.Input("@ReferenceNo", Clean(dto.ReferenceNo)),
                SqlParameterHelper.Input("@ContactNumber", Clean(dto.ContactNumber)),
                SqlParameterHelper.Input("@GSTIN", Clean(dto.GSTIN)),
                SqlParameterHelper.Input("@BillingAddress", Clean(dto.BillingAddress)),
                SqlParameterHelper.Input("@City", Clean(dto.City)),
                SqlParameterHelper.Input("@State", Clean(dto.State)),
                SqlParameterHelper.Input("@PinCode", Clean(dto.PinCode)),
                SqlParameterHelper.Input("@IsInterState", dto.IsInterState),
                SqlParameterHelper.Input("@Notes", Clean(dto.Notes)),
                SqlParameterHelper.Input("@ItemsJson", JsonSerializer.Serialize(items, JsonOpts)),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_SalesOrder_Save", p);
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<SalesOrderSaveResultDto>.Fail("No response from the database.");

            var row = dt.Rows[0];
            if (Convert.ToInt32(row["Success"]) != 1)
                return ApiResponse<SalesOrderSaveResultDto>.Fail(row["Message"]?.ToString() ?? "Bill could not be saved.");

            return ApiResponse<SalesOrderSaveResultDto>.Ok(new SalesOrderSaveResultDto
            {
                SalesOrderId = Convert.ToInt32(row["SalesOrderId"]),
                OrderNo = row["OrderNo"]?.ToString() ?? string.Empty
            }, row["Message"]?.ToString() ?? "Saved");
        }

        public async Task<ApiResponse> CancelOrder(int salesOrderId, int userId)
        {
            var dt = await GetDataTableAsync("sp_SalesOrder_Cancel", new[]
            {
                SqlParameterHelper.Input("@SalesOrderId", salesOrderId),
                SqlParameterHelper.Input("@UserId", userId)
            });
            if (dt == null || dt.Rows.Count == 0) return new ApiResponse(false, "No response from the database.");
            return new ApiResponse(Convert.ToInt32(dt.Rows[0]["Success"]) == 1, dt.Rows[0]["Message"]?.ToString() ?? string.Empty);
        }

        public async Task<PagedResult<SalesOrderListDto>> GetOrders(SalesOrderFilterDto filter)
        {
            filter ??= new SalesOrderFilterDto();
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", Clean(filter.SearchTerm)),
                SqlParameterHelper.Input("@Status", Clean(filter.Status)),
                SqlParameterHelper.Input("@FromDate", filter.FromDate),
                SqlParameterHelper.Input("@ToDate", filter.ToDate),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };
            var items = await GetListAsync<SalesOrderListDto>("sp_SalesOrder_GetAll", p);
            return Page(items, items.FirstOrDefault()?.TotalCount ?? 0, filter.PageNumber, filter.PageSize);
        }

        public async Task<ApiResponse<SalesOrderDetailDto>> GetOrder(int salesOrderId)
        {
            var ds = await GetDataSetAsync("sp_SalesOrder_GetById", new[] { SqlParameterHelper.Input("@SalesOrderId", salesOrderId) });
            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<SalesOrderDetailDto>.Fail("Bill not found.");

            var detail = new SalesOrderDetailDto
            {
                Order = ds.Tables[0].ToList<SalesOrderHeaderDto>().First(),
                Items = ds.Tables.Count > 1 ? ds.Tables[1].ToList<SalesOrderItemDto>() : new(),
                Despatches = ds.Tables.Count > 2 ? ds.Tables[2].ToList<DespatchSummaryDto>() : new()
            };
            return ApiResponse<SalesOrderDetailDto>.Ok(detail);
        }

        // =====================================================================
        // Despatch
        // =====================================================================
        public async Task<ApiResponse<DespatchCreateResultDto>> CreateDespatch(DespatchCreateDto dto, int userId)
        {
            if (dto == null || dto.SalesOrderId <= 0) return ApiResponse<DespatchCreateResultDto>.Fail("Select the bill to despatch.");

            var units = (dto.Units ?? new()).Where(u => u != null && u.SalesOrderItemId > 0).ToList();

            var p = new[]
            {
                SqlParameterHelper.Input("@SalesOrderId", dto.SalesOrderId),
                SqlParameterHelper.Input("@DespatchDate", dto.DespatchDate?.Date),
                SqlParameterHelper.Input("@DeliveryAddress", Clean(dto.DeliveryAddress)),
                SqlParameterHelper.Input("@ContactPerson", Clean(dto.ContactPerson)),
                SqlParameterHelper.Input("@ContactNumber", Clean(dto.ContactNumber)),
                SqlParameterHelper.Input("@TransporterName", Clean(dto.TransporterName)),
                SqlParameterHelper.Input("@VehicleNo", Clean(dto.VehicleNo)),
                SqlParameterHelper.Input("@DriverName", Clean(dto.DriverName)),
                SqlParameterHelper.Input("@TrackingNo", Clean(dto.TrackingNo)),
                SqlParameterHelper.Input("@Remarks", Clean(dto.Remarks)),
                SqlParameterHelper.Input("@ItemsJson", JsonSerializer.Serialize(units, JsonOpts)),
                SqlParameterHelper.Input("@CreateInstallationComplaint", dto.CreateInstallationComplaint),
                SqlParameterHelper.Input("@Priority", Clean(dto.Priority) ?? "Medium"),
                SqlParameterHelper.Input("@PreferredDate", dto.PreferredDate?.Date),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_Despatch_Create", p);
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<DespatchCreateResultDto>.Fail("No response from the database.");

            var row = dt.Rows[0];
            if (Convert.ToInt32(row["Success"]) != 1)
                return ApiResponse<DespatchCreateResultDto>.Fail(row["Message"]?.ToString() ?? "Despatch could not be saved.");

            return ApiResponse<DespatchCreateResultDto>.Ok(new DespatchCreateResultDto
            {
                DespatchId = Convert.ToInt32(row["DespatchId"]),
                DespatchNo = row["DespatchNo"]?.ToString() ?? string.Empty,
                ComplaintId = row["ComplaintId"] == DBNull.Value ? null : Convert.ToInt32(row["ComplaintId"]),
                ComplaintNumber = row["ComplaintNumber"] == DBNull.Value ? null : row["ComplaintNumber"]?.ToString()
            }, row["Message"]?.ToString() ?? "Saved");
        }

        public async Task<PagedResult<DespatchListDto>> GetDespatches(DespatchFilterDto filter)
        {
            filter ??= new DespatchFilterDto();
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", Clean(filter.SearchTerm)),
                SqlParameterHelper.Input("@FromDate", filter.FromDate),
                SqlParameterHelper.Input("@ToDate", filter.ToDate),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };
            var items = await GetListAsync<DespatchListDto>("sp_Despatch_GetAll", p);
            return Page(items, items.FirstOrDefault()?.TotalCount ?? 0, filter.PageNumber, filter.PageSize);
        }

        public async Task<ApiResponse<DespatchDetailDto>> GetDespatch(int despatchId)
        {
            var ds = await GetDataSetAsync("sp_Despatch_GetById", new[] { SqlParameterHelper.Input("@DespatchId", despatchId) });
            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<DespatchDetailDto>.Fail("Despatch not found.");

            return ApiResponse<DespatchDetailDto>.Ok(new DespatchDetailDto
            {
                Despatch = ds.Tables[0].ToList<DespatchHeaderDto>().First(),
                Units = ds.Tables.Count > 1 ? ds.Tables[1].ToList<DespatchUnitDetailDto>() : new()
            });
        }

        // =====================================================================
        // Warranty
        // =====================================================================
        public async Task<PagedResult<WarrantyLookupDto>> WarrantyLookup(WarrantyLookupFilterDto filter)
        {
            filter ??= new WarrantyLookupFilterDto();
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", Clean(filter.Search)),
                SqlParameterHelper.Input("@CustomerId", filter.CustomerId),
                SqlParameterHelper.Input("@OnlyActive", filter.OnlyActive),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };
            var items = await GetListAsync<WarrantyLookupDto>("sp_Sales_WarrantyLookup", p);
            return Page(items, items.FirstOrDefault()?.TotalCount ?? 0, filter.PageNumber, filter.PageSize);
        }

        // =====================================================================
        private static string? Clean(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static PagedResult<T> Page<T>(List<T> items, int totalCount, int pageNumber, int pageSize)
        {
            var size = pageSize < 1 ? 20 : pageSize;
            var pages = totalCount > 0 ? (int)Math.Ceiling(totalCount / (double)size) : (items.Count > 0 ? 1 : 0);
            return new PagedResult<T>(items, totalCount, pageNumber < 1 ? 1 : pageNumber, size, pages);
        }
    }
}
