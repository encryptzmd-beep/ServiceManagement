using System.Security.Claims;
using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class TenantClaimsTests
    {
        private static ClaimsPrincipal User(params Claim[] claims)
            => new(new ClaimsIdentity(claims, "test"));

        [Fact]
        public void Tenant_key_is_read_from_the_new_claim()
        {
            var user = User(new Claim("TenantKey", "C002-P001"), new Claim("ProjectKey", "OTHER"));
            Assert.Equal("C002-P001", TenantClaims.GetTenantKey(user));
            Assert.False(TenantClaims.IsLegacyToken(user));
        }

        [Fact]
        public void A_token_issued_before_the_change_falls_back_to_the_project_key()
        {
            var user = User(new Claim("ProjectKey", "C001-P001"));
            Assert.Equal("C001-P001", TenantClaims.GetTenantKey(user));
            Assert.True(TenantClaims.IsLegacyToken(user));
        }

        [Fact]
        public void A_company_only_token_has_no_tenant_key()
        {
            Assert.Equal("", TenantClaims.GetTenantKey(User(new Claim("TenantKey", ""), new Claim("ProjectKey", ""))));
            Assert.Equal("", TenantClaims.GetTenantKey(User()));
        }

        [Fact]
        public void Scope_claims_carry_the_key_under_both_names()
        {
            var claims = TenantClaims.BuildScopeClaims(2, "C002-P001", 5, 9, "SERVICE", 31, 4);
            string Value(string type) => claims.Single(c => c.Type == type).Value;

            Assert.Equal("2", Value("CompanyId"));
            Assert.Equal("2", Value("ClientId"));
            Assert.Equal("C002-P001", Value("TenantKey"));
            Assert.Equal("C002-P001", Value("ProjectKey"));
            Assert.Equal("5", Value("ProjectId"));
            Assert.Equal("9", Value("LocationId"));
            Assert.Equal("SERVICE", Value("ModuleKey"));
            Assert.Equal("31", Value("TenantUserId"));
            Assert.Equal("4", Value("TechnicianId"));
        }

        [Fact]
        public void Module_key_is_empty_when_absent()
        {
            Assert.Equal("", TenantClaims.GetModuleKey(User()));
            Assert.Equal("SERVICE", TenantClaims.GetModuleKey(User(new Claim("ModuleKey", "SERVICE"))));
        }
    }
}
