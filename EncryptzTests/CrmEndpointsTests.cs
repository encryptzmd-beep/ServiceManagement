using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Crm;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class CrmEndpointsTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        [Fact]
        public void Controller_is_crm_module_and_authorized()
        {
            var type = typeof(CrmController);
            Assert.Equal("api/crm", type.GetCustomAttribute<RouteAttribute>()!.Template);
            Assert.Equal("CRM", type.GetCustomAttribute<AppModuleAttribute>()!.ModuleKey);
            Assert.NotNull(type.GetCustomAttribute<AuthorizeAttribute>());

            foreach (var action in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>());
                foreach (var parameter in action.GetParameters())
                    Assert.False(Regex.IsMatch(parameter.Name!, "user|company", RegexOptions.IgnoreCase), $"{action.Name} takes '{parameter.Name}'");
            }
        }

        [Theory]
        [InlineData("GET", "leads")]
        [InlineData("GET", "leads/{id:int}")]
        [InlineData("POST", "leads")]
        [InlineData("POST", "leads/{id:int}/status")]
        [InlineData("POST", "leads/{id:int}/reassign")]
        [InlineData("POST", "leads/{id:int}/follow-ups")]
        [InlineData("GET", "masters/{kind}")]
        [InlineData("POST", "masters/{kind}")]
        [InlineData("GET", "members")]
        [InlineData("POST", "members")]
        [InlineData("GET", "me")]
        [InlineData("POST", "quotations")]
        [InlineData("GET", "quotations/{id:int}")]
        [InlineData("POST", "quotations/{id:int}/revise")]
        [InlineData("POST", "quotations/{id:int}/status")]
        [InlineData("GET", "products")]
        [InlineData("GET", "dashboard")]
        [InlineData("GET", "reports/follow-ups")]
        [InlineData("GET", "reports/conversion")]
        [InlineData("GET", "leads/{id:int}/convert-preview")]
        [InlineData("POST", "leads/{id:int}/convert")]
        [InlineData("POST", "leads/{id:int}/link-order")]
        [InlineData("POST", "leads/{id:int}/cancel-convert")]
        public void Routes_are_as_planned(string verb, string template)
        {
            var found = typeof(CrmController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .SelectMany(m => m.GetCustomAttributes<HttpMethodAttribute>())
                .Any(a => a.Template == template && a.HttpMethods.Contains(verb));
            Assert.True(found, $"{verb} {template} is missing");
        }

        [Fact]
        public void Service_is_registered()
        {
            var registration = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "SrvInjection", "ServiceRegistration.cs"));
            Assert.Contains("services.AddScoped<ICrmService, CrmService>();", registration);
        }

        [Fact]
        public void Request_dtos_carry_no_ids_of_people()
        {
            foreach (var dto in new[] { typeof(LeadSaveDto), typeof(FollowUpSaveDto), typeof(QuotationSaveDto), typeof(ConvertRequestDto) })
                Assert.DoesNotContain(dto.GetProperties(), p => Regex.IsMatch(p.Name, "^(UserId|CompanyId)$"));
        }

        [Fact]
        public void Owner_lookup_does_not_filter_dbo_users_by_company()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Crm", "CrmService.Leads.cs"));
            Assert.Contains("SELECT MainUserId FROM dbo.Users WHERE UserId = @UserId\"", source);
            Assert.DoesNotContain("FROM dbo.Users WHERE UserId = @UserId AND CompanyId", source);
        }

        [Fact]
        public void Controller_takes_the_company_from_tenant_context()
        {
            Assert.NotNull(typeof(CrmController).GetConstructor(new[] { typeof(ICrmService), typeof(EncryptzBL.Common.Tenant.TenantContext) }));
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Controllers", "CrmController.cs"));
            Assert.Contains("_tenant.CompanyId", source);
            Assert.DoesNotContain("FindFirst(\"CompanyId\")", source);
        }

        [Fact]
        public void Sales_user_sees_only_own()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Crm", "CrmService.Leads.cs"));
            foreach (var proc in new[] { "crm.sp_Lead_List", "crm.sp_Lead_Get" })
            {
                var at = source.IndexOf("\"" + proc + "\"", StringComparison.Ordinal);
                Assert.True(at >= 0, proc + " is not called");
                var call = source.Substring(at, Math.Min(500, source.Length - at));
                Assert.Contains("@IsManager", call);
                Assert.Contains("@UserId", call);
            }
        }

        [Fact]
        public void Lead_list_passes_the_due_and_closed_filters()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Crm", "CrmService.Leads.cs"));
            var at = source.IndexOf("\"crm.sp_Lead_List\"", StringComparison.Ordinal);
            Assert.True(at >= 0);
            var call = source.Substring(at, source.IndexOf("});", at, StringComparison.Ordinal) - at);
            foreach (var p in new[] { "@Due", "@ClosedFrom", "@ClosedTo" })
                Assert.Contains(p, call);
            Assert.NotNull(typeof(LeadFilterDto).GetProperty("Due"));
            Assert.NotNull(typeof(LeadFilterDto).GetProperty("ClosedFrom"));
            Assert.NotNull(typeof(LeadFilterDto).GetProperty("ClosedTo"));
        }

        [Fact]
        public void Revise_supersedes_the_old()
        {
            var sql = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "14_CRM.sql"));
            var at = sql.IndexOf("CREATE OR ALTER PROCEDURE crm.sp_Quotation_Revise", StringComparison.Ordinal);
            Assert.True(at >= 0);
            var end = sql.IndexOf("\nGO", at, StringComparison.Ordinal);
            var body = sql.Substring(at, end - at);
            Assert.Contains("Status = 'Superseded'", body);
            Assert.Contains("RevisionNo + 1", body);
            Assert.Contains("'Draft'", body);
        }

        [Fact]
        public void Every_service_method_takes_the_user_and_whether_a_manager_first()
        {
            foreach (var method in typeof(ICrmService).GetMethods().Where(m => m.Name != "IsManager"))
            {
                Assert.Equal("userId", method.GetParameters()[0].Name);
                Assert.Equal("isManager", method.GetParameters()[1].Name);
            }
        }

        [Fact]
        public void Reports_call_their_procedures_for_the_callers_branch_and_refuse_other_groupings()
        {
            var source = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Crm", "CrmService.Reports.cs"));
            foreach (var proc in new[] { "crm.sp_Dashboard", "crm.sp_Report_FollowUps", "crm.sp_Report_Conversion" })
            {
                var at = source.IndexOf("\"" + proc + "\"", StringComparison.Ordinal);
                Assert.True(at >= 0, proc + " is not called");
                var call = source.Substring(at, Math.Min(400, source.Length - at));
                Assert.Contains("@IsManager", call);
                Assert.Contains("@UserId", call);
                Assert.Contains("@LocationId", call);
            }
            Assert.Contains("Choose source, owner or month", source);
        }
    }
}
