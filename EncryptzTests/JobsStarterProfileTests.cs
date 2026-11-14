using EncryptzBL.Common.Jobs;
using Xunit;

namespace EncryptzTests
{
    /// <summary>
    /// The first time a person opens Job Portal, the profile starts with what the user
    /// master already knows. Only values the profile itself would accept are taken.
    /// </summary>
    public class JobsStarterProfileTests
    {
        [Fact]
        public void Name_email_and_phone_are_taken_from_the_user_master()
        {
            var p = JobsRules.StarterProfile("  Leo Joseph ", " leo@example.com ", " +91 98470 12345 ");

            Assert.NotNull(p);
            Assert.Equal("Leo Joseph", p!.FullName);
            Assert.Equal("leo@example.com", p.ContactEmail);
            Assert.Equal("+91 98470 12345", p.ContactPhone);
            Assert.Equal("", p.Headline);
            Assert.False(p.IsVisible);
            Assert.Null(p.DateOfBirth);
        }

        [Theory]
        [InlineData("not-an-email", "9847012345", "", "9847012345")]
        [InlineData("leo@example.com", "ext. 12", "leo@example.com", "")]
        [InlineData("leo@example.com", "123", "leo@example.com", "")]
        [InlineData("bad", "bad", "", "")]
        public void A_value_the_profile_would_refuse_is_left_out_and_the_rest_is_kept(
            string email, string phone, string expectedEmail, string expectedPhone)
        {
            var p = JobsRules.StarterProfile("Leo Joseph", email, phone);

            Assert.NotNull(p);
            Assert.Equal("Leo Joseph", p!.FullName);
            Assert.Equal(expectedEmail, p.ContactEmail);
            Assert.Equal(expectedPhone, p.ContactPhone);
        }

        [Fact]
        public void A_name_that_is_too_long_is_left_out()
        {
            var p = JobsRules.StarterProfile(new string('a', 201), "leo@example.com", null);

            Assert.NotNull(p);
            Assert.Equal("", p!.FullName);
            Assert.Equal("leo@example.com", p.ContactEmail);
        }

        [Theory]
        [InlineData(null, null, null)]
        [InlineData("  ", "", " ")]
        [InlineData("", "bad", "x")]
        public void Nothing_usable_means_no_starter_profile(string? name, string? email, string? phone)
        {
            Assert.Null(JobsRules.StarterProfile(name, email, phone));
        }
    }
}
