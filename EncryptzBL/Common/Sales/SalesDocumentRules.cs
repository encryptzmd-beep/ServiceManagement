using System.Text;

namespace EncryptzBL.Common.Sales
{
    /// <summary>What may be attached to a bill or a despatch: a PDF of a known kind.</summary>
    public static class SalesDocumentRules
    {
        public const long MaxFileBytes = 10 * 1024 * 1024;

        public static readonly IReadOnlyList<string> Types = new[]
        {
            "Invoice", "E-Way Bill", "Delivery Challan", "LR / Consignment Note", "Purchase Order", "Other"
        };

        /// <summary>The file itself says it is a PDF; the name and the browser's type are not trusted.</summary>
        public static bool IsPdf(ReadOnlySpan<byte> content)
            => content.Length > 5 && content[..5].SequenceEqual("%PDF-"u8);

        public static string? KnownType(string? type)
            => Types.FirstOrDefault(t => string.Equals(t, type?.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>A plain file name ending in .pdf, without any path or control character.</summary>
        public static string CleanFileName(string? name)
        {
            var baseName = (name ?? "").Replace('\\', '/').Split('/').Last();
            var clean = new StringBuilder();
            foreach (var c in baseName)
                if (!char.IsControl(c) && !"<>:\"|?*".Contains(c)) clean.Append(c);

            var stem = clean.ToString().Trim().TrimEnd('.');
            if (stem.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) stem = stem[..^4].TrimEnd();
            if (stem.Length == 0) stem = "document";
            if (stem.Length > 190) stem = stem[..190];
            return stem + ".pdf";
        }
    }
}
