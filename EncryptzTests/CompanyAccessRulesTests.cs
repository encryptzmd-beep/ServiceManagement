using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class CompanyAccessRulesTests
    {
        private static SaveCompanyRoleRequest Role() => new()
        {
            RoleName = "Branch Manager",
            AccessLevel = "Manager",
            ModuleKeys = new List<string> { "SERVICE" }
        };

        [Theory]
        [InlineData(false, true, true, false, true)]    // tenant admin
        [InlineData(false, true, false, true, true)]    // granted by the tenant admin
        [InlineData(false, true, false, false, false)]  // ordinary member
        [InlineData(false, false, false, true, false)]  // a stale grant without membership
        [InlineData(true, false, false, false, true)]   // platform administrator
        public void Who_can_manage(bool platform, bool member, bool admin, bool manager, bool expected)
            => Assert.Equal(expected, CompanyAccessRules.CanManage(platform, member, admin, manager));

        [Fact]
        public void Only_the_tenant_admin_can_grant()
        {
            Assert.True(CompanyAccessRules.CanGrant(false, true, true));
            Assert.False(CompanyAccessRules.CanGrant(false, true, false));
            Assert.False(CompanyAccessRules.CanGrant(false, false, true));
        }

        [Theory]
        [InlineData("Admin")]
        [InlineData("CompanyAdmin")]
        [InlineData("Customer")]
        [InlineData("")]
        [InlineData(null)]
        public void A_role_cannot_work_as_an_administrator(string? level)
        {
            var role = Role();
            role.AccessLevel = level;
            Assert.Equal("Choose what this role works as", CompanyAccessRules.RoleProblem(role));
        }

        [Fact]
        public void A_role_needs_a_name_and_a_module()
        {
            var noName = Role();
            noName.RoleName = "  ";
            Assert.Equal("Enter a role name", CompanyAccessRules.RoleProblem(noName));

            var noModule = Role();
            noModule.ModuleKeys = new List<string> { " " };
            Assert.Equal("Choose at least one module", CompanyAccessRules.RoleProblem(noModule));

            Assert.Null(CompanyAccessRules.RoleProblem(Role()));
        }

        [Theory]
        [InlineData("not-an-email", "Enter a valid email")]
        [InlineData("a@b", "Enter a valid email")]
        public void A_new_user_needs_a_valid_email(string email, string message)
            => Assert.Equal(message, CompanyAccessRules.UserProblem(new SaveCompanyUserRequest { Email = email, RoleIds = new() { 1 } }));

        [Fact]
        public void A_new_user_needs_a_role_and_a_long_enough_password()
        {
            Assert.Equal("Choose at least one role",
                CompanyAccessRules.UserProblem(new SaveCompanyUserRequest { Email = "anu@example.com" }));
            Assert.Contains("at least 6",
                CompanyAccessRules.UserProblem(new SaveCompanyUserRequest { Email = "anu@example.com", RoleIds = new() { 1 }, Password = "12345" }));
            Assert.Null(CompanyAccessRules.UserProblem(new SaveCompanyUserRequest { Email = "anu@example.com", RoleIds = new() { 1 } }));
        }

        [Fact]
        public void A_granted_manager_cannot_raise_themselves_or_touch_an_admin()
        {
            Assert.NotNull(CompanyAccessRules.TargetRefusal(5, 5, actorCanGrant: false, targetIsTenantAdmin: false));
            Assert.NotNull(CompanyAccessRules.TargetRefusal(5, 6, actorCanGrant: false, targetIsTenantAdmin: true));
            Assert.NotNull(CompanyAccessRules.TargetRefusal(5, 6, actorCanGrant: true, targetIsTenantAdmin: true));
            Assert.Null(CompanyAccessRules.TargetRefusal(5, 6, actorCanGrant: false, targetIsTenantAdmin: false));
        }

        [Fact]
        public void Branch_changes_ignore_a_branch_of_another_company()
        {
            var (add, remove) = CompanyAccessRules.BranchChanges(new[] { 1, 2 }, new[] { 2, 3, 99 }, new[] { 1, 2, 3 });
            Assert.Equal(new[] { 3 }, add);
            Assert.Equal(new[] { 1 }, remove);
        }
    }
}
