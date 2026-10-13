namespace EncryptzBL.Common
{
    /// <summary>
    /// The Individual ID of a user: one per person, given once, never changed, and safe to
    /// show and to tell someone (the UserId is internal). It is stored as 14 characters,
    /// "EZ" + 11 random symbols + 1 check character, and shown as EZ-7K4M-2P9Q-XD3T.
    /// The main database creates it (script 22, trigger on dbo.Users); this class only
    /// formats and checks it. The alphabet and the check rule are the same in both places:
    /// change them together, and never once an ID was given out.
    /// </summary>
    public static class IndividualId
    {
        public const string Prefix = "EZ";

        /// <summary>31 symbols: no 0, 1, O, I or L, which are misread on paper and on the phone.</summary>
        public const string Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

        private const int BodyLength = 11;
        private const int StoredLength = 14;   // prefix + body + check

        /// <summary>
        /// The check character of 11 symbols: the sum of position (1 to 11) times value,
        /// modulo 31. One wrong character or two neighbours swapped always change it,
        /// because 31 is prime and the weights differ.
        /// </summary>
        public static char CheckChar(string body)
        {
            if (body == null || body.Length != BodyLength)
                throw new ArgumentException("11 symbols are expected.", nameof(body));

            var sum = 0;
            for (var i = 0; i < BodyLength; i++)
            {
                var value = Alphabet.IndexOf(body[i]);
                if (value < 0)
                    throw new ArgumentException("A symbol is not in the alphabet.", nameof(body));
                sum += (i + 1) * value;
            }

            return Alphabet[sum % Alphabet.Length];
        }

        /// <summary>True for a stored ID (14 characters) whose check character fits.</summary>
        public static bool IsValid(string? stored)
        {
            if (stored == null || stored.Length != StoredLength || !stored.StartsWith(Prefix, StringComparison.Ordinal))
                return false;

            for (var i = Prefix.Length; i < StoredLength; i++)
                if (Alphabet.IndexOf(stored[i]) < 0)
                    return false;

            return CheckChar(stored.Substring(Prefix.Length, BodyLength)) == stored[StoredLength - 1];
        }

        /// <summary>
        /// What a person typed (any case, with or without the prefix, blanks or dashes) as the
        /// stored form, or null when it is not an Individual ID.
        /// </summary>
        public static string? Normalize(string? typed)
        {
            if (string.IsNullOrWhiteSpace(typed))
                return null;

            var text = new string(typed.Where(ch => ch != ' ' && ch != '-' && ch != '\t').ToArray());
            // checked before upper-casing: only plain letters may become A-Z
            if (text.Any(ch => ch >= 128))
                return null;

            text = text.ToUpperInvariant();
            if (text.Length == StoredLength - Prefix.Length)
                text = Prefix + text;

            return IsValid(text) ? text : null;
        }

        /// <summary>EZ-7K4M-2P9Q-XD3T for a stored ID, "" for anything else (also the placeholder of a row that has none yet).</summary>
        public static string Format(string? stored)
        {
            if (stored == null || stored.Length != StoredLength || !stored.StartsWith(Prefix, StringComparison.Ordinal))
                return "";

            return $"{Prefix}-{stored.Substring(2, 4)}-{stored.Substring(6, 4)}-{stored.Substring(10, 4)}";
        }
    }
}
