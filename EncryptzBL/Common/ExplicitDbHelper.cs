namespace EncryptzBL.Common
{
    /// <summary>
    /// DB executor bound to an explicit connection string supplied at construction.
    /// Used for ad-hoc access to a project's DB before a scope is set on the token
    /// (e.g. listing/validating a project's locations during the selection flow).
    /// </summary>
    public class ExplicitDbHelper : SqlDbHelper
    {
        private readonly string _connectionString;

        public ExplicitDbHelper(string connectionString)
        {
            _connectionString = connectionString;
        }

        protected override string ConnectionString => _connectionString;
    }
}
