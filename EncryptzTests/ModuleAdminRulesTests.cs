using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ModuleAdminRulesTests
    {
        private static PlatformActor Platform() => new() { UserId = 1, IsPlatformAdmin = true };
        private static PlatformActor CompanyAdmin(int companyId) => new() { UserId = 2, IsCompanyAdmin = true, CompanyId = companyId };
        private static PlatformActor Member(int companyId) => new() { UserId = 3, CompanyId = companyId };

        [Theory]
        [InlineData("SERVICE", "SERVICE")]
        [InlineData(" service ", "SERVICE")]
        [InlineData("Sales_2", "SALES_2")]
        public void A_key_is_trimmed_and_upper_cased(string input, string expected)
        {
            Assert.Equal(expected, ModuleAdminRules.NormalizeKey(input));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("SERVICE'; DROP")]
        [InlineData("SER VICE")]
        [InlineData("SERVICE-1")]
        [InlineData("SERVICÉ")]
        [InlineData("ſERVICE")]   // long s: upper-cases into S
        [InlineData("SER\tVICE")]
        public void A_key_with_anything_but_letters_digits_and_underscore_is_refused(string? input)
        {
            Assert.Null(ModuleAdminRules.NormalizeKey(input));
        }

        [Fact]
        public void A_key_longer_than_the_column_is_refused()
        {
            Assert.Null(ModuleAdminRules.NormalizeKey(new string('A', 51)));
            Assert.Equal(new string('A', 50), ModuleAdminRules.NormalizeKey(new string('A', 50)));
        }

        [Fact]
        public void The_length_is_checked_on_the_trimmed_key()
        {
            Assert.Equal(new string('A', 50), ModuleAdminRules.NormalizeKey(" " + new string('A', 50) + " "));
            Assert.Null(ModuleAdminRules.NormalizeKey(" " + new string('A', 51) + " "));
        }

        [Fact]
        public void Only_a_platform_administrator_switches_modules()
        {
            Assert.True(ModuleAdminRules.CanSwitchModules(Platform()));
            Assert.False(ModuleAdminRules.CanSwitchModules(CompanyAdmin(7)));
            Assert.False(ModuleAdminRules.CanSwitchModules(Member(7)));
        }

        [Fact]
        public void A_company_administrator_sees_the_modules_of_the_own_company_only()
        {
            Assert.True(ModuleAdminRules.CanViewModules(Platform(), 7));
            Assert.True(ModuleAdminRules.CanViewModules(CompanyAdmin(7), 7));
            Assert.False(ModuleAdminRules.CanViewModules(CompanyAdmin(7), 8));
            Assert.False(ModuleAdminRules.CanViewModules(Member(7), 7));
        }

        [Fact]
        public void Access_is_managed_by_the_platform_or_the_own_company_administrator()
        {
            Assert.True(ModuleAdminRules.CanManageAccess(Platform(), 7));
            Assert.True(ModuleAdminRules.CanManageAccess(CompanyAdmin(7), 7));
            Assert.False(ModuleAdminRules.CanManageAccess(CompanyAdmin(7), 8));
            Assert.False(ModuleAdminRules.CanManageAccess(Member(7), 7));
        }

        private static CompanyModuleDto Mod(string key, bool on) => new() { ModuleKey = key, IsEnabled = on };

        [Fact]
        public void A_module_is_had_only_when_it_is_listed_and_switched_on()
        {
            Assert.True(ModuleAdminRules.HasModule(new[] { Mod("SERVICE", true) }, "SERVICE"));
            Assert.False(ModuleAdminRules.HasModule(new[] { Mod("SERVICE", false) }, "SERVICE"));
            Assert.False(ModuleAdminRules.HasModule(new[] { Mod("SALES", true) }, "SERVICE"));
            Assert.False(ModuleAdminRules.HasModule(new List<CompanyModuleDto>(), "SERVICE"));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void No_company_means_nothing_to_manage(int companyId)
        {
            Assert.False(ModuleAdminRules.CanViewModules(Platform(), companyId));
            Assert.False(ModuleAdminRules.CanManageAccess(Platform(), companyId));
            Assert.False(ModuleAdminRules.CanViewModules(CompanyAdmin(companyId), companyId));
        }
    }
}
