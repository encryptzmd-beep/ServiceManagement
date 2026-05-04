using EncryptzBL.DTO_s;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EncryptzBL.Infrastructure.Payments.Modules
{
    public interface IPaymentService
    {
        Task<decimal> GetDefaultServiceCharge();
        Task<ApiResponse<int>> UpdateDefaultServiceCharge(decimal amount, int userId);
        
        Task<List<UPIConfigurationDto>> GetUPIConfigurations();
        Task<ApiResponse<int>> AddUPIConfiguration(string upiId, string displayName, int userId);
        Task<ApiResponse<int>> SetDefaultUPI(int id, int userId);
        Task<ApiResponse<int>> ToggleUPIStatus(int id, int userId);
        Task<ApiResponse<int>> DeleteUPIConfiguration(int id);
        
        Task<List<ComplaintPaymentDto>> GetComplaintPayments(int complaintId);
        Task<ApiResponse<int>> RecordComplaintPayment(RecordPaymentRequest request, int userId);
        Task<List<AdminPaymentDto>> GetAllPayments();
        Task<ApiResponse<int>> UpdatePayment(UpdatePaymentRequest request, int userId);
    }
}
