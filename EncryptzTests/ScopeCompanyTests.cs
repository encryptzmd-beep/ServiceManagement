using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class ScopeCompanyTests
    {
        [Fact]
        public void A_request_for_another_company_than_the_token_is_refused()
        {
            var (companyId, error) = ScopeCompany.Resolve(3, 4);
            Assert.Equal(0, companyId);
            Assert.Equal("Your session changed company. Reload the page", error);
        }

        [Theory]
        [InlineData(3)]
        [InlineData(0)]
        [InlineData(-1)]
        public void The_company_of_the_token_is_used(int requested)
        {
            var (companyId, error) = ScopeCompany.Resolve(3, requested);
            Assert.Null(error);
            Assert.Equal(3, companyId);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public void Without_a_company_in_the_token_the_requested_one_is_used(int tokenCompanyId)
        {
            var (companyId, error) = ScopeCompany.Resolve(tokenCompanyId, 4);
            Assert.Null(error);
            Assert.Equal(4, companyId);
        }

        [Fact]
        public void Without_any_company_the_result_is_zero_and_no_error()
        {
            Assert.Equal((0, (string?)null), ScopeCompany.Resolve(-1, -2));
        }
    }
}
