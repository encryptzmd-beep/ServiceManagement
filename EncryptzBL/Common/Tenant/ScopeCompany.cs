namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Which company a "set scope" request is for. The token says which company the session
    /// really works in; the request body must not move it to another one.
    /// </summary>
    public static class ScopeCompany
    {
        public static (int CompanyId, string? Error) Resolve(int tokenCompanyId, int requestedCompanyId)
        {
            var token = Math.Max(tokenCompanyId, 0);
            var requested = Math.Max(requestedCompanyId, 0);

            if (token > 0 && requested > 0 && token != requested)
                return (0, "Your session changed company. Reload the page");

            // no company in the token: the requested one (the service still checks the membership)
            return (token > 0 ? token : requested, null);
        }
    }
}
