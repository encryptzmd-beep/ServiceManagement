using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Job Consultancy: candidates, clients and placements of a company. Every method takes the
    /// user and the company first; whether the company has Job Consultancy and the user may use
    /// it is decided on every call (HiringAccess).
    ///
    /// Two databases: what the company keeps (clients, its candidate pool, placements, which
    /// job is for which client) is in the company's own database (ProjectDB/11). What people
    /// put on Job Portal (profiles, jobs, applications) is in the Personal DB; a company reads
    /// it there, never copies it, and names a person only by the CandidateKey.
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
        /// <summary>Said when the company database has no Job Consultancy tables yet (ProjectDB/11 was not run).</summary>
        public const string ConsultancyNotSetUp = "Job Consultancy is not set up in your company's database yet. Ask Encryptz to finish it";

        private static SqlParameter Key(string name, Guid? value)
            => new(name, SqlDbType.UniqueIdentifier) { Value = value.HasValue && value.Value != Guid.Empty ? value.Value : DBNull.Value };

        private static string Text(DataRow r, string column) => r.Table.Columns.Contains(column) ? r[column]?.ToString() ?? "" : "";

        /// <summary>
        /// The way in for what the company keeps in its own database: the company guard first
        /// (member, Job Consultancy, access), then the company's database, which must be ready.
        /// The work gets the company's name and its database.
        /// </summary>
        private Task<ApiResponse<T>> GuardedTenant<T>(int userId, int companyId, string what, Func<string, SqlDbHelper, Task<ApiResponse<T>>> work)
            => GuardedCompany(userId, companyId, what, async companyName =>
            {
                if (_tenants == null)
                    return ApiResponse<T>.Fail(PersonalDbHelper.NotAvailable);

                var database = await _users!.GetApplicationDatabase(userId, companyId, HiringAccess.ModuleKey);
                if (database == null || !database.Success || string.IsNullOrEmpty(database.Data))
                    return ApiResponse<T>.Fail(database?.Message ?? PersonalDbHelper.NotAvailable);

                var tenantDb = new ExplicitDbHelper(await _tenants.GetServiceConnectionAsync(database.Data));
                try
                {
                    return await work(companyName, tenantDb);
                }
                catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)
                {
                    // a company database from before ProjectDB/11: the procedures are not there yet
                    return ApiResponse<T>.Fail(ConsultancyNotSetUp);
                }
            });

        private static (bool Success, string Message, int Id) TenantAnswer(DataTable? dt) => Answer(dt);

        // ── clients (company database) ────────────────────────────────────────

        public Task<ApiResponse<List<ConsultClientDto>>> GetClients(int userId, int companyId)
            => GuardedTenant(userId, companyId, "reading the clients", async (_, tenant) =>
            {
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_Client_List", new[] { In("@CompanyId", companyId) });
                var clients = dt.Rows.Cast<DataRow>().Select(r => new ConsultClientDto
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
                    Placements = Convert.ToInt32(r["Placements"]),
                    CreatedAt = Convert.ToDateTime(r["CreatedAt"])
                }).ToList();

                // the open jobs of a client: which job is for which client is kept by the company,
                // whether a job is open is on Job Portal
                if (clients.Count > 0)
                {
                    var links = await tenant.ExecuteDataTableAsync("consult.sp_PostingClient_List", new[] { In("@CompanyId", companyId) });
                    var jobs = await GetDataTableAsync("jobs.sp_Company_Posting_List", new[] { In("@CompanyId", companyId) });
                    var open = (jobs?.Rows.Cast<DataRow>() ?? Enumerable.Empty<DataRow>())
                        .Where(r => Text(r, "Status") is "Open" or "InReview")
                        .Select(r => Convert.ToInt32(r["PostingId"])).ToHashSet();
                    var openPerClient = links.Rows.Cast<DataRow>()
                        .Where(r => open.Contains(Convert.ToInt32(r["PostingId"])))
                        .GroupBy(r => Convert.ToInt32(r["ClientId"]))
                        .ToDictionary(g => g.Key, g => g.Count());
                    foreach (var c in clients)
                        c.OpenJobs = openPerClient.TryGetValue(c.ClientId, out var n) ? n : 0;
                }

                return ApiResponse<List<ConsultClientDto>>.Ok(clients);
            });

        public Task<ApiResponse<int>> SaveClient(int userId, int companyId, ConsultClientDto dto)
            => GuardedTenant(userId, companyId, "saving a client", async (_, tenant) =>
            {
                var problem = ConsultancyRules.ClientProblem(dto);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Client_Save", new[]
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
            => GuardedTenant(userId, companyId, "removing a client", async (_, tenant) =>
                AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Client_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@ClientId", clientId)
                }))));

        public Task<ApiResponse<List<PostingClientDto>>> GetPostingClients(int userId, int companyId)
            => GuardedTenant(userId, companyId, "reading the clients of the jobs", async (_, tenant) =>
            {
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_PostingClient_List", new[] { In("@CompanyId", companyId) });

                return ApiResponse<List<PostingClientDto>>.Ok(dt.Rows.Cast<DataRow>().Select(r => new PostingClientDto
                {
                    PostingId = Convert.ToInt32(r["PostingId"]),
                    ClientId = Convert.ToInt32(r["ClientId"]),
                    ClientName = Text(r, "ClientName")
                }).ToList());
            });

        public Task<ApiResponse<bool>> SetPostingClient(int userId, int companyId, int postingId, int? clientId)
            => GuardedTenant(userId, companyId, "linking a job to a client", async (_, tenant) =>
            {
                // only a job of this company (Job Portal) can be linked
                var job = await GetDataTableAsync("jobs.sp_Company_Posting_Get", new[] { In("@CompanyId", companyId), In("@PostingId", postingId) });
                if (job == null || job.Rows.Count == 0)
                    return ApiResponse<bool>.Fail(NotFound);

                return AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_PostingClient_Set", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@ClientId", clientId is > 0 ? clientId : null)
                })));
            });

        // ── candidates (Personal DB) and the pool (company database) ──────────

        private static async Task<Dictionary<Guid, (string Stage, string Note)>> PoolOf(SqlDbHelper tenant, int companyId)
        {
            var dt = await tenant.ExecuteDataTableAsync("consult.sp_Talent_List", new[] { In("@CompanyId", companyId) });
            return dt.Rows.Cast<DataRow>().ToDictionary(r => (Guid)r["CandidateKey"], r => (Text(r, "Stage"), Text(r, "Note")));
        }

        public Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, string? query, string? city, int? minYears,
            string? workMode, bool poolOnly, int? page)
            => GuardedTenant(userId, companyId, "searching candidates", async (_, tenant) =>
            {
                var pool = await PoolOf(tenant, companyId);
                var pageNumber = JobPostingRules.Page(page);
                var result = new CandidateSearchResultDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };

                if (poolOnly && pool.Count == 0)
                    return ApiResponse<CandidateSearchResultDto>.Ok(result);

                var dt = await GetDataTableAsync("jobs.sp_Candidate_Search", new[]
                {
                    In("@CompanyId", companyId),
                    In("@Query", JobPostingRules.SearchText(query)),
                    In("@City", JobPostingRules.SearchText(city)),
                    In("@MinYears", minYears is >= 0 and <= 60 ? minYears : null),
                    In("@WorkMode", JobPostingRules.InList(JobsRules.WorkModes, workMode) ?? ""),
                    In("@Keys", poolOnly ? JsonSerializer.Serialize(pool.Keys) : null),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize)
                });

                if (dt != null && dt.Rows.Count > 0)
                {
                    result.Items = dt.Rows.Cast<DataRow>().Select(r =>
                    {
                        var key = (Guid)r["CandidateKey"];
                        var inPool = pool.TryGetValue(key, out var p);
                        return new CandidateDto
                        {
                            CandidateKey = key,
                            FullName = Text(r, "FullName"),
                            Headline = Text(r, "Headline"),
                            City = Text(r, "City"),
                            ExperienceYears = Convert.ToInt32(r["ExperienceYears"]),
                            Skills = Text(r, "Skills"),
                            PreferredJobs = Text(r, "PreferredJobs"),
                            WorkModes = Text(r, "WorkModes"),
                            HasResume = Convert.ToBoolean(r["HasResume"]),
                            InPool = inPool,
                            Stage = inPool ? p.Stage : ""
                        };
                    }).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                return ApiResponse<CandidateSearchResultDto>.Ok(result);
            });

        public Task<ApiResponse<CandidatePageDto>> GetCandidate(int userId, int companyId, Guid candidateKey)
            => GuardedTenant(userId, companyId, "reading a candidate", async (companyName, tenant) =>
            {
                var ds = await GetDataSetAsync("jobs.sp_Candidate_Get", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@ViewerUserId", userId),
                    In("@CompanyName", companyName)
                });

                // one empty set: no such candidate, or the profile is no longer to be found
                if (ds == null || ds.Tables.Count < 8 || ds.Tables[0].Rows.Count == 0)
                    return ApiResponse<CandidatePageDto>.Fail(NotFound);

                var pool = await PoolOf(tenant, companyId);
                var inPool = pool.TryGetValue(candidateKey, out var p);

                var page = new CandidatePageDto
                {
                    CandidateKey = candidateKey,
                    InPool = inPool,
                    Stage = inPool ? p.Stage : "",
                    Note = inPool ? p.Note : "",
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
                var dt = await GetDataTableAsync("jobs.sp_Candidate_Resume", new[]
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

        /// <summary>The name of a person the company can find by this key, or null.</summary>
        private async Task<string?> FindableName(int companyId, Guid candidateKey)
        {
            var dt = await GetDataTableAsync("jobs.sp_Candidate_Find", new[] { In("@CompanyId", companyId), Key("@CandidateKey", candidateKey) });
            return dt == null || dt.Rows.Count == 0 ? null : Text(dt.Rows[0], "FullName");
        }

        public Task<ApiResponse<bool>> SaveTalent(int userId, int companyId, Guid candidateKey, TalentSaveRequest req)
            => GuardedTenant(userId, companyId, "saving a candidate to the pool", async (_, tenant) =>
            {
                var problem = ConsultancyRules.TalentProblem(req);
                if (problem != null)
                    return ApiResponse<bool>.Fail(problem);

                if (await FindableName(companyId, candidateKey) == null)
                    return ApiResponse<bool>.Fail(NotFound);

                return AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Talent_Save", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@Stage", req.Stage),
                    In("@Note", req.Note),
                    In("@UserId", userId)
                })));
            });

        public Task<ApiResponse<bool>> RemoveTalent(int userId, int companyId, Guid candidateKey)
            => GuardedTenant(userId, companyId, "removing a candidate from the pool", async (_, tenant) =>
                AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Talent_Remove", new[]
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

                return AsFlag(Answer(await GetDataTableAsync("jobs.sp_Candidate_Invite", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@PostingId", req.PostingId),
                    In("@Message", req.Message),
                    In("@UserId", userId)
                })));
            });

        // ── placements (company database) ─────────────────────────────────────

        public Task<ApiResponse<PlacementListDto>> GetPlacements(int userId, int companyId)
            => GuardedTenant(userId, companyId, "reading the placements", async (_, tenant) =>
            {
                var ds = await tenant.ExecuteDataSetAsync("consult.sp_Placement_List", new[] { In("@CompanyId", companyId) });
                var list = new PlacementListDto();
                if (ds.Tables.Count == 0)
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
                    OnJobPortal = r["CandidateKey"] != DBNull.Value,
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
            => GuardedTenant(userId, companyId, "saving a placement", async (_, tenant) =>
            {
                var problem = ConsultancyRules.PlacementProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                // who was placed: a person the company can find, an applicant of one of its jobs, or a name only
                Guid? key = null;
                var name = req.CandidateName;
                var postingId = req.PostingId is > 0 ? req.PostingId : null;

                if (req.CandidateKey.HasValue && req.CandidateKey.Value != Guid.Empty)
                {
                    var found = await FindableName(companyId, req.CandidateKey.Value);
                    if (found == null)
                        return ApiResponse<int>.Fail(NotFound);
                    key = req.CandidateKey.Value;
                    if (name.Length == 0) name = found;
                }
                else if (req.ApplicationId is > 0)
                {
                    var applicant = await GetDataTableAsync("jobs.sp_Company_Applicant_Identity", new[]
                    {
                        In("@CompanyId", companyId),
                        In("@ApplicationId", req.ApplicationId)
                    });
                    if (applicant == null || applicant.Rows.Count == 0)
                        return ApiResponse<int>.Fail(NotFound);
                    var a = applicant.Rows[0];
                    key = (Guid)a["CandidateKey"];
                    if (name.Length == 0) name = Text(a, "FullName");
                    postingId ??= Convert.ToInt32(a["PostingId"]);
                }

                // only a job of this company
                if (postingId.HasValue)
                {
                    var job = await GetDataTableAsync("jobs.sp_Company_Posting_Get", new[] { In("@CompanyId", companyId), In("@PostingId", postingId) });
                    if (job == null || job.Rows.Count == 0)
                        return ApiResponse<int>.Fail(NotFound);
                }

                return AsId(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Placement_Save", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PlacementId", req.PlacementId),
                    In("@UserId", userId),
                    Key("@CandidateKey", key),
                    In("@CandidateName", name),
                    In("@ClientId", req.ClientId is > 0 ? req.ClientId : null),
                    In("@PostingId", postingId),
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
            => GuardedTenant(userId, companyId, "removing a placement", async (_, tenant) =>
                AsFlag(TenantAnswer(await tenant.ExecuteDataTableAsync("consult.sp_Placement_Delete", new[]
                {
                    In("@CompanyId", companyId),
                    In("@PlacementId", placementId)
                }))));
    }
}
