using System.Data;
using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzAPI.Hubs;
using EncryptzBL.Infrastructure.Jobs;
using EncryptzBL.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>
    /// One place for the notifications of every application (MainDB script 24), sent at once
    /// over SignalR; Job Portal and Job Consultancy say whom to tell (PersonalDB script 12).
    /// </summary>
    public class NotificationsTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] parts) => File.ReadAllText(Path.Combine(new[] { Root() }.Concat(parts).ToArray()));

        private static readonly string Main = Read("EncryptzAPI", "Database", "MainDB", "24_Notifications.sql");
        private static readonly string Personal = Read("EncryptzAPI", "Database", "PersonalDB", "12_Jobs_Notify.sql");

        private static List<(string Name, string Body)> Procedures(string script, string schema)
            => Regex.Matches(script, @"CREATE OR ALTER PROCEDURE " + schema + @"\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        // ── MainDB 24 ─────────────────────────────────────────────────────────

        [Fact]
        public void The_main_script_needs_script_21_and_changes_nothing_that_exists()
        {
            Assert.Contains("COL_LENGTH('dbo.Modules', 'AppType') IS NULL", Main);
            Assert.Contains("OBJECT_ID('dbo.fn_ModuleUsers') IS NULL", Main);
            Assert.Contains("SET NOEXEC ON", Main);
            Assert.Contains("IF OBJECT_ID('dbo.Notifications') IS NULL", Main);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Main);
            Assert.DoesNotMatch(new Regex(@"\b(DROP|ALTER)\s+TABLE\b", RegexOptions.IgnoreCase), Main);
        }

        [Fact]
        public void What_a_person_reads_or_marks_is_always_their_own()
        {
            foreach (var (name, body) in Procedures(Main, "dbo").Where(p => p.Name is "sp_Notification_ListMine" or "sp_Notification_MarkRead"))
            {
                Assert.Equal("@UserId", Regex.Match(body, @"@\w+").Value);
                foreach (var statement in body.Split(';').Where(s => s.Contains("dbo.Notifications")))
                    Assert.True(statement.Contains("UserId = @UserId"), $"{name}: a statement does not name @UserId:\n{statement.Trim()}");
            }
        }

        [Fact]
        public void The_add_procedures_answer_with_the_new_rows()
        {
            var adds = Procedures(Main, "dbo").Where(p => p.Name.StartsWith("sp_Notification_Add")).ToList();

            Assert.Equal(3, adds.Count);
            foreach (var (name, body) in adds)
                Assert.True(body.Contains("OUTPUT inserted.NotificationId, inserted.UserId"), name);
        }

        // ── PersonalDB 12 ─────────────────────────────────────────────────────

        private static readonly string[] Notifying =
        {
            "sp_Admin_Certificate_Decide", "sp_Admin_Posting_Decide", "sp_Application_Apply", "sp_Application_Withdraw",
            "sp_Candidate_Invite", "sp_Certificate_Save", "sp_Company_Applicant_SetStatus", "sp_Company_Posting_Save",
            "sp_Company_Posting_SetStatus"
        };

        [Fact]
        public void The_personal_script_needs_scripts_09_and_11_and_writes_no_notification_itself()
        {
            Assert.Contains("OBJECT_ID('jobs.CandidateInvitations') IS NULL", Personal);
            Assert.Contains("COL_LENGTH('jobs.Postings', 'ReviewNote') IS NULL", Personal);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Personal);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), Personal);
            Assert.DoesNotContain("INSERT INTO jobs.Notifications", Personal);

            Assert.Equal(Notifying, Procedures(Personal, "jobs").Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));
            foreach (var (name, body) in Procedures(Personal, "jobs"))
                Assert.True(body.Contains("AS Audience"), $"{name} does not say whom to tell");
        }

        [Fact]
        public void A_company_procedure_takes_the_company_first_and_a_person_procedure_the_user()
        {
            foreach (var (name, body) in Procedures(Personal, "jobs").Where(p => !p.Name.StartsWith("sp_Admin_")))
                Assert.Equal(name.StartsWith("sp_Company_") || name.StartsWith("sp_Candidate_") ? "@CompanyId" : "@UserId",
                    Regex.Match(body, @"@\w+").Value);
        }

        [Fact]
        public void Every_company_statement_reaches_postings_and_applications_through_the_company()
        {
            foreach (var (name, body) in Procedures(Personal, "jobs").Where(p => p.Name.StartsWith("sp_Company_")))
                foreach (var statement in body.Split(';').Where(s => s.Contains("jobs.Postings") || s.Contains("jobs.Applications")))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
        }

        // ── the "whom to tell" set ────────────────────────────────────────────

        private static DataTable NotifySet(params object?[][] rows)
        {
            var dt = new DataTable();
            foreach (var column in new[] { "Audience", "UserId", "CompanyId", "App", "Kind", "Title", "Body", "Link" })
                dt.Columns.Add(column, column is "UserId" or "CompanyId" ? typeof(int) : typeof(string));
            foreach (var row in rows)
                dt.Rows.Add(row.Select(v => v ?? DBNull.Value).ToArray());
            return dt;
        }

        [Fact]
        public void The_set_is_read_into_targets_and_what_cannot_be_delivered_is_left_out()
        {
            var targets = NotificationRules.Targets(NotifySet(
                new object?[] { "User", 5, null, "JOBPORTAL", "Shortlisted", "You are shortlisted", "Co", "/apps/jobs/applications" },
                new object?[] { "Company", null, 7, "JOBCONSULTANCY", "NewApplicant", "A applied", "", "/consultancy/postings" },
                new object?[] { "PlatformAdmins", null, null, "PLATFORM", "ReviewWaiting", "Waits", "", "/settings/platform" },
                new object?[] { "User", 0, null, "JOBPORTAL", "Shortlisted", "nobody", "", "" },
                new object?[] { "Company", null, 0, "JOBCONSULTANCY", "NewApplicant", "no company", "", "" },
                new object?[] { "Everybody", 5, 7, "JOBPORTAL", "X", "unknown audience", "", "" },
                new object?[] { "User", 5, null, "JOBPORTAL", "X", "  ", "", "" }));

            Assert.Equal(3, targets.Count);
            Assert.Equal(("User", 5, 0), (targets[0].Audience, targets[0].UserId, targets[0].CompanyId));
            Assert.Equal(("Company", 0, 7), (targets[1].Audience, targets[1].UserId, targets[1].CompanyId));
            Assert.Equal("PlatformAdmins", targets[2].Audience);
            Assert.Equal("/consultancy/postings", targets[1].Link);
        }

        [Fact]
        public void No_set_or_a_set_of_another_shape_gives_no_target()
        {
            Assert.Empty(NotificationRules.Targets(null));

            var other = new DataTable();
            other.Columns.Add("Success", typeof(int));
            other.Rows.Add(1);
            Assert.Empty(NotificationRules.Targets(other));
        }

        [Theory]
        [InlineData("/apps/jobs/applications", "/apps/jobs/applications")]
        [InlineData("/apps/jobs/search?posting=4", "/apps/jobs/search?posting=4")]
        [InlineData("//evil.example/x", "")]
        [InlineData("/\\evil.example", "")]
        [InlineData("https://evil.example", "")]
        [InlineData("javascript:alert(1)", "")]
        [InlineData("", "")]
        [InlineData(null, "")]
        public void Only_a_page_of_the_application_is_a_link(string? link, string expected)
            => Assert.Equal(expected, NotificationRules.SafeLink(link));

        [Fact]
        public void A_person_listens_in_a_group_of_their_own()
        {
            Assert.Equal("user:42", NotificationRules.GroupOf(42));

            var person = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "42"), new Claim("PlatformAdmin", "false")
            }, "jwt"));
            var customer = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "42"), new Claim("CustomerId", "9"), new Claim(ClaimTypes.Role, "Customer")
            }, "jwt"));

            Assert.Equal("user:42", NotificationHub.GroupFor(person));
            Assert.Null(NotificationHub.GroupFor(customer));
            Assert.Null(NotificationHub.GroupFor(new ClaimsPrincipal(new ClaimsIdentity())));
        }

        // ── the service and the endpoints ─────────────────────────────────────

        private static NotificationService Service(RecordingPush push)
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                // never reached: every call below stops before the database
                ["ConnectionStrings:MainConnection"] = "Server=nowhere.invalid;Database=x;Connect Timeout=1"
            }).Build();
            return new NotificationService(new EncryptzBL.Common.MainDbHelper(config), push, NullLogger<NotificationService>.Instance);
        }

        private sealed class RecordingPush : INotificationPush
        {
            public List<(int UserId, NotificationDto Notification)> Sent { get; } = new();
            public Task PushAsync(int userId, NotificationDto notification) { Sent.Add((userId, notification)); return Task.CompletedTask; }
        }

        [Fact]
        public async Task Nothing_to_tell_touches_nothing_and_a_caller_without_a_login_is_refused()
        {
            var push = new RecordingPush();
            var service = Service(push);

            await service.SendAsync(new List<NotificationTarget>());
            Assert.Empty(push.Sent);

            Assert.Equal("Please log in again", (await service.ListMine(0)).Message);
            Assert.Equal("Please log in again", (await service.MarkRead(-3, null)).Message);
        }

        [Theory]
        [InlineData("GetMine", "GET", "")]
        [InlineData("MarkRead", "POST", "read")]
        public void The_notifications_have_their_endpoints(string action, string verb, string template)
        {
            var http = typeof(NotificationsController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template ?? "");
            Assert.DoesNotContain(typeof(NotificationDto).GetProperties(), p => p.Name.Contains("UserId", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void Job_Portal_has_no_notifications_of_its_own_any_more()
        {
            Assert.Null(typeof(IJobPostingsService).GetMethod("GetNotifications"));
            Assert.Null(typeof(IJobPostingsService).GetMethod("MarkNotificationsRead"));
            Assert.Null(typeof(JobPostingsController).GetMethod("GetNotifications"));
        }

        [Fact]
        public void Every_notifying_procedure_is_called_so_that_its_set_is_passed_on()
        {
            var source = string.Join("\n", Directory.GetFiles(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Jobs"), "JobsService*.cs")
                .Select(File.ReadAllText));

            foreach (var name in Notifying)
                Assert.Matches(new Regex(@"Told\(""jobs\." + name + @""""), source);
        }

        [Fact]
        public void The_hub_is_wired_with_the_token_of_the_query_string_for_the_hub_only()
        {
            var program = Read("EncryptzAPI", "Program.cs");
            var registration = Read("EncryptzAPI", "SrvInjection", "ServiceRegistration.cs");

            Assert.Contains("AddSignalR()", program);
            Assert.Contains("MapHub<NotificationHub>(NotificationHub.Path)", program);
            Assert.Contains("OnMessageReceived", program);
            Assert.Contains("StartsWithSegments(NotificationHub.Path)", program);
            Assert.Equal("/hubs/notifications", NotificationHub.Path);
            Assert.Contains("INotificationService, NotificationService", registration);
            Assert.Contains("INotificationPush, HubNotificationPush", registration);
        }
    }
}
