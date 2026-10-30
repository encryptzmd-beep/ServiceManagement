using System.Net;
using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Wallet;
using EncryptzBL.DTO_s;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Wallet
{
    /// <summary>The credits and invites of an individual, in the main database (MainDB script 27).</summary>
    public interface IWalletService
    {
        Task<ApiResponse<WalletBalanceDto>> GetBalance(int userId);
        Task<ApiResponse<WalletLedgerDto>> GetLedger(int userId, int page);
        Task<ApiResponse<List<ReferralDto>>> GetReferrals(int userId);
        Task<ApiResponse<InviteResultDto>> Invite(int userId, string? email);
        Task<ApiResponse<WalletOfferDto>> GetOffer();
        Task<ApiResponse<InviteLinkDto>> GetInviteLink(int userId);
    }

    public sealed class WalletService : BaseRepository, IWalletService
    {
        private const string SignIn = "Sign in again";
        private const int PageSize = 20;
        private const string DefaultPublicUrl = "https://serviceapp.encryptz.in";

        private readonly IEmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<WalletService> _logger;

        public WalletService(MainDbHelper db, IEmailService email, IConfiguration config, ILogger<WalletService> logger) : base(db)
        {
            _email = email;
            _config = config;
            _logger = logger;
        }

        public async Task<ApiResponse<WalletBalanceDto>> GetBalance(int userId)
        {
            if (userId <= 0) return ApiResponse<WalletBalanceDto>.Fail(SignIn);
            return ApiResponse<WalletBalanceDto>.Ok(new WalletBalanceDto { Balance = await ReadBalance(userId) });
        }

        public async Task<ApiResponse<WalletLedgerDto>> GetLedger(int userId, int page)
        {
            if (userId <= 0) return ApiResponse<WalletLedgerDto>.Fail(SignIn);
            if (page < 1) page = 1;

            var rows = await GetListAsync<WalletEntryDto>("sp_Wallet_GetLedger", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@Page", page),
                SqlParameterHelper.Input("@PageSize", PageSize)
            });
            return ApiResponse<WalletLedgerDto>.Ok(new WalletLedgerDto
            {
                Balance = await ReadBalance(userId),
                TotalCount = rows.Count > 0 ? rows[0].TotalCount : 0,
                Entries = rows
            });
        }

        public async Task<ApiResponse<List<ReferralDto>>> GetReferrals(int userId)
        {
            if (userId <= 0) return ApiResponse<List<ReferralDto>>.Fail(SignIn);
            return ApiResponse<List<ReferralDto>>.Ok(await GetListAsync<ReferralDto>("sp_Wallet_GetReferrals",
                new[] { SqlParameterHelper.Input("@UserId", userId) }));
        }

        public async Task<ApiResponse<InviteResultDto>> Invite(int userId, string? email)
        {
            if (userId <= 0) return ApiResponse<InviteResultDto>.Fail(SignIn);

            var problem = WalletRules.InviteProblem(email);
            if (problem != null) return ApiResponse<InviteResultDto>.Fail(problem);

            var address = WalletRules.NormalizeEmail(email);
            var ds = await GetDataSetAsync("sp_Wallet_SaveReferral", new[]
            {
                SqlParameterHelper.Input("@InviterUserId", userId),
                SqlParameterHelper.Input("@Email", address)
            });
            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<InviteResultDto>.Fail("The invite could not be saved");

            var row = ds.Tables[0].Rows[0];
            var result = Convert.ToString(row["Result"]) ?? "";
            var refusal = WalletRules.RefusalText(result);
            if (refusal != null) return ApiResponse<InviteResultDto>.Fail(refusal);

            var inviter = Convert.ToString(row["InviterName"]) ?? "";
            var token = row["Token"] == DBNull.Value ? Guid.Empty : (Guid)row["Token"];

            // the referral credits go to the inviter only: the mail does not promise the friend any
            var link = $"{PublicUrl()}/register?ref={token}&email={Uri.EscapeDataString(address)}";
            var name = WebUtility.HtmlEncode(inviter);
            var body = $"<p>{name} invited you to join Encryptz.</p><p>Encryptz is one place for your work, jobs and services.</p>"
                + $"<p><a href=\"{WebUtility.HtmlEncode(link)}\">Join Encryptz</a></p>";

            var sent = await TrySend(_email, address, $"{inviter.ReplaceLineEndings(" ").Trim()} invited you to Encryptz", body, _logger);
            return ApiResponse<InviteResultDto>.Ok(new InviteResultDto { Result = result, MailSent = sent });
        }

        public async Task<ApiResponse<WalletOfferDto>> GetOffer()
            => ApiResponse<WalletOfferDto>.Ok(new WalletOfferDto { ReferralCredits = await ReadReferralCredits() });

        /// <summary>The person's own link to share: /register?inv=key (MainDB script 29). The key is random, not the user id.</summary>
        public async Task<ApiResponse<InviteLinkDto>> GetInviteLink(int userId)
        {
            if (userId <= 0) return ApiResponse<InviteLinkDto>.Fail(SignIn);

            var dt = await GetDataTableAsync("sp_Wallet_GetInviteKey", new[] { SqlParameterHelper.Input("@UserId", userId) });
            var key = dt != null && dt.Rows.Count > 0 && dt.Rows[0]["InviteKey"] != DBNull.Value ? Convert.ToString(dt.Rows[0]["InviteKey"]) : null;
            if (string.IsNullOrEmpty(key)) return ApiResponse<InviteLinkDto>.Fail("Your invite link could not be made");

            return ApiResponse<InviteLinkDto>.Ok(new InviteLinkDto { Key = key, Url = $"{PublicUrl()}/register?inv={key}" });
        }

        /// <summary>Sends the invite; a mail that cannot go out never loses the saved invite.</summary>
        internal static async Task<bool> TrySend(IEmailService email, string to, string subject, string body, ILogger? logger = null)
        {
            try
            {
                await email.SendEmailAsync(to, subject, body);
                return true;
            }
            catch (Exception ex)
            {
                // the server's reason (never the address): e.g. "5.7.0 Authentication Required"
                logger?.LogWarning("An invite mail could not be sent ({ExceptionType}: {Reason})",
                    ex.GetType().Name, ex.InnerException?.Message ?? ex.Message);
                return false;
            }
        }

        private string PublicUrl()
        {
            var url = _config["App:PublicUrl"];
            return (string.IsNullOrWhiteSpace(url) ? DefaultPublicUrl : url.Trim()).TrimEnd('/');
        }

        private async Task<int> ReadBalance(int userId)
        {
            var row = await GetSingleAsync<WalletBalanceDto>("sp_Wallet_GetBalance",
                new[] { SqlParameterHelper.Input("@UserId", userId) });
            return row?.Balance ?? 0;
        }

        /// <summary>The credits the inviter earns for a friend who joins; 0 when the setting is missing or not a number.</summary>
        private async Task<int> ReadReferralCredits()
        {
            try
            {
                var all = await GetListAsync<PlatformSettingDto>("sp_Platform_GetSettings");
                var v = all.FirstOrDefault(s => s.SettingKey == PlatformSettingRules.ReferralCredits)?.SettingValue;
                return int.TryParse(v, out var n) && n > 0 ? n : 0;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("The referral credits could not be read ({ExceptionType})", ex.GetType().Name);
                return 0;
            }
        }
    }
}
