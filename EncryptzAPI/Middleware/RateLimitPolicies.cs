using System.Net;
using System.Security.Claims;

namespace EncryptzAPI.Middleware
{
    /// <summary>Names of the rate-limit policies registered in Program.cs.</summary>
    public static class RateLimitPolicies
    {
        /// <summary>
        /// Anonymous lookups that could be used to enumerate data: 20 per minute per client
        /// IP (300 for the one bucket all callers share when the proxy passes no client IP on).
        /// </summary>
        public const string PublicLookup = "public-lookup";

        /// <summary>
        /// Creating a company or retrying its set-up starts a database build: 5 per hour per
        /// logged-in user, whatever address the calls come from (see <see cref="CompanyCreationKey"/>).
        /// The limiter runs after authentication in Program.cs, so the policy sees the user;
        /// the endpoints need a login, so the per-IP bucket only catches calls without a valid
        /// token (which are then refused with 401 anyway).
        /// </summary>
        public const string CompanyCreation = "company-creation";

        /// <summary>The bucket of a create / retry call: the user of the token, else the client address.</summary>
        public static string CompanyCreationKey(ClaimsPrincipal? user, IPAddress? remoteAddress)
        {
            var userId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return !string.IsNullOrEmpty(userId)
                ? "u:" + userId
                : "ip:" + (remoteAddress?.ToString() ?? "unknown");
        }
    }
}
