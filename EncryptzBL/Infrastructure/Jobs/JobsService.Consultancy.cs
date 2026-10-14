using System.Data;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Job Consultancy: candidates, clients and placements of a company (script PersonalDB/10).
    /// Every method takes the user and the company first; whether the company has Job
    /// Consultancy and the user may use it is decided on every call (HiringAccess).
    /// </summary>
    public interface IConsultancyService
    {
        Task<ApiResponse<List<ConsultClientDto>>> GetClients(int userId, int companyId);
        Task<ApiResponse<int>> SaveClient(int userId, int companyId, ConsultClientDto dto);
        Task<ApiResponse<bool>> DeleteClient(int userId, int companyId, int clientId);
        Task<ApiResponse<List<PostingClientDto>>> GetPostingClients(int userId, int companyId);
        Task<ApiResponse<bool>> SetPostingClient(int userId, int companyId, int postingId, int? clientId);

        Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, string? query, string? city, int? minYears, string? workMode, bool poolOnly, int? page);
        Task<ApiResponse<CandidatePageDto>> GetCandidate(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<JobFileContent>> GetCandidateResume(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<bool>> SaveTalent(int userId, int companyId, Guid candidateKey, TalentSaveRequest req);
        Task<ApiResponse<bool>> RemoveTalent(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<bool>> InviteCandidate(int userId, int companyId, Guid candidateKey, CandidateInviteRequest req);

        Task<ApiResponse<PlacementListDto>> GetPlacements(int userId, int companyId);
        Task<ApiResponse<int>> SavePlacement(int userId, int companyId, PlacementSaveRequest req);
        Task<ApiResponse<bool>> DeletePlacement(int userId, int companyId, int placementId);
    }

    public sealed partial class JobsService : IConsultancyService
    {
        private static SqlParameter Key(string name, Guid? value)
            => new(name, SqlDbType.UniqueIdentifier) { Value = value.HasValue && value.Value != Guid.Empty ? value.Value : DBNull.Value };

        private static string Text(DataRow r, string column) => r.Table.Columns.Contains(column) ? r[column]?.ToString() ?? "" : "";

        // ── clients ───────────────────────────────────────────────────────────

        public Task<ApiResponse<List<ConsultClientDto>>> GetClients(int userId, int companyId)
            => GuardedCompany(userId, companyId, "reading the clients", async _ =>
            {
                var dt = await GetDataTableAsync("consult.sp_Client_List", new[] { In("@CompanyId", companyId) });

                return ApiResponse<List<ConsultClientDto>>.Ok(dt == null ? new List<ConsultClientDto>() : dt.Rows.Cast<DataRow>().Select(r => new ConsultClientDto
                {
                    ClientId = Convert.ToInt32(r["ClientId"]),
                    Name = Text(r, "Name"),
                    ContactPerson = Text(r, "ContactPerson"),
                    Phone = Text(r, "Phone"),
                    Email = Text(r, "Email"),
                    City = Text(r, "City"),
                    Industry = Text(r, "Industry"),
                    Notes = Text(r, "Notes"),
                    IsActive = Convert.ToBoolean(r["IsActive"]),
                    OpenJobs = Convert.ToInt32(r["OpenJobs"]),
                    Placements = Convert.ToInt32(r["Placements"]),
                    CreatedAt = Convert.ToDateTime(r["CreatedAt"])
                }).ToList());
            });

        public Task<ApiResponse<int>> SaveClient(int userId, int companyId, ConsultClientDto dto)
            => GuardedCompany(userId, companyId, "saving a client", async _ =>
            {
                var problem = ConsultancyRules.ClientProblem(dto);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("consult.sp_Client_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@ClientId", dto.ClientId),
                    In("@Name", dto.Name),
                    In("@ContactPerson", dto.ContactPerson),
                    In("@Phone", dto.Phone),
                    In("@Email", dto.Email),
                    In("@City", dto.City),
                    In("@Industry", dto.Industry),
                    In("@Notes", dto.Notes),
                    In("@IsActive", dto.IsActive)
                })));
            });

        public Task<ApiResponse<bool>> DeleteClient(int userId, int companyId, int clientId)
            => GuardedCompany(userId, companyId, "removing a client", async _ =>
                AsFlag(Answer(await GetDataTableAsync("consult.sp_Client_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@ClientId", clientId)
                }))));

        public Task<ApiResponse<List<PostingClientDto>>> GetPostingClients(int userId, int companyId)
            => GuardedCompany(userId, companyId, "reading the clients of the jobs", async _ =>
            {
                var dt = await GetDataTableAsync("consult.sp_Posting_ClientList", new[] { In("@CompanyId", companyId) });

                return ApiResponse<List<PostingClientDto>>.Ok(dt == null ? new List<PostingClientDto>() : dt.Rows.Cast<DataRow>().Select(r => new PostingClientDto
                {
                    PostingId = Convert.ToInt32(r["PostingId"]),
                    ClientId = Convert.ToInt32(r["ClientId"]),
                    ClientName = Text(r, "ClientName")
                }).ToList());
            });

        public Task<ApiResponse<bool>> SetPostingClient(int userId, int companyId, int postingId, int? clientId)
            => GuardedCompany(userId, companyId, "linking a job to a client", async _ =>
                AsFlag(Answer(await GetDataTableAsync("consult.sp_Posting_SetClient", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@ClientId", clientId is > 0 ? clientId : null)
                }))));

        // ── candidates ────────────────────────────────────────────────────────

        public Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, string? query, string? city, int? minYears,
            string? workMode, bool poolOnly, int? page)
            => GuardedCompany(userId, companyId, "searching candidates", async _ =>
            {
                var pageNumber = JobPostingRules.Page(page);
                var dt = await GetDataTableAsync("consult.sp_Candidate_Search", new[]
                {
                    In("@CompanyId", companyId),
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@City", JobPostingRules.SearchText(city)),
                    In("@MinYears", minYears is >= 0 and <= 60 ? minYears : null),
                    In("@WorkMode", JobPostingRules.InList(JobsRules.WorkModes, workMode) ?? ""),
                    In("@PoolOnly", poolOnly),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize)
                });

                var result = new CandidateSearchResultDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };
                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(r => new CandidateDto
                    {
                        CandidateKey = (Guid)r["CandidateKey"],
                        FullName = Text(r, "FullName"),
                        Headline = Text(r, "Headline"),
                        City = Text(r, "City"),
                        ExperienceYears = Convert.ToInt32(r["ExperienceYears"]),
                        Skills = Text(r, "Skills"),
                        PreferredJobs = Text(r, "PreferredJobs"),
                        WorkModes = Text(r, "WorkModes"),
                        HasResume = Convert.ToBoolean(r["HasResume"]),
                        InPool = Convert.ToBoolean(r["InPool"]),
                        Stage = Text(r, "Stage")
                    }).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<CandidateSearchResultDto>.Ok(result);
            });

        public Task<ApiResponse<CandidatePageDto>> GetCandidate(int userId, int companyId, Guid candidateKey)
            => GuardedCompany(userId, companyId, "reading a candidate", async companyName =>
            {
                var ds = await GetDataSetAsync("consult.sp_Candidate_Get", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@ViewerUserId", userId),
                    In("@CompanyName", companyName)
                });

                // one empty set: no such candidate, or the profile is no longer to be found
                if (ds == null || ds.Tables.Count < 8 || ds.Tables[0].Rows.Count == 0)
                    return ApiResponse<CandidatePageDto>.Fail(NotFound);

                var head = ds.Tables[0].Rows[0];
                var page = new CandidatePageDto
                {
                    CandidateKey = (Guid)head["CandidateKey"],
                    InPool = Convert.ToBoolean(head["InPool"]),
                    Stage = Text(head, "Stage"),
                    Note = Text(head, "Note"),
                    Profile = MapPage(ds, 2)
                };

                foreach (DataRow r in ds.Tables[1].Rows)
                {
                    var value = Text(r, "Value");
                    switch (Text(r, "Kind"))
                    {
                        case "Job": page.PreferredJobs.Add(value); break;
                        case "Location": page.PreferredLocations.Add(value); break;
                        case "WorkMode": page.WorkModes.Add(value); break;
                    }
                }

                // what the person chose to show: not the date of birth, the files of certificates or what they expect to earn
                page.Profile.Profile.DateOfBirth = null;
                page.Profile.Preferences = new JobPreferencesDto();
                foreach (var certificate in page.Profile.Certificates)
                {
                    certificate.FileId = 0;
                    certificate.FileName = "";
                    certificate.SizeBytes = 0;
                }
                page.Profile.Completeness = JobsRules.Completeness(page.Profile);

                return ApiResponse<CandidatePageDto>.Ok(page);
            });

        public Task<ApiResponse<JobFileContent>> GetCandidateResume(int userId, int companyId, Guid candidateKey)
            => GuardedCompany(userId, companyId, "reading the resume of a candidate", async companyName =>
            {
                var dt = await GetDataTableAsync("consult.sp_Candidate_Resume", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@ViewerUserId", userId),
                    In("@CompanyName", companyName)
                });

                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });

        public Task<ApiResponse<bool>> SaveTalent(int userId, int companyId, Guid candidateKey, TalentSaveRequest req)
            => GuardedCompany(userId, companyId, "saving a candidate to the pool", async _ =>
            {
                var problem = ConsultancyRules.TalentProblem(req);
                if (problem != null)
                    return ApiResponse<bool>.Fail(problem);

                return AsFlag(Answer(await GetDataTableAsync("consult.sp_Talent_Save", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@Stage", req.Stage),
                    In("@Note", req.Note),
                    In("@UserId", userId)
                })));
            });

        public Task<ApiResponse<bool>> RemoveTalent(int userId, int companyId, Guid candidateKey)
            => GuardedCompany(userId, companyId, "removing a candidate from the pool", async _ =>
                AsFlag(Answer(await GetDataTableAsync("consult.sp_Talent_Remove", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey)
                }))));

        public Task<ApiResponse<bool>> InviteCandidate(int userId, int companyId, Guid candidateKey, CandidateInviteRequest req)
            => GuardedCompany(userId, companyId, "inviting a candidate", async _ =>
            {
                var problem = ConsultancyRules.InviteProblem(req);
                if (problem != null)
                    return ApiResponse<bool>.Fail(problem);

                return AsFlag(Answer(await GetDataTableAsync("consult.sp_Candidate_Invite", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@PostingId", req.PostingId),
                    In("@Message", req.Message),
                    In("@UserId", userId)
                })));
            });

        // ── placements ────────────────────────────────────────────────────────

        public Task<ApiResponse<PlacementListDto>> GetPlacements(int userId, int companyId)
            => GuardedCompany(userId, companyId, "reading the placements", async _ =>
            {
                var ds = await GetDataSetAsync("consult.sp_Placement_List", new[] { In("@CompanyId", companyId) });
                var list = new PlacementListDto();
                if (ds == null || ds.Tables.Count == 0)
                    return ApiResponse<PlacementListDto>.Ok(list);

                list.Items = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new PlacementDto
                {
                    PlacementId = Convert.ToInt32(r["PlacementId"]),
                    ClientId = IntOrNull(r, "ClientId"),
                    ClientName = Text(r, "ClientName"),
                    PostingId = IntOrNull(r, "PostingId"),
                    CandidateName = Text(r, "CandidateName"),
                    JobTitle = Text(r, "JobTitle"),
                    JoinDate = Convert.ToDateTime(r["JoinDate"]),
                    AnnualCtc = IntOrNull(r, "AnnualCtc"),
                    FeeAmount = IntOrNull(r, "FeeAmount"),
                    FeeStatus = Text(r, "FeeStatus"),
                    GuaranteeUntil = DateOrNull(r, "GuaranteeUntil"),
                    Notes = Text(r, "Notes"),
                    OnJobPortal = Convert.ToBoolean(r["OnJobPortal"]),
                    CreatedAt = Convert.ToDateTime(r["CreatedAt"])
                }).ToList();

                if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                {
                    var f = ds.Tables[1].Rows[0];
                    list.ThisMonth = Convert.ToInt32(f["ThisMonth"]);
                    list.Total = Convert.ToInt32(f["Total"]);
                    list.FeeOutstanding = Convert.ToInt64(f["FeeOutstanding"]);
                    list.FeePaidThisYear = Convert.ToInt64(f["FeePaidThisYear"]);
                }

                return ApiResponse<PlacementListDto>.Ok(list);
            });

        public Task<ApiResponse<int>> SavePlacement(int userId, int companyId, PlacementSaveRequest req)
            => GuardedCompany(userId, companyId, "saving a placement", async _ =>
            {
                var problem = ConsultancyRules.PlacementProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("consult.sp_Placement_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PlacementId", req.PlacementId),
                    In("@UserId", userId),
                    Key("@CandidateKey", req.CandidateKey),
                    In("@ApplicationId", req.ApplicationId is > 0 ? req.ApplicationId : null),
                    In("@CandidateName", req.CandidateName),
                    In("@ClientId", req.ClientId is > 0 ? req.ClientId : null),
                    In("@PostingId", req.PostingId is > 0 ? req.PostingId : null),
                    In("@JobTitle", req.JobTitle),
                    Date("@JoinDate", req.JoinDate),
                    In("@AnnualCtc", req.AnnualCtc),
                    In("@FeeAmount", req.FeeAmount),
                    In("@FeeStatus", req.FeeStatus),
                    Date("@GuaranteeUntil", req.GuaranteeUntil),
                    In("@Notes", req.Notes)
                })));
            });

        public Task<ApiResponse<bool>> DeletePlacement(int userId, int companyId, int placementId)
            => GuardedCompany(userId, companyId, "removing a placement", async _ =>
                AsFlag(Answer(await GetDataTableAsync("consult.sp_Placement_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PlacementId", placementId)
                }))));
    }
}
