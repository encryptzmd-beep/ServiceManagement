using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Job Consultancy, the candidates a company adds itself (ProjectDB/12): people who are not on
    /// Job Portal. They live in the company's own database; nobody else sees them, they are never
    /// public. No two of a company share an e-mail or a phone number. Every method takes the user
    /// and the company first; whether the user may use Job Consultancy for the company is decided
    /// on every call (HiringAccess).
    /// </summary>
    public interface IOwnCandidatesService
    {
        Task<ApiResponse<OwnCandidateListDto>> GetOwnCandidates(int userId, int companyId, string? query, int? page);
        /// <summary>One candidate of the company. "Not found" for a candidate of another company.</summary>
        Task<ApiResponse<OwnCandidateDto>> GetOwnCandidate(int userId, int companyId, int candidateId);
        /// <summary>The company's candidates who already have this e-mail or phone (another than <paramref name="candidateId"/>).</summary>
        Task<ApiResponse<List<OwnCandidateDuplicateDto>>> FindDuplicates(int userId, int companyId, int candidateId, string? email, string? phone);
        Task<ApiResponse<int>> SaveOwnCandidate(int userId, int companyId, OwnCandidateDto dto);
        Task<ApiResponse<bool>> DeleteOwnCandidate(int userId, int companyId, int candidateId);
        /// <summary>A new resume replaces the old one; no file removes it.</summary>
        Task<ApiResponse<int>> SaveOwnCandidateResume(int userId, int companyId, int candidateId, JobUpload? file);
        Task<ApiResponse<JobFileContent>> GetOwnCandidateResume(int userId, int companyId, int candidateId);
    }

    public sealed partial class JobsService : IOwnCandidatesService
    {
        private static OwnCandidateDto OwnCandidateRow(DataRow r) => new()
        {
            CandidateId = Convert.ToInt32(r["CandidateId"]),
            FullName = Text(r, "FullName"),
            Headline = Text(r, "Headline"),
            Email = Text(r, "Email"),
            Phone = Text(r, "Phone"),
            City = Text(r, "City"),
            ExperienceYears = r["ExperienceYears"] == DBNull.Value ? null : Convert.ToDecimal(r["ExperienceYears"]),
            Skills = Text(r, "Skills"),
            PreferredJobs = Text(r, "PreferredJobs"),
            Source = Text(r, "Source"),
            Stage = Text(r, "Stage"),
            Notes = Text(r, "Notes"),
            HasResume = Convert.ToBoolean(r["HasResume"]),
            ResumeName = Text(r, "ResumeName"),
            CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
            UpdatedAt = Convert.ToDateTime(r["UpdatedAt"]),
            MatchScore = r.Table.Columns.Contains("MatchScore") && r["MatchScore"] != DBNull.Value ? Convert.ToInt32(r["MatchScore"]) : 0
        };

        public Task<ApiResponse<OwnCandidateDto>> GetOwnCandidate(int userId, int companyId, int candidateId)
            => GuardedTenant(userId, companyId, "reading a candidate of the company", async (_, tenant) =>
            {
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Get", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", candidateId)
                });
                return dt.Rows.Count == 0 ? ApiResponse<OwnCandidateDto>.Fail(NotFound) : ApiResponse<OwnCandidateDto>.Ok(OwnCandidateRow(dt.Rows[0]));
            });
        public Task<ApiResponse<OwnCandidateListDto>> GetOwnCandidates(int userId, int companyId, string? query, int? page)
            => GuardedTenant(userId, companyId, "reading the company's candidates", async (_, tenant) =>
            {
                var pageNumber = JobPostingRules.Page(page);
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_List", new[]
                {
                    In("@CompanyId", companyId),
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize)
                });

                var result = new OwnCandidateListDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };
                if (dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(OwnCandidateRow).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<OwnCandidateListDto>.Ok(result);
            });

        public Task<ApiResponse<List<OwnCandidateDuplicateDto>>> FindDuplicates(int userId, int companyId, int candidateId, string? email, string? phone)
            => GuardedTenant(userId, companyId, "looking for the same candidate", async (_, tenant) =>
            {
                var emailKey = ConsultancyRules.EmailKey(email);
                var phoneKey = ConsultancyRules.PhoneKey(phone);
                if (emailKey.Length == 0 && phoneKey.Length == 0)
                    return ApiResponse<List<OwnCandidateDuplicateDto>>.Ok(new List<OwnCandidateDuplicateDto>());

                var dt = await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Duplicates", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", candidateId),
                    In("@EmailKey", emailKey),
                    In("@PhoneKey", phoneKey)
                });

                return ApiResponse<List<OwnCandidateDuplicateDto>>.Ok(dt.Rows.Cast<DataRow>().Select(r => new OwnCandidateDuplicateDto
                {
                    CandidateId = Convert.ToInt32(r["CandidateId"]),
                    FullName = Text(r, "FullName"),
                    Email = Text(r, "Email"),
                    Phone = Text(r, "Phone"),
                    SameAs = Text(r, "SameAs")
                }).ToList());
            });

        public Task<ApiResponse<int>> SaveOwnCandidate(int userId, int companyId, OwnCandidateDto dto)
            => GuardedTenant(userId, companyId, "saving a candidate of the company", async (_, tenant) =>
            {
                var problem = ConsultancyRules.OwnCandidateProblem(dto);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", dto.CandidateId),
                    In("@FullName", dto.FullName),
                    In("@Headline", dto.Headline),
                    In("@Email", dto.Email),
                    In("@EmailKey", ConsultancyRules.EmailKey(dto.Email)),
                    In("@Phone", dto.Phone),
                    In("@PhoneKey", ConsultancyRules.PhoneKey(dto.Phone)),
                    In("@City", dto.City),
                    In("@ExperienceYears", dto.ExperienceYears),
                    In("@Skills", dto.Skills),
                    In("@PreferredJobs", dto.PreferredJobs),
                    In("@Source", dto.Source),
                    In("@Stage", dto.Stage),
                    In("@Notes", dto.Notes),
                    In("@UserId", userId)
                })));
            });

        public Task<ApiResponse<bool>> DeleteOwnCandidate(int userId, int companyId, int candidateId)
            => GuardedTenant(userId, companyId, "removing a candidate of the company", async (_, tenant) =>
                AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", candidateId)
                }))));

        public Task<ApiResponse<int>> SaveOwnCandidateResume(int userId, int companyId, int candidateId, JobUpload? file)
            => GuardedTenant(userId, companyId, "saving the resume of a candidate of the company", async (_, tenant) =>
            {
                if (file != null)
                {
                    var problem = JobsRules.FileProblem(JobsRules.ResumeKind, file.FileName, file.Content.LongLength, file.Content);
                    if (problem != null)
                        return ApiResponse<int>.Fail(problem);
                }

                var name = file == null ? null : JobsRules.SafeFileName(file.FileName);
                return AsId(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Resume_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", candidateId),
                    In("@FileName", name),
                    In("@ContentType", name == null ? null : JobsRules.ContentTypeFor(name)),
                    In("@SizeBytes", file?.Content.Length),
                    Binary("@Content", file?.Content)
                })));
            });

        public Task<ApiResponse<JobFileContent>> GetOwnCandidateResume(int userId, int companyId, int candidateId)
            => GuardedTenant(userId, companyId, "reading the resume of a candidate of the company", async (_, tenant) =>
            {
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Resume_Get", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CandidateId", candidateId)
                });

                if (dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });
    }
}
