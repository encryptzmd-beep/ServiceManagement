using System.Reflection;
using System.Text.RegularExpressions;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Messages between a person and a company (script PersonalDB/20).</summary>
    public class JobsMessagesTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "20_Jobs_Messages.sql"));
        }

        private static string Body(string procedure)
            => Regex.Match(Script, $@"CREATE OR ALTER PROCEDURE jobs\.{procedure}\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        [Fact]
        public void The_script_runs_only_in_the_personal_database_and_drops_nothing()
        {
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", Script);
            Assert.DoesNotContain("DROP ", Script);
            Assert.Contains("UQ_jobs_Conversations_Company_User", Script);
        }

        [Theory]
        [InlineData("sp_Message_Person_List")]
        [InlineData("sp_Message_Person_Unread")]
        [InlineData("sp_Message_Person_Thread")]
        [InlineData("sp_Message_Person_Send")]
        [InlineData("sp_Message_Person_Block")]
        public void Every_person_procedure_takes_the_user_first_and_names_it_on_every_conversation(string procedure)
        {
            var body = Body(procedure);
            Assert.StartsWith("@UserId", body.Trim());
            foreach (Match m in Regex.Matches(body, @"(FROM|UPDATE) jobs\.Conversations[^;]*?(;|\n\s*\n)", RegexOptions.Singleline))
                Assert.Contains("UserId = @UserId", m.Value);
        }

        [Theory]
        [InlineData("sp_Message_Company_List")]
        [InlineData("sp_Message_Company_Unread")]
        [InlineData("sp_Message_Company_Thread")]
        [InlineData("sp_Message_Company_Send")]
        public void Every_company_procedure_takes_the_company_first_and_never_answers_a_user_id(string procedure)
        {
            var body = Body(procedure);
            Assert.StartsWith("@CompanyId", body.Trim());
            Assert.Contains("CompanyId = @CompanyId", body);
            // the "whom to tell" set of Send names the person for the API only (it never leaves it)
            if (procedure != "sp_Message_Company_Send")
                foreach (Match columns in Regex.Matches(body, @"SELECT\b(.*?)\bFROM\b", RegexOptions.Singleline))
                    Assert.DoesNotContain("UserId", columns.Groups[1].Value);
        }

        [Fact]
        public void A_company_reaches_only_a_findable_person_or_its_own_applicant()
        {
            var start = Body("sp_Message_Company_Start");

            Assert.Contains("pr.IsVisible = 1", start);
            Assert.Contains("p.CompanyId = @CompanyId AND a.Status <> 'Withdrawn'", start);
            Assert.Contains("pr.CandidateKey = @CandidateKey", start);
            // by an application: only one to the company's own job
            Assert.Contains("p.PostingId = a.PostingId AND p.CompanyId = @CompanyId", start);
        }

        [Fact]
        public void A_person_writes_about_an_open_job_or_one_they_applied_to_and_needs_a_name()
        {
            var start = Body("sp_Message_Person_Start");

            Assert.Contains("p.Status = 'Open'", start);
            Assert.Contains("a.UserId = @UserId", start);
            Assert.Contains("FullName <> ''", start);
        }

        [Fact]
        public void A_blocked_company_cannot_write_and_the_person_writing_again_ends_the_block()
        {
            Assert.Contains("IF @Blocked = 1", Body("sp_Message_Company_Send"));
            Assert.Contains("BlockedByPerson = 0", Body("sp_Message_Person_Send"));
        }

        [Fact]
        public void There_are_limits_against_spam()
        {
            Assert.Contains(">= 20", Body("sp_Message_Person_Start"));
            Assert.Contains(">= 60", Body("sp_Message_Person_Send"));
            Assert.Contains(">= 200", Body("sp_Message_Company_Start"));
            Assert.Contains(">= 300", Body("sp_Message_Company_Send"));
        }

        [Fact]
        public void Only_an_open_job_can_be_shared_and_the_other_side_is_told()
        {
            foreach (var send in new[] { "sp_Message_Person_Send", "sp_Message_Company_Send" })
            {
                var body = Body(send);
                Assert.Contains("Only an open job can be shared", body);
                Assert.Contains("'Message' AS Kind", body);
            }
            Assert.Contains("'Company' AS Audience", Body("sp_Message_Person_Send"));
            Assert.Contains("'User' AS Audience", Body("sp_Message_Company_Send"));
        }

        [Theory]
        [InlineData(null, null, "Write a message")]
        [InlineData("   ", null, "Write a message")]
        [InlineData("", 7, null)]
        [InlineData("Hello", null, null)]
        public void A_message_needs_text_or_a_job(string? body, int? job, string? problem)
            => Assert.Equal(problem, JobsService.MessageProblem(new SendMessageRequest { Body = body, SharePostingId = job }));

        [Fact]
        public void A_message_has_at_most_2000_characters()
            => Assert.Equal("A message can have at most 2000 characters", JobsService.MessageProblem(new SendMessageRequest { Body = new string('a', 2001) }));

        [Fact]
        public async Task Without_a_login_or_a_personal_database_nothing_is_read()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal("Please log in again", (await jobs.GetPersonConversations(0)).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.GetPersonUnread(5)).Message);
            Assert.Equal("Please log in again", (await jobs.SendCompanyMessage(0, 2, 1, new SendMessageRequest { Body = "Hi" }, "A")).Message);
        }

        [Theory]
        [InlineData("GetMine", "GET", "me")]
        [InlineData("GetMyUnread", "GET", "me/unread")]
        [InlineData("GetMyConversation", "GET", "me/{id:int}")]
        [InlineData("StartMine", "POST", "me/start")]
        [InlineData("SendMine", "POST", "me/{id:int}")]
        [InlineData("Block", "POST", "me/{id:int}/block")]
        [InlineData("GetCompany", "GET", "company")]
        [InlineData("GetCompanyUnread", "GET", "company/unread")]
        [InlineData("GetCompanyConversation", "GET", "company/{id:int}")]
        [InlineData("StartCompany", "POST", "company/start")]
        [InlineData("SendCompany", "POST", "company/{id:int}")]
        public void The_endpoints_exist_behind_a_login(string action, string verb, string template)
        {
            var http = typeof(MessagesController).GetMethod(action)!.GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.NotNull(typeof(MessagesController).GetCustomAttribute<AuthorizeAttribute>());
        }
    }
}
