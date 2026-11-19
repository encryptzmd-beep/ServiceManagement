using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Service;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace EncryptzTests
{
    // Staff register a complaint for a customer (Register Complaint page)
    public class StaffComplaintTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        [Theory]
        [InlineData("+91 98470 12345")]
        [InlineData("09847012345")]
        [InlineData("9847012345")]
        [InlineData("98470-12345")]
        public void Mobile_is_normalised(string value)
            => Assert.Equal("9847012345", StaffComplaintRules.NormaliseMobile(value));

        [Theory]
        [InlineData("98470")]
        [InlineData(null)]
        [InlineData("abcdefghij")]
        [InlineData("919847012345678")]
        public void Bad_mobile_is_refused(string? value)
            => Assert.Null(StaffComplaintRules.NormaliseMobile(value));

        private static PublicQuickComplaintRequest_Dto Dto(string mobile = "9847012345", string subject = "Not cooling", string? name = "Anil")
            => new() { MobileNumber = mobile, Subject = subject, FullName = name! };

        [Fact]
        public void Problem_words()
        {
            Assert.Equal("Enter a valid 10-digit mobile number", StaffComplaintRules.Problem(Dto(mobile: "123"), customerFound: true));
            Assert.Equal("Enter the subject", StaffComplaintRules.Problem(Dto(subject: "  "), customerFound: true));
            Assert.Null(StaffComplaintRules.Problem(Dto(name: null), customerFound: true));
            Assert.Null(StaffComplaintRules.Problem(Dto(), customerFound: false));
        }

        [Fact]
        public void New_customer_needs_a_name()
            => Assert.Equal("Enter the customer name", StaffComplaintRules.Problem(Dto(name: " "), customerFound: false));

        [Fact]
        public void Stored_mobile_formats_are_tried_after_the_ten_digits()
            => Assert.Equal(new[] { "9847012345", "+919847012345", "919847012345", "09847012345", "+91 9847012345" },
                StaffComplaintRules.MobileVariants("9847012345"));

        [Theory]
        [InlineData("Could not create customer account")]
        [InlineData("UserAlreadyExists")]
        public void A_user_who_is_not_a_customer_gets_a_clear_refusal(string message)
            => Assert.Equal("This mobile or email already belongs to a user account that is not a customer. Use another mobile, or leave the email empty",
                StaffComplaintRules.RefusalOf(message));

        [Fact]
        public void Other_refusals_pass_through()
            => Assert.Equal("Duplicate complaint", StaffComplaintRules.RefusalOf("Duplicate complaint"));

        [Fact]
        public void Register_uses_the_stored_mobile_and_words_the_refusal()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Controllers", "StaffComplaintController.cs"));
            Assert.Contains("MobileVariants(", source);
            Assert.Contains("StaffComplaintRules.RefusalOf(", source);
        }

        [Fact]
        public void Controller_is_back_office_service_only()
        {
            var type = typeof(StaffComplaintController);
            Assert.Equal("api/staff-complaints", type.GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.Equal("SERVICE", type.GetCustomAttribute<AppModuleAttribute>()!.ModuleKey);
            Assert.Equal("Admin,CompanyAdmin,ServiceManager,Manager", type.GetCustomAttribute<AuthorizeAttribute>()!.Roles);
            Assert.Null(type.GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void Actions_are_as_planned()
        {
            var type = typeof(StaffComplaintController);
            var lookup = type.GetMethod("LookupCustomer")!;
            Assert.Equal("customer", lookup.GetCustomAttribute<HttpGetAttribute>()!.Template);
            Assert.NotNull(type.GetMethod("Register")!.GetCustomAttribute<HttpPostAttribute>());
            foreach (var m in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                Assert.Null(m.GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void Register_finds_the_customer_and_reuses_the_quick_complaint()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Controllers", "StaffComplaintController.cs"));
            Assert.Contains("CheckByMobile(", source);
            Assert.Contains("CreatePublicQuickComplaint(", source);
            Assert.Contains("StaffComplaintRules.Problem(", source);
        }
    }
}
