namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// The company has no active, ready database to route to (deactivated, still being
    /// set up, or unknown key). Not a database failure: callers may carry on without a
    /// resolved tenant.
    /// </summary>
    public class TenantNotRoutableException : InvalidOperationException
    {
        public TenantNotRoutableException()
            : base("No active company database is registered for this key.") { }
    }
}
