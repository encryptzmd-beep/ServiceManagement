using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class CompanyMemberRulesTests
    {
        [Fact]
        public void The_roles_a_member_can_have_are_the_four_of_a_company()
        {
            Assert.Equal(new[] { "Admin", "Technician", "Storekeeper", "Manager" }, CompanyMemberRules.Roles);
        }

        [Theory]
        [InlineData("Admin", "Admin")]
        [InlineData(" admin ", "Admin")]
        [InlineData("MANAGER", "Manager")]
        public void A_role_is_brought_to_its_one_spelling(string typed, string expected)
        {
            Assert.Equal(expected, CompanyMemberRules.NormalizeRole(typed));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("Customer")]            // a customer is not a member of staff
        [InlineData("CompanyAdmin")]        // not offered: Admin is the administrator of a company
        [InlineData("Owner")]
        public void Any_other_role_is_not_a_role(string? typed)
        {
            Assert.Null(CompanyMemberRules.NormalizeRole(typed));
        }

        [Theory]
        [InlineData("Admin", true)]
        [InlineData(" CompanyAdmin ", true)]
        [InlineData("admin", true)]
        [InlineData("Manager", false)]
        [InlineData("", false)]
        [InlineData(null, false)]
        public void Administrator_roles_are_admin_and_company_admin(string? role, bool expected)
        {
            Assert.Equal(expected, CompanyMemberRules.IsAdministrator(role));
        }

        [Fact]
        public void A_person_is_looked_up_by_individual_id_in_any_way_it_is_typed()
        {
            var stored = "EZ7K4M2P9QXD3" + IndividualId.CheckChar("7K4M2P9QXD3");
            var shown = IndividualId.Format(stored);

            foreach (var typed in new[] { shown, shown.ToLowerInvariant(), "  " + shown.Replace("-", " ") + " ", stored })
            {
                var (email, id, problem) = CompanyMemberRules.Lookup(typed);

                Assert.Null(problem);
                Assert.Null(email);
                Assert.Equal(stored, id);
            }
        }

        [Theory]
        [InlineData("leo@example.com", "leo@example.com")]
        [InlineData("  Leo.J@Example.co.in ", "Leo.J@Example.co.in")]
        public void Or_by_e_mail(string typed, string expected)
        {
            var (email, id, problem) = CompanyMemberRules.Lookup(typed);

            Assert.Null(problem);
            Assert.Null(id);
            Assert.Equal(expected, email);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("Leo Joseph")]
        [InlineData("leo@")]
        [InlineData("@example.com")]
        [InlineData("leo@example")]
        [InlineData("EZ-7K4M-2P9Q-XD32")]            // a wrong check character
        [InlineData("EZ-0000-0000-0000")]
        [InlineData("a@b.c'; DROP TABLE Users--")]
        public void Anything_else_is_asked_for_again(string? typed)
        {
            var (email, id, problem) = CompanyMemberRules.Lookup(typed);

            Assert.Equal("Enter the e-mail address or the Individual ID of the person", problem);
            Assert.Null(email);
            Assert.Null(id);
        }
    }

    /// <summary>Text checks on script 23: it cannot be run in a test (the server is live).</summary>
    public class CompanyAdministratorsScriptTests
    {
        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Script()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "23_Company_Administrators.sql")).Replace("\r\n", "\n");

        private static string Code()
            => Regex.Replace(Regex.Replace(Script(), @"/\*.*?\*/", "", RegexOptions.Singleline), @"--[^\n]*", "");

        private static string Procedure(string name)
        {
            var m = Regex.Match(Code(), @"CREATE OR ALTER PROCEDURE dbo\." + name + @"\b(?<body>.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, name + " is not in script 23");
            return m.Groups["body"].Value;
        }

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_or_drops(string forbidden)
        {
            Assert.DoesNotContain(forbidden, Code(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_script_refuses_to_run_before_scripts_20_and_22()
        {
            var script = Script();

            Assert.Contains("COL_LENGTH('dbo.Companies', 'CreatedBy') IS NULL", script);      // script 20
            Assert.Contains("COL_LENGTH('dbo.Users', 'IndividualId') IS NULL", script);       // script 22
            Assert.Contains("OBJECT_ID('dbo.sp_Company_GrantDefaultModules') IS NULL", script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        [Fact]
        public void The_script_changes_no_table()
        {
            Assert.DoesNotMatch(@"\b(ALTER|CREATE)\s+TABLE\b", Code());
        }

        [Fact]
        public void The_members_are_listed_with_their_id_and_who_created_the_company()
        {
            var body = Procedure("sp_Platform_GetCompanyMembers");

            Assert.Contains("AS IndividualId", body);
            Assert.Contains("AS IsCreator", body);
            Assert.Contains("c.CreatedBy = u.UserId", body);
            Assert.Contains("cu.IsActive = 1", body);
            Assert.DoesNotContain("PasswordHash", body);
        }

        [Fact]
        public void A_company_always_keeps_an_administrator()
        {
            var body = Procedure("sp_Platform_SetCompanyMemberRole");

            Assert.Contains("A company needs at least one administrator. Make someone else administrator first", body);
            // the other administrators are counted under a lock, so two changes at once cannot both pass
            Assert.Matches(@"FROM\s+dbo\.CompanyUsers\s+\w+\s+WITH\s*\(\s*UPDLOCK\s*,\s*HOLDLOCK\s*\)", body);
            Assert.Contains("cu.UserId <> @UserId", body);
        }

        [Theory]
        [InlineData("sp_Platform_SetCompanyMemberRole")]
        [InlineData("sp_Platform_AddCompanyMember")]
        public void A_role_must_be_an_active_role_of_the_platform(string procedure)
        {
            var body = Procedure(procedure);

            Assert.Matches(@"FROM\s+dbo\.Roles\s+WHERE\s+RoleName\s*=\s*@RoleName\s+AND\s+IsActive\s*=\s*1", body);
            Assert.Contains("Role not found", body);
        }

        [Theory]
        [InlineData("sp_Platform_SetCompanyMemberRole")]
        [InlineData("sp_Platform_AddCompanyMember")]
        public void A_member_who_is_not_an_administrator_gets_the_modules_of_the_company(string procedure)
        {
            // an administrator needs no grant; anybody else would be locked out without one
            Assert.Contains("EXEC dbo.sp_Company_GrantDefaultModules", Procedure(procedure));
        }

        [Fact]
        public void A_person_is_added_only_when_registered_and_not_a_member_yet()
        {
            var body = Procedure("sp_Platform_AddCompanyMember");

            Assert.Contains("Nobody is registered with this e-mail or Individual ID", body);
            Assert.Contains("This person is already a member of the company. Change the role in the list", body);
            Assert.Contains("u.IsActive = 1", body);
        }
    }

    public class CompanyAdministratorsEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetCompanyMembers", "GET", "companies/{companyId}/members")]
        [InlineData("AddCompanyMember", "POST", "companies/{companyId}/members")]
        [InlineData("SetCompanyMemberRole", "POST", "companies/{companyId}/members/{memberId}/role")]
        public void The_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("GetCompanyMembers")]
        [InlineData("AddCompanyMember")]
        [InlineData("SetCompanyMemberRole")]
        public void They_need_a_login_and_the_platform_unlock_and_take_the_company_from_the_route(string action)
        {
            Assert.NotNull(typeof(PlatformController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());

            var companyId = Action(action).GetParameters().Single(p => p.Name == "companyId");
            Assert.Equal(typeof(int), companyId.ParameterType);
            Assert.Null(companyId.GetCustomAttribute<FromBodyAttribute>());
        }

        private static string Method(string source, string signature)
        {
            var start = source.IndexOf(signature, StringComparison.Ordinal);
            Assert.True(start >= 0, signature + " was not found");
            var next = source.IndexOf("\n        public ", start + signature.Length, StringComparison.Ordinal);
            return source.Substring(start, (next < 0 ? source.Length : next) - start);
        }

        [Theory]
        [InlineData("GetCompanyMembers(int companyId, PlatformActor actor)")]
        [InlineData("SetCompanyMemberRole(int companyId, int memberId, SetCompanyMemberRoleRequest req, PlatformActor actor)")]
        [InlineData("AddCompanyMember(int companyId, AddCompanyMemberRequest req, PlatformActor actor)")]
        public void Only_a_platform_administrator_gets_past_the_first_line(string signature)
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs"))) folder = folder.Parent;
            var source = File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzBL", "Infrastructure", "User", "Modules", "PlatformService.cs"));
            var body = Method(source, signature);

            var refusal = body.IndexOf("if (!actor.IsPlatformAdmin)", StringComparison.Ordinal);
            var database = body.IndexOf("Async(", body.IndexOf('{'), StringComparison.Ordinal);

            Assert.True(refusal >= 0, "no platform administrator check");
            Assert.True(database < 0 || refusal < database, "the database is called before the check");
        }
    }
}
