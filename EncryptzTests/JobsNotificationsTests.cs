using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Notifications of the person (script 08), and Job Portal answering only while it is released.</summary>
    public class JobsNotificationsTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "08_Jobs_Notifications.sql"));
        }

        private static List<(string Name, string Body)> Procedures()
            => Regex.Matches(Script, @"CREATE OR ALTER PROCEDURE jobs\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        [Fact]
        public void The_script_needs_script_06_and_the_personal_database()
        {
            Assert.Contains("OBJECT_ID('jobs.Applications') IS NULL", Script);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.Contains("SET NOEXEC ON", Script);
            Assert.Contains("CREATE TABLE jobs.Notifications", Script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Script);
        }

        [Fact]
        public void A_company_procedure_takes_the_company_first_and_a_person_procedure_the_user()
        {
            Assert.Equal(new[] { "sp_Company_Applicant_SetStatus", "sp_Company_Posting_SetStatus", "sp_Notification_ListMine", "sp_Notification_MarkRead" },
                Procedures().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));

            foreach (var (name, body) in Procedures())
                Assert.Equal(name.StartsWith("sp_Company_") ? "@CompanyId" : "@UserId", Regex.Match(body, @"@\w+").Value);
        }

        [Fact]
        public void Every_company_statement_reaches_postings_and_applications_through_the_company()
        {
            foreach (var (name, body) in Procedures().Where(p => p.Name.StartsWith("sp_Company_")))
                foreach (var statement in body.Split(';').Where(s => s.Contains("jobs.Postings") || s.Contains("jobs.Applications")))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
        }

        [Fact]
        public void Every_person_statement_on_the_notifications_names_the_user()
        {
            foreach (var (name, body) in Procedures().Where(p => !p.Name.StartsWith("sp_Company_")))
                foreach (var statement in body.Split(';').Where(s => s.Contains("jobs.Notifications")))
                    Assert.True(statement.Contains("@UserId"), $"{name}: a statement does not name @UserId:\n{statement.Trim()}");
        }

        [Fact]
        public void A_withdrawn_applicant_is_not_reached_and_a_notification_never_names_who_did_it()
        {
            var setStatus = Procedures().Single(p => p.Name == "sp_Company_Applicant_SetStatus").Body;
            foreach (var statement in setStatus.Split(';').Where(s => s.Contains("jobs.Applications")))
                Assert.Contains("a.Status <> 'Withdrawn'", statement);

            Assert.DoesNotContain("ViewerUserId", Script);
            Assert.DoesNotContain("PostedBy", Script);
        }

        // ── Job Portal answers only while it is released ──────────────────────

        private static PersonalAppDto App(string key, bool released) => new() { ModuleKey = key, IsReleased = released };

        [Fact]
        public void Job_Portal_is_open_while_it_is_released()
        {
            Assert.True(JobsRules.PortalOpen(new[] { App("EXPENSE", false), App("JOBPORTAL", true) }));
            Assert.False(JobsRules.PortalOpen(new[] { App("JOBPORTAL", false) }));
            Assert.False(JobsRules.PortalOpen(new[] { App("EXPENSE", true) }));   // switched off (inactive) or removed
        }

        [Fact]
        public void A_main_database_that_lists_no_personal_application_does_not_close_it()
        {
            // before script 21 the list is empty: Job Portal was usable before releases existed
            Assert.True(JobsRules.PortalOpen(new List<PersonalAppDto>()));
            Assert.True(JobsRules.PortalOpen(null));
        }

        [Fact]
        public async Task Without_a_personal_database_the_notifications_are_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetNotifications(11)).Message);
            Assert.Equal("Please log in again", (await jobs.MarkNotificationsRead(0, null)).Message);
        }

        [Theory]
        [InlineData("GetNotifications", "GET", "notifications")]
        [InlineData("MarkNotificationsRead", "POST", "notifications/read")]
        public void The_notifications_have_their_endpoints(string action, string verb, string template)
        {
            var http = typeof(JobPostingsController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.DoesNotContain(typeof(JobNotificationDto).GetProperties(), p => p.Name.Contains("UserId", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void The_person_side_checks_the_release_the_company_side_does_not()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            var service = File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzBL", "Infrastructure", "Jobs", "JobsService.cs"));
            var company = File.ReadAllText(Path.Combine(folder.FullName, "EncryptzBL", "Infrastructure", "Jobs", "JobsService.Company.cs"));

            Assert.Contains("JobsRules.PortalOpen(", service);
            Assert.Contains("personal: false", company);
        }
    }
}
