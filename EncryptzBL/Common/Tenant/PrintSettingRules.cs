using System.Text.RegularExpressions;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>What the company's Print Settings page may change, and what each value may hold.</summary>
    public static class PrintSettingRules
    {
        public const string Group = "Print";
        public const string NotInstalled = "Print settings are not set up for this company. Run 29_Document_Print.sql in its database";
        public const int MaxTextLength = 4000;
        /// <summary>The page scales an image to fit this before it sends it.</summary>
        public const int MaxImageLength = 1_572_864;

        private static readonly Regex ImageData = new(@"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$", RegexOptions.Compiled);
        private static readonly string[] Modes = { "none", "text", "image" };

        public static string? Problem(string key, string? value, string dataType)
        {
            var text = value ?? string.Empty;
            var type = (dataType ?? string.Empty).ToLowerInvariant();

            if (type == "image")
            {
                if (text.Length == 0) return null;
                if (text.Length > MaxImageLength) return "The image is too large. Use a smaller image";
                return ImageData.IsMatch(text) ? null : "Only PNG, JPG or WEBP images can be used";
            }
            if (type.StartsWith("select"))
            {
                // the row's type names its choices, e.g. select:none,text,image or select:exclusive,inclusive
                var colon = type.IndexOf(':');
                var options = colon >= 0
                    ? type[(colon + 1)..].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    : Modes;
                if (options.Length == 0) options = Modes;
                return options.Contains(text.Trim().ToLowerInvariant()) ? null
                    : "Choose " + (options.Length == 1 ? options[0] : string.Join(", ", options[..^1]) + " or " + options[^1]);
            }
            return text.Length > MaxTextLength ? $"{key} is too long" : null;
        }
    }
}
