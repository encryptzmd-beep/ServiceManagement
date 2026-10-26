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
