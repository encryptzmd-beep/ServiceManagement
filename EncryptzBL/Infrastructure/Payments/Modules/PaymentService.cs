using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
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

        public async Task<ApiResponse<int>> AddUPIConfiguration(string upiId, string displayName, int userId)
        {
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
            return ApiResponse<int>.Ok(1, "UPI deleted");
        }

        public async Task<List<ComplaintPaymentDto>> GetComplaintPayments(int complaintId)
        {
            var parameters = new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) };
            var dt = await GetDataTableAsync("sp_GetComplaintPayments", parameters);
            return dt.Rows.Count > 0 ? dt.ToList<ComplaintPaymentDto>() : new List<ComplaintPaymentDto>();
        }

        public async Task<ApiResponse<int>> RecordComplaintPayment(RecordPaymentRequest request, int userId)
        {
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
    }
}
