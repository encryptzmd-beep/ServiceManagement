using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Provisioning
{
    /// <summary>The platform settings that exist and what their values may be.</summary>
    public static class PlatformSettingRules
    {
        /// <summary>How many companies one user may create (platform administrators are exempt).</summary>
        public const string MaxCompaniesPerUser = "MaxCompaniesPerUser";

        /// <summary>
        /// A database on the tenant server whose lookup rows (roles, statuses, settings,
        /// menus) a new company database starts with. Empty = the script's built-in defaults.
        /// </summary>
        public const string TenantLookupSourceDb = "TenantLookupSourceDb";

        /// <summary>The credits a new individual starts with.</summary>
        public const string WelcomeCredits = "WelcomeCredits";

        /// <summary>The credits the inviter earns when an invited friend is onboarded (the friend gets the welcome credits).</summary>
        public const string ReferralCredits = "ReferralCredits";

        /// <summary>When the wallet started; set by the database script, not editable.</summary>
        public const string WalletStartedAt = "WalletStartedAt";

        /// <summary>The address of the platform, used in the links of mails (invites): https://host[/path], no trailing /.</summary>
        public const string PublicUrl = "PublicUrl";

        // The mail server. An empty value means "use the Smtp section of appsettings.json".
        public const string SmtpHost = "SmtpHost";
        public const string SmtpPort = "SmtpPort";
        public const string SmtpEnableSsl = "SmtpEnableSsl";
        public const string SmtpUserName = "SmtpUserName";
        /// <summary>Stored encrypted (ITenantSecretProtector); never shown again, only replaced.</summary>
        public const string SmtpPassword = "SmtpPassword";
        public const string SmtpFromEmail = "SmtpFromEmail";
        public const string SmtpFromName = "SmtpFromName";

        /// <summary>What the settings list shows instead of a stored secret.</summary>
        public const string SecretMask = "********";

        /// <summary>A setting that is stored encrypted and never shown.</summary>
        public static bool IsSecret(string? key) => key == SmtpPassword;

        private static readonly Regex HostName = new(@"^[A-Za-z0-9]([A-Za-z0-9\-\.]{0,251}[A-Za-z0-9])?\z", RegexOptions.CultureInvariant);

        private static readonly Regex DatabaseName = new(@"^[A-Za-z0-9_]{1,128}\z", RegexOptions.CultureInvariant);
        private static readonly string[] SystemDatabases = { "master", "model", "msdb", "tempdb" };

        /// <summary>The value to store, or the reason it is refused.</summary>
        public static (string? Value, string? Error) Validate(string? key, string? value)
        {
            var text = (value ?? "").Trim();

            switch (key)
            {
                case MaxCompaniesPerUser:
                    return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n <= 100
                        ? (n.ToString(CultureInfo.InvariantCulture), null)
                        : (null, "Enter a number from 0 to 100");

                case WelcomeCredits:
                case ReferralCredits:
                    return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var credits)
                        && credits <= Wallet.WalletRules.MaxCredits
                        ? (credits.ToString(CultureInfo.InvariantCulture), null)
                        : (null, "Enter a number from 0 to 100000");

                case TenantLookupSourceDb:
                    if (text.Length == 0)
                        return ("", null);

                    if (!DatabaseName.IsMatch(text)
                        || SystemDatabases.Contains(text, StringComparer.OrdinalIgnoreCase))
                        return (null, "Enter the plain name of a company database, or leave it empty");

                    return (text, null);

                case PublicUrl:
                    var url = text.TrimEnd('/');
                    return url.Length <= 200
                        && Uri.TryCreate(url, UriKind.Absolute, out var uri)
                        && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
                        && uri.Query.Length == 0 && uri.Fragment.Length == 0 && uri.UserInfo.Length == 0
                        ? (url, null)
                        : (null, "Enter the address of the platform, such as https://serviceapp.encryptz.in");

                case SmtpHost:
                    return text.Length == 0 || HostName.IsMatch(text)
                        ? (text, null)
                        : (null, "Enter the name of the mail server, such as smtp.gmail.com, or leave it empty");

                case SmtpPort:
                    if (text.Length == 0) return ("", null);
                    return int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var port) && port is >= 1 and <= 65535
                        ? (port.ToString(CultureInfo.InvariantCulture), null)
                        : (null, "Enter a port from 1 to 65535, such as 587, or leave it empty");

                case SmtpEnableSsl:
                    if (text.Length == 0) return ("", null);
                    return bool.TryParse(text, out var ssl)
                        ? (ssl ? "true" : "false", null)
                        : (null, "Enter true or false, or leave it empty");

                case SmtpUserName:
                    return text.Length <= 256 && !text.Any(c => char.IsWhiteSpace(c) || char.IsControl(c))
                        ? (text, null)
                        : (null, "Enter the login of the mail server without spaces, or leave it empty");

                case SmtpPassword:
                    // the spaces of a Gmail app password are part of what is typed: kept as typed
                    var secret = value ?? "";
                    if (secret == SecretMask) return (null, "Type the new password, or leave it empty to use appsettings.json");
                    return secret.Length <= 200 && !secret.Any(char.IsControl)
                        ? (secret.Trim(), null)
                        : (null, "The password is longer than 200 characters");

                case SmtpFromEmail:
                    return text.Length == 0 || RegistrationRules.IsEmail(text)
                        ? (text, null)
                        : (null, "Enter the e-mail address mails are sent from, or leave it empty");

                case SmtpFromName:
                    return text.Length <= 100 && !text.Any(char.IsControl)
                        ? (text, null)
                        : (null, "Enter a name of at most 100 characters, or leave it empty");

                default:
                    return (null, "Unknown setting");
            }
        }

        // ---- the options of a database server (DbServers.ExtraOptions) ----

        /// <summary>DbServers.ExtraOptions / Companies.ExtraOptions.</summary>
        public const int MaxServerOptionsLength = 400;

        private const string ForbiddenOptions = "The options must not set the server, database, login or password";

        /// <summary>The keywords as the builder names them: a synonym that carries a value ends up here.</summary>
        private static readonly string[] ForbiddenKeywords =
        {
            "Data Source", "Initial Catalog", "User ID", "Password", "Integrated Security",
            "AttachDBFilename", "Failover Partner", "Authentication"
        };

        /// <summary>
        /// The same keywords with their synonyms, as they can be typed. Needed besides the
        /// builder: a keyword WITHOUT a value ("Database=") is dropped by the builder, but
        /// appended to a connection string it still replaces what was set before it.
        /// </summary>
        private static readonly HashSet<string> ForbiddenTyped = new(StringComparer.OrdinalIgnoreCase)
        {
            "data source", "server", "address", "addr", "network address",
            "initial catalog", "database",
            "user id", "uid", "user",
            "password", "pwd",
            "integrated security", "trusted_connection",
            "attachdbfilename", "extended properties", "initial file name",
            "failover partner", "failoverpartner",
            "authentication"
        };

        /// <summary>
        /// The options a platform administrator types for a database server. They are copied
        /// to every company created on it and appended, as typed, to that company's connection
        /// string (TenantConnectionString.Build), where a later keyword replaces an earlier
        /// one. So they must be real connection options and must not say where to connect or
        /// as whom: that would send every request of a new company somewhere else.
        /// Returns the text to store ("" for none), or the reason it is refused.
        /// </summary>
        public static (string? Value, string? Error) ValidateServerOptions(string? options)
        {
            var text = (options ?? "").Trim();

            if (text.Length == 0)
                return ("", null);

            if (text.Length > MaxServerOptionsLength)
                return (null, "The options are too long");

            SqlConnectionStringBuilder builder;
            try
            {
                builder = new SqlConnectionStringBuilder(text);
            }
            catch (Exception)
            {
                // unknown keyword, bad value, bad quoting
                return (null, "The options are not valid connection options");
            }

            foreach (var keyword in ForbiddenKeywords)
            {
                if (builder.ShouldSerialize(keyword))
                    return (null, ForbiddenOptions);
            }

            // Every "name=" as typed. Splitting at ';' also cuts through a quoted value that
            // contains one: that can only refuse more, never less.
            foreach (var part in text.Split(';'))
            {
                var equals = part.IndexOf('=');
                if (equals < 0)
                    continue;

                var name = Regex.Replace(part.Substring(0, equals).Trim(), @"\s+", " ");
                if (ForbiddenTyped.Contains(name))
                    return (null, ForbiddenOptions);
            }

            return (text, null);
        }
    }
}
