using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.User.Modules
{
    /// <summary>A company's users and roles, outside the modules. The actor comes from the token.</summary>
    public interface ICompanyAccessService
    {
        Task<ApiResponse<CompanyAccessMeDto>> GetMe(PlatformActor actor);
        Task<ApiResponse<CompanyAccessOverviewDto>> GetOverview(PlatformActor actor);
        Task<ApiResponse<int>> SaveRole(SaveCompanyRoleRequest req, PlatformActor actor);
        Task<ApiResponse<bool>> DeleteRole(int companyRoleId, PlatformActor actor);
        Task<ApiResponse<int>> SaveUser(SaveCompanyUserRequest req, PlatformActor actor);
        Task<ApiResponse<bool>> SetManager(SetCompanyManagerRequest req, PlatformActor actor);
    }
}
