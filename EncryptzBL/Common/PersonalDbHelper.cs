using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common
{
    /// <summary>
    /// DB executor bound to the Personal DB ("PersonalConnection"): the data of personal
    /// applications, keyed by the main database UserId. It belongs to no company and
    /// takes no tenant context. A company database never reads it; the API does.
    /// </summary>
    public class PersonalDbHelper : SqlDbHelper
    {
        /// <summary>What a user is told while the Personal DB is not configured.</summary>
        public const string NotAvailable = "This application is not available right now";

        private readonly string? _connectionString;

        public PersonalDbHelper(IConfiguration configuration)
        {
            // optional: the API must start on an installation that has no Personal DB yet
            var value = configuration.GetConnectionString("PersonalConnection");
            _connectionString = string.IsNullOrWhiteSpace(value) ? null : value;
        }

        /// <summary>False until ConnectionStrings:PersonalConnection is set. Check it before a call.</summary>
        public bool IsConfigured => _connectionString != null;

        protected override string ConnectionString
            => _connectionString ?? throw new InvalidOperationException("ConnectionStrings:PersonalConnection is not configured.");
    }
}
