using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    // Job Portal, the company's side of job postings (script PersonalDB/06).
    public sealed partial class JobsService : ICompanyJobsService
    {
        /// <summary>
        /// The way in for everything a company does: the guard of a person first, then whether
        /// this person may act for this company right now (HiringAccess, read from the main
        /// database). The work gets the name of the company as the main database has it.
        /// </summary>
        private Task<ApiResponse<T>> GuardedCompany<T>(int userId, int companyId, string what, Func<string, Task<ApiResponse<T>>> work)
            => Guarded(userId, what, async () =>
            {
                if (_users == null || companyId <= 0)
                    return ApiResponse<T>.Fail(HiringAccess.Refused);

                var membership = HiringAccess.Membership((await _users.GetUserCompanies(userId))?.Data, companyId);
                if (!HiringAccess.MayManage(membership))
                    return ApiResponse<T>.Fail(HiringAccess.Refused);

                return await work(membership!.CompanyName.Trim());
            });

        private static CompanyPostingDto CompanyPosting(DataRow r)
        {
            int Count(string column) => r.Table.Columns.Contains(column) ? Convert.ToInt32(r[column]) : 0;

            return new CompanyPostingDto
            {
                PostingId = Convert.ToInt32(r["PostingId"]),
                Title = r["Title"]?.ToString() ?? "",
                City = r["City"]?.ToString() ?? "",
                EmploymentType = r["EmploymentType"]?.ToString() ?? "",
                WorkMode = r["WorkMode"]?.ToString() ?? "",
                ExperienceMinYears = IntOrNull(r, "ExperienceMinYears"),
                ExperienceMaxYears = IntOrNull(r, "ExperienceMaxYears"),
                SalaryMin = IntOrNull(r, "SalaryMin"),
                SalaryMax = IntOrNull(r, "SalaryMax"),
                Skills = r["Skills"]?.ToString() ?? "",
                Description = r.Table.Columns.Contains("Description") ? r["Description"]?.ToString() ?? "" : "",
                ClosesOn = DateOrNull(r, "ClosesOn"),
                Status = r["Status"]?.ToString() ?? "",
                PublishedAt = DateOrNull(r, "PublishedAt"),
                CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
                Applied = Count("Applied"),
                Shortlisted = Count("Shortlisted"),
                Rejected = Count("Rejected"),
                Hired = Count("Hired")
            };
        }

        // ── postings ──────────────────────────────────────────────────────────

        public Task<ApiResponse<List<CompanyPostingDto>>> GetCompanyPostings(int userId, int companyId)
            => GuardedCompany(userId, companyId, "reading the jobs of a company", async _ =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Company_Posting_List", new[] { In("@CompanyId", companyId) });

                return ApiResponse<List<CompanyPostingDto>>.Ok(
                    dt == null ? new List<CompanyPostingDto>() : dt.Rows.Cast<DataRow>().Select(CompanyPosting).ToList());
            });

        public Task<ApiResponse<CompanyPostingDto>> GetCompanyPosting(int userId, int companyId, int postingId)
            => GuardedCompany(userId, companyId, "reading a job of a company", async _ =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Company_Posting_Get", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId)
                });

                return dt == null || dt.Rows.Count == 0
                    ? ApiResponse<CompanyPostingDto>.Fail(NotFound)
                    : ApiResponse<CompanyPostingDto>.Ok(CompanyPosting(dt.Rows[0]));
            });

        public Task<ApiResponse<int>> SaveCompanyPosting(int userId, int companyId, JobPostingDto dto)
            => GuardedCompany(userId, companyId, "saving a job", async companyName =>
            {
                var problem = JobPostingRules.PostingProblem(dto);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Company_Posting_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@UserId", userId),
                    In("@CompanyName", companyName.Length > 200 ? companyName.Substring(0, 200) : companyName),
                    In("@PostingId", dto.PostingId),
                    In("@Title", dto.Title),
                    In("@City", dto.City),
                    In("@EmploymentType", dto.EmploymentType),
                    In("@WorkMode", dto.WorkMode),
                    In("@ExperienceMinYears", dto.ExperienceMinYears),
                    In("@ExperienceMaxYears", dto.ExperienceMaxYears),
                    In("@SalaryMin", dto.SalaryMin),
                    In("@SalaryMax", dto.SalaryMax),
                    In("@Skills", dto.Skills),
                    In("@Description", dto.Description),
                    Date("@ClosesOn", dto.ClosesOn)
                })));
            });

        public Task<ApiResponse<bool>> SetCompanyPostingStatus(int userId, int companyId, int postingId, string? status)
            => GuardedCompany(userId, companyId, "changing the state of a job", async _ =>
            {
                var move = JobPostingRules.InList(JobPostingRules.PostingMoves, status);
                if (move == null)
                    return ApiResponse<bool>.Fail("This change is not possible");

                return AsFlag(Answer(await GetDataTableAsync("jobs.sp_Company_Posting_SetStatus", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@Status", move)
                })));
            });

        public Task<ApiResponse<bool>> DeleteCompanyPosting(int userId, int companyId, int postingId)
            => GuardedCompany(userId, companyId, "removing a job", async _ =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Company_Posting_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId)
                }))));

        // ── applicants ────────────────────────────────────────────────────────

        public Task<ApiResponse<List<JobApplicantDto>>> GetApplicants(int userId, int companyId, int postingId)
            => GuardedCompany(userId, companyId, "reading the applicants of a job", async _ =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Company_Applicant_List", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId)
                });

                var list = dt == null
                    ? new List<JobApplicantDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new JobApplicantDto
                    {
                        ApplicationId = Convert.ToInt32(r["ApplicationId"]),
                        FullName = r["FullName"]?.ToString() ?? "",
                        Headline = r["Headline"]?.ToString() ?? "",
                        City = r["City"]?.ToString() ?? "",
                        Status = r["Status"]?.ToString() ?? "",
                        Note = r["Note"]?.ToString() ?? "",
                        AppliedAt = Convert.ToDateTime(r["AppliedAt"]),
                        StatusAt = Convert.ToDateTime(r["StatusAt"]),
                        HasResume = Convert.ToBoolean(r["HasResume"])
                    }).ToList();

                return ApiResponse<List<JobApplicantDto>>.Ok(list);
            });

        public Task<ApiResponse<JobApplicantPageDto>> GetApplicant(int userId, int companyId, int postingId, int applicationId)
            => GuardedCompany(userId, companyId, "reading an applicant", async _ =>
            {
                var ds = await GetDataSetAsync("jobs.sp_Company_Applicant_Get", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@ApplicationId", applicationId),
                    In("@ViewerUserId", userId)
                });

                // one empty set: no such applicant for this company (or they withdrew)
                if (ds == null || ds.Tables.Count < 7 || ds.Tables[0].Rows.Count == 0)
                    return ApiResponse<JobApplicantPageDto>.Fail(NotFound);

                var a = ds.Tables[0].Rows[0];
                var profile = MapPage(ds, 1);

                // what the person agreed to show: the profile and the resume. The date of birth,
                // the files of certificates and what the person is looking for stay with the person.
                profile.Preferences = new JobPreferencesDto();
                profile.Profile.DateOfBirth = null;
                foreach (var certificate in profile.Certificates)
                {
                    certificate.FileId = 0;
                    certificate.FileName = "";
                    certificate.SizeBytes = 0;
                }
                profile.Completeness = JobsRules.Completeness(profile);

                return ApiResponse<JobApplicantPageDto>.Ok(new JobApplicantPageDto
                {
                    ApplicationId = Convert.ToInt32(a["ApplicationId"]),
                    PostingTitle = a["Title"]?.ToString() ?? "",
                    Status = a["Status"]?.ToString() ?? "",
                    Note = a["Note"]?.ToString() ?? "",
                    AppliedAt = Convert.ToDateTime(a["AppliedAt"]),
                    Profile = profile
                });
            });

        public Task<ApiResponse<JobFileContent>> GetApplicantResume(int userId, int companyId, int postingId, int applicationId)
            => GuardedCompany(userId, companyId, "reading the resume of an applicant", async _ =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Company_Applicant_Resume", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@ApplicationId", applicationId),
                    In("@ViewerUserId", userId)
                });

                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });

        public Task<ApiResponse<bool>> SetApplicantStatus(int userId, int companyId, int postingId, int applicationId, string? status)
            => GuardedCompany(userId, companyId, "changing the state of an application", async _ =>
            {
                var state = JobPostingRules.InList(JobPostingRules.ApplicantStates, status);
                if (state == null)
                    return ApiResponse<bool>.Fail("This change is not possible");

                return AsFlag(Answer(await GetDataTableAsync("jobs.sp_Company_Applicant_SetStatus", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@ApplicationId", applicationId),
                    In("@Status", state)
                })));
            });
    }
}
