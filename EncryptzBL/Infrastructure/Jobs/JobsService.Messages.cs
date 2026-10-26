using System.Data;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>
    /// Messages between a person and a company (script PersonalDB/20). The person side takes the
    /// user first; the company side the user and the company, checked on every call (HiringAccess).
    /// A company never receives a user id.
    /// </summary>
    public interface IMessagesService
    {
        Task<ApiResponse<List<ConversationSummaryDto>>> GetPersonConversations(int userId);
        Task<ApiResponse<int>> GetPersonUnread(int userId);
        Task<ApiResponse<ConversationDto>> GetPersonConversation(int userId, int conversationId);
        /// <summary>The conversation with the company of a job (made when there is none); its id.</summary>
        Task<ApiResponse<int>> StartPersonConversation(int userId, int postingId);
        Task<ApiResponse<int>> SendPersonMessage(int userId, int conversationId, SendMessageRequest req);
        Task<ApiResponse<bool>> BlockConversation(int userId, int conversationId, bool blocked);

        Task<ApiResponse<List<ConversationSummaryDto>>> GetCompanyConversations(int userId, int companyId);
        Task<ApiResponse<int>> GetCompanyUnread(int userId, int companyId);
        Task<ApiResponse<ConversationDto>> GetCompanyConversation(int userId, int companyId, int conversationId);
        /// <summary>
        /// The conversation with a person the company may reach (made when there is none); its id. The person is
        /// named by the key, or by an application to one of the company's jobs.
        /// </summary>
        Task<ApiResponse<int>> StartCompanyConversation(int userId, int companyId, Guid? candidateKey, int? postingId, int? applicationId = null);
        Task<ApiResponse<int>> SendCompanyMessage(int userId, int companyId, int conversationId, SendMessageRequest req, string senderName);
    }

    public sealed partial class JobsService : IMessagesService
    {
        public const int MaxMessageLength = 2000;

        /// <summary>What is wrong with a message before it reaches the database (null when nothing).</summary>
        public static string? MessageProblem(SendMessageRequest? req)
        {
            if (req == null) return "Write a message";
            var body = (req.Body ?? "").Trim();
            if (body.Length > MaxMessageLength) return "A message can have at most 2000 characters";
            if (body.Length == 0 && (req.SharePostingId ?? 0) <= 0) return "Write a message";
            return null;
        }

        private static ConversationSummaryDto Summary(DataRow r) => new()
        {
            ConversationId = Convert.ToInt32(r["ConversationId"]),
            CompanyName = Text(r, "CompanyName"),
            CandidateKey = r.Table.Columns.Contains("CandidateKey") && r["CandidateKey"] is Guid key ? key : null,
            FullName = Text(r, "FullName"),
            Headline = Text(r, "Headline"),
            IsVerified = FlagOrFalse(r, "IsVerified"),
            PostingTitle = Text(r, "PostingTitle"),
            LastMessageAt = Convert.ToDateTime(r["LastMessageAt"]),
            LastBody = Text(r, "LastBody"),
            LastFromSide = Text(r, "LastFromSide"),
            LastIsJob = FlagOrFalse(r, "LastIsJob"),
            Unread = Convert.ToInt32(r["Unread"]),
            BlockedByPerson = Convert.ToBoolean(r["BlockedByPerson"])
        };

        /// <summary>The two sets of a thread procedure: the conversation (no row = not found), then its messages.</summary>
        private static ConversationDto? Conversation(DataSet? ds)
        {
            if (ds == null || ds.Tables.Count < 2 || ds.Tables[0].Rows.Count == 0)
                return null;

            var r = ds.Tables[0].Rows[0];
            return new ConversationDto
            {
                ConversationId = Convert.ToInt32(r["ConversationId"]),
                CompanyName = Text(r, "CompanyName"),
                CandidateKey = r.Table.Columns.Contains("CandidateKey") && r["CandidateKey"] is Guid key ? key : null,
                FullName = Text(r, "FullName"),
                Headline = Text(r, "Headline"),
                City = Text(r, "City"),
                IsVerified = FlagOrFalse(r, "IsVerified"),
                PostingId = Convert.ToInt32(r["PostingId"]),
                PostingTitle = Text(r, "PostingTitle"),
                BlockedByPerson = Convert.ToBoolean(r["BlockedByPerson"]),
                OtherReadAt = DateOrNull(r, "OtherReadAt"),
                Messages = ds.Tables[1].Rows.Cast<DataRow>().Select(m =>
                {
                    var shared = Convert.ToInt32(m["SharedPostingId"]);
                    return new MessageDto
                    {
                        MessageId = Convert.ToInt64(m["MessageId"]),
                        FromSide = Text(m, "FromSide"),
                        SenderName = Text(m, "SenderName"),
                        Body = Text(m, "Body"),
                        CreatedAt = Convert.ToDateTime(m["CreatedAt"]),
                        // a shared job that is gone (deleted, back to draft) leaves only its text
                        SharedPosting = shared > 0 && Text(m, "SharedTitle").Length > 0
                            ? new SharedPostingDto
                            {
                                PostingId = shared,
                                Title = Text(m, "SharedTitle"),
                                CompanyName = Text(m, "SharedCompany"),
                                City = Text(m, "SharedCity"),
                                IsOpen = Convert.ToBoolean(m["SharedIsOpen"])
                            }
                            : null
                    };
                }).ToList()
            };
        }

        private static int UnreadOf(DataTable? dt)
            => dt == null || dt.Rows.Count == 0 ? 0 : Convert.ToInt32(dt.Rows[0]["Unread"]);

        // ── the person ────────────────────────────────────────────────────────

        public Task<ApiResponse<List<ConversationSummaryDto>>> GetPersonConversations(int userId)
            => Guarded(userId, "reading the messages", async () =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Message_Person_List", new[] { In("@UserId", userId) });
                return ApiResponse<List<ConversationSummaryDto>>.Ok(dt == null ? new() : dt.Rows.Cast<DataRow>().Select(Summary).ToList());
            });

        public Task<ApiResponse<int>> GetPersonUnread(int userId)
            => Guarded(userId, "counting the unread messages", async () =>
                ApiResponse<int>.Ok(UnreadOf(await GetDataTableAsync("jobs.sp_Message_Person_Unread", new[] { In("@UserId", userId) }))));

        public Task<ApiResponse<ConversationDto>> GetPersonConversation(int userId, int conversationId)
            => Guarded(userId, "reading a conversation", async () =>
            {
                var conversation = Conversation(await GetDataSetAsync("jobs.sp_Message_Person_Thread", new[]
                {
                    In("@UserId", userId),
                    In("@ConversationId", conversationId)
                }));
                return conversation == null ? ApiResponse<ConversationDto>.Fail(NotFound) : ApiResponse<ConversationDto>.Ok(conversation);
            });

        public Task<ApiResponse<int>> StartPersonConversation(int userId, int postingId)
            => Guarded(userId, "starting a conversation", async () =>
                AsId(Answer(await GetDataTableAsync("jobs.sp_Message_Person_Start", new[]
                {
                    In("@UserId", userId),
                    In("@PostingId", postingId)
                }))));

        public Task<ApiResponse<int>> SendPersonMessage(int userId, int conversationId, SendMessageRequest req)
            => Guarded(userId, "sending a message", async () =>
            {
                var problem = MessageProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                return AsId(Answer(await Told("jobs.sp_Message_Person_Send", new[]
                {
                    In("@UserId", userId),
                    In("@ConversationId", conversationId),
                    In("@Body", (req.Body ?? "").Trim()),
                    In("@SharePostingId", req.SharePostingId)
                })));
            });

        public Task<ApiResponse<bool>> BlockConversation(int userId, int conversationId, bool blocked)
            => Guarded(userId, "blocking a company", async () =>
                AsFlag(Answer(await GetDataTableAsync("jobs.sp_Message_Person_Block", new[]
                {
                    In("@UserId", userId),
                    In("@ConversationId", conversationId),
                    In("@Blocked", blocked)
                }))));

        // ── the company ───────────────────────────────────────────────────────

        public Task<ApiResponse<List<ConversationSummaryDto>>> GetCompanyConversations(int userId, int companyId)
            => GuardedCompany(userId, companyId, "reading the company's messages", async _ =>
            {
                var dt = await GetDataTableAsync("jobs.sp_Message_Company_List", new[] { In("@CompanyId", companyId) });
                return ApiResponse<List<ConversationSummaryDto>>.Ok(dt == null ? new() : dt.Rows.Cast<DataRow>().Select(Summary).ToList());
            });

        public Task<ApiResponse<int>> GetCompanyUnread(int userId, int companyId)
            => GuardedCompany(userId, companyId, "counting the company's unread messages", async _ =>
                ApiResponse<int>.Ok(UnreadOf(await GetDataTableAsync("jobs.sp_Message_Company_Unread", new[] { In("@CompanyId", companyId) }))));

        public Task<ApiResponse<ConversationDto>> GetCompanyConversation(int userId, int companyId, int conversationId)
            => GuardedCompany(userId, companyId, "reading a conversation of the company", async _ =>
            {
                var conversation = Conversation(await GetDataSetAsync("jobs.sp_Message_Company_Thread", new[]
                {
                    In("@CompanyId", companyId),
                    In("@ConversationId", conversationId)
                }));
                return conversation == null ? ApiResponse<ConversationDto>.Fail(NotFound) : ApiResponse<ConversationDto>.Ok(conversation);
            });

        public Task<ApiResponse<int>> StartCompanyConversation(int userId, int companyId, Guid? candidateKey, int? postingId, int? applicationId = null)
            => GuardedCompany(userId, companyId, "starting a conversation of the company", async companyName =>
            {
                var byKey = candidateKey.HasValue && candidateKey.Value != Guid.Empty;
                if (!byKey && (applicationId ?? 0) <= 0)
                    return ApiResponse<int>.Fail(NotFound);

                return AsId(Answer(await GetDataTableAsync("jobs.sp_Message_Company_Start", new[]
                {
                    In("@CompanyId", companyId),
                    In("@CompanyName", companyName),
                    Key("@CandidateKey", byKey ? candidateKey : null),
                    In("@PostingId", postingId),
                    In("@ApplicationId", byKey ? null : applicationId)
                })));
            });

        public Task<ApiResponse<int>> SendCompanyMessage(int userId, int companyId, int conversationId, SendMessageRequest req, string senderName)
            => GuardedCompany(userId, companyId, "sending a message of the company", async _ =>
            {
                var problem = MessageProblem(req);
                if (problem != null)
                    return ApiResponse<int>.Fail(problem);

                var name = (senderName ?? "").Trim();
                if (name.Length > 200) name = name.Substring(0, 200);

                return AsId(Answer(await Told("jobs.sp_Message_Company_Send", new[]
                {
                    In("@CompanyId", companyId),
                    In("@SenderName", name),
                    In("@ConversationId", conversationId),
                    In("@Body", (req.Body ?? "").Trim()),
                    In("@SharePostingId", req.SharePostingId)
                })));
            });
    }
}
