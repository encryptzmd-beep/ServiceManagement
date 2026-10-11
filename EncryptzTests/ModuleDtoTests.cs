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
    }
}
