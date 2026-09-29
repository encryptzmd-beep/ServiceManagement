using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public class PlatformUnlockResult
    {
        /// <summary>Sent back by the UI as X-Platform-Token on every Platform Admin call.</summary>
        public string UnlockToken { get; set; } = "";
        public int ValidMinutes { get; set; }
    }

    /// <summary>
    /// Second factor of the Platform Admin screen: a 4-digit code e-mailed to the platform
    /// owner (PlatformAdmin:OtpEmail). A correct code is exchanged for a short-lived unlock
    /// token; without it the Platform Admin endpoints answer 403.
    /// </summary>
    public interface IPlatformUnlockService
    {
        Task<ApiResponse<string>> SendOtp(PlatformActor actor);
        Task<ApiResponse<PlatformUnlockResult>> VerifyOtp(PlatformActor actor, string? code);
        bool IsUnlocked(string? unlockToken, int userId);
    }

    public class PlatformUnlockService : BaseRepository, IPlatformUnlockService
    {
        private const string Purpose = "platform-unlock";
        private const string Audience = "EncryptzPlatformAdmin";

        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        public PlatformUnlockService(MainDbHelper db, IConfiguration config, IEmailService emailService) : base(db)
        {
            _config = config;
            _emailService = emailService;
        }

        private string OtpEmail => _config["PlatformAdmin:OtpEmail"] ?? "";
        private int OtpMinutes => int.TryParse(_config["PlatformAdmin:OtpMinutes"], out var m) && m > 0 ? m : 5;
        private int SessionMinutes => int.TryParse(_config["PlatformAdmin:SessionMinutes"], out var m) && m > 0 ? m : 30;

        public async Task<ApiResponse<string>> SendOtp(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin && !actor.IsCompanyAdmin)
                return ApiResponse<string>.Fail("You are not allowed to open Platform Admin");

            if (string.IsNullOrWhiteSpace(OtpEmail))
                return ApiResponse<string>.Fail("PlatformAdmin:OtpEmail is not configured");

            var code = RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");

            var dt = await GetDataTableAsync("sp_Platform_CreateOtp", new[]
            {
                SqlParameterHelper.Input("@UserId", actor.UserId),
                SqlParameterHelper.Input("@Email", OtpEmail),
                SqlParameterHelper.Input("@CodeHash", BCrypt.Net.BCrypt.HashPassword(code)),
                SqlParameterHelper.Input("@ValidMinutes", OtpMinutes)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<string>.Fail("Could not create the code");

            if (Convert.ToInt32(dt.Rows[0]["Success"]) != 1)
                return ApiResponse<string>.Fail(dt.Rows[0]["Message"]?.ToString() ?? "Could not create the code");

            var body = $@"
                <h3>Platform Admin access</h3>
                <p><b>{System.Net.WebUtility.HtmlEncode(actor.UserName)}</b> is opening the Platform Admin screen.</p>
                <p>Access code:</p>
                <div style='font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2563eb; padding: 10px 16px; background: #f1f5f9; border-radius: 8px; display: inline-block;'>
                    {code}
                </div>
                <p>The code is valid for {OtpMinutes} minutes. If you do not expect this request, do not share the code.</p>
                <br/>
                <p>Regards,<br/>Encryptz Team</p>";

            try
            {
                await _emailService.SendEmailAsync(OtpEmail, "Platform Admin access code - Encryptz", body);
            }
            catch (Exception)
            {
                return ApiResponse<string>.Fail("The access code could not be e-mailed. Check the Smtp settings.");
            }

            return ApiResponse<string>.Ok(MaskEmail(OtpEmail), "Access code sent to " + MaskEmail(OtpEmail));
        }

        public async Task<ApiResponse<PlatformUnlockResult>> VerifyOtp(PlatformActor actor, string? code)
        {
            if (!actor.IsPlatformAdmin && !actor.IsCompanyAdmin)
                return ApiResponse<PlatformUnlockResult>.Fail("You are not allowed to open Platform Admin");

            code = (code ?? "").Trim();
            if (code.Length != 4 || !code.All(char.IsDigit))
                return ApiResponse<PlatformUnlockResult>.Fail("Enter the 4-digit code");

            var otp = await GetDataTableAsync("sp_Platform_GetOtp", new[]
            {
                SqlParameterHelper.Input("@UserId", actor.UserId)
            });

            if (otp == null || otp.Rows.Count == 0)
                return ApiResponse<PlatformUnlockResult>.Fail("The code has expired. Request a new one.");

            var otpId = Convert.ToInt32(otp.Rows[0]["OtpId"]);
            var hash = otp.Rows[0]["CodeHash"]?.ToString() ?? "";
            var matched = hash.Length > 0 && BCrypt.Net.BCrypt.Verify(code, hash);

            var result = await GetDataTableAsync("sp_Platform_VerifyOtp", new[]
            {
                SqlParameterHelper.Input("@OtpId", otpId),
                SqlParameterHelper.Input("@UserId", actor.UserId),
                SqlParameterHelper.Input("@Matched", matched)
            });

            var accepted = matched && result.Rows.Count > 0 && Convert.ToInt32(result.Rows[0]["Success"]) == 1;

            if (!accepted)
            {
                var left = result.Rows.Count > 0 ? Convert.ToInt32(result.Rows[0]["AttemptsLeft"]) : 0;
                return ApiResponse<PlatformUnlockResult>.Fail(left > 0
                    ? $"Wrong code. {left} attempt(s) left."
                    : "Too many wrong attempts. Request a new code.");
            }

            return ApiResponse<PlatformUnlockResult>.Ok(new PlatformUnlockResult
            {
                UnlockToken = CreateToken(actor.UserId),
                ValidMinutes = SessionMinutes
            }, "Platform Admin unlocked");
        }

        public bool IsUnlocked(string? unlockToken, int userId)
        {
            if (string.IsNullOrWhiteSpace(unlockToken) || userId <= 0)
                return false;

            try
            {
                var principal = new JwtSecurityTokenHandler().ValidateToken(unlockToken, new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = true,
                    ValidAudience = Audience,           // a login token can never pass as an unlock token
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = SigningKey()
                }, out _);

                return principal.FindFirst("purpose")?.Value == Purpose
                    && principal.FindFirst("uid")?.Value == userId.ToString();
            }
            catch (Exception)
            {
                return false;   // expired, tampered or not a token
            }
        }

        private string CreateToken(int userId)
        {
            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: Audience,
                claims: new[]
                {
                    new Claim("purpose", Purpose),
                    new Claim("uid", userId.ToString())
                },
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(SessionMinutes),
                signingCredentials: new SigningCredentials(SigningKey(), SecurityAlgorithms.HmacSha256));

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private SymmetricSecurityKey SigningKey()
        {
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                throw new Exception("JWT Key not configured");

            return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        }

        /// <summary>jo*******4@gmail.com — enough to recognise the mailbox, not to harvest it.</summary>
        private static string MaskEmail(string email)
        {
            var at = email.IndexOf('@');
            if (at <= 2) return email;
            return email[..2] + new string('*', at - 3) + email[(at - 1)..];
        }
    }
}
