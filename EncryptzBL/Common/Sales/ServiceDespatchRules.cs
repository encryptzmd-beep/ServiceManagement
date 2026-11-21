namespace EncryptzBL.Common.Sales
{
    /// <summary>What a spare part or repaired part despatch must carry (the Despatch screen checks the same).</summary>
    public static class ServiceDespatchRules
    {
        public static readonly IReadOnlyList<string> Modes = new[]
        {
            "Own Vehicle", "Road Transport", "Courier", "Rail", "Air", "Sea", "Hand Delivery", "Customer Pickup"
        };

        /// <summary>The source as stored (Spare / Repair), or null.</summary>
        public static string? Source(string? value)
            => string.Equals(value?.Trim(), "Spare", StringComparison.OrdinalIgnoreCase) ? "Spare"
             : string.Equals(value?.Trim(), "Repair", StringComparison.OrdinalIgnoreCase) ? "Repair"
             : null;

        public static string? Mode(string? value)
            => Modes.FirstOrDefault(m => string.Equals(m, value?.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>Every despatch (sales, spare, repair) carries its mode and reference.</summary>
        public static string? DetailsProblem(string? mode, string? referenceNo)
        {
            if (Mode(mode) == null) return "Choose the mode of despatch.";
            if (string.IsNullOrWhiteSpace(referenceNo)) return "Enter the despatch reference number.";
            return null;
        }

        /// <summary>The problem with the details, or null when they can be saved.</summary>
        public static string? Problem(string? source, int sourceId, DateTime? despatchDate, string? mode, string? referenceNo, DateTime? referenceDate, DateTime today)
        {
            if (Source(source) == null || sourceId <= 0) return "Select the request to despatch.";
            if (despatchDate == null) return "Despatch date is required.";
            if (despatchDate.Value.Date > today.Date) return "Despatch date cannot be in the future.";
            var details = DetailsProblem(mode, referenceNo);
            if (details != null) return details;
            if (referenceDate?.Date > today.Date) return "Reference date cannot be in the future.";
            return null;
        }

        public const string OnlyFromDespatch = "Despatch this from the Despatch screen, with its mode and reference.";
        private const string NoGoingBack = "This part is already despatched, so its status cannot go back.";

        private static bool Is(string? value, params string[] any)
            => any.Any(x => string.Equals(x, value?.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>Why a spare request cannot move to this status, or null when it can.</summary>
        public static string? SpareStatusProblem(string? current, string? target)
        {
            if (Is(target, current ?? string.Empty)) return null;
            if (Is(target, "Dispatched")) return OnlyFromDespatch;
            if (Is(target, "Used")) return Is(current, "Dispatched") ? null : "Despatch this part first, then mark it as used.";
            return Is(current, "Dispatched", "Used") ? NoGoingBack : null;
        }

        /// <summary>Why a repair request cannot move to this status, or null when it can.</summary>
        public static string? RepairStatusProblem(string? current, string? target)
        {
            if (Is(target, current ?? string.Empty)) return null;
            if (Is(target, "Dispatched")) return OnlyFromDespatch;
            var despatched = Is(current, "Dispatched", "Delivered", "Resolved");
            if (Is(target, "Delivered", "Resolved")) return despatched ? null : "Despatch this part first, then mark it as delivered.";
            return despatched ? NoGoingBack : null;
        }
    }
}
