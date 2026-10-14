using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    // Job Portal, the person's side of job postings (script PersonalDB/06).
    public sealed partial class JobsService : IJobPostingsService
    {
        private static int? IntOrNull(DataRow r, string column)
            => r[column] == DBNull.Value ? null : Convert.ToInt32(r[column]);

        private static DateTime? DateOrNull(DataRow r, string column)
            => r[column] == DBNull.Value ? null : Convert.ToDateTime(r[column]);

        private static JobPostingViewDto PostingView(DataRow r) => new()
        {
            PostingId = Convert.ToInt32(r["PostingId"]),
            Title = r["Title"]?.ToString() ?? "",
            CompanyName = r["CompanyName"]?.ToString() ?? "",
            City = r["City"]?.ToString() ?? "",
            EmploymentType = r["EmploymentType"]?.ToString() ?? "",
            WorkMode = r["WorkMode"]?.ToString() ?? "",
            ExperienceMinYears = IntOrNull(r, "ExperienceMinYears"),
            ExperienceMaxYears = IntOrNull(r, "ExperienceMaxYears"),
            SalaryMin = IntOrNull(r, "SalaryMin"),
            SalaryMax = IntOrNull(r, "SalaryMax"),
            Skills = r["Skills"]?.ToString() ?? "",
            Description = r.Table.Columns.Contains("Description") ? r["Description"]?.ToString() ?? "" : "",
            PublishedAt = DateOrNull(r, "PublishedAt"),
            ClosesOn = DateOrNull(r, "ClosesOn"),
            IsSaved = Convert.ToBoolean(r["IsSaved"]),
            MyStatus = r["MyStatus"]?.ToString() ?? "",
            IsOpen = Convert.ToBoolean(r["IsOpen"]),
            // only the search scores a job (script 07)
            MatchScore = r.Table.Columns.Contains("MatchScore") && r["MatchScore"] != DBNull.Value ? Convert.ToInt32(r["MatchScore"]) : 0
        };

        public Task<ApiResponse<JobPostingSearchResultDto>> SearchPostings(
            int userId, string? query, string? city, string? employmentType, string? workMode, int? page, string? sort = null)
            => Guarded(userId, "searching jobs", async () =>
            {
                var pageNumber = JobPostingRules.Page(page);

                var dt = await GetDataTableAsync("jobs.sp_Posting_Search", new[]
                {
                    In("@UserId", userId),
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@City", JobPostingRules.SearchText(city)),
                    // a value that is not in the list filters nothing
                    In("@EmploymentType", JobPostingRules.InList(JobPostingRules.EmploymentTypes, employmentType) ?? ""),
                    In("@WorkMode", JobPostingRules.InList(JobsRules.WorkModes, workMode) ?? ""),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize),
                    In("@Sort", JobPostingRules.Sort(sort))
                });

                var result = new JobPostingSearchResultDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };
                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(PostingView).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<JobPostingSearchResultDto>.Ok(result);
            });

        public Task<ApiResponse<JobPostingViewDto>> GetPosting(int userId, int postingId)
            => Guarded(userId, "reading a job", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Posting_Get", new[]
                {
                    In("@UserId", userId),
                    In("@PostingId", postingId)
                });

                return dt == null || dt.Rows.Count == 0
                    ? ApiResponse<JobPostingViewDto>.Fail(NotFound)
                    : ApiResponse<JobPostingViewDto>.Ok(PostingView(dt.Rows[0]));
            });

        public Task<ApiResponse<int>> Apply(int userId, int postingId, string? note)
            => Guarded(userId, "applying to a job", async () =>
            {
                var text = JobPostingRules.Note(note);
                if (text == null)
                    return ApiResponse<int>.Fail("The note can have at most 1000 characters");

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Application_Apply", new[]
                {
                    In("@UserId", userId),
                    In("@PostingId", postingId),
                    In("@Note", text)
                })));
            });

        public Task<ApiResponse<bool>> Withdraw(int userId, int applicationId)
            => Guarded(userId, "withdrawing an application", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Application_Withdraw", new[]
                {
                    In("@UserId", userId),
                    In("@ApplicationId", applicationId)
                }))));

        public Task<ApiResponse<List<JobApplicationDto>>> GetMyApplications(int userId)
            => Guarded(userId, "reading the applications", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Application_ListMine", new[] { In("@UserId", userId) });

                var list = dt == null
                    ? new List<JobApplicationDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new JobApplicationDto
                    {
                        ApplicationId = Convert.ToInt32(r["ApplicationId"]),
                        PostingId = Convert.ToInt32(r["PostingId"]),
                        Title = r["Title"]?.ToString() ?? "",
                        CompanyName = r["CompanyName"]?.ToString() ?? "",
                        City = r["City"]?.ToString() ?? "",
                        EmploymentType = r["EmploymentType"]?.ToString() ?? "",
                        WorkMode = r["WorkMode"]?.ToString() ?? "",
                        Status = r["Status"]?.ToString() ?? "",
                        Note = r["Note"]?.ToString() ?? "",
                        AppliedAt = Convert.ToDateTime(r["AppliedAt"]),
                        StatusAt = Convert.ToDateTime(r["StatusAt"]),
                        IsOpen = Convert.ToBoolean(r["IsOpen"])
                    }).ToList();

                return ApiResponse<List<JobApplicationDto>>.Ok(list);
            });

        public Task<ApiResponse<bool>> SetSaved(int userId, int postingId, bool saved)
            => Guarded(userId, "saving a job", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Saved_Set", new[]
                {
                    In("@UserId", userId),
                    In("@PostingId", postingId),
                    In("@Saved", saved)
                }))));

        public Task<ApiResponse<List<JobProfileViewDto>>> GetProfileViews(int userId)
            => Guarded(userId, "reading who viewed the profile", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_ProfileView_ListMine", new[] { In("@UserId", userId) });

                var list = dt == null
                    ? new List<JobProfileViewDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new JobProfileViewDto
                    {
                        CompanyName = r["CompanyName"]?.ToString() ?? "",
                        PostingTitle = r["PostingTitle"]?.ToString() ?? "",
                        ProfileViews = Convert.ToInt32(r["ProfileViews"]),
                        ResumeViews = Convert.ToInt32(r["ResumeViews"]),
                        LastViewedAt = Convert.ToDateTime(r["LastViewedAt"])
                    }).ToList();

                return ApiResponse<List<JobProfileViewDto>>.Ok(list);
            });

        public Task<ApiResponse<JobNotificationsDto>> GetNotifications(int userId)
            => Guarded(userId, "reading the notifications", async () =>
            {
                var ds = await GetDataSetAsync("jobs.sp_Notification_ListMine", new[] { In("@UserId", userId) });
                var result = new JobNotificationsDto();
                if (ds == null || ds.Tables.Count == 0)
                    return ApiResponse<JobNotificationsDto>.Ok(result);

                result.Items = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new JobNotificationDto
                {
                    NotificationId = Convert.ToInt32(r["NotificationId"]),
                    Kind = r["Kind"]?.ToString() ?? "",
                    Title = r["Title"]?.ToString() ?? "",
                    Body = r["Body"]?.ToString() ?? "",
                    // only a page of Job Portal is ever handed out as a link
                    Link = (r["Link"]?.ToString() ?? "").StartsWith("/apps/jobs", StringComparison.Ordinal) ? r["Link"]!.ToString()! : "",
                    CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
                    IsRead = Convert.ToBoolean(r["IsRead"])
                }).ToList();

                if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                    result.Unread = Convert.ToInt32(ds.Tables[1].Rows[0]["Unread"]);

                return ApiResponse<JobNotificationsDto>.Ok(result);
            });

        public Task<ApiResponse<bool>> MarkNotificationsRead(int userId, int? notificationId)
            => Guarded(userId, "marking notifications as read", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Notification_MarkRead", new[]
                {
                    In("@UserId", userId),
                    In("@NotificationId", notificationId is > 0 ? notificationId : null)
                }))));

        public Task<ApiResponse<List<JobPostingViewDto>>> GetSavedPostings(int userId)
            => Guarded(userId, "reading the saved jobs", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Saved_ListMine", new[] { In("@UserId", userId) });

                return ApiResponse<List<JobPostingViewDto>>.Ok(
                    dt == null ? new List<JobPostingViewDto>() : dt.Rows.Cast<DataRow>().Select(PostingView).ToList());
            });
    }
}
