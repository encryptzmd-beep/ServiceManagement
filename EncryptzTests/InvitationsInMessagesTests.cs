using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>An invitation to apply is also a message from the company (script PersonalDB/25).</summary>
    public class InvitationsInMessagesTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "25_Jobs_Invitations_In_Messages.sql"));
        }

        private static string Invite
            => Regex.Match(Script, @"CREATE OR ALTER PROCEDURE jobs\.sp_Candidate_Invite\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        [Fact]
        public void The_rules_of_an_invitation_stay_as_they_were()
        {
            Assert.Contains("pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1", Invite);
            Assert.Contains("p.CompanyId = @CompanyId AND p.Status = 'Open'", Invite);
            Assert.Contains("This candidate has already applied to the job", Invite);
            Assert.Contains("This candidate was already invited to the job", Invite);
        }

        [Fact]
        public void The_invitation_is_a_message_with_the_job_in_the_one_conversation_of_the_company_and_the_person()
        {
            Assert.Contains("FROM jobs.Conversations WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND UserId = @Person", Invite);
            Assert.Contains("INSERT INTO jobs.Messages (ConversationId, FromSide, SenderName, Body, PostingId)", Invite);
            Assert.Contains("VALUES (@Conversation, 'Company', @Company,", Invite);
            // the invitation and its message are one change: both or neither
            Assert.True(Invite.IndexOf("BEGIN TRANSACTION", StringComparison.Ordinal) < Invite.IndexOf("INSERT INTO jobs.Messages", StringComparison.Ordinal));
            Assert.True(Invite.IndexOf("INSERT INTO jobs.Messages", StringComparison.Ordinal) < Invite.IndexOf("COMMIT TRANSACTION", StringComparison.Ordinal));
        }

        [Fact]
        public void The_person_is_told_and_the_notification_opens_the_conversation()
        {
            Assert.Contains("'User' AS Audience", Invite);
            Assert.Contains("'Invitation' AS Kind", Invite);
            Assert.Contains("'/apps/jobs/messages?c=' + CAST(@Conversation AS NVARCHAR(12)) AS Link", Invite);
        }

        [Fact]
        public void Earlier_invitations_are_put_into_messages_once()
        {
            var backfill = Script.Substring(Script.IndexOf("The invitations sent before this script, into Messages once", StringComparison.Ordinal));

            Assert.Contains("WHERE NOT EXISTS (SELECT 1 FROM jobs.Conversations c WHERE c.CompanyId = i.CompanyId AND c.UserId = i.UserId)", backfill);
            Assert.Contains("AND m.PostingId = i.PostingId AND m.CreatedAt = i.InvitedAt", backfill);
        }
    }
}
