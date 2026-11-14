using System.Data;
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

        private const string NotReady = "Your company is still being set up. Please try again shortly";
        private const string NotSubscribed = "This module is not part of your company's subscription";
        private const string NoGrant = "You don't have access to this module. Ask your administrator";

        [Fact]
        public void Refusal_not_ready_wins_over_everything_else()
        {
            Assert.Equal(NotReady, ModuleAccess.Refusal("Failed", "K", false, false, "Technician"));
            Assert.Equal(NotReady, ModuleAccess.Refusal("None", "K", true, true, "Admin"));
            Assert.Equal(NotReady, ModuleAccess.Refusal(null, "K", true, true, "Admin"));
        }

        [Theory]
        [InlineData("")]
        [InlineData(null)]
        public void Refusal_ready_without_a_tenant_key_is_still_being_set_up(string? key)
        {
            Assert.Equal(NotReady, ModuleAccess.Refusal("Ready", key, true, true, "CompanyAdmin"));
        }

        [Fact]
        public void Refusal_not_subscribed_comes_before_the_grant_check()
        {
            Assert.Equal(NotSubscribed, ModuleAccess.Refusal("Ready", "K", false, true, "Admin"));
            Assert.Equal(NotSubscribed, ModuleAccess.Refusal("Ready", "K", false, false, "Technician"));
        }

        [Fact]
        public void Refusal_ungranted_non_admin_is_told_to_ask_the_administrator()
        {
            Assert.Equal(NoGrant, ModuleAccess.Refusal("Ready", "K", true, false, "Technician"));
        }

        [Theory]
        [InlineData("CompanyAdmin", false)]
        [InlineData("Admin", false)]
        [InlineData("Technician", true)]
        public void Refusal_allows_admins_and_granted_members(string role, bool granted)
        {
            Assert.Null(ModuleAccess.Refusal("Ready", "K", true, granted, role));
        }

        private const string NotAvailableYet = "This application is not available yet";

        [Fact]
        public void An_application_that_is_not_released_is_coming_soon_for_everyone()
        {
            Assert.Equal(ModuleState.ComingSoon, ModuleAccess.Evaluate(true, true, "Admin", isReleased: false));
            Assert.Equal(ModuleState.ComingSoon, ModuleAccess.Evaluate(false, false, "Technician", isReleased: false));
        }

        [Fact]
        public void Released_is_the_default()
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, true, "Technician"));
        }

        [Fact]
        public void Refusal_a_subscribed_company_cannot_enter_an_application_that_is_not_released()
        {
            Assert.Equal(NotAvailableYet, ModuleAccess.Refusal("Ready", "K", true, true, "Admin", isReleased: false));
        }

        [Fact]
        public void Refusal_not_ready_still_wins_over_coming_soon()
        {
            Assert.Equal(NotReady, ModuleAccess.Refusal("Failed", "K", true, true, "Admin", isReleased: false));
        }

        [Fact]
        public void A_row_without_the_column_is_released()
        {
            var table = new DataTable();
            table.Columns.Add("ModuleKey", typeof(string));
            var row = table.Rows.Add("SERVICE");

            Assert.True(ModuleAccess.IsReleasedOf(row));
        }

        [Theory]
        [InlineData(true, true)]
        [InlineData(false, false)]
        public void A_row_with_the_column_says_what_the_column_says(bool stored, bool expected)
        {
            var table = new DataTable();
            table.Columns.Add("IsReleased", typeof(bool));
            var row = table.Rows.Add(stored);

            Assert.Equal(expected, ModuleAccess.IsReleasedOf(row));
        }

        [Fact]
        public void A_row_with_an_empty_column_is_released()
        {
            var table = new DataTable();
            table.Columns.Add("IsReleased", typeof(bool));
            var row = table.Rows.Add(DBNull.Value);

            Assert.True(ModuleAccess.IsReleasedOf(row));
        }
    }
}
