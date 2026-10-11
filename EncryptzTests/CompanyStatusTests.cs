using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class CompanyStatusTests
    {
        [Theory]
        [InlineData("Ready", "Ready")]
        [InlineData(" Failed ", "Failed")]
        [InlineData("Provisioning", "Provisioning")]
        public void A_status_from_the_database_is_passed_on(string value, string expected)
        {
            Assert.Equal(expected, CompanyResponseDto.StatusFrom(value));
        }

        [Fact]
        public void A_missing_status_is_None()
        {
            Assert.Equal("None", CompanyResponseDto.StatusFrom(null));
            Assert.Equal("None", CompanyResponseDto.StatusFrom(DBNull.Value));
            Assert.Equal("None", CompanyResponseDto.StatusFrom(""));
        }
    }
}
