using EncryptzBL.Common;
using EncryptzBL.Common.Sales;
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
                SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(searchTerm)),
                SqlParameterHelper.Input("@Top", top)
            };
            return await GetListAsync<SalesCustomerDto>("sp_Sales_Customer_Search", p);
        }

        public async Task<ApiResponse<SalesCustomerSaveResultDto>> SaveCustomer(SalesCustomerSaveDto dto)
        {
            if (dto == null) return ApiResponse<SalesCustomerSaveResultDto>.Fail("No customer data.");
            if (string.IsNullOrWhiteSpace(dto.CustomerName)) return ApiResponse<SalesCustomerSaveResultDto>.Fail("Customer name is required.");
            var mobile = EncryptzBL.Common.Sales.SalesInputRules.NormalizeMobile(dto.MobileNumber);
            if (mobile == null) return ApiResponse<SalesCustomerSaveResultDto>.Fail("Enter a valid 10-digit mobile number.");
            if (!EncryptzBL.Common.Sales.SalesInputRules.IsEmailOrBlank(dto.Email)) return ApiResponse<SalesCustomerSaveResultDto>.Fail("Enter a valid e-mail address.");
            if (!EncryptzBL.Common.Sales.SalesInputRules.IsPinOrBlank(dto.PinCode)) return ApiResponse<SalesCustomerSaveResultDto>.Fail("PIN code must be 6 digits.");

            var p = new[]
            {
                SqlParameterHelper.Input("@CustomerId", dto.CustomerId),
                SqlParameterHelper.Input("@CustomerName", dto.CustomerName.Trim().ToUpperInvariant()),
                SqlParameterHelper.Input("@MobileNumber", mobile),
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
                SqlParameterHelper.Input("@SearchTerm", mobile),
                SqlParameterHelper.Input("@Top", 10)
            });
            result.Customer = list.FirstOrDefault(c => c.CustomerId == customerId);

            return ApiResponse<SalesCustomerSaveResultDto>.Ok(result, row["Message"]?.ToString() ?? "Saved");
        }

        // =====================================================================
        // Transporter master
        // =====================================================================
        public async Task<List<TransporterDto>> GetTransporters(bool includeInactive)
            => await GetListAsync<TransporterDto>("sp_Transporter_List", new[] { SqlParameterHelper.Input("@IncludeInactive", includeInactive) });

        public async Task<ApiResponse<int>> SaveTransporter(TransporterDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.TransporterName)) return ApiResponse<int>.Fail("Enter the transporter name.");
            var name = dto.TransporterName.Trim();
            if (name.Length > 150) return ApiResponse<int>.Fail("The transporter name is too long.");
            var mobile = (dto.Mobile ?? "").Trim();
            if (mobile.Length > 0)
            {
                mobile = EncryptzBL.Common.Sales.SalesInputRules.NormalizeMobile(mobile) ?? "";
                if (mobile.Length == 0) return ApiResponse<int>.Fail("Enter a valid 10-digit mobile number.");
            }
            var gstin = (dto.GSTIN ?? "").Trim().ToUpperInvariant();
            if (gstin.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(gstin, "^[0-9A-Z]{15}$"))
                return ApiResponse<int>.Fail("GSTIN must be 15 characters.");
            if ((dto.ContactPerson ?? "").Length > 150 || (dto.Address ?? "").Length > 400)
                return ApiResponse<int>.Fail("The contact person or the address is too long.");

            var dt = await GetDataTableAsync("sp_Transporter_Save", new[]
            {
                SqlParameterHelper.Input("@TransporterId", dto.TransporterId),
                SqlParameterHelper.Input("@TransporterName", name),
                SqlParameterHelper.Input("@ContactPerson", dto.ContactPerson ?? ""),
                SqlParameterHelper.Input("@Mobile", mobile),
                SqlParameterHelper.Input("@GSTIN", gstin),
                SqlParameterHelper.Input("@Address", dto.Address ?? ""),
                SqlParameterHelper.Input("@IsActive", dto.IsActive)
            });
            if (dt == null || dt.Rows.Count == 0) return ApiResponse<int>.Fail("No response from the database.");
            var row = dt.Rows[0];
            var message = row["Message"]?.ToString() ?? "";
            return Convert.ToInt32(row["Success"]) == 1
                ? ApiResponse<int>.Ok(Convert.ToInt32(row["TransporterId"]), message)
                : ApiResponse<int>.Fail(message);
        }

        // =====================================================================
        // Sales order
        // =====================================================================
        public async Task<string> GetNextOrderNumber()
        {
            var dt = await GetDataTableAsync("sp_SalesOrder_NextNumber");
            return dt != null && dt.Rows.Count > 0 ? dt.Rows[0]["OrderNo"]?.ToString() ?? string.Empty : string.Empty;
        }

        public async Task<ApiResponse<SalesOrderSaveResultDto>> SaveOrder(SalesOrderSaveDto dto, int userId, string initialStatus = SalesOrderStatus.Order)
        {
            if (dto == null) return ApiResponse<SalesOrderSaveResultDto>.Fail("No bill data.");
            if (!SalesOrderStatus.IsStart(initialStatus))
                return ApiResponse<SalesOrderSaveResultDto>.Fail("A new sales order starts as Sales Order or Sales Confirmed.");
            if (dto.CustomerId <= 0) return ApiResponse<SalesOrderSaveResultDto>.Fail("Select a customer first.");

            var items = (dto.Items ?? new())
                .Where(i => i != null && !string.IsNullOrWhiteSpace(i.ProductName))
                .ToList();
            if (items.Count == 0) return ApiResponse<SalesOrderSaveResultDto>.Fail("Add at least one product line.");
            if (items.Any(i => i.Qty < 1)) return ApiResponse<SalesOrderSaveResultDto>.Fail("Quantity must be at least 1.");
            if (items.Any(i => i.Rate < 0 || i.DiscountAmount < 0 || i.GstPercent < 0))
                return ApiResponse<SalesOrderSaveResultDto>.Fail("Rate, discount and GST cannot be negative.");

            if (dto.PaymentDueDate.HasValue && dto.PaymentDueDate.Value.Date < dto.OrderDate.Date)
                return ApiResponse<SalesOrderSaveResultDto>.Fail("The payment due date cannot be before the bill date.");
            if ((dto.Terms?.Trim().Length ?? 0) > 4000) return ApiResponse<SalesOrderSaveResultDto>.Fail("The terms are too long.");
            if ((dto.WarrantyText?.Trim().Length ?? 0) > 4000) return ApiResponse<SalesOrderSaveResultDto>.Fail("The warranty is too long.");

            var p = new[]
            {
                SqlParameterHelper.Input("@SalesOrderId", dto.SalesOrderId),
                SqlParameterHelper.Input("@OrderDate", dto.OrderDate.Date),
                SqlParameterHelper.Input("@CustomerId", dto.CustomerId),
                SqlParameterHelper.Input("@PaymentMode", Clean(dto.PaymentMode)),
                SqlParameterHelper.Input("@PaymentDueDate", dto.PaymentDueDate?.Date),
                SqlParameterHelper.Input("@ReferenceNo", Clean(dto.ReferenceNo)),
                SqlParameterHelper.Input("@ContactNumber", Clean(dto.ContactNumber)),
                SqlParameterHelper.Input("@GSTIN", Clean(dto.GSTIN)),
                SqlParameterHelper.Input("@BillingAddress", Clean(dto.BillingAddress)),
                SqlParameterHelper.Input("@City", Clean(dto.City)),
                SqlParameterHelper.Input("@State", Clean(dto.State)),
                SqlParameterHelper.Input("@PinCode", Clean(dto.PinCode)),
                SqlParameterHelper.Input("@IsInterState", dto.IsInterState),
                SqlParameterHelper.Input("@Notes", Clean(dto.Notes)),
                SqlParameterHelper.Input("@Terms", Clean(dto.Terms)),
                SqlParameterHelper.Input("@WarrantyText", Clean(dto.WarrantyText)),
                SqlParameterHelper.Input("@ItemsJson", JsonSerializer.Serialize(items, JsonOpts)),
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@Status", initialStatus)
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

        public async Task<ApiResponse> SetOrderStatus(int salesOrderId, string? status, int userId)
        {
            status = status?.Trim();
            if (salesOrderId <= 0) return new ApiResponse(false, "Sales order not found.");
            if (status is not (SalesOrderStatus.Confirmed or SalesOrderStatus.Billed))
                return new ApiResponse(false, "A sales order can be marked Sales Confirmed or Billed.");

            // sp_SalesOrder_SetStatus decides: the step order and, for Billed, an Invoice PDF attached
            var dt = await GetDataTableAsync("sp_SalesOrder_SetStatus", new[]
            {
                SqlParameterHelper.Input("@SalesOrderId", salesOrderId),
                SqlParameterHelper.Input("@Status", status),
                SqlParameterHelper.Input("@UserId", userId)
            });
            if (dt == null || dt.Rows.Count == 0) return new ApiResponse(false, "No response from the database.");
            return new ApiResponse(Convert.ToInt32(dt.Rows[0]["Success"]) == 1, dt.Rows[0]["Message"]?.ToString() ?? string.Empty);
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
                SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(filter.SearchTerm)),
                SqlParameterHelper.Input("@Status", Clean(filter.Status)),
                SqlParameterHelper.Input("@FromDate", filter.FromDate),
                SqlParameterHelper.Input("@ToDate", filter.ToDate),
                SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                SqlParameterHelper.Input("@PageSize", filter.PageSize)
            };
            var items = await GetListAsync<SalesOrderListDto>("sp_SalesOrder_GetAll", p);
            return Page(items, items.FirstOrDefault()?.TotalCount ?? 0, filter.PageNumber, filter.PageSize);
        }

        public async Task<ApiResponse<NeighboursDto>> GetOrderNeighbours(int salesOrderId)
        {
            var dt = await GetDataTableAsync("sp_SalesOrder_Neighbours", new[] { SqlParameterHelper.Input("@SalesOrderId", Math.Max(0, salesOrderId)) });
            var n = dt != null && dt.Rows.Count > 0 ? dt.ToList<NeighboursDto>().First() : new NeighboursDto();
            return ApiResponse<NeighboursDto>.Ok(n);
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
            var details = EncryptzBL.Common.Sales.ServiceDespatchRules.DetailsProblem(dto.DespatchMode, dto.TrackingNo);
            if (details != null) return ApiResponse<DespatchCreateResultDto>.Fail(details);

            // the warranty starts on this date, so goods cannot leave before they were billed
            if (dto.DespatchDate.HasValue)
            {
                var bill = await GetOrder(dto.SalesOrderId);
                if (bill.Success && bill.Data?.Order != null && dto.DespatchDate.Value.Date < bill.Data.Order.OrderDate.Date)
                    return ApiResponse<DespatchCreateResultDto>.Fail($"Despatch date cannot be before the bill date ({bill.Data.Order.OrderDate:dd MMM yyyy}).");
            }

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
                SqlParameterHelper.Input("@DespatchMode", Clean(dto.DespatchMode)),
                SqlParameterHelper.Input("@ReferenceDate", dto.ReferenceDate?.Date),
                SqlParameterHelper.Input("@Remarks", Clean(dto.Remarks)),
                SqlParameterHelper.Input("@ItemsJson", JsonSerializer.Serialize(units, JsonOpts)),
                SqlParameterHelper.Input("@CreateInstallationComplaint", dto.CreateInstallationComplaint),
                SqlParameterHelper.Input("@Priority", Clean(dto.Priority) ?? "Medium"),
                SqlParameterHelper.Input("@PreferredDate", dto.PreferredDate?.Date),
                SqlParameterHelper.Input("@UserId", userId)
            };

            DataTable dt;
            try
            {
                dt = await GetDataTableAsync("sp_Despatch_Create", p);
            }
            catch (SqlException ex) when (ex.Number == SqlTooManyArguments)
            {
                return ApiResponse<DespatchCreateResultDto>.Fail(DocumentsNotInstalled);
            }
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
                SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(filter.SearchTerm)),
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
        // Documents of a bill (script 23)
        // =====================================================================
        private const int SqlProcedureMissing = 2812;
        // =====================================================================
        // Spare and repaired parts in the single Despatch screen
        // =====================================================================
        private const string ServiceDespatchNotInstalled = "This company database needs script 25 (single despatch).";

        public async Task<ApiResponse<PagedResult<ServiceDespatchListDto>>> GetServiceDespatches(ServiceDespatchFilterDto filter)
        {
            filter ??= new ServiceDespatchFilterDto();
            var stage = string.Equals(filter.Stage?.Trim(), "Despatched", StringComparison.OrdinalIgnoreCase) ? "Despatched" : "Pending";
            try
            {
                var items = await GetListAsync<ServiceDespatchListDto>("sp_ServiceDespatch_List", new[]
                {
                    SqlParameterHelper.Input("@Stage", stage),
                    SqlParameterHelper.Input("@SourceType", EncryptzBL.Common.Sales.ServiceDespatchRules.Source(filter.SourceType)),
                    SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(filter.SearchTerm)),
                    SqlParameterHelper.Input("@FromDate", filter.FromDate?.Date),
                    SqlParameterHelper.Input("@ToDate", filter.ToDate?.Date),
                    SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                    SqlParameterHelper.Input("@PageSize", filter.PageSize)
                });
                return ApiResponse<PagedResult<ServiceDespatchListDto>>.Ok(Page(items, items.FirstOrDefault()?.TotalCount ?? 0, filter.PageNumber, filter.PageSize));
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return ApiResponse<PagedResult<ServiceDespatchListDto>>.Fail(ServiceDespatchNotInstalled);
            }
        }

        public async Task<ApiResponse<ServiceDespatchResultDto>> CreateServiceDespatch(ServiceDespatchCreateDto dto, int userId)
        {
            if (dto == null) return ApiResponse<ServiceDespatchResultDto>.Fail("Select the request to despatch.");
            var today = DateTime.UtcNow.AddMinutes(330).Date;
            var problem = EncryptzBL.Common.Sales.ServiceDespatchRules.Problem(dto.SourceType, dto.SourceId, dto.DespatchDate, dto.DespatchMode, dto.ReferenceNo, dto.ReferenceDate, today);
            if (problem != null) return ApiResponse<ServiceDespatchResultDto>.Fail(problem);
            var markup = InputSanitizer.Validate(("Reference", dto.ReferenceNo), ("Transporter", dto.TransporterName),
                ("Vehicle", dto.VehicleNo), ("Driver", dto.DriverName), ("Remarks", dto.Remarks));
            if (markup != null) return ApiResponse<ServiceDespatchResultDto>.Fail(markup);

            try
            {
                var dt = await GetDataTableAsync("sp_ServiceDespatch_Create", new[]
                {
                    SqlParameterHelper.Input("@SourceType", EncryptzBL.Common.Sales.ServiceDespatchRules.Source(dto.SourceType)),
                    SqlParameterHelper.Input("@SourceId", dto.SourceId),
                    SqlParameterHelper.Input("@DespatchDate", dto.DespatchDate!.Value.Date),
                    SqlParameterHelper.Input("@DespatchMode", EncryptzBL.Common.Sales.ServiceDespatchRules.Mode(dto.DespatchMode)),
                    SqlParameterHelper.Input("@ReferenceNo", Clean(dto.ReferenceNo)),
                    SqlParameterHelper.Input("@ReferenceDate", dto.ReferenceDate?.Date),
                    SqlParameterHelper.Input("@TransporterName", Clean(dto.TransporterName)),
                    SqlParameterHelper.Input("@VehicleNo", Clean(dto.VehicleNo)),
                    SqlParameterHelper.Input("@DriverName", Clean(dto.DriverName)),
                    SqlParameterHelper.Input("@Remarks", Clean(dto.Remarks)),
                    SqlParameterHelper.Input("@UserId", userId)
                });
                if (dt == null || dt.Rows.Count == 0) return ApiResponse<ServiceDespatchResultDto>.Fail("No response from the database.");
                var row = dt.Rows[0];
                if (Convert.ToInt32(row["Success"]) != 1)
                    return ApiResponse<ServiceDespatchResultDto>.Fail(row["Message"]?.ToString() ?? "Despatch could not be saved.");
                return ApiResponse<ServiceDespatchResultDto>.Ok(new ServiceDespatchResultDto
                {
                    ServiceDespatchId = Convert.ToInt32(row["ServiceDespatchId"]),
                    DespatchNo = row["DespatchNo"]?.ToString() ?? string.Empty
                }, row["Message"]?.ToString() ?? "Saved");
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return ApiResponse<ServiceDespatchResultDto>.Fail(ServiceDespatchNotInstalled);
            }
        }

        public async Task<ApiResponse> AddServiceDespatchDetails(ServiceDespatchCreateDto dto, int userId)
        {
            if (dto == null) return new ApiResponse(false, "Select the despatch.");
            var today = DateTime.UtcNow.AddMinutes(330).Date;
            var problem = EncryptzBL.Common.Sales.ServiceDespatchRules.Problem(dto.SourceType, dto.SourceId, dto.DespatchDate, dto.DespatchMode, dto.ReferenceNo, dto.ReferenceDate, today)
                ?? InputSanitizer.Validate(("Reference", dto.ReferenceNo), ("Transporter", dto.TransporterName),
                    ("Vehicle", dto.VehicleNo), ("Driver", dto.DriverName), ("Remarks", dto.Remarks));
            if (problem != null) return new ApiResponse(false, problem);

            return await DetailsResult("sp_ServiceDespatch_AddDetails", new[]
            {
                SqlParameterHelper.Input("@SourceType", EncryptzBL.Common.Sales.ServiceDespatchRules.Source(dto.SourceType)),
                SqlParameterHelper.Input("@SourceId", dto.SourceId),
                SqlParameterHelper.Input("@DespatchDate", dto.DespatchDate!.Value.Date),
                SqlParameterHelper.Input("@DespatchMode", EncryptzBL.Common.Sales.ServiceDespatchRules.Mode(dto.DespatchMode)),
                SqlParameterHelper.Input("@ReferenceNo", Clean(dto.ReferenceNo)),
                SqlParameterHelper.Input("@ReferenceDate", dto.ReferenceDate?.Date),
                SqlParameterHelper.Input("@TransporterName", Clean(dto.TransporterName)),
                SqlParameterHelper.Input("@VehicleNo", Clean(dto.VehicleNo)),
                SqlParameterHelper.Input("@DriverName", Clean(dto.DriverName)),
                SqlParameterHelper.Input("@Remarks", Clean(dto.Remarks)),
                SqlParameterHelper.Input("@UserId", userId)
            });
        }

        public async Task<ApiResponse> AddDespatchDetails(int despatchId, DespatchDetailsDto dto, int userId)
        {
            if (dto == null || despatchId <= 0) return new ApiResponse(false, "Select the despatch.");
            var problem = EncryptzBL.Common.Sales.ServiceDespatchRules.DetailsProblem(dto.DespatchMode, dto.ReferenceNo)
                ?? (dto.ReferenceDate?.Date > DateTime.UtcNow.AddMinutes(330).Date ? "Reference date cannot be in the future." : null)
                ?? InputSanitizer.Validate(("Reference", dto.ReferenceNo), ("Transporter", dto.TransporterName),
                    ("Vehicle", dto.VehicleNo), ("Driver", dto.DriverName));
            if (problem != null) return new ApiResponse(false, problem);

            return await DetailsResult("sp_Despatch_AddDetails", new[]
            {
                SqlParameterHelper.Input("@DespatchId", despatchId),
                SqlParameterHelper.Input("@DespatchMode", EncryptzBL.Common.Sales.ServiceDespatchRules.Mode(dto.DespatchMode)),
                SqlParameterHelper.Input("@ReferenceNo", Clean(dto.ReferenceNo)),
                SqlParameterHelper.Input("@ReferenceDate", dto.ReferenceDate?.Date),
                SqlParameterHelper.Input("@TransporterName", Clean(dto.TransporterName)),
                SqlParameterHelper.Input("@VehicleNo", Clean(dto.VehicleNo)),
                SqlParameterHelper.Input("@DriverName", Clean(dto.DriverName)),
                SqlParameterHelper.Input("@UserId", userId)
            });
        }

        private async Task<ApiResponse> DetailsResult(string procedure, SqlParameter[] parameters)
        {
            try
            {
                var dt = await GetDataTableAsync(procedure, parameters);
                if (dt == null || dt.Rows.Count == 0) return new ApiResponse(false, "No response from the database.");
                return new ApiResponse(Convert.ToInt32(dt.Rows[0]["Success"]) == 1, dt.Rows[0]["Message"]?.ToString() ?? string.Empty);
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return new ApiResponse(false, ServiceDespatchNotInstalled);
            }
        }

        private const int SqlTooManyArguments = 8144;
        private const string DocumentsNotInstalled = "This company database needs script 23 (sales documents and despatch mode).";

        public async Task<ApiResponse<List<SalesDocumentDto>>> GetDocuments(int salesOrderId)
        {
            try
            {
                return ApiResponse<List<SalesDocumentDto>>.Ok(await GetListAsync<SalesDocumentDto>("sp_SalesDocument_List",
                    new[] { SqlParameterHelper.Input("@SalesOrderId", salesOrderId) }));
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return ApiResponse<List<SalesDocumentDto>>.Fail(DocumentsNotInstalled);
            }
        }

        public async Task<ApiResponse<int>> SaveDocument(int salesOrderId, int? despatchId, string? documentType, string? fileName, byte[] content, int userId)
        {
            var type = EncryptzBL.Common.Sales.SalesDocumentRules.KnownType(documentType);
            if (type == null) return ApiResponse<int>.Fail("Choose the type of document.");
            if (content == null || !EncryptzBL.Common.Sales.SalesDocumentRules.IsPdf(content)) return ApiResponse<int>.Fail("Only PDF files can be attached.");
            if (content.Length > EncryptzBL.Common.Sales.SalesDocumentRules.MaxFileBytes) return ApiResponse<int>.Fail("The file is larger than 10 MB.");

            try
            {
                var dt = await GetDataTableAsync("sp_SalesDocument_Save", new[]
                {
                    SqlParameterHelper.Input("@SalesOrderId", salesOrderId),
                    SqlParameterHelper.Input("@DespatchId", despatchId),
                    SqlParameterHelper.Input("@DocumentType", type),
                    SqlParameterHelper.Input("@FileName", EncryptzBL.Common.Sales.SalesDocumentRules.CleanFileName(fileName)),
                    new SqlParameter("@Content", SqlDbType.VarBinary, -1) { Value = content },
                    SqlParameterHelper.Input("@UserId", userId)
                });
                if (dt == null || dt.Rows.Count == 0) return ApiResponse<int>.Fail("No response from the database.");
                var row = dt.Rows[0];
                return Convert.ToInt32(row["Success"]) == 1
                    ? ApiResponse<int>.Ok(Convert.ToInt32(row["DocumentId"]), row["Message"]?.ToString() ?? "Saved")
                    : ApiResponse<int>.Fail(row["Message"]?.ToString() ?? "The document could not be saved.");
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return ApiResponse<int>.Fail(DocumentsNotInstalled);
            }
        }

        public async Task<ApiResponse<SalesDocumentFile>> GetDocumentFile(int documentId)
        {
            try
            {
                var dt = await GetDataTableAsync("sp_SalesDocument_GetFile", new[] { SqlParameterHelper.Input("@DocumentId", documentId) });
                if (dt == null || dt.Rows.Count == 0) return ApiResponse<SalesDocumentFile>.Fail("Document not found.");
                return ApiResponse<SalesDocumentFile>.Ok(new SalesDocumentFile(dt.Rows[0]["FileName"]?.ToString() ?? "document.pdf", (byte[])dt.Rows[0]["Content"]));
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return ApiResponse<SalesDocumentFile>.Fail(DocumentsNotInstalled);
            }
        }

        public async Task<ApiResponse> DeleteDocument(int documentId, int userId)
        {
            try
            {
                var dt = await GetDataTableAsync("sp_SalesDocument_Delete", new[]
                {
                    SqlParameterHelper.Input("@DocumentId", documentId),
                    SqlParameterHelper.Input("@UserId", userId)
                });
                if (dt == null || dt.Rows.Count == 0) return new ApiResponse(false, "No response from the database.");
                return new ApiResponse(Convert.ToInt32(dt.Rows[0]["Success"]) == 1, dt.Rows[0]["Message"]?.ToString() ?? string.Empty);
            }
            catch (SqlException ex) when (ex.Number == SqlProcedureMissing)
            {
                return new ApiResponse(false, DocumentsNotInstalled);
            }
        }

        // =====================================================================
        // Warranty
        // =====================================================================
        public async Task<PagedResult<WarrantyLookupDto>> WarrantyLookup(WarrantyLookupFilterDto filter)
        {
            filter ??= new WarrantyLookupFilterDto();
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(filter.Search)),
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
