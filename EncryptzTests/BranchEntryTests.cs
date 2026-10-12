using System.Data;
using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class BranchEntryTests
    {
        private static DataTable NewShape(bool? hasAccess)
        {
            var table = new DataTable();
            table.Columns.Add("LocationId", typeof(int));
            table.Columns.Add("LocationName", typeof(string));
            table.Columns.Add("HasAccess", typeof(bool));
            if (hasAccess != null) table.Rows.Add(7, "Main", hasAccess.Value);
            return table;
        }

        private static DataTable OldShape(bool row)
        {
            var table = new DataTable();
            table.Columns.Add("LocationId", typeof(int));
            table.Columns.Add("LocationName", typeof(string));
            if (row) table.Rows.Add(7, "Main");
            return table;
        }

        [Fact]
        public void A_branch_the_member_was_given_can_be_entered()
        {
            Assert.Equal((true, true), BranchAccessRules.ValidationOutcome(NewShape(true), newProcedure: true));
        }

        [Fact]
        public void A_branch_the_member_was_not_given_is_found_but_refused()
        {
            Assert.Equal((true, false), BranchAccessRules.ValidationOutcome(NewShape(false), newProcedure: true));
            Assert.Equal("You do not have access to this branch", BranchAccessRules.EntryRefusal(true, false));
        }

        [Fact]
        public void No_row_means_no_such_branch()
        {
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(NewShape(null), newProcedure: true));
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(null, newProcedure: true));
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(OldShape(false), newProcedure: false));
        }

        [Fact]
        public void A_company_database_without_branch_access_lets_every_member_into_every_branch()
        {
            Assert.Equal((true, true), BranchAccessRules.ValidationOutcome(OldShape(true), newProcedure: false));
        }

        [Fact]
        public void A_new_answer_without_the_access_column_is_treated_as_no_access()
        {
            // never fail open when the new procedure answers in an unexpected shape
            Assert.Equal((true, false), BranchAccessRules.ValidationOutcome(OldShape(true), newProcedure: true));
        }

        [Fact]
        public void Only_a_missing_procedure_counts_as_not_installed()
        {
            Assert.False(BranchAccessRules.IsMissingBranchAccess(null));
            Assert.False(BranchAccessRules.IsMissingBranchAccess(new InvalidOperationException("boom")));
            Assert.False(BranchAccessRules.IsMissingBranchAccess(new TimeoutException()));
        }
    }
}
