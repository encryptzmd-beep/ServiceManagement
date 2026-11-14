using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

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

        Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, CandidateSearchRequest req);
        Task<ApiResponse<CandidatePageDto>> GetCandidate(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<JobFileContent>> GetCandidateResume(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<bool>> SaveTalent(int userId, int companyId, Guid candidateKey, TalentSaveRequest req);
        Task<ApiResponse<bool>> RemoveTalent(int userId, int companyId, Guid candidateKey);
        Task<ApiResponse<bool>> InviteCandidate(int userId, int companyId, Guid candidateKey, CandidateInviteRequest req);

        /// <summary>The people who fit one job of the company, best first, with why (script 24).</summary>
        Task<ApiResponse<List<CandidateMatchDto>>> GetPostingMatches(int userId, int companyId, int postingId);
        /// <summary>How many suitable people each open job (or one in review) of the company has.</summary>
        Task<ApiResponse<List<PostingMatchCountDto>>> GetPostingMatchCounts(int userId, int companyId);

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

        public Task<ApiResponse<CandidateSearchResultDto>> SearchCandidates(int userId, int companyId, CandidateSearchRequest req)
            => GuardedTenant(userId, companyId, "searching candidates", async (_, tenant) =>
            {
                req ??= new CandidateSearchRequest();
                var pool = await PoolOf(tenant, companyId);
                var pageNumber = JobPostingRules.Page(req.Page);
                var result = new CandidateSearchResultDto { Page = pageNumber, PageSize = JobPostingRules.PageSize };

                if (req.Pool && pool.Count == 0)
                    return ApiResponse<CandidateSearchResultDto>.Ok(result);

                var ds = await GetDataSetAsync("jobs.sp_Candidate_Search", new[]
                {
                    In("@CompanyId", companyId),
                    In("@Query", JobPostingRules.SearchText(req.Q)),
                    In("@City", JobPostingRules.SearchText(req.City)),
                    In("@MinYears", req.Years is >= 0 and <= 60 ? req.Years : null),
                    In("@WorkMode", JobPostingRules.InList(JobsRules.WorkModes, req.Mode) ?? ""),
                    In("@Keys", req.Pool ? JsonSerializer.Serialize(pool.Keys) : null),
                    In("@Page", pageNumber),
                    In("@PageSize", JobPostingRules.PageSize),
                    In("@MatchAll", req.MatchAll),
                    In("@Cities", ConsultancyRules.FilterList(req.Cities)),
                    In("@Bands", ConsultancyRules.FilterList(req.Bands, ConsultancyRules.ExperienceBands)),
                    In("@Modes", ConsultancyRules.FilterList(req.Modes, JobsRules.WorkModes)),
                    In("@Skills", ConsultancyRules.FilterList(req.Skills)),
                    In("@SkillsAll", req.SkillsAll),
                    In("@VerifiedOnly", req.VerifiedOnly),
                    In("@WithResume", req.WithResume)
                });
                var dt = ds != null && ds.Tables.Count > 0 ? ds.Tables[0] : null;

                // the choices of the filters come with script 21
                if (ds != null && ds.Tables.Count > 1 && ds.Tables[1].Columns.Contains("Kind"))
                    result.Facets = ds.Tables[1].Rows.Cast<DataRow>().Select(f => new CandidateFacetDto
                    {
                        Kind = Text(f, "Kind"),
                        Value = Text(f, "Value"),
                        People = Convert.ToInt32(f["People"])
                    }).ToList();

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
                            ExperienceSource = Text(r, "ExperienceSource"),
                            Skills = Text(r, "Skills"),
                            PreferredJobs = Text(r, "PreferredJobs"),
                            WorkModes = Text(r, "WorkModes"),
                            HasResume = Convert.ToBoolean(r["HasResume"]),
                            IsVerified = FlagOrFalse(r, "IsVerified"),
                            MatchScore = r.Table.Columns.Contains("MatchScore") && r["MatchScore"] != DBNull.Value ? Convert.ToInt32(r["MatchScore"]) : 0,
                            InPool = inPool,
                            Stage = inPool ? p.Stage : ""
                        };
                    }).ToList();
                    result.Total = Convert.ToInt32(dt.Rows[0]["TotalCount"]);
                }

                await AddOwnCandidates(tenant, companyId, req, result);
                return ApiResponse<CandidateSearchResultDto>.Ok(result);
            });

        private const int OwnShownInSearch = 50;

        /// <summary>
        /// The candidates the company added itself that match the search, from its own database (ProjectDB/13).
        /// Not in the pool, nor with "verified only" or a work mode: they are neither verified nor say a mode.
        /// A company database without the script leaves the list of Job Portal as it is.
        /// </summary>
        private static async Task AddOwnCandidates(SqlDbHelper tenant, int companyId, CandidateSearchRequest req, CandidateSearchResultDto result)
        {
            if (req.Pool || req.VerifiedOnly || ConsultancyRules.FilterList(req.Modes, JobsRules.WorkModes) != null
                || !string.IsNullOrWhiteSpace(req.Mode) || req.Years.HasValue || !string.IsNullOrWhiteSpace(req.City))
                return;

            try
            {
                var dt = await tenant.ExecuteDataTableAsync("consult.sp_OwnCandidate_Search", new[]
                {
                    In("@CompanyId", companyId),
                    In("@Query", JobPostingRules.SearchText(req.Q)),
                    In("@MatchAll", req.MatchAll),
                    In("@Cities", ConsultancyRules.FilterList(req.Cities)),
                    In("@Bands", ConsultancyRules.FilterList(req.Bands, ConsultancyRules.ExperienceBands)),
                    In("@Skills", ConsultancyRules.FilterList(req.Skills)),
                    In("@SkillsAll", req.SkillsAll),
                    In("@WithResume", req.WithResume),
                    In("@Count", OwnShownInSearch)
                });

                result.OwnItems = dt.Rows.Cast<DataRow>().Select(OwnCandidateRow).ToList();
                result.OwnTotal = dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["TotalCount"]) : 0;
            }
            catch (SqlException ex) when (ex.Number == 2812 || ex.Number == 208)
            {
                // ProjectDB/13 (or 12) not run in this company database yet: Job Portal only
            }
        }

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

                return AsFlag(Answer(await Told("jobs.sp_Candidate_Invite", new[]
                {
                    In("@CompanyId", companyId),
                    Key("@CandidateKey", candidateKey),
                    In("@PostingId", req.PostingId),
                    In("@Message", req.Message),
                    In("@UserId", userId)
                })));
            });

        // ── suitable candidates of a job (script PersonalDB/24) ────────────────

        private const int MatchesShown = 30;

        /// <summary>
        /// The company's own people (its members in the main database) are not its candidates (QA BUG-022).
        /// A Personal DB without script 27 does not take the list: it is then called without it.
        /// </summary>
        private async Task<DataTable?> MatchesTable(string procedure, int companyId, params SqlParameter[] parameters)
        {
            var members = _users == null ? new List<int>() : await _users.GetCompanyMemberUserIds(companyId);
            if (members.Count > 0)
            {
                try
                {
                    return await GetDataTableAsync(procedure, parameters.Append(In("@ExcludeUserIds", string.Join(",", members))).ToArray());
                }
                catch (SqlException ex) when (ex.Number == 8144)   // too many arguments: script 27 not run yet
                {
                    _logger.LogWarning("{Procedure} does not leave out the company's members: run PersonalDB/27_Jobs_Matches_Exclude_Members.sql.", procedure);
                }
            }
            return await GetDataTableAsync(procedure, parameters);
        }

        public Task<ApiResponse<List<CandidateMatchDto>>> GetPostingMatches(int userId, int companyId, int postingId)
            => GuardedCompany(userId, companyId, "finding candidates for a job", async _ =>
            {
                var dt = await MatchesTable("jobs.sp_Posting_Matches", companyId,
                    In("@CompanyId", companyId),
                    In("@PostingId", postingId),
                    In("@Count", MatchesShown));

                var list = dt == null || !dt.Columns.Contains("MatchScore")
                    ? new List<CandidateMatchDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new CandidateMatchDto
                    {
                        CandidateKey = (Guid)r["CandidateKey"],
                        FullName = Text(r, "FullName"),
                        Headline = Text(r, "Headline"),
                        City = Text(r, "City"),
                        ExperienceYears = Convert.ToInt32(r["ExperienceYears"]),
                        ExperienceSource = Text(r, "ExperienceSource"),
                        IsVerified = Convert.ToBoolean(r["IsVerified"]),
                        HasResume = Convert.ToBoolean(r["HasResume"]),
                        MatchedSkills = Text(r, "MatchedSkills"),
                        SkillHits = Convert.ToInt32(r["SkillHits"]),
                        SkillsWanted = Convert.ToInt32(r["SkillsWanted"]),
                        TitleHits = Convert.ToInt32(r["TitleHits"]),
                        CityMatch = Convert.ToBoolean(r["CityMatch"]),
                        ModeMatch = Convert.ToBoolean(r["ModeMatch"]),
                        ExperienceFit = Convert.ToInt32(r["ExperienceFit"]),
                        AlreadyInvited = Convert.ToBoolean(r["AlreadyInvited"]),
                        MatchScore = Convert.ToInt32(r["MatchScore"])
                    }).ToList();

                return ApiResponse<List<CandidateMatchDto>>.Ok(list);
            });

        public Task<ApiResponse<List<PostingMatchCountDto>>> GetPostingMatchCounts(int userId, int companyId)
            => GuardedCompany(userId, companyId, "counting candidates for the jobs", async _ =>
            {
                var dt = await MatchesTable("jobs.sp_Posting_Match_Counts", companyId, In("@CompanyId", companyId));

                return ApiResponse<List<PostingMatchCountDto>>.Ok(dt == null
                    ? new List<PostingMatchCountDto>()
                    : dt.Rows.Cast<DataRow>().Select(r => new PostingMatchCountDto
                    {
                        PostingId = Convert.ToInt32(r["PostingId"]),
                        Suitable = Convert.ToInt32(r["Suitable"])
                    }).ToList());
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
