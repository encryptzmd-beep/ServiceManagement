using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.User.Modules
{
    /// <summary>
    /// Administration of the MainDB registry: companies, projects and the database each
    /// project is routed to, project access, locations (in the project's DB) and the menu tree.
    /// </summary>
    public interface IPlatformService
    {
        Task<ApiResponse<List<PlatformCompanyDto>>> GetCompanies(PlatformActor actor);
        Task<ApiResponse<int>> SaveCompany(PlatformCompanyDto dto, PlatformActor actor);

        Task<ApiResponse<List<PlatformProjectDto>>> GetProjects(int companyId, PlatformActor actor);
        Task<ApiResponse<int>> SaveProject(SaveProjectRequest req, PlatformActor actor);
        Task<ApiResponse<ConnectionTestResult>> TestConnection(SaveProjectRequest req, PlatformActor actor);

        Task<ApiResponse<List<PlatformLocationDto>>> GetLocations(int projectId, PlatformActor actor);
        Task<ApiResponse<int>> SaveLocation(int projectId, PlatformLocationDto dto, PlatformActor actor);

        Task<ApiResponse<List<ProjectAccessDto>>> GetProjectAccess(int projectId, PlatformActor actor);
        Task<ApiResponse<bool>> SetProjectAccess(int projectId, SetProjectAccessRequest req, PlatformActor actor);

        Task<ApiResponse<List<CompanyModuleDto>>> GetCompanyModules(int companyId, PlatformActor actor);
        Task<ApiResponse<CompanyMembersDto>> GetCompanyMembers(int companyId, PlatformActor actor);
        Task<ApiResponse<bool>> SetCompanyMemberRole(int companyId, int memberId, SetCompanyMemberRoleRequest req, PlatformActor actor);
        Task<ApiResponse<int>> AddCompanyMember(int companyId, AddCompanyMemberRequest req, PlatformActor actor);
        Task<ApiResponse<List<ApplicationDto>>> GetApplications(PlatformActor actor);
        Task<ApiResponse<int>> SaveApplication(ApplicationDto dto, PlatformActor actor);
        Task<ApiResponse<bool>> SetCompanyModule(int companyId, SetCompanyModuleRequest req, PlatformActor actor);

        Task<ApiResponse<List<ProjectAccessDto>>> GetModuleAccess(int companyId, string moduleKey, PlatformActor actor);
        Task<ApiResponse<bool>> SetModuleAccess(int companyId, string moduleKey, SetProjectAccessRequest req, PlatformActor actor);

        Task<ApiResponse<BranchAccessDto>> GetBranchAccess(int companyId, PlatformActor actor);
        Task<ApiResponse<bool>> SetBranchAccess(int companyId, SetBranchAccessRequest req, PlatformActor actor);

        Task<ApiResponse<List<DbServerDto>>> GetDbServers(PlatformActor actor);
        Task<ApiResponse<int>> SaveDbServer(SaveDbServerRequest req, PlatformActor actor);
        Task<ApiResponse<ConnectionTestResult>> TestDbServer(SaveDbServerRequest req, PlatformActor actor);

        Task<ApiResponse<List<PlatformSettingDto>>> GetSettings(PlatformActor actor);
        Task<ApiResponse<bool>> SaveSetting(SavePlatformSettingRequest req, PlatformActor actor);

        Task<ApiResponse<List<PlatformMenuDto>>> GetMenus(PlatformActor actor);
        Task<ApiResponse<int>> SaveMenu(PlatformMenuDto dto, PlatformActor actor);
    }
}
