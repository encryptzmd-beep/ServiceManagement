using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class ModuleAccessTests
    {
        [Fact]
        public void Company_without_the_module_is_not_subscribed_even_for_admins()
        {
            Assert.Equal(ModuleState.NotSubscribed, ModuleAccess.Evaluate(false, true, "Admin"));
            Assert.Equal(ModuleState.NotSubscribed, ModuleAccess.Evaluate(false, false, "Technician"));
        }

        [Fact]
        public void Granted_member_can_open_the_module()
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, true, "Technician"));
        }

        [Fact]
        public void Member_without_a_grant_has_no_access()
        {
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, "Technician"));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, "Manager"));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, null));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, ""));
        }

        [Theory]
        [InlineData("Admin")]
        [InlineData("CompanyAdmin")]
        [InlineData("admin")]
        [InlineData(" CompanyAdmin ")]
        public void Company_admins_get_every_module_the_company_has_without_a_grant(string role)
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, false, role));
        }

        [Fact]
        public void Service_module_key_is_SERVICE()
        {
            Assert.Equal("SERVICE", ModuleAccess.ServiceModuleKey);
        }
    }
}
