using System.Security.Claims;

namespace EncryptzBL.Common
{
    /// <summary>
    /// Who is logged in, as a user of the MAIN database.
    ///
    /// Two kinds of token are signed with the same key. A login token of the main database
    /// carries the main UserId and always a "PlatformAdmin" claim. A customer-portal token
    /// carries the user id of ONE COMPANY database, the role Customer and a "CustomerId"
    /// claim. The two id ranges overlap, so an endpoint that works on data of a person
    /// across companies (personal applications) must never read the id of a customer
    /// token as a main user id.
    /// </summary>
    public static class MainIdentity
    {
        /// <summary>The main UserId of the caller, or 0 when the caller is not a logged-in user of the main database.</summary>
        public static int UserId(ClaimsPrincipal? user)
        {
            if (user?.Identity?.IsAuthenticated != true)
                return 0;

            if (user.FindFirst("CustomerId") != null || user.IsInRole("Customer"))
                return 0;

            // both generators of main-database tokens add it; the customer portal does not
            if (user.FindFirst("PlatformAdmin") == null)
                return 0;

            var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(value, System.Globalization.NumberStyles.None,
                       System.Globalization.CultureInfo.InvariantCulture, out var id) && id > 0
                ? id
                : 0;
        }
    }
}
