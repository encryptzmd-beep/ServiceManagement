using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class BranchAccessRulesTests
    {
        private static ProjectAccessDto Member(int id, string role, string name = "U")
            => new() { UserId = id, FullName = name + id, Email = name + id + "@x.test", RoleInCompany = role, HasAccess = true };

        private static BranchDto Branch(int id, bool active = true) => new() { LocationId = id, LocationName = "B" + id, IsActive = active };

        [Theory]
        [InlineData("Admin", true)]
        [InlineData("CompanyAdmin", true)]
        [InlineData(" admin ", true)]
        [InlineData("Technician", false)]
        [InlineData("Manager", false)]
        [InlineData("", false)]
        [InlineData(null, false)]
        public void Administrators_have_every_branch(string? role, bool expected)
        {
            Assert.Equal(expected, BranchAccessRules.HasEveryBranch(role));
        }

        [Fact]
        public void Entering_is_refused_for_an_unknown_branch_and_for_a_branch_not_given()
        {
            Assert.Equal("Invalid branch for this company", BranchAccessRules.EntryRefusal(branchFound: false, hasAccess: false));
            Assert.Equal("Invalid branch for this company", BranchAccessRules.EntryRefusal(branchFound: false, hasAccess: true));
            Assert.Equal("You do not have access to this branch", BranchAccessRules.EntryRefusal(branchFound: true, hasAccess: false));
            Assert.Null(BranchAccessRules.EntryRefusal(branchFound: true, hasAccess: true));
        }

        [Fact]
        public void Only_a_member_who_is_not_an_administrator_can_be_changed()
        {
            Assert.Equal("The user is not an active member of the company", BranchAccessRules.ChangeRefusal(null, actorUserId: 1));
            Assert.Equal("Company administrators have every branch. Change the role instead.", BranchAccessRules.ChangeRefusal(Member(5, "Admin"), 1));
            Assert.Equal("Company administrators have every branch. Change the role instead.", BranchAccessRules.ChangeRefusal(Member(5, "CompanyAdmin"), 1));
            Assert.Null(BranchAccessRules.ChangeRefusal(Member(5, "Technician"), 1));
        }

        [Fact]
        public void The_view_lists_members_with_their_branches_and_marks_administrators()
        {
            var view = BranchAccessRules.Build(
                new[] { Member(3, "Technician", "Zed"), Member(1, "Admin", "Amy"), Member(2, "Manager", "Bob") },
                new[] { Branch(20), Branch(10), Branch(30, active: false) },
                new[] { (2, 10), (2, 20), (3, 20), (3, 999), (77, 10), (1, 10) });

            Assert.Equal(new[] { 20, 10, 30 }, view.Branches.Select(b => b.LocationId));   // order as given
            Assert.Equal(new[] { "Amy1", "Bob2", "Zed3" }, view.Users.Select(u => u.FullName));   // by name

            var amy = view.Users[0];
            Assert.True(amy.AllBranches);
            Assert.Empty(amy.LocationIds);                       // nothing stored or shown per branch for an administrator

            Assert.False(view.Users[1].AllBranches);
            Assert.Equal(new[] { 10, 20 }, view.Users[1].LocationIds);
            Assert.Equal(new[] { 20 }, view.Users[2].LocationIds);   // 999 is not a branch of this company
        }

        [Fact]
        public void A_member_without_any_row_has_no_branch()
        {
            var view = BranchAccessRules.Build(new[] { Member(4, "Technician") }, new[] { Branch(10) }, Array.Empty<(int, int)>());

            Assert.False(view.Users[0].AllBranches);
            Assert.Empty(view.Users[0].LocationIds);
        }

        [Fact]
        public void Only_members_who_are_not_administrators_need_their_first_branches()
        {
            var ids = BranchAccessRules.MemberIdsToInitialise(new[] { Member(1, "Admin"), Member(2, "Technician"), Member(3, "CompanyAdmin"), Member(4, "Manager"), Member(2, "Technician") });

            Assert.Equal(new[] { 2, 4 }, ids);
        }
    }
}
