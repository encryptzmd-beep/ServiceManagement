using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Provisioning
{
    public interface ICompanyProvisioningService
    {
        Task<ApiResponse<CompanyCreatedDto>> CreateCompany(CreateCompanyRequest req, int userId, bool isPlatformAdmin);
        Task<ApiResponse<bool>> RetryProvision(int companyId, int userId, bool isPlatformAdmin);
        Task<ApiResponse<CompanyCreationStateDto>> GetCreationState(int userId, bool isPlatformAdmin);
    }
}
