using System.Globalization;

namespace EncryptzBL.Common.Service
{
    /// <summary>
    /// Service Workflow settings (dbo.SystemSettings, group ServiceWorkflow) and the
    /// completion photo rule. A missing or broken value means today's behaviour.
    /// </summary>
    public static class ServiceWorkflowRules
    {
        public const string MinPhotosKey = "Service.MinCompletionPhotos";
        public const string CategoriesKey = "Service.PhotoCategories";

        public static readonly IReadOnlyList<string> DefaultCategories =
            new[] { "Before", "After", "Part", "Signature", "Other" };

        /// <summary>A whole number of 0 or more; anything else means the default 1.</summary>
        public static int ParseMinPhotos(string? value)
            => int.TryParse(value?.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 1;

        /// <summary>The comma list, trimmed, blanks dropped; nothing left means the defaults.</summary>
        public static List<string> ParseCategories(string? value)
        {
            var list = (value ?? "").Split(',').Select(c => c.Trim()).Where(c => c.Length > 0).ToList();
            return list.Count > 0 ? list : DefaultCategories.ToList();
        }

        /// <summary>The refusal when fewer photos than needed are uploaded, else null.</summary>
        public static string? PhotoProblem(int uploaded, int min)
        {
            if (uploaded >= min) return null;
            return min == 1
                ? "Upload at least one service photo before completing the work order"
                : $"Upload at least {min} service photos before completing the work order";
        }
    }
}
