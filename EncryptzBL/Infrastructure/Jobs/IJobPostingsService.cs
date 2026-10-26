using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Job Portal, the person's side of job postings: search, save, apply, follow.
    /// Every method takes the user first; it is the main UserId of whoever is logged in.
    /// </summary>
    public interface IJobPostingsService
    {
        Task<ApiResponse<JobPostingSearchResultDto>> SearchPostings(int userId, string? query, string? city, string? employmentType, string? workMode, int? page, string? sort = null);
        Task<ApiResponse<JobPostingViewDto>> GetPosting(int userId, int postingId);

        Task<ApiResponse<int>> Apply(int userId, int postingId, string? note);
        Task<ApiResponse<bool>> Withdraw(int userId, int applicationId);
        Task<ApiResponse<List<JobApplicationDto>>> GetMyApplications(int userId);

        Task<ApiResponse<bool>> SetSaved(int userId, int postingId, bool saved);
        Task<ApiResponse<List<JobPostingViewDto>>> GetSavedPostings(int userId);

        /// <summary>Which company looked at the person's profile or resume, for which job.</summary>
        Task<ApiResponse<List<JobProfileViewDto>>> GetProfileViews(int userId);
    }

    /// <summary>
    /// Job Portal, the public job pages: the open jobs for anybody, without an account
    /// (search engines included). Applying needs a login (IJobPostingsService).
    /// </summary>
    public interface IPublicJobsService
    {
        Task<ApiResponse<JobPostingSearchResultDto>> SearchPublicPostings(string? query, string? city, string? employmentType, string? workMode, int? page);
        Task<ApiResponse<JobPostingViewDto>> GetPublicPosting(int postingId);
        /// <summary>The open jobs most like one job (title, skills, city, type, mode), never the job itself.</summary>
        Task<ApiResponse<List<JobPostingViewDto>>> GetRelatedPublicPostings(int postingId);
        /// <summary>Every job people can find now, for the sitemap.</summary>
        Task<ApiResponse<List<PublicPostingLinkDto>>> GetPublicSitemap();
    }

    /// <summary>
    /// What the platform administrator checks: certificates people uploaded and jobs companies
    /// want to publish. Every method takes the user first (the platform administrator who is
    /// logged in); the API lets nobody else in.
    /// </summary>
    public interface IVerificationService
    {
        Task<ApiResponse<VerificationQueueDto>> GetVerificationQueue(int userId);
        Task<ApiResponse<JobFileContent>> GetCertificateFileForReview(int userId, int certificateId);
        Task<ApiResponse<bool>> DecideCertificate(int userId, int certificateId, bool verified, string? note, string adminName);
        Task<ApiResponse<bool>> DecidePosting(int userId, int postingId, bool approved, string? note, string adminName);

        /// <summary>People to verify. <paramref name="show"/>: waiting (not verified), verified or all.</summary>
        Task<ApiResponse<PersonReviewPageDto>> GetPeopleForReview(int userId, string? query, string? show, int? page);
        /// <summary>Verifies a person, or takes the tick away (that needs a reason the person reads).</summary>
        Task<ApiResponse<bool>> DecidePerson(int userId, Guid candidateKey, bool verified, string? note, string adminName);
    }

    /// <summary>
    /// Job Portal, the company's side: its postings and the people who applied to them.
    /// Every method takes the user and the company first: the user is who is logged in, the
    /// company is the one of their token. Whether that user may act for that company is
    /// decided inside, on every call (HiringAccess).
    /// </summary>
    public interface ICompanyJobsService
    {
        Task<ApiResponse<List<CompanyPostingDto>>> GetCompanyPostings(int userId, int companyId);
        Task<ApiResponse<CompanyPostingDto>> GetCompanyPosting(int userId, int companyId, int postingId);
        Task<ApiResponse<int>> SaveCompanyPosting(int userId, int companyId, JobPostingDto dto);
        Task<ApiResponse<bool>> SetCompanyPostingStatus(int userId, int companyId, int postingId, string? status);
        Task<ApiResponse<bool>> DeleteCompanyPosting(int userId, int companyId, int postingId);

        Task<ApiResponse<List<JobApplicantDto>>> GetApplicants(int userId, int companyId, int postingId);
        Task<ApiResponse<JobApplicantPageDto>> GetApplicant(int userId, int companyId, int postingId, int applicationId);
        Task<ApiResponse<JobFileContent>> GetApplicantResume(int userId, int companyId, int postingId, int applicationId);
        Task<ApiResponse<bool>> SetApplicantStatus(int userId, int companyId, int postingId, int applicationId, string? status);
    }
}
