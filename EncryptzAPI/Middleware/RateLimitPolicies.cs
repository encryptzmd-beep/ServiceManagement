namespace EncryptzAPI.Middleware
{
    /// <summary>Names of the rate-limit policies registered in Program.cs.</summary>
    public static class RateLimitPolicies
    {
        /// <summary>Anonymous lookups that could be used to enumerate data (10 per minute per IP).</summary>
        public const string PublicLookup = "public-lookup";
    }
}
