using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.Common.LoginAds;
using EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.LoginAds
{
    /// <summary>An uploaded image, as the API read it.</summary>
    public sealed record LoginAdUpload(string FileName, byte[] Content);

    /// <summary>The advertisement slides of the sign-in page, in the main database (MainDB script 25).</summary>
    public interface ILoginAdService
    {
        /// <summary>The slides shown today. Never fails: the sign-in page must load whatever happens here.</summary>
        Task<ApiResponse<List<PublicLoginAdDto>>> ListPublic();

        /// <summary>The image of a slide shown today; null when there is none.</summary>
        Task<LoginAdImage?> GetPublicImage(int loginAdId);

        /// <summary>The image of any slide, for the platform administrator; null otherwise.</summary>
        Task<LoginAdImage?> GetAdminImage(int loginAdId, PlatformActor actor);

        Task<ApiResponse<List<LoginAdDto>>> ListAll(PlatformActor actor);
        Task<ApiResponse<int>> Save(SaveLoginAdRequest? req, LoginAdUpload? image, PlatformActor actor);
        Task<ApiResponse<bool>> SetActive(int loginAdId, bool isActive, PlatformActor actor);
        Task<ApiResponse<bool>> Delete(int loginAdId, PlatformActor actor);
        Task<ApiResponse<bool>> Reorder(IReadOnlyList<int>? ids, PlatformActor actor);
    }

    public sealed class LoginAdService : BaseRepository, ILoginAdService
    {
        private const string NotAllowed = "You are not allowed to manage this";

        private readonly ILogger<LoginAdService> _logger;

        public LoginAdService(MainDbHelper db, ILogger<LoginAdService> logger) : base(db)
        {
            _logger = logger;
        }

        // ── the sign-in page ──────────────────────────────────────────────────

        public async Task<ApiResponse<List<PublicLoginAdDto>>> ListPublic()
        {
            try
            {
                var list = await GetListAsync<PublicLoginAdDto>("sp_LoginAd_ListPublic");
                ClearUnsafeLinks(list);
                return ApiResponse<List<PublicLoginAdDto>>.Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("The login page advertisements could not be read ({ExceptionType})", ex.GetType().Name);
                return ApiResponse<List<PublicLoginAdDto>>.Ok(new List<PublicLoginAdDto>());
            }
        }

        public async Task<LoginAdImage?> GetPublicImage(int loginAdId)
        {
            try
            {
                return await ReadImage(loginAdId, onlyShowing: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("A login page advertisement image could not be read ({ExceptionType})", ex.GetType().Name);
                return null;
            }
        }

        /// <summary>A link that is not http or https (stored by hand in the database) is dropped; the slide stays.</summary>
        public static void ClearUnsafeLinks(List<PublicLoginAdDto> list)
        {
            foreach (var ad in list)
                if (!string.IsNullOrEmpty(ad.LinkUrl) && !LoginAdRules.IsWebLink(ad.LinkUrl))
                    ad.LinkUrl = "";
        }

        // ── the platform administrator ────────────────────────────────────────

        public async Task<LoginAdImage?> GetAdminImage(int loginAdId, PlatformActor actor)
            => actor.IsPlatformAdmin ? await ReadImage(loginAdId, onlyShowing: false) : null;

        public async Task<ApiResponse<List<LoginAdDto>>> ListAll(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<List<LoginAdDto>>.Fail(NotAllowed);

            return ApiResponse<List<LoginAdDto>>.Ok(await GetListAsync<LoginAdDto>("sp_LoginAd_ListAll"));
        }

        public async Task<ApiResponse<int>> Save(SaveLoginAdRequest? req, LoginAdUpload? image, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<int>.Fail(NotAllowed);

            var problem = LoginAdRules.SaveProblem(req);
            if (problem != null)
                return ApiResponse<int>.Fail(problem);

            if (image != null)
            {
                problem = LoginAdRules.ImageProblem(image.FileName, image.Content.Length, image.Content);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);
            }
            else if (req!.LoginAdId == 0)
            {
                return ApiResponse<int>.Fail("Choose an image");
            }

            var name = JobsRules.SafeFileName(image?.FileName);
            if (name.Length > 200)
                name = name.Substring(name.Length - 200);

            var dt = await GetDataTableAsync("sp_LoginAd_Save", new[]
            {
                SqlParameterHelper.Input("@LoginAdId", req!.LoginAdId),
                SqlParameterHelper.Input("@Tag", req.Tag!),
                SqlParameterHelper.Input("@Title", req.Title!),
                SqlParameterHelper.Input("@Body", req.Body!),
                SqlParameterHelper.Input("@ButtonText", req.ButtonText!),
                SqlParameterHelper.Input("@LinkUrl", req.LinkUrl!),
                new SqlParameter("@ShowFrom", SqlDbType.Date) { Value = (object?)req.ShowFrom ?? DBNull.Value },
                new SqlParameter("@ShowUntil", SqlDbType.Date) { Value = (object?)req.ShowUntil ?? DBNull.Value },
                SqlParameterHelper.Input("@IsActive", req.IsActive),
                new SqlParameter("@ImageName", SqlDbType.NVarChar, 200) { Value = image == null ? DBNull.Value : name },
                new SqlParameter("@ImageType", SqlDbType.NVarChar, 20) { Value = image == null ? DBNull.Value : LoginAdRules.ContentTypeFor(name) },
                // typed, so that "no image" is a NULL varbinary and not an nvarchar
                new SqlParameter("@Image", SqlDbType.VarBinary, -1) { Value = (object?)image?.Content ?? DBNull.Value },
                SqlParameterHelper.Input("@UserId", actor.UserId)
            });

            var result = ToResult(dt);
            if (result.Success)
                _logger.LogInformation("Login advertisement {LoginAdId} saved by user {UserId}", result.Data, actor.UserId);
            return result;
        }

        public async Task<ApiResponse<bool>> SetActive(int loginAdId, bool isActive, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<bool>.Fail(NotAllowed);

            return ToFlag(await GetDataTableAsync("sp_LoginAd_SetActive", new[]
            {
                SqlParameterHelper.Input("@LoginAdId", loginAdId),
                SqlParameterHelper.Input("@IsActive", isActive),
                SqlParameterHelper.Input("@UserId", actor.UserId)
            }));
        }

        public async Task<ApiResponse<bool>> Delete(int loginAdId, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<bool>.Fail(NotAllowed);

            var result = ToFlag(await GetDataTableAsync("sp_LoginAd_Delete", new[]
            {
                SqlParameterHelper.Input("@LoginAdId", loginAdId)
            }));
            if (result.Success)
                _logger.LogInformation("Login advertisement {LoginAdId} deleted by user {UserId}", loginAdId, actor.UserId);
            return result;
        }

        public async Task<ApiResponse<bool>> Reorder(IReadOnlyList<int>? ids, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<bool>.Fail(NotAllowed);
            if (ids == null || ids.Count == 0)
                return ApiResponse<bool>.Fail("Nothing to order");

            var result = ToFlag(await GetDataTableAsync("sp_LoginAd_Reorder", new[]
            {
                SqlParameterHelper.Input("@Ids", JsonSerializer.Serialize(ids)),
                SqlParameterHelper.Input("@UserId", actor.UserId)
            }));
            if (result.Success)
                _logger.LogInformation("Login advertisements reordered by user {UserId}", actor.UserId);
            return result;
        }

        // ── helpers ───────────────────────────────────────────────────────────

        private async Task<LoginAdImage?> ReadImage(int loginAdId, bool onlyShowing)
        {
            var dt = await GetDataTableAsync("sp_LoginAd_GetImage", new[]
            {
                SqlParameterHelper.Input("@LoginAdId", loginAdId),
                SqlParameterHelper.Input("@OnlyShowing", onlyShowing)
            });

            if (dt == null || dt.Rows.Count == 0 || dt.Rows[0]["Image"] is not byte[] bytes)
                return null;

            var row = dt.Rows[0];
            return new LoginAdImage(row["ImageName"]?.ToString() ?? "", row["ImageType"]?.ToString() ?? "", bytes);
        }

        private static ApiResponse<bool> ToFlag(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Save failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";
            return Convert.ToInt32(dt.Rows[0]["Success"]) == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }

        private static ApiResponse<int> ToResult(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Save failed");

            var row = dt.Rows[0];
            var message = row["Message"]?.ToString() ?? "";
            return Convert.ToInt32(row["Success"]) == 1
                ? ApiResponse<int>.Ok(Convert.ToInt32(row["LoginAdId"]), message)
                : ApiResponse<int>.Fail(message);
        }
    }
}
