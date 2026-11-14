namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Business data was requested by a caller whose token has no resolved company
    /// database yet (logged in, but no company / module / branch selected).
    /// </summary>
    public class TenantScopeRequiredException : InvalidOperationException
    {
        public TenantScopeRequiredException()
            : base("No company database is resolved for this request. A company, module and branch must be selected (set-scope) before accessing business data.")
        {
        }
    }
}
