using System.Text;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>
    /// What may be saved or tested for a database server (dbo.DbServers) without typing
    /// its password again. The stored password belongs to the stored server name and
    /// login: it must never be sent to a server, or used for a login, that the caller
    /// names in the request.
    /// </summary>
    public static class DbServerRules
    {
        /// <summary>The longest password SQL Server accepts.</summary>
        public const int MaxPasswordLength = 128;

        /// <summary>
        /// The encrypted password is base64( IV(16) + AES blocks ) and is stored in
        /// NVARCHAR(500): that holds at most 351 bytes of UTF-8.
        /// </summary>
        public const int MaxPasswordBytes = 351;

        /// <summary>Why a typed password cannot be stored; null when it can (or none was typed).</summary>
        public static string? PasswordProblem(string? typedPassword)
        {
            if (string.IsNullOrEmpty(typedPassword))
                return null;

            return typedPassword.Length > MaxPasswordLength || Encoding.UTF8.GetByteCount(typedPassword) > MaxPasswordBytes
                ? "The password is too long"
                : null;
        }

        /// <summary>Server names and logins are compared trimmed and without regard to case.</summary>
        public static bool SameServerAndLogin(string? storedServer, string? storedLogin, string? server, string? login)
            => Same(storedServer, server) && Same(storedLogin, login);

        /// <summary>
        /// Saving an existing server: when its name or login changes, the password must be
        /// typed again (otherwise the stored one would from then on be sent to the new place).
        /// Null when the save may go on.
        /// </summary>
        public static string? SaveProblem(string? storedServer, string? storedLogin, string? server, string? login, bool passwordTyped)
            => passwordTyped || SameServerAndLogin(storedServer, storedLogin, server, login)
                ? null
                : "Enter the password again when the server or login changes";

        /// <summary>
        /// Testing an existing server without typing its password: only the stored server and
        /// login are tested. Null when the request names the same ones.
        /// </summary>
        public static string? TestWithStoredPasswordProblem(string? storedServer, string? storedLogin, string? server, string? login)
            => SameServerAndLogin(storedServer, storedLogin, server, login)
                ? null
                : "Enter the password to test a changed server or login";

        private static bool Same(string? a, string? b)
            => string.Equals((a ?? "").Trim(), (b ?? "").Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
