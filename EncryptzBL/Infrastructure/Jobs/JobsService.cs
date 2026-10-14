using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Common.Tenant;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Job Portal on the Personal DB (schema jobs, script PersonalDB/02). The procedures
    /// keep one person's rows from another (every statement names @UserId); this class
    /// checks what is typed (JobsRules) and never lets a database error reach the caller.
    /// </summary>
    public sealed partial class JobsService : BaseRepository, IJobsService
    {
        private const string NotFound = "Not found";

        private readonly PersonalDbHelper _personal;
        private readonly ILogger<JobsService> _logger;
        private readonly IAuthService? _users;
        private readonly IConnectionResolver? _tenants;

        /// <param name="users">The user master (main database). Without it a profile starts empty.</param>
        /// <param name="tenants">Finds the company's own database (Job Consultancy keeps its data there).</param>
        public JobsService(PersonalDbHelper db, ILogger<JobsService> logger, IAuthService? users = null, IConnectionResolver? tenants = null) : base(db)
        {
            _personal = db;
            _logger = logger;
            _users = users;
            _tenants = tenants;
        }

        /// <summary>Whether Job Portal is released, as the main database said it a moment ago.</summary>
        private sealed record PortalState(DateTime At, bool Open);

        private static PortalState _portal = new(DateTime.MinValue, true);
        private static readonly TimeSpan PortalCheckedFor = TimeSpan.FromSeconds(60);

        /// <summary>
        /// Job Portal is a personal application of the catalogue: while the platform administrator
        /// has not released it (or switched it off) its person side does not answer. The answer of
        /// the main database is kept for a minute, so that not every call asks again.
        /// </summary>
        private async Task<bool> PortalOpenAsync()
        {
            if (_users == null)
                return true;

            var known = _portal;
            if (DateTime.UtcNow - known.At < PortalCheckedFor)
                return known.Open;

            var open = JobsRules.PortalOpen((await _users.GetPersonalApps())?.Data);
            _portal = new PortalState(DateTime.UtcNow, open);
            return open;
        }

        /// <summary>
        /// The one way into the database: no user = refused; no Personal DB = "not available";
        /// Job Portal not released = "not available" (the person side only); a database error =
        /// the same sentence for the caller and the cause in the log.
        /// </summary>
        private async Task<ApiResponse<T>> Guarded<T>(int userId, string what, Func<Task<ApiResponse<T>>> work, bool personal = true)
        {
            if (userId <= 0)
                return ApiResponse<T>.Fail("Please log in again");

            if (!_personal.IsConfigured)
                return ApiResponse<T>.Fail(PersonalDbHelper.NotAvailable);

            try
            {
                if (personal && !await PortalOpenAsync())
                    return ApiResponse<T>.Fail(PersonalDbHelper.NotAvailable);

                return await work();
            }
            catch (SqlException ex)
            {
                // the text of a database error can name the server: it goes to the log only
                _logger.LogError(ex, "Job Portal: {What} failed for user {UserId} (SQL error {Number})",
                    what, userId, ex.Number);
                return ApiResponse<T>.Fail(PersonalDbHelper.NotAvailable);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // a connection string the driver refuses, a pool that ran dry, an answer of a
                // procedure that is older than this code: none of these is a SqlException, and
                // none of them may reach the caller as an HTTP 500
                _logger.LogError(ex, "Job Portal: {What} failed for user {UserId} ({ErrorType})",
                    what, userId, ex.GetType().Name);
                return ApiResponse<T>.Fail(PersonalDbHelper.NotAvailable);
            }
        }

        private static SqlParameter In(string name, object? value)
            => SqlParameterHelper.Input(name, value ?? DBNull.Value);

        private static SqlParameter Binary(string name, byte[]? value)
            // typed: an untyped NULL would be nvarchar, which SQL Server does not convert to varbinary
            => new(name, SqlDbType.VarBinary, -1) { Value = (object?)value ?? DBNull.Value };

        private static SqlParameter Date(string name, DateTime? value)
            => new(name, SqlDbType.Date) { Value = (object?)value?.Date ?? DBNull.Value };

        /// <summary>The row of a "Success, Message[, Id]" answer.</summary>
        private static (bool Success, string Message, int Id) Answer(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return (false, "Could not save. Please try again", 0);

            var row = dt.Rows[0];
            var id = dt.Columns.Contains("Id") && row["Id"] != DBNull.Value ? Convert.ToInt32(row["Id"]) : 0;
            return (Convert.ToInt32(row["Success"]) == 1, row["Message"]?.ToString() ?? "", id);
        }

        private static ApiResponse<bool> AsFlag((bool Success, string Message, int Id) answer)
            => answer.Success ? ApiResponse<bool>.Ok(true, answer.Message) : ApiResponse<bool>.Fail(answer.Message);

        private static ApiResponse<int> AsId((bool Success, string Message, int Id) answer)
            => answer.Success ? ApiResponse<int>.Ok(answer.Id, answer.Message) : ApiResponse<int>.Fail(answer.Message);

        // ── the page ──────────────────────────────────────────────────────────

        public Task<ApiResponse<JobProfilePageDto>> GetPage(int userId)
            => Guarded(userId, "reading the profile", async () =>
            {
                var ds = await GetDataSetAsync("jobs.sp_Profile_Get", new[] { In("@UserId", userId) });

                if (ds == null || ds.Tables.Count < 6)
                    return ApiResponse<JobProfilePageDto>.Fail(PersonalDbHelper.NotAvailable);

                var page = MapPage(ds, 0);

                // the first visit: the profile starts with what the user master knows
                if (ds.Tables[0].Rows.Count == 0)
                    page.Profile = await StartProfile(userId) ?? page.Profile;

                page.Preferences = await ReadPreferences(userId);
                page.Completeness = JobsRules.Completeness(page);
                return ApiResponse<JobProfilePageDto>.Ok(page);
            });

        /// <summary>
        /// The six result sets of jobs.sp_Profile_Get as a page. <paramref name="first"/> is the
        /// index of the first of them: another procedure may put a set of its own in front.
        /// </summary>
        private static JobProfilePageDto MapPage(DataSet ds, int first)
        {
            var page = new JobProfilePageDto();

            if (ds.Tables[first].Rows.Count > 0)
            {
                var r = ds.Tables[first].Rows[0];
                page.Profile = new JobProfileDto
                {
                    FullName = r["FullName"]?.ToString() ?? "",
                    Headline = r["Headline"]?.ToString() ?? "",
                    Summary = r["Summary"]?.ToString() ?? "",
                    City = r["City"]?.ToString() ?? "",
                    ContactEmail = r["ContactEmail"]?.ToString() ?? "",
                    ContactPhone = r["ContactPhone"]?.ToString() ?? "",
                    DateOfBirth = r["DateOfBirth"] == DBNull.Value ? null : Convert.ToDateTime(r["DateOfBirth"]),
                    IsVisible = Convert.ToBoolean(r["IsVisible"])
                };
            }

            page.Experience = ds.Tables[first + 1].Rows.Cast<DataRow>().Select(r => new JobExperienceDto
            {
                ExperienceId = Convert.ToInt32(r["ExperienceId"]),
                Organisation = r["Organisation"]?.ToString() ?? "",
                Title = r["Title"]?.ToString() ?? "",
                StartMonth = Convert.ToDateTime(r["StartMonth"]),
                EndMonth = r["EndMonth"] == DBNull.Value ? null : Convert.ToDateTime(r["EndMonth"]),
                Description = r["Description"]?.ToString() ?? ""
            }).ToList();

            page.Education = ds.Tables[first + 2].Rows.Cast<DataRow>().Select(r => new JobEducationDto
            {
                EducationId = Convert.ToInt32(r["EducationId"]),
                Institution = r["Institution"]?.ToString() ?? "",
                Course = r["Course"]?.ToString() ?? "",
                FieldOfStudy = r["FieldOfStudy"]?.ToString() ?? "",
                StartYear = r["StartYear"] == DBNull.Value ? null : Convert.ToInt32(r["StartYear"]),
                EndYear = r["EndYear"] == DBNull.Value ? null : Convert.ToInt32(r["EndYear"])
            }).ToList();

            page.Skills = ds.Tables[first + 3].Rows.Cast<DataRow>().Select(r => new JobSkillDto
            {
                SkillId = Convert.ToInt32(r["SkillId"]),
                SkillName = r["SkillName"]?.ToString() ?? "",
                Level = r["Level"]?.ToString() ?? "",
                // a stored link that is not a plain https address is not handed out
                EvidenceUrl = JobsRules.IsHttpsLink(r["EvidenceUrl"]?.ToString()) ? r["EvidenceUrl"]!.ToString() : ""
            }).ToList();

            page.Certificates = ds.Tables[first + 4].Rows.Cast<DataRow>().Select(r => new JobCertificateDto
            {
                CertificateId = Convert.ToInt32(r["CertificateId"]),
                Title = r["Title"]?.ToString() ?? "",
                Issuer = r["Issuer"]?.ToString() ?? "",
                IssuedOn = r["IssuedOn"] == DBNull.Value ? null : Convert.ToDateTime(r["IssuedOn"]),
                Status = r["Status"]?.ToString() ?? "",
                FileId = Convert.ToInt32(r["FileId"]),
                FileName = r["FileName"]?.ToString() ?? "",
                SizeBytes = Convert.ToInt32(r["SizeBytes"])
            }).ToList();

            if (ds.Tables[first + 5].Rows.Count > 0)
            {
                var r = ds.Tables[first + 5].Rows[0];
                page.Resume = new JobFileInfoDto
                {
                    FileId = Convert.ToInt32(r["FileId"]),
                    FileName = r["FileName"]?.ToString() ?? "",
                    SizeBytes = Convert.ToInt32(r["SizeBytes"]),
                    UploadedAt = Convert.ToDateTime(r["UploadedAt"])
                };
            }

            return page;
        }

        // ── preferences (script PersonalDB/05) ────────────────────────────────

        /// <summary>
        /// What the person is looking for. A database that does not have script 05 yet gives
        /// an empty answer: the rest of the page must still open.
        /// </summary>
        private async Task<JobPreferencesDto> ReadPreferences(int userId)
        {
            var preferences = new JobPreferencesDto();

            try
            {
                var ds = await GetDataSetAsync("jobs.sp_Preference_List", new[] { In("@UserId", userId) });
                if (ds == null || ds.Tables.Count == 0)
                    return preferences;

                foreach (DataRow r in ds.Tables[0].Rows)
                {
                    var value = r["Value"]?.ToString() ?? "";
                    switch (r["Kind"]?.ToString())
                    {
                        case "Job": preferences.Jobs.Add(value); break;
                        case "Location": preferences.Locations.Add(value); break;
                        case "WorkMode": preferences.WorkModes.Add(value); break;
                    }
                }

                if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0 && ds.Tables[1].Rows[0]["ExpectedCtc"] != DBNull.Value)
                    preferences.ExpectedCtc = Convert.ToInt32(ds.Tables[1].Rows[0]["ExpectedCtc"]);
            }
            catch (SqlException ex)
            {
                _logger.LogWarning(ex, "Job Portal: the preferences of user {UserId} could not be read (SQL error {Number})", userId, ex.Number);
                return new JobPreferencesDto();
            }

            return preferences;
        }

        public Task<ApiResponse<bool>> SavePreferences(int userId, JobPreferencesDto dto)
            => Guarded(userId, "saving the preferences", async () =>
            {
                var problem = JobsRules.PreferencesProblem(dto);
                if (problem != null)
                    return ApiResponse<bool>.Fail(problem);

                return AsFlag(Answer(await GetDataTableAsync("jobs.sp_Preference_Save", new[]
                {
                    In("@UserId", userId),
                    In("@Jobs", JsonSerializer.Serialize(dto.Jobs)),
                    In("@Locations", JsonSerializer.Serialize(dto.Locations)),
                    In("@WorkModes", JsonSerializer.Serialize(dto.WorkModes)),
                    In("@ExpectedCtc", dto.ExpectedCtc)
                })));
            });

        /// <summary>
        /// Creates the profile of a person who has none yet from the user master: name, e-mail
        /// and phone. It stays private, and the person can change every value. Null when
        /// nothing was stored; the page is then shown empty, as before.
        /// </summary>
        private async Task<JobProfileDto?> StartProfile(int userId)
        {
            if (_users == null)
                return null;

            try
            {
                var user = (await _users.GetMyProfile(userId, 0))?.Data;
                var starter = user == null ? null : JobsRules.StarterProfile(user.FullName, user.Email, user.MobileNumber);
                if (starter == null)
                    return null;

                var saved = Answer(await GetDataTableAsync("jobs.sp_Profile_Save", new[]
                {
                    In("@UserId", userId),
                    In("@FullName", starter.FullName),
                    In("@Headline", starter.Headline),
                    In("@ContactEmail", starter.ContactEmail),
                    In("@ContactPhone", starter.ContactPhone)
                }));

                return saved.Success ? starter : null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // the page must open also when the user master cannot be read
                _logger.LogWarning(ex, "Job Portal: the profile of user {UserId} could not be started from the user master ({ErrorType})",
                    userId, ex.GetType().Name);
                return null;
            }
        }

        // ── profile ───────────────────────────────────────────────────────────

        public Task<ApiResponse<bool>> SaveProfile(int userId, JobProfileDto dto)
            => Guarded(userId, "saving the profile", async () =>
            {
                var problem = JobsRules.ProfileProblem(dto, TimeHelper.IndianNow.Date);
                if (problem != null)
                    return ApiResponse<bool>.Fail(problem);

                return AsFlag(Answer(await GetDataTableAsync("jobs.sp_Profile_Save", new[]
                {
                    In("@UserId", userId),
                    In("@FullName", dto.FullName),
                    In("@Headline", dto.Headline),
                    In("@Summary", dto.Summary),
                    In("@City", dto.City),
                    In("@ContactEmail", dto.ContactEmail),
                    In("@ContactPhone", dto.ContactPhone),
                    Date("@DateOfBirth", dto.DateOfBirth)
                })));
            });

        public Task<ApiResponse<bool>> SetVisible(int userId, bool isVisible)
            => Guarded(userId, "switching visibility", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Profile_SetVisible", new[]
                {
                    In("@UserId", userId),
                    In("@IsVisible", isVisible)
                }))));

        // ── experience ────────────────────────────────────────────────────────

        public Task<ApiResponse<int>> SaveExperience(int userId, JobExperienceDto dto)
            => Guarded(userId, "saving an experience entry", async () =>
            {
                var problem = JobsRules.ExperienceProblem(dto, TimeHelper.IndianNow.Date);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Experience_Save", new[]
                {
                    In("@UserId", userId),
                    In("@ExperienceId", dto.ExperienceId),
                    In("@Organisation", dto.Organisation),
                    In("@Title", dto.Title),
                    Date("@StartMonth", dto.StartMonth),
                    Date("@EndMonth", dto.EndMonth),
                    In("@Description", dto.Description)
                })));
            });

        public Task<ApiResponse<bool>> DeleteExperience(int userId, int experienceId)
            => Guarded(userId, "removing an experience entry", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Experience_Delete", new[]
                {
                    In("@UserId", userId),
                    In("@ExperienceId", experienceId)
                }))));

        // ── education ─────────────────────────────────────────────────────────

        public Task<ApiResponse<int>> SaveEducation(int userId, JobEducationDto dto)
            => Guarded(userId, "saving an education entry", async () =>
            {
                var problem = JobsRules.EducationProblem(dto, TimeHelper.IndianNow.Year);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Education_Save", new[]
                {
                    In("@UserId", userId),
                    In("@EducationId", dto.EducationId),
                    In("@Institution", dto.Institution),
                    In("@Course", dto.Course),
                    In("@FieldOfStudy", dto.FieldOfStudy),
                    In("@StartYear", dto.StartYear),
                    In("@EndYear", dto.EndYear)
                })));
            });

        public Task<ApiResponse<bool>> DeleteEducation(int userId, int educationId)
            => Guarded(userId, "removing an education entry", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Education_Delete", new[]
                {
                    In("@UserId", userId),
                    In("@EducationId", educationId)
                }))));

        // ── skills ────────────────────────────────────────────────────────────

        public Task<ApiResponse<int>> SaveSkill(int userId, JobSkillDto dto)
            => Guarded(userId, "saving a skill", async () =>
            {
                var problem = JobsRules.SkillProblem(dto);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Skill_Save", new[]
                {
                    In("@UserId", userId),
                    In("@SkillId", dto.SkillId),
                    In("@SkillName", dto.SkillName),
                    In("@Level", dto.Level),
                    In("@EvidenceUrl", string.IsNullOrEmpty(dto.EvidenceUrl) ? null : dto.EvidenceUrl)
                })));
            });

        public Task<ApiResponse<bool>> DeleteSkill(int userId, int skillId)
            => Guarded(userId, "removing a skill", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Skill_Delete", new[]
                {
                    In("@UserId", userId),
                    In("@SkillId", skillId)
                }))));

        public Task<ApiResponse<List<string>>> SuggestSkills(int userId, string? query)
            => Guarded(userId, "suggesting skills", async () =>
            {
                var text = (query ?? "").Trim();
                if (text.Length < 2 || text.Length > 100)
                    return ApiResponse<List<string>>.Ok(new List<string>());

                var dt = await GetDataTableAsync("jobs.sp_Skill_Suggest", new[]
                {
                    In("@UserId", userId),
                    In("@Query", text)
                });

                var names = dt == null
                    ? new List<string>()
                    : dt.Rows.Cast<DataRow>().Select(r => r["SkillName"]?.ToString() ?? "").Where(n => n.Length > 0).ToList();

                return ApiResponse<List<string>>.Ok(names);
            });

        // ── certificates ──────────────────────────────────────────────────────

        public Task<ApiResponse<int>> SaveCertificate(int userId, JobCertificateDto dto, JobUpload? file)
            => Guarded(userId, "saving a certificate", async () =>
            {
                var problem = JobsRules.CertificateProblem(dto, TimeHelper.IndianNow.Date);
                if (problem == null && file != null)
                    problem = JobsRules.FileProblem(JobsRules.CertificateKind, file.FileName, file.Content.LongLength, file.Content);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                var name = file == null ? null : JobsRules.SafeFileName(file.FileName);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Certificate_Save", new[]
                {
                    In("@UserId", userId),
                    In("@CertificateId", dto.CertificateId),
                    In("@Title", dto.Title),
                    In("@Issuer", dto.Issuer),
                    Date("@IssuedOn", dto.IssuedOn),
                    In("@FileName", name),
                    In("@ContentType", name == null ? null : JobsRules.ContentTypeFor(name)),
                    In("@SizeBytes", file?.Content.Length),
                    Binary("@Content", file?.Content)
                })));
            });

        public Task<ApiResponse<bool>> DeleteCertificate(int userId, int certificateId)
            => Guarded(userId, "removing a certificate", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Certificate_Delete", new[]
                {
                    In("@UserId", userId),
                    In("@CertificateId", certificateId)
                }))));

        // ── resume ────────────────────────────────────────────────────────────

        public Task<ApiResponse<int>> SaveResume(int userId, JobUpload? file)
            => Guarded(userId, "saving the resume", async () =>
            {
                var problem = file == null
                    ? "Choose a file"
                    : JobsRules.FileProblem(JobsRules.ResumeKind, file.FileName, file.Content.LongLength, file.Content);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                var name = JobsRules.SafeFileName(file!.FileName);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Resume_Save", new[]
                {
                    In("@UserId", userId),
                    In("@FileName", name),
                    In("@ContentType", JobsRules.ContentTypeFor(name)),
                    In("@SizeBytes", file.Content.Length),
                    Binary("@Content", file.Content)
                })));
            });

        public Task<ApiResponse<bool>> DeleteResume(int userId)
            => Guarded(userId, "removing the resume", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Resume_Delete", new[]
                {
                    In("@UserId", userId)
                }))));

        // ── photo (script PersonalDB/04) ──────────────────────────────────────

        public Task<ApiResponse<int>> SavePhoto(int userId, JobUpload? file)
            => Guarded(userId, "saving the photo", async () =>
            {
                var problem = file == null
                    ? "Choose a file"
                    : JobsRules.FileProblem(JobsRules.PhotoKind, file.FileName, file.Content.LongLength, file.Content);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                var name = JobsRules.SafeFileName(file!.FileName);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Photo_Save", new[]
                {
                    In("@UserId", userId),
                    In("@FileName", name),
                    In("@ContentType", JobsRules.ContentTypeFor(name)),
                    In("@SizeBytes", file.Content.Length),
                    Binary("@Content", file.Content)
                })));
            });

        public Task<ApiResponse<bool>> DeletePhoto(int userId)
            => Guarded(userId, "removing the photo", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Photo_Delete", new[]
                {
                    In("@UserId", userId)
                }))));

        public Task<ApiResponse<JobFileContent>> GetPhoto(int userId)
            => Guarded(userId, "reading the photo", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Photo_Get", new[] { In("@UserId", userId) });

                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });

        // ── files ─────────────────────────────────────────────────────────────

        public Task<ApiResponse<JobFileContent>> GetFile(int userId, int fileId)
            => Guarded(userId, "reading a file", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_File_Get", new[]
                {
                    In("@UserId", userId),
                    In("@FileId", fileId)
                });

                // no row: there is no such file, or it is somebody else's - the caller is told the same
                if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Content"] is not byte[] content)
                    return ApiResponse<JobFileContent>.Fail(NotFound);

                var name = JobsRules.SafeFileName(dt.Rows[0]["FileName"]?.ToString());
                return ApiResponse<JobFileContent>.Ok(new JobFileContent(name, JobsRules.ContentTypeFor(name), content));
            });
    }
}
