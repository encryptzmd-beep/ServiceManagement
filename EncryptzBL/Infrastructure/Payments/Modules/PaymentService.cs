using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace EncryptzBL.Infrastructure.Payments.Modules
{
    public class PaymentService : BaseRepository, IPaymentService
    {
        public PaymentService(DbHelper db) : base(db) { }

        public async Task<decimal> GetDefaultServiceCharge()
        {
            var dt = await GetDataTableAsync("sp_GetDefaultServiceCharge", null);
            if (dt.Rows.Count > 0 && dt.Rows[0]["ConfigValue"] != DBNull.Value)
            {
                if (decimal.TryParse(dt.Rows[0]["ConfigValue"].ToString(), out decimal val))
                    return val;
            }
            return 0;
        }

        public async Task<ApiResponse<int>> UpdateDefaultServiceCharge(decimal amount, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@ConfigValue", amount.ToString("F2")),
                SqlParameterHelper.Input("@UpdatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_UpdateDefaultServiceCharge", parameters);
            return ApiResponse<int>.Ok(1, "Service charge updated successfully");
        }

        public async Task<List<UPIConfigurationDto>> GetUPIConfigurations()
        {
            var dt = await GetDataTableAsync("sp_GetUPIConfigurations", null);
            return dt.Rows.Count > 0 ? dt.ToList<UPIConfigurationDto>() : new List<UPIConfigurationDto>();
        }

        // name@bank, e.g. shop.name@okhdfcbank
        private static readonly Regex UpiIdFormat = new(
            @"^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$", RegexOptions.Compiled);

        public async Task<ApiResponse<int>> AddUPIConfiguration(string upiId, string displayName, int userId)
        {
            upiId = upiId?.Trim() ?? string.Empty;
            displayName = displayName?.Trim() ?? string.Empty;

            if (!UpiIdFormat.IsMatch(upiId))
                return ApiResponse<int>.Fail("Enter a valid UPI ID in the form name@bank");
            if (upiId.Length > 100)
                return ApiResponse<int>.Fail("UPI ID is too long (max 100 characters)");
            if (displayName.Length == 0)
                return ApiResponse<int>.Fail("Display name is required");
            if (InputSanitizer.ContainsMarkup(displayName))
                return ApiResponse<int>.Fail("Display name must not contain HTML or script content");

            var existing = await GetDataTableByQueryAsync(
                "SELECT TOP 1 1 AS Found FROM dbo.UPIConfigurations WHERE UpiId = @UpiId",
                new[] { SqlParameterHelper.Input("@UpiId", upiId) });
            if (existing.Rows.Count > 0)
                return ApiResponse<int>.Fail("This UPI ID is already configured");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@UpiId", upiId),
                SqlParameterHelper.Input("@DisplayName", displayName),
                SqlParameterHelper.Input("@CreatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_AddUPIConfiguration", parameters);
            return ApiResponse<int>.Ok(1, "UPI added successfully");
        }

        public async Task<ApiResponse<int>> SetDefaultUPI(int id, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Id", id),
                SqlParameterHelper.Input("@UpdatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_SetDefaultUPI", parameters);
            return ApiResponse<int>.Ok(1, "Default UPI set");
        }

        public async Task<ApiResponse<int>> ToggleUPIStatus(int id, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Id", id),
                SqlParameterHelper.Input("@UpdatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_ToggleUPIStatus", parameters);
            return ApiResponse<int>.Ok(1, "UPI status toggled");
        }

        public async Task<ApiResponse<int>> DeleteUPIConfiguration(int id)
        {
            var parameters = new[] { SqlParameterHelper.Input("@Id", id) };
            var dt = await GetDataTableAsync("sp_DeleteUPIConfiguration", parameters);

            // the default was deleted: the first active one takes over, so payments keep a UPI ID
            await _db.ExecuteQueryAsync(
                @"IF NOT EXISTS (SELECT 1 FROM dbo.UPIConfigurations WHERE IsDefault = 1)
                      UPDATE dbo.UPIConfigurations SET IsDefault = 1
                      WHERE Id = (SELECT TOP 1 Id FROM dbo.UPIConfigurations WHERE ISNULL(IsActive, 1) = 1 ORDER BY Id)");

            return ApiResponse<int>.Ok(1, "UPI deleted");
        }

        public async Task<List<ComplaintPaymentDto>> GetComplaintPayments(int complaintId)
        {
            var parameters = new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) };
            var dt = await GetDataTableAsync("sp_GetComplaintPayments", parameters);
            return dt.Rows.Count > 0 ? dt.ToList<ComplaintPaymentDto>() : new List<ComplaintPaymentDto>();
        }

        private static readonly string[] PaymentTypes = { "Advance", "Final", "ServiceCharge" };
        private static readonly string[] PaymentMethods = { "Cash", "UPI", "Card", "Online", "BankTransfer" };
        private const decimal MaxAmount = 9_999_999.99m;

        /// <summary>
        /// Cost of the spare parts approved for the complaint (approved cost, else the
        /// catalog price). Parts without any price count as 0.
        /// </summary>
        private async Task<decimal> GetApprovedSpareCost(int complaintId)
        {
            var p = new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) };
            DataTable dt;
            try
            {
                dt = await GetDataTableByQueryAsync(
                    @"SELECT ISNULL(SUM(r.Quantity * ISNULL(r.UnitPrice, sp.UnitPrice)), 0) AS SpareCost
                      FROM dbo.SparePartRequests r
                      LEFT JOIN dbo.SpareParts sp ON sp.SparePartId = r.SparePartId
                      WHERE r.ComplaintId = @ComplaintId AND r.Status IN ('Approved', 'Dispatched', 'Used')", p);
            }
            catch (Microsoft.Data.SqlClient.SqlException)
            {
                // database without 08_Backoffice_Technician_Fixes.sql (no approved cost yet): catalog price only
                dt = await GetDataTableByQueryAsync(
                    @"SELECT ISNULL(SUM(r.Quantity * sp.UnitPrice), 0) AS SpareCost
                      FROM dbo.SparePartRequests r
                      INNER JOIN dbo.SpareParts sp ON sp.SparePartId = r.SparePartId
                      WHERE r.ComplaintId = @ComplaintId AND r.Status IN ('Approved', 'Dispatched', 'Used')",
                    new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) });
            }

            return dt.Rows.Count > 0 && dt.Rows[0]["SpareCost"] != DBNull.Value
                ? Convert.ToDecimal(dt.Rows[0]["SpareCost"])
                : 0m;
        }

        /// <summary>
        /// The amounts come from the technician's device, so nothing derived is trusted:
        /// the total is recomputed here, the service charge has its configured floor and
        /// the spare parts cannot be billed below what was approved for the job.
        /// </summary>
        public async Task<ApiResponse<int>> RecordComplaintPayment(RecordPaymentRequest request, int userId)
        {
            if (request.ComplaintId <= 0)
                return ApiResponse<int>.Fail("Invalid complaint");

            var paymentType = PaymentTypes.FirstOrDefault(t => string.Equals(t, request.PaymentType, StringComparison.OrdinalIgnoreCase));
            if (paymentType == null)
                return ApiResponse<int>.Fail("Invalid payment type");
            request.PaymentType = paymentType;

            var paymentMethod = PaymentMethods.FirstOrDefault(m => string.Equals(m, request.PaymentMethod, StringComparison.OrdinalIgnoreCase));
            if (paymentMethod == null)
                return ApiResponse<int>.Fail("Invalid payment method");
            request.PaymentMethod = paymentMethod;

            var amounts = new[] { request.ServiceChargeAmount, request.SparePartsAmount, request.DiscountAmount, request.AmountPaid };
            if (amounts.Any(a => a < 0))
                return ApiResponse<int>.Fail("Amounts cannot be negative");
            if (amounts.Any(a => a > MaxAmount))
                return ApiResponse<int>.Fail("Amount is out of range");

            var invalid = InputSanitizer.Validate(("Remarks", request.Remarks), ("Transaction reference", request.TransactionReference));
            if (invalid != null)
                return ApiResponse<int>.Fail(invalid);

            if (paymentType == "Advance")
            {
                // money on account: no bill lines, the total is what was collected
                if (request.AmountPaid <= 0)
                    return ApiResponse<int>.Fail("Advance amount must be greater than zero");
                request.ServiceChargeAmount = 0;
                request.SparePartsAmount = 0;
                request.DiscountAmount = 0;
                request.TotalAmount = request.AmountPaid;
            }
            else
            {
                var gross = request.ServiceChargeAmount + request.SparePartsAmount;
                if (request.DiscountAmount > gross)
                    return ApiResponse<int>.Fail("Discount cannot exceed the bill amount");

                if (paymentType == "Final")
                {
                    var defaultServiceCharge = await GetDefaultServiceCharge();
                    if (request.ServiceChargeAmount < defaultServiceCharge)
                        return ApiResponse<int>.Fail($"Service charge cannot be below {defaultServiceCharge:F2}");

                    var spareCost = await GetApprovedSpareCost(request.ComplaintId);
                    if (request.SparePartsAmount < spareCost)
                        return ApiResponse<int>.Fail($"Spare parts amount cannot be below the approved spare cost ({spareCost:F2})");
                }

                request.TotalAmount = gross - request.DiscountAmount;     // never the client's total
                if (request.AmountPaid > request.TotalAmount)
                    return ApiResponse<int>.Fail("Amount paid cannot exceed the bill total");
            }

            var parameters = new[]
            {
                SqlParameterHelper.Input("@ComplaintId", request.ComplaintId),
                SqlParameterHelper.Input("@PaymentType", request.PaymentType),
                SqlParameterHelper.Input("@ServiceChargeAmount", request.ServiceChargeAmount),
                SqlParameterHelper.Input("@SparePartsAmount", request.SparePartsAmount),
                SqlParameterHelper.Input("@DiscountAmount", request.DiscountAmount),
                SqlParameterHelper.Input("@TotalAmount", request.TotalAmount),
                SqlParameterHelper.Input("@AmountPaid", request.AmountPaid),
                SqlParameterHelper.Input("@PaymentMethod", request.PaymentMethod),
                SqlParameterHelper.Input("@UpiIdUsed", request.UpiIdUsed),
                SqlParameterHelper.Input("@TransactionReference", request.TransactionReference),
                SqlParameterHelper.Input("@Remarks", request.Remarks),
                SqlParameterHelper.Input("@CreatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_RecordComplaintPayment", parameters);
            if (dt.Rows.Count > 0)
            {
                int paymentId = Convert.ToInt32(dt.Rows[0]["PaymentId"]);
                return ApiResponse<int>.Ok(paymentId, "Payment recorded successfully");
            }
            return ApiResponse<int>.Fail("Failed to record payment");
        }

        public async Task<List<AdminPaymentDto>> GetAllPayments()
        {
            var dt = await GetDataTableAsync("sp_GetAllComplaintPayments", null);
            return dt.Rows.Count > 0 ? dt.ToList<AdminPaymentDto>() : new List<AdminPaymentDto>();
        }

        public async Task<ApiResponse<int>> UpdatePayment(UpdatePaymentRequest request, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@PaymentId", request.PaymentId),
                SqlParameterHelper.Input("@ServiceChargeAmount", request.ServiceChargeAmount),
                SqlParameterHelper.Input("@SparePartsAmount", request.SparePartsAmount),
                SqlParameterHelper.Input("@DiscountAmount", request.DiscountAmount),
                SqlParameterHelper.Input("@AmountPaid", request.AmountPaid),
                SqlParameterHelper.Input("@PaymentMethod", request.PaymentMethod),
                SqlParameterHelper.Input("@PaymentStatus", request.PaymentStatus),
                SqlParameterHelper.Input("@TransactionReference", request.TransactionReference),
                SqlParameterHelper.Input("@Remarks", request.Remarks),
                SqlParameterHelper.Input("@UpdatedBy", userId)
            };
            var dt = await GetDataTableAsync("sp_UpdateComplaintPayment", parameters);
            return ApiResponse<int>.Ok(1, "Payment updated successfully");
        }

        public async Task<ApiResponse<int>> VerifyPayment(VerifyPaymentRequest request, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@PaymentId",  request.PaymentId),
                SqlParameterHelper.Input("@IsVerified", request.IsVerified),
                SqlParameterHelper.Input("@VerifiedBy", userId)
            };
            await GetDataTableAsync("sp_VerifyComplaintPayment", parameters);
            var msg = request.IsVerified ? "Payment marked as verified" : "Payment verification removed";
            return ApiResponse<int>.Ok(1, msg);
        }
    }
}
