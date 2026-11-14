using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class TenantUserSyncRulesTests
    {
        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void A_full_sync_without_users_is_skipped(int userCount)
        {
            Assert.True(TenantUserSyncRules.ShouldSkipFullSync(userCount));
        }

        [Theory]
        [InlineData(1)]
        [InlineData(250)]
        public void A_full_sync_with_users_runs(int userCount)
        {
            Assert.False(TenantUserSyncRules.ShouldSkipFullSync(userCount));
        }
    }
}
