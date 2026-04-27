namespace EncryptzBL.Common
{
    /// <summary>
    /// Centralized time helper — all application timestamps use IST (UTC+05:30).
    /// Usage: TimeHelper.IndianNow  instead of  DateTime.UtcNow / DateTime.Now
    /// </summary>
    public static class TimeHelper
    {
        private static readonly TimeZoneInfo IndianZone =
            TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");

        /// <summary>Current date-time in Indian Standard Time (UTC+05:30).</summary>
        public static DateTime IndianNow =>
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IndianZone);
    }
}
