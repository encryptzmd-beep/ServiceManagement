namespace EncryptzBL.Common.Wallet
{
    /// <summary>The wallet's limits and the texts shown when an invite is refused.</summary>
    public static class WalletRules
    {
        /// <summary>How many invites one person may send in a day.</summary>
        public const int MaxInvitesPerDay = 20;

        /// <summary>The most credits one setting may grant.</summary>
        public const int MaxCredits = 100000;

        /// <summary>An e-mail address as it is stored and compared.</summary>
        public static string NormalizeEmail(string? email)
        {
            return (email ?? "").Trim().ToLowerInvariant();
        }

        /// <summary>The invite key of a shared link (?inv=), upper case; null when it cannot be one.</summary>
        public static string? NormalizeInviteKey(string? key)
        {
            var k = (key ?? "").Trim().ToUpperInvariant();
            return k.Length is >= 1 and <= 16 && k.All(char.IsAsciiLetterOrDigit) ? k : null;
        }

        /// <summary>Why the invite e-mail cannot be used, or null when it can.</summary>
        public static string? InviteProblem(string? email)
        {
            return RegistrationRules.IsEmail(NormalizeEmail(email)) ? null : "Enter a valid e-mail address";
        }

        /// <summary>The text for a refused sp_Wallet_SaveReferral result, or null when the invite went out.</summary>
        public static string? RefusalText(string result)
        {
            return result switch
            {
                "Self" => "You cannot invite yourself",
                "HasAccount" => "This person already has an account",
                "Limit" => $"You can send up to {MaxInvitesPerDay} invites a day",
                "Invalid" => "Enter a valid e-mail address",
                _ => null
            };
        }
    }
}
