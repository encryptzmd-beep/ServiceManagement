using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    // Job Portal, the public job pages (scripts PersonalDB/06, 07, 16 and 17): anybody can
    // search the open jobs and read one, without an account. The search and the job are the
    // person's procedures with user 0 - no user has that id - so nothing saved or applied
    // is ever answered. Applying still needs a login (IJobPostingsService).
    public sealed partial class JobsService : IPublicJobsService
    {
        private const int Nobody = 0;

        public Task<ApiResponse<JobPostingSearchResultDto>> SearchPublicPostings(
            string? query, string? city, string? employmentType, string? workMode, int? page)
            => Shielded(Nobody, "searching the public jobs", async () =>
            {
                var pageNumber = JobPostingRules.Page(page);

                var dt = await GetDataTableAsync("jobs.sp_Posting_Search", new[]
                {
                    In("@UserId", Nobody),
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@City", JobPostingRules.SearchText(city)),
                    In("@EmploymentType", JobPostingRules.InList(JobPostingRules.EmploymentTypes, employmentType) ?? ""),
                    In("@WorkMode", JobPostingRules.InList(JobsRules.WorkModes, workMode) ?? ""),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize),
                    // nobody has preferences: the best match is the newest
                    In("@Sort", "newest")
                });

                var result = new JobPostingSearchResultDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };
                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(PostingView).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<JobPostingSearchResultDto>.Ok(result);
            });

        public Task<ApiResponse<JobPostingViewDto>> GetPublicPosting(int postingId)
            => Shielded(Nobody, "reading a public job", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Posting_Get", new[]
                {
                    In("@UserId", Nobody),
                    In("@PostingId", postingId)
                });

                // user 0 applied to nothing: only an open job is answered
                return dt == null || dt.Rows.Count == 0
                    ? ApiResponse<JobPostingViewDto>.Fail(NotFound)
                    : ApiResponse<JobPostingViewDto>.Ok(PostingView(dt.Rows[0]));
            });

        private const int RelatedCount = 6;

        public Task<ApiResponse<List<JobPostingViewDto>>> GetRelatedPublicPostings(int postingId)
            => Shielded(Nobody, "reading the jobs like a public job", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Public_Posting_Related", new[]
                {
                    In("@PostingId", postingId),
                    In("@Count", RelatedCount)
                });

                return ApiResponse<List<JobPostingViewDto>>.Ok(
                    dt == null ? new List<JobPostingViewDto>() : dt.Rows.Cast<DataRow>().Select(PostingView).ToList());
            });

        // ── a shared profile (script PersonalDB/19) ───────────────────────────

        /// <summary>A share code as the database makes it: 10 of the letters and digits it uses. Anything else is not looked up.</summary>
        private static string? ShareCode(string? code)
        {
            var text = (code ?? "").Trim().ToLowerInvariant();
            return text.Length == 10 && text.All(c => "abcdefghijkmnpqrstuvwxyz23456789".Contains(c)) ? text : null;
        }

        public Task<ApiResponse<PublicProfileDto>> GetPublicProfile(string? code)
            => Shielded(Nobody, "reading a shared profile", async () =>
            {
                var key = ShareCode(code);
                if (key == null)
                    return ApiResponse<PublicProfileDto>.Fail(NotFound);

                var ds = await GetDataSetAsync("jobs.sp_Public_Profile_Get", new[] { In("@Code", key) });
                if (ds == null || ds.Tables.Count < 7 || ds.Tables[0].Rows.Count == 0)
                    return ApiResponse<PublicProfileDto>.Fail(NotFound);

                var p = ds.Tables[0].Rows[0];
                var page = new PublicProfileDto
                {
                    FullName = p["FullName"]?.ToString() ?? "",
                    Headline = p["Headline"]?.ToString() ?? "",
                    Summary = p["Summary"]?.ToString() ?? "",
                    City = p["City"]?.ToString() ?? "",
                    IsVerified = Convert.ToBoolean(p["IsVerified"]),
                    HasPhoto = Convert.ToBoolean(p["HasPhoto"]),
                    Experience = ds.Tables[1].Rows.Cast<DataRow>().Select(r => new JobExperienceDto
                    {
                        ExperienceId = Convert.ToInt32(r["ExperienceId"]),
                        Organisation = r["Organisation"]?.ToString() ?? "",
                        Title = r["Title"]?.ToString() ?? "",
                        StartMonth = Convert.ToDateTime(r["StartMonth"]),
                        EndMonth = DateOrNull(r, "EndMonth"),
                        Description = r["Description"]?.ToString() ?? ""
                    }).ToList(),
                    Education = ds.Tables[2].Rows.Cast<DataRow>().Select(r => new JobEducationDto
                    {
                        EducationId = Convert.ToInt32(r["EducationId"]),
                        Institution = r["Institution"]?.ToString() ?? "",
                        Course = r["Course"]?.ToString() ?? "",
                        FieldOfStudy = r["FieldOfStudy"]?.ToString() ?? "",
                        StartYear = IntOrNull(r, "StartYear"),
                        EndYear = IntOrNull(r, "EndYear")
                    }).ToList(),
                    Certificates = ds.Tables[5].Rows.Cast<DataRow>().Select(r => new PublicCertificateDto
                    {
                        Title = r["Title"]?.ToString() ?? "",
                        Issuer = r["Issuer"]?.ToString() ?? "",
                        IssuedOn = DateOrNull(r, "IssuedOn"),
                        Status = r["Status"]?.ToString() ?? ""
                    }).ToList(),
                    SocialLinks = ds.Tables[6].Rows.Cast<DataRow>()
                        // a stored link that is not a plain https address is not handed out
                        .Where(r => JobsRules.IsHttpsLink(r["Url"]?.ToString()))
                        .Select(r => new JobSocialLinkDto { Platform = r["Platform"]?.ToString() ?? "", Url = r["Url"]!.ToString()! })
                        .ToList()
                };

                var subSkills = ds.Tables[4].Rows.Cast<DataRow>().ToList();
                page.Skills = ds.Tables[3].Rows.Cast<DataRow>().Select(r =>
                {
                    var skillId = Convert.ToInt32(r["SkillId"]);
                    var rating = r["Rating"] == DBNull.Value ? 3 : Convert.ToInt32(r["Rating"]);
                    var parts = subSkills.Where(u => Convert.ToInt32(u["SkillId"]) == skillId).Select(u => new JobSubSkillDto
                    {
                        Name = u["SubSkillName"]?.ToString() ?? "",
                        Rating = Convert.ToInt32(u["Rating"])
                    }).ToList();

                    return new JobSkillDto
                    {
                        SkillId = skillId,
                        SkillName = r["SkillName"]?.ToString() ?? "",
                        Rating = rating,
                        Overall = parts.Count > 0 ? JobsRules.AverageRating(parts) : rating,
                        Level = JobsRules.LevelOf(rating),
                        EvidenceUrl = JobsRules.IsHttpsLink(r["EvidenceUrl"]?.ToString()) ? r["EvidenceUrl"]!.ToString()! : "",
                        SubSkills = parts
                    };
                }).ToList();

                return ApiResponse<PublicProfileDto>.Ok(page);
            });

        public Task<ApiResponse<JobFileContent>> GetPublicProfilePhoto(string? code)
            => Shielded(Nobody, "reading the photo of a shared profile", async () =>
            {
                var key = ShareCode(code);
                if (key == null)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var dt = await GetDataTableAsync("jobs.sp_Public_Profile_Photo", new[] { In("@Code", key) });
                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });

        public Task<ApiResponse<List<PublicPostingLinkDto>>> GetPublicSitemap()
            => Shielded(Nobody, "reading the sitemap of the public jobs", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Public_Posting_Sitemap", Array.Empty<Microsoft.Data.SqlClient.SqlParameter>());

                var list = dt == null
                    ? new List<PublicPostingLinkDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new PublicPostingLinkDto
                    {
                        PostingId = Convert.ToInt32(r["PostingId"]),
                        Title = r["Title"]?.ToString() ?? "",
                        City = r["City"]?.ToString() ?? "",
                        UpdatedAt = Convert.ToDateTime(r["UpdatedAt"])
                    }).ToList();

                return ApiResponse<List<PublicPostingLinkDto>>.Ok(list);
            });
    }
}
