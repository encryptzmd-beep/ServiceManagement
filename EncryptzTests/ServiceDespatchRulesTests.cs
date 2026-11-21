using EncryptzBL.Common.Sales;
using Xunit;

namespace EncryptzTests
{
    public class ServiceDespatchRulesTests
    {
        private static readonly DateTime Today = new(2026, 11, 21);

        [Theory]
        [InlineData("spare", "Spare")]
        [InlineData(" Repair ", "Repair")]
        [InlineData("Sales", null)]
        [InlineData(null, null)]
        public void Source_is_spare_or_repair(string? typed, string? expected)
            => Assert.Equal(expected, ServiceDespatchRules.Source(typed));

        [Fact]
        public void Good_details_pass()
            => Assert.Null(ServiceDespatchRules.Problem("Spare", 4, Today, "courier", "DTDC-784512096", Today, Today));

        [Theory]
        [InlineData("Other", 4, "Courier", "AWB-1")]
        [InlineData("Spare", 0, "Courier", "AWB-1")]
        [InlineData("Spare", 4, "Drone", "AWB-1")]
        [InlineData("Repair", 4, "", "AWB-1")]
        [InlineData("Repair", 4, "Courier", "   ")]
        public void Bad_source_mode_or_reference_is_refused(string source, int id, string mode, string reference)
            => Assert.NotNull(ServiceDespatchRules.Problem(source, id, Today, mode, reference, null, Today));

        [Fact]
        public void Date_is_required_and_not_in_the_future()
        {
            Assert.NotNull(ServiceDespatchRules.Problem("Spare", 4, null, "Courier", "AWB-1", null, Today));
            Assert.NotNull(ServiceDespatchRules.Problem("Spare", 4, Today.AddDays(1), "Courier", "AWB-1", null, Today));
            Assert.NotNull(ServiceDespatchRules.Problem("Spare", 4, Today, "Courier", "AWB-1", Today.AddDays(1), Today));
        }

        [Theory]
        [InlineData("Requested", "Approved", true)]
        [InlineData("Requested", "Rejected", true)]
        [InlineData("Approved", "Dispatched", false)]
        [InlineData("Approved", "Used", false)]
        [InlineData("Requested", "Used", false)]
        [InlineData("Dispatched", "Used", true)]
        [InlineData("Dispatched", "Dispatched", true)]
        [InlineData("Dispatched", "Approved", false)]
        [InlineData("Used", "Requested", false)]
        public void Spare_status_goes_through_despatch(string current, string target, bool allowed)
            => Assert.Equal(allowed, ServiceDespatchRules.SpareStatusProblem(current, target) == null);

        [Theory]
        [InlineData("Requested", "ReceivedAtHQ", true)]
        [InlineData("UnderRepair", "Repaired", true)]
        [InlineData("Repaired", "Dispatched", false)]
        [InlineData("Repaired", "Delivered", false)]
        [InlineData("Requested", "Resolved", false)]
        [InlineData("Dispatched", "Delivered", true)]
        [InlineData("Delivered", "Resolved", true)]
        [InlineData("Dispatched", "Repaired", false)]
        public void Repair_status_goes_through_despatch(string current, string target, bool allowed)
            => Assert.Equal(allowed, ServiceDespatchRules.RepairStatusProblem(current, target) == null);
    }
}
