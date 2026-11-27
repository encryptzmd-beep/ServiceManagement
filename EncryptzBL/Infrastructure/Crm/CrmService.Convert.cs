using EncryptzBL.Common;
using EncryptzBL.Common.Crm;
using EncryptzBL.Common.Sales;
using EncryptzBL.DTO_s;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Crm
{
    /// <summary>
    /// Convert to Sale: the lead and its quotation become a customer and a sales order of the existing Sales module
    /// (ISalesService, unchanged). The lead is marked first (crm.sp_Lead_BeginConvert, one UPDATE, so only one
    /// convert wins); the order is made; then the lead is linked (crm.sp_Lead_FinishConvert). The two services are not
    /// one transaction: a failure before the order frees the mark, a failure after it is logged and a manager links
    /// the order from the lead (crm.sp_Lead_LinkOrder). A failure once the order call was made also flags the lead
    /// (crm.sp_Lead_MarkConvertUnknown), so the marker never expires until a manager links the order or cancels the convert.
    /// </summary>
    public sealed partial class CrmService
    {
        private const string AlreadyConverting = "This lead is already being converted or has a sale";

        /// <summary>Said when the order call failed in a way that leaves unknown whether the order was made.</summary>
        private const string OrderMayBeMade = "The sale may have been made but the lead could not be updated. A manager can check the sales orders and link it from the lead";

        public Task<ApiResponse<ConvertPreviewDto>> PreviewConvert(int userId, bool isManager, int companyId, int leadId, int quotationId)
            => Guard(async () =>
            {
                var lead = await ReadLeadRow(userId, isManager, companyId, leadId);
                if (lead == null) return ApiResponse<ConvertPreviewDto>.Fail(LeadNotFound);
                var q = quotationId > 0 ? await ReadQuotation(userId, isManager, companyId, quotationId) : null;

                var problem = CrmRules.ConvertProblem(lead, q);
                if (problem != null) return ApiResponse<ConvertPreviewDto>.Fail(problem);

                return ApiResponse<ConvertPreviewDto>.Ok(new ConvertPreviewDto { Matches = await CustomersWithMobile(lead.Mobile), Quotation = q! });
            });

        // explicit, so that the name Convert does not hide System.Convert inside the class
        Task<ApiResponse<ConvertResultDto>> ICrmService.Convert(int userId, bool isManager, int companyId, int leadId, ConvertRequestDto dto)
            => Guard(async () =>
            {
                // ── rules ──────────────────────────────────────────────────────
                var requestProblem = CrmRules.ConvertRequestProblem(dto);
                if (requestProblem != null) return ApiResponse<ConvertResultDto>.Fail(requestProblem);

                var lead = await ReadLeadRow(userId, isManager, companyId, leadId);
                if (lead == null) return ApiResponse<ConvertResultDto>.Fail(LeadNotFound);
                var q = await ReadQuotation(userId, isManager, companyId, dto.QuotationId);
                var problem = CrmRules.ConvertProblem(lead, q);
                if (problem != null) return ApiResponse<ConvertResultDto>.Fail(problem);

                var matches = await CustomersWithMobile(lead.Mobile);
                var choiceProblem = CrmRules.CustomerChoiceProblem(matches.Select(c => c.CustomerId).ToList(), dto.CustomerId);
                if (choiceProblem != null) return ApiResponse<ConvertResultDto>.Fail(choiceProblem);

                // ── mark the lead: only one convert can win ────────────────────
                var begin = Answer(await GetDataTableAsync("crm.sp_Lead_BeginConvert", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@QuotationId", dto.QuotationId)
                }));
                if (!begin.Success) return ApiResponse<ConvertResultDto>.Fail(BeginRefusal(begin.Message));

                // ── customer and order (Sales module); a failure before the order is attempted frees the mark ──
                int customerId = 0;
                var newCustomer = false;
                var orderAttempted = false;
                SalesOrderSaveResultDto made;
                try
                {
                    customerId = dto.CustomerId is > 0 ? dto.CustomerId.Value : matches.Count == 1 ? matches[0].CustomerId : 0;
                    if (customerId <= 0)
                    {
                        var customer = await _sales.SaveCustomer(new SalesCustomerSaveDto
                        {
                            CustomerName = lead.ContactName, MobileNumber = lead.Mobile, Email = lead.Email, Address = lead.Address,
                            City = lead.City, State = lead.State, PinCode = lead.PinCode, Landmark = lead.Landmark
                        });
                        if (!customer.Success || customer.Data == null || customer.Data.CustomerId <= 0)
                        {
                            await CancelConvert(userId, isManager, companyId, leadId);
                            return ApiResponse<ConvertResultDto>.Fail(customer.Message ?? "The customer could not be saved");
                        }
                        customerId = customer.Data.CustomerId;
                        newCustomer = customer.Data.IsNew;
                    }

                    // from here sp_SalesOrder_Save may commit even if the call then throws (a timeout, a dropped connection)
                    orderAttempted = true;
                    // the customer accepted the quotation: the order starts as Sales Confirmed (Billed once its invoice is attached)
                    var saved = await _sales.SaveOrder(CrmRules.BuildOrder(lead, q!, customerId, dto), userId, SalesOrderStatus.Confirmed);
                    if (!saved.Success || saved.Data == null || saved.Data.SalesOrderId <= 0)
                    {
                        if (newCustomer)
                            _logger.LogWarning("CRM: customer {CustomerId} was made for lead {LeadId} but its sales order was refused: {Message}",
                                customerId, leadId, saved.Message);
                        await CancelConvert(userId, isManager, companyId, leadId);
                        return ApiResponse<ConvertResultDto>.Fail(saved.Message ?? "The sales order could not be saved");
                    }
                    made = saved.Data;
                }
                catch (Exception ex) when (orderAttempted)
                {
                    // the order may exist: keep the mark so nobody makes a second one, and let a manager check and link it
                    _logger.LogError(ex, "CRM: the sales order of lead {LeadId} (quotation {QuotationId}, customer {CustomerId}) may have been made; the convert mark is kept ({ErrorType})",
                        leadId, dto.QuotationId, customerId, ex.GetType().Name);
                    await MarkConvertUnknown(userId, isManager, companyId, leadId);
                    return ApiResponse<ConvertResultDto>.Fail(OrderMayBeMade);
                }
                catch
                {
                    await CancelConvert(userId, isManager, companyId, leadId);
                    throw;
                }

                // ── link the order to the lead; the order exists now, so a failure is logged and told ──
                var orderMade = $"The sale {made.OrderNo} was made but the lead could not be updated. A manager can link it from the lead";
                try
                {
                    var finish = Answer(await GetDataTableAsync("crm.sp_Lead_FinishConvert", new[]
                    {
                        In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@LocationId", LocationId),
                        In("@QuotationId", dto.QuotationId), In("@CustomerId", customerId), In("@SalesOrderId", made.SalesOrderId)
                    }));
                    if (!finish.Success)
                    {
                        _logger.LogError("CRM: sales order {OrderNo} ({SalesOrderId}) was made for lead {LeadId} but the lead was not updated: {Message}",
                            made.OrderNo, made.SalesOrderId, leadId, finish.Message);
                        await MarkConvertUnknown(userId, isManager, companyId, leadId);
                        return ApiResponse<ConvertResultDto>.Fail(orderMade);
                    }

                    return ApiResponse<ConvertResultDto>.Ok(
                        new ConvertResultDto { SalesOrderId = made.SalesOrderId, OrderNo = made.OrderNo, CustomerId = customerId }, finish.Message);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "CRM: sales order {OrderNo} ({SalesOrderId}) was made for lead {LeadId} but the lead was not updated ({ErrorType})",
                        made.OrderNo, made.SalesOrderId, leadId, ex.GetType().Name);
                    await MarkConvertUnknown(userId, isManager, companyId, leadId);
                    return ApiResponse<ConvertResultDto>.Fail(orderMade);
                }
            });

        public Task<ApiResponse<int>> LinkOrder(int userId, bool isManager, int companyId, int leadId, string orderNo, int? quotationId = null)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);
                orderNo = (orderNo ?? "").Trim();
                if (orderNo.Length == 0) return ApiResponse<int>.Fail("Enter the order number");
                if (orderNo.Length > 30) return ApiResponse<int>.Fail("The order number is too long");

                var dt = await GetDataTableAsync("crm.sp_Lead_LinkOrder", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@OrderNo", orderNo), In("@QuotationId", quotationId is > 0 ? quotationId : null)
                });
                return ToResponse(Answer(dt));
            });

        /// <summary>
        /// A manager frees the convert marker of a lead, also of one flagged by MarkConvertUnknown, once the manager
        /// has checked in the sales orders that no order was made (crm.sp_Lead_CancelConvert).
        /// </summary>
        public Task<ApiResponse<int>> ManagerCancelConvert(int userId, bool isManager, int companyId, int leadId)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);
                var dt = await GetDataTableAsync("crm.sp_Lead_CancelConvert", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId)
                });
                return ToResponse(Answer(dt));
            });

        /// <summary>The refusal of crm.sp_Lead_BeginConvert: a lead with an order or a convert under way is said in one sentence.</summary>
        private static string BeginRefusal(string message)
            => message is "This lead already has a sales order" or "This lead is being converted to a sale. Try again in a minute"
                ? AlreadyConverting : message;

        /// <summary>Frees the mark of a convert that made no order. Never fails the caller.</summary>
        private async Task CancelConvert(int userId, bool isManager, int companyId, int leadId)
        {
            try
            {
                await GetDataTableAsync("crm.sp_Lead_CancelConvert", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId)
                });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "CRM: freeing the convert mark of lead {LeadId} failed ({ErrorType})", leadId, ex.GetType().Name);
            }
        }

        /// <summary>
        /// Flags a lead whose order call was made when it is not known whether the order exists
        /// (crm.sp_Lead_MarkConvertUnknown): the marker then never expires, and only a manager's LinkOrder or
        /// CancelConvert frees it. Never fails the caller.
        /// </summary>
        private async Task MarkConvertUnknown(int userId, bool isManager, int companyId, int leadId)
        {
            try
            {
                await GetDataTableAsync("crm.sp_Lead_MarkConvertUnknown", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId)
                });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "CRM: flagging the convert of lead {LeadId} for a manager's check failed ({ErrorType})", leadId, ex.GetType().Name);
            }
        }

        /// <summary>The customers of the master whose mobile is the lead's, compared as CrmRules.NormaliseMobile does.</summary>
        private async Task<List<SalesCustomerDto>> CustomersWithMobile(string mobile)
        {
            var normalised = CrmRules.NormaliseMobile(mobile);
            if (normalised.Length == 0) return new List<SalesCustomerDto>();
            var found = await _sales.SearchCustomers(normalised, 50);
            return found.Where(c => CrmRules.SameMobile(c.MobileNumber, normalised)).ToList();
        }

        /// <summary>The lead alone (crm.sp_Lead_Get), without its follow-ups, history and quotations.</summary>
        private async Task<LeadDetailDto?> ReadLeadRow(int userId, bool isManager, int companyId, int leadId)
            => (await GetDataTableAsync("crm.sp_Lead_Get", LeadScope(userId, isManager, companyId, leadId))).ToList<LeadDetailDto>().FirstOrDefault();
    }
}
