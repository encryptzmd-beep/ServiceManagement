using System.Data;
using System.Reflection;
using Microsoft.Data.SqlClient;
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

        /// <summary>A SqlException cannot be made in the open: built the way the client builds it.</summary>
        private static SqlException SqlError(int number)
        {
            const BindingFlags Hidden = BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public;

            var errorType = typeof(SqlError);
            var constructor = errorType.GetConstructors(Hidden)
                .Where(c => c.GetParameters().Length > 0 && c.GetParameters()[0].ParameterType == typeof(int))
                .OrderBy(c => c.GetParameters().Length)
                .First();

            var arguments = constructor.GetParameters().Select((p, i) =>
                i == 0 ? number
                : p.ParameterType == typeof(string) ? ""
                : p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType)
                : null).ToArray();

            var error = constructor.Invoke(arguments);

            var collection = Activator.CreateInstance(typeof(SqlErrorCollection), true)!;
            typeof(SqlErrorCollection).GetMethod("Add", Hidden)!.Invoke(collection, new[] { error });

            var create = typeof(SqlException).GetMethods(Hidden)
                .First(m => m.Name == "CreateException" && m.GetParameters().Length == 2
                            && m.GetParameters()[0].ParameterType == typeof(SqlErrorCollection));

            return (SqlException)create.Invoke(null, new object?[] { collection, "16.00.0000" })!;
        }

        [Fact]
        public void A_missing_procedure_error_counts_as_not_installed()
        {
            Assert.True(BranchAccessRules.IsMissingBranchAccess(SqlError(2812)));
        }

        [Theory]
        [InlineData(229)]
        [InlineData(-2)]
        public void Other_database_errors_do_not_count_as_not_installed(int number)
        {
            Assert.False(BranchAccessRules.IsMissingBranchAccess(SqlError(number)));
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
