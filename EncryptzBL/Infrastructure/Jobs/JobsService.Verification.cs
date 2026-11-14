using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    // Job Portal: what the platform administrator checks (script PersonalDB/09). The API lets
    // only a platform administrator with the screen unlocked reach these methods.
    public sealed partial class JobsService : IVerificationService
    {
        private const int MaxNoteLength = 500;

        public Task<ApiResponse<VerificationQueueDto>> GetVerificationQueue(int userId)
            => Guarded(userId, "reading what waits to be verified", async () =>
            {
                var ds = await GetDataSetAsync("jobs.sp_Admin_Verification_List", Array.Empty<Microsoft.Data.SqlClient.SqlParameter>());
                var queue = new VerificationQueueDto();
                if (ds == null || ds.Tables.Count < 2)
                    return ApiResponse<VerificationQueueDto>.Ok(queue);

                queue.Certificates = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new CertificateReviewDto
                {
                    CertificateId = Convert.ToInt32(r["CertificateId"]),
                    Title = r["Title"]?.ToString() ?? "",
                    Issuer = r["Issuer"]?.ToString() ?? "",
                    IssuedOn = DateOrNull(r, "IssuedOn"),
                    FileName = r["FileName"]?.ToString() ?? "",
                    SubmittedAt = Convert.ToDateTime(r["SubmittedAt"]),
                    PersonName = r["PersonName"]?.ToString() ?? "",
                    PersonHeadline = r["PersonHeadline"]?.ToString() ?? ""
                }).ToList();

                queue.Postings = ds.Tables[1].Rows.Cast<DataRow>().Select(r => new PostingReviewDto
                {
                    PostingId = Convert.ToInt32(r["PostingId"]),
                    CompanyName = r["CompanyName"]?.ToString() ?? "",
                    Title = r["Title"]?.ToString() ?? "",
                    City = r["City"]?.ToString() ?? "",
                    EmploymentType = r["EmploymentType"]?.ToString() ?? "",
                    WorkMode = r["WorkMode"]?.ToString() ?? "",
                    ExperienceMinYears = IntOrNull(r, "ExperienceMinYears"),
                    ExperienceMaxYears = IntOrNull(r, "ExperienceMaxYears"),
                    SalaryMin = IntOrNull(r, "SalaryMin"),
                    SalaryMax = IntOrNull(r, "SalaryMax"),
                    Skills = r["Skills"]?.ToString() ?? "",
                    Description = r["Description"]?.ToString() ?? "",
                    ClosesOn = DateOrNull(r, "ClosesOn"),
                    SubmittedAt = Convert.ToDateTime(r["SubmittedAt"]),
                    WasPublished = Convert.ToBoolean(r["WasPublished"])
                }).ToList();

                return ApiResponse<VerificationQueueDto>.Ok(queue);
            }, personal: false);

        public Task<ApiResponse<JobFileContent>> GetCertificateFileForReview(int userId, int certificateId)
            => Guarded(userId, "reading a certificate to verify it", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Admin_Certificate_File", new[] { In("@CertificateId", certificateId) });

                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            }, personal: false);

        public Task<ApiResponse<bool>> DecideCertificate(int userId, int certificateId, bool verified, string? note, string adminName)
            => Guarded(userId, "deciding on a certificate", async () =>
            {
                var text = (note ?? "").Trim();
                if (text.Length > MaxNoteLength)
                    return ApiResponse<bool>.Fail("The note can have at most 500 characters");
                if (!verified && text.Length == 0)
                    return ApiResponse<bool>.Fail("Say why the certificate is not verified");

                return AsFlag(Answer(await Told("jobs.sp_Admin_Certificate_Decide", new[]
                {
                    In("@CertificateId", certificateId),
                    In("@Verified", verified),
                    In("@Note", text),
                    In("@AdminName", AdminName(adminName))
                })));
            }, personal: false);

        public Task<ApiResponse<bool>> DecidePosting(int userId, int postingId, bool approved, string? note, string adminName)
            => Guarded(userId, "deciding on a job", async () =>
            {
                var text = (note ?? "").Trim();
                if (text.Length > MaxNoteLength)
                    return ApiResponse<bool>.Fail("The note can have at most 500 characters");
                if (!approved && text.Length == 0)
                    return ApiResponse<bool>.Fail("Say why the job is returned, so that the company can correct it");

                return AsFlag(Answer(await Told("jobs.sp_Admin_Posting_Decide", new[]
                {
                    In("@PostingId", postingId),
                    In("@Approved", approved),
                    In("@Note", text),
                    In("@AdminName", AdminName(adminName))
                })));
            }, personal: false);

        // ── people (script PersonalDB/16) ─────────────────────────────────────

        private const int PeoplePageSize = 20;

        public Task<ApiResponse<PersonReviewPageDto>> GetPeopleForReview(int userId, string? query, string? show, int? page)
            => Guarded(userId, "reading the people to verify", async () =>
            {
                var pageNumber = JobPostingRules.Page(page);
                var shown = show is "verified" or "all" ? show : "waiting";

                var dt = await GetDataTableAsync("jobs.sp_Admin_Person_List", new[]
                {
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@Show", shown),
                    In("@Page", pageNumber),
                    In("@PageSize", PeoplePageSize)
                });

                var result = new PersonReviewPageDto { Page = pageNumber, PageSize = PeoplePageSize };
                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(r => new PersonReviewDto
                    {
                        CandidateKey = (Guid)r["CandidateKey"],
                        FullName = r["FullName"]?.ToString() ?? "",
                        Headline = r["Headline"]?.ToString() ?? "",
                        City = r["City"]?.ToString() ?? "",
                        ContactEmail = r["ContactEmail"]?.ToString() ?? "",
                        ContactPhone = r["ContactPhone"]?.ToString() ?? "",
                        DateOfBirth = DateOrNull(r, "DateOfBirth"),
                        IsVisible = Convert.ToBoolean(r["IsVisible"]),
                        VerifiedAt = DateOrNull(r, "VerifiedAt"),
                        VerifiedBy = r["VerifiedBy"]?.ToString() ?? "",
                        UpdatedAt = Convert.ToDateTime(r["UpdatedAt"]),
                        ExperienceCount = Convert.ToInt32(r["ExperienceCount"]),
                        VerifiedCertificates = Convert.ToInt32(r["VerifiedCertificates"]),
                        HasResume = Convert.ToBoolean(r["HasResume"])
                    }).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<PersonReviewPageDto>.Ok(result);
            }, personal: false);

        // ── rejections (script PersonalDB/26) ─────────────────────────────────

        public Task<ApiResponse<RejectionReviewPageDto>> GetRejections(int userId, string? query, int? page)
            => Guarded(userId, "reading the rejections", async () =>
            {
                var pageNumber = JobPostingRules.Page(page);
                var dt = await GetDataTableAsync("jobs.sp_Admin_Rejection_List", new[]
                {
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@Page", pageNumber),
                    In("@PageSize", PeoplePageSize)
                });

                var result = new RejectionReviewPageDto { Page = pageNumber, PageSize = PeoplePageSize };
                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(r => new RejectionReviewDto
                    {
                        RejectionId = Convert.ToInt32(r["RejectionId"]),
                        RejectedAt = Convert.ToDateTime(r["RejectedAt"]),
                        CompanyName = r["CompanyName"]?.ToString() ?? "",
                        JobTitle = r["JobTitle"]?.ToString() ?? "",
                        Skills = r["Skills"]?.ToString() ?? "",
                        Reason = r["Reason"]?.ToString() ?? "",
                        CandidateName = r["CandidateName"]?.ToString() ?? "",
                        CandidateHeadline = r["CandidateHeadline"]?.ToString() ?? ""
                    }).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<RejectionReviewPageDto>.Ok(result);
            }, personal: false);

        public Task<ApiResponse<bool>> DecidePerson(int userId, Guid candidateKey, bool verified, string? note, string adminName)
            => Guarded(userId, "deciding on a person", async () =>
            {
                var text = (note ?? "").Trim();
                if (candidateKey == Guid.Empty)
                    return ApiResponse<bool>.Fail(NotFound);
                if (text.Length > MaxNoteLength)
                    return ApiResponse<bool>.Fail("The note can have at most 500 characters");
                if (!verified && text.Length == 0)
                    return ApiResponse<bool>.Fail("Say why the tick is taken away. The person reads it");

                return AsFlag(Answer(await Told("jobs.sp_Admin_Person_Decide", new[]
                {
                    In("@CandidateKey", candidateKey),
                    In("@Verified", verified),
                    In("@Note", text),
                    In("@AdminName", AdminName(adminName))
                })));
            }, personal: false);

        private static string AdminName(string? name)
        {
            var text = (name ?? "").Trim();
            if (text.Length == 0) text = "Platform administrator";
            return text.Length > 200 ? text.Substring(0, 200) : text;
        }
    }
}
