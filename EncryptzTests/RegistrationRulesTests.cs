using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    /// <summary>What a self-registration must hold (QA BUG-001: 'qa.cand@' and '12ab' were taken).</summary>
    public class RegistrationRulesTests
    {
        private static SelfRegisterDto Valid() => new()
        {
            FullName = "QA Test Candidate",
            Email = "qa.cand@example.com",
            MobileNumber = "+91 98765 43210",
            Password = "secret1",
            AadhaarNumber = ""
        };

        [Fact]
        public void A_valid_entry_is_taken() => Assert.Null(RegistrationRules.Problem(Valid()));

        [Theory]
        [InlineData("qa.cand@")]
        [InlineData("qa.cand")]
        [InlineData("qa @x.com")]
        [InlineData("a@b.c")]
        [InlineData("")]
        public void A_bad_email_is_refused(string email)
        {
            var dto = Valid(); dto.Email = email;
            Assert.Equal("Enter a valid e-mail address", RegistrationRules.Problem(dto));
        }

        [Theory]
        [InlineData("12ab")]
        [InlineData("12345")]
        [InlineData("98765-4321x")]
        [InlineData("")]
        public void A_bad_mobile_is_refused(string mobile)
        {
            var dto = Valid(); dto.MobileNumber = mobile;
            Assert.Equal("Enter a valid mobile number (10 digits)", RegistrationRules.Problem(dto));
        }

        [Theory]
        [InlineData("9876543210")]
        [InlineData("09876543210")]
        [InlineData("+91-98765-43210")]
        public void Usual_mobile_forms_are_taken(string mobile)
        {
            var dto = Valid(); dto.MobileNumber = mobile;
            Assert.Null(RegistrationRules.Problem(dto));
        }

        [Fact]
        public void The_entry_is_trimmed()
        {
            var dto = Valid(); dto.Email = "  qa@example.com "; dto.FullName = " Q ";
            Assert.Null(RegistrationRules.Problem(dto));
            Assert.Equal("qa@example.com", dto.Email);
            Assert.Equal("Q", dto.FullName);
        }

        [Fact]
        public void A_short_password_is_refused()
        {
            var dto = Valid(); dto.Password = "12345";
            Assert.Equal("The password must be at least 6 characters", RegistrationRules.Problem(dto));
        }

        [Fact]
        public void A_bad_aadhaar_is_refused()
        {
            var dto = Valid(); dto.AadhaarNumber = "1234";
            Assert.Equal("The Aadhaar number must be 12 digits", RegistrationRules.Problem(dto));
        }
    }
}
