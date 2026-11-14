using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ApplicationRulesTests
    {
        private static ApplicationDto App(string key = "PAYROLL", string name = "Payroll", string type = "Commercial",
            string route = "", bool released = false, string family = "")
            => new ApplicationDto { ModuleKey = key, ModuleName = name, AppType = type, RoutePath = route, IsReleased = released, Family = family };

        [Fact]
        public void A_complete_entry_has_no_problem()
        {
            Assert.Null(ApplicationRules.Problem(App()));
        }

        [Fact]
        public void Nothing_sent_is_a_problem()
        {
            Assert.Equal("Key and name are required", ApplicationRules.Problem(null));
        }

        [Fact]
        public void The_key_is_trimmed_and_upper_cased()
        {
            var app = App(key: "  payroll ");

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal("PAYROLL", app.ModuleKey);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("PAY ROLL")]
        [InlineData("PAY-ROLL")]
        [InlineData("PÄY")]
        public void A_key_is_letters_digits_and_underscore(string key)
        {
            Assert.Equal("The key may hold letters, digits and _ only", ApplicationRules.Problem(App(key: key)));
        }

        [Fact]
        public void A_key_of_more_than_50_characters_is_refused()
        {
            Assert.Equal("The key may hold letters, digits and _ only", ApplicationRules.Problem(App(key: new string('A', 51))));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void A_name_is_required(string name)
        {
            Assert.Equal("Key and name are required", ApplicationRules.Problem(App(name: name)));
        }

        [Fact]
        public void A_name_of_more_than_150_characters_is_refused()
        {
            Assert.Equal("The name is too long", ApplicationRules.Problem(App(name: new string('n', 151))));
        }

        [Theory]
        [InlineData("personal", "Personal")]
        [InlineData(" COMMERCIAL ", "Commercial")]
        public void The_type_is_stored_in_its_one_spelling(string typed, string stored)
        {
            var app = App(type: typed);

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal(stored, app.AppType);
        }

        [Theory]
        [InlineData("")]
        [InlineData("Free")]
        public void Any_other_type_is_refused(string type)
        {
            Assert.Equal("Choose Personal or Commercial", ApplicationRules.Problem(App(type: type)));
        }

        [Fact]
        public void A_released_personal_application_needs_a_route()
        {
            Assert.Equal("A personal application needs a route before it is released",
                ApplicationRules.Problem(App(type: "Personal", released: true)));
            Assert.Null(ApplicationRules.Problem(App(type: "Personal", released: true, route: "/apps/jobs")));
            Assert.Null(ApplicationRules.Problem(App(type: "Personal", released: false)));
        }

        [Theory]
        [InlineData("apps/jobs")]
        [InlineData("https://example.com/jobs")]
        [InlineData("//example.com")]
        [InlineData("/apps/jobs?x=1")]
        [InlineData("/apps/jo bs")]
        public void A_route_is_a_path_inside_the_application(string route)
        {
            Assert.Equal("The route must start with / and hold letters, digits, - _ and / only",
                ApplicationRules.Problem(App(route: route)));
        }

        [Fact]
        public void An_empty_family_and_route_stay_empty_and_long_ones_are_refused()
        {
            var app = App(family: "  HR ", route: " /apps/hr ");

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal("HR", app.Family);
            Assert.Equal("/apps/hr", app.RoutePath);

            Assert.Equal("The family is too long", ApplicationRules.Problem(App(family: new string('f', 101))));
            Assert.Equal("The route is too long", ApplicationRules.Problem(App(route: "/" + new string('r', 200))));
        }
    }
}
