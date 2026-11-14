using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ModuleDtoTests
    {
        [Theory]
        [InlineData(true, true, "Technician", "Available")]
        [InlineData(true, false, "Technician", "NoAccess")]
        [InlineData(true, false, "CompanyAdmin", "Available")]
        [InlineData(false, true, "Admin", "NotSubscribed")]
        public void State_is_the_name_of_the_module_state(bool companyEnabled, bool userGranted, string role, string expected)
        {
            var dto = ModuleDto.From(1, "SERVICE", "Service Management", "desc", "build", 1, companyEnabled, userGranted, role);

            Assert.Equal(expected, dto.State);
            Assert.Equal("SERVICE", dto.ModuleKey);
            Assert.Equal("Service Management", dto.ModuleName);
        }

        [Fact]
        public void An_application_that_is_not_released_is_coming_soon_and_carries_its_family()
        {
            var dto = ModuleDto.From(4, "PAYROLL", "Payroll", "desc", "payments", 5, true, true, "Admin",
                isReleased: false, family: "HR");

            Assert.Equal("ComingSoon", dto.State);
            Assert.Equal("HR", dto.Family);
        }

        [Fact]
        public void Family_is_empty_when_none_is_given()
        {
            var dto = ModuleDto.From(1, "SERVICE", "Service Management", "desc", "build", 1, true, true, "Admin");

            Assert.Equal("", dto.Family);
            Assert.Equal("Available", dto.State);
        }
    }
}
