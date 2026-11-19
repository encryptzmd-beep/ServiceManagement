using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Crm
{
    /// <summary>
    /// CRM (Lead Management) of a company, kept in the company's own database (schema crm).
    /// Every method takes the caller's tenant user id and whether the caller is a CRM manager
    /// first; a sales user sees and changes only own leads, which the procedures enforce.
    /// </summary>
    public interface ICrmService
    {
        Task<bool> IsManager(int userId, string? role, int companyId);

        Task<ApiResponse<PagedResult<LeadListDto>>> GetLeads(int userId, bool isManager, int companyId, LeadFilterDto f);
        Task<ApiResponse<LeadDetailDto>> GetLead(int userId, bool isManager, int companyId, int leadId);
        Task<ApiResponse<int>> SaveLead(int userId, bool isManager, int companyId, LeadSaveDto dto);
        Task<ApiResponse<int>> ChangeStatus(int userId, bool isManager, int companyId, int leadId, StatusChangeDto dto);
        Task<ApiResponse<int>> Reassign(int userId, bool isManager, int companyId, int leadId, ReassignDto dto);
        Task<ApiResponse<int>> AddFollowUp(int userId, bool isManager, int companyId, int leadId, FollowUpSaveDto dto);

        Task<ApiResponse<int>> SaveQuotation(int userId, bool isManager, int companyId, QuotationSaveDto dto);
        Task<ApiResponse<QuotationDto>> GetQuotation(int userId, bool isManager, int companyId, int quotationId);
        Task<ApiResponse<int>> ReviseQuotation(int userId, bool isManager, int companyId, int quotationId);
        Task<ApiResponse<int>> SetQuotationStatus(int userId, bool isManager, int companyId, int quotationId, string status);
        Task<ApiResponse<List<CrmProductDto>>> SearchProducts(int userId, bool isManager, int companyId, string? term, string? category = null, int? top = null);
        Task<ApiResponse<List<string>>> GetProductCategories(int userId, bool isManager, int companyId);

        Task<ApiResponse<ConvertPreviewDto>> PreviewConvert(int userId, bool isManager, int companyId, int leadId, int quotationId);
        Task<ApiResponse<ConvertResultDto>> Convert(int userId, bool isManager, int companyId, int leadId, ConvertRequestDto dto);
        Task<ApiResponse<int>> LinkOrder(int userId, bool isManager, int companyId, int leadId, string orderNo, int? quotationId = null);
        Task<ApiResponse<int>> ManagerCancelConvert(int userId, bool isManager, int companyId, int leadId);

        Task<ApiResponse<List<CrmMasterDto>>> GetMasters(int userId, bool isManager, int companyId, string kind);
        Task<ApiResponse<int>> SaveMaster(int userId, bool isManager, int companyId, string kind, CrmMasterDto dto);

        Task<ApiResponse<CrmDashboardDto>> GetDashboard(int userId, bool isManager, int companyId);
        Task<ApiResponse<List<CrmFollowUpReportRowDto>>> FollowUpReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, int? ownerUserId);
        Task<ApiResponse<List<CrmConversionRowDto>>> ConversionReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, string? groupBy);

        Task<ApiResponse<CrmBoardDto>> GetBoard(int userId, bool isManager, int companyId, int? ownerUserId);
        Task<ApiResponse<PagedResult<QuotationListRowDto>>> GetQuotations(int userId, bool isManager, int companyId, QuotationFilterDto f);
        Task<ApiResponse<List<CrmPipelineRowDto>>> PipelineReport(int userId, bool isManager, int companyId, int? ownerUserId);
        Task<ApiResponse<List<CrmSourceRowDto>>> SourcesReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to);
        Task<ApiResponse<List<CrmTeamRowDto>>> TeamReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, int? ownerUserId);
        Task<ApiResponse<List<CrmLostReasonRowDto>>> LostReasonsReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, int? ownerUserId);

        Task<ApiResponse<CrmMemberListDto>> GetMembers(int userId, bool isManager, int companyId);
        Task<ApiResponse<int>> SaveMember(int userId, bool isManager, int companyId, CrmMemberDto dto);
    }
}
