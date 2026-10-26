namespace EncryptzBL.DTO_s
{
    // Messages between a person (Job Portal) and a company (Job Consultancy), script PersonalDB/20.
    // A company never receives a user id: the person is named by CandidateKey.

    /// <summary>A job shared in a message; filled while the job is still published.</summary>
    public class SharedPostingDto
    {
        public int PostingId { get; set; }
        public string Title { get; set; } = "";
        public string CompanyName { get; set; } = "";
        public string City { get; set; } = "";
        public bool IsOpen { get; set; }
    }

    public class MessageDto
    {
        public long MessageId { get; set; }
        /// <summary>Person or Company.</summary>
        public string FromSide { get; set; } = "";
        public string SenderName { get; set; } = "";
        public string Body { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public SharedPostingDto? SharedPosting { get; set; }
    }

    /// <summary>A conversation in the list: the other side, the last message and how many are unread.</summary>
    public class ConversationSummaryDto
    {
        public int ConversationId { get; set; }
        /// <summary>The person's list: the company.</summary>
        public string CompanyName { get; set; } = "";
        /// <summary>The company's list: the person.</summary>
        public Guid? CandidateKey { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public bool IsVerified { get; set; }
        /// <summary>The job it began about ('' when none).</summary>
        public string PostingTitle { get; set; } = "";
        public DateTime LastMessageAt { get; set; }
        public string LastBody { get; set; } = "";
        public string LastFromSide { get; set; } = "";
        /// <summary>The last message is a shared job without text.</summary>
        public bool LastIsJob { get; set; }
        public int Unread { get; set; }
        public bool BlockedByPerson { get; set; }
    }

    /// <summary>One conversation opened: the other side and the newest 200 messages, oldest first.</summary>
    public class ConversationDto
    {
        public int ConversationId { get; set; }
        public string CompanyName { get; set; } = "";
        public Guid? CandidateKey { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string City { get; set; } = "";
        public bool IsVerified { get; set; }
        public int PostingId { get; set; }
        public string PostingTitle { get; set; } = "";
        public bool BlockedByPerson { get; set; }
        /// <summary>When the other side last read it (for "Seen"); null when never.</summary>
        public DateTime? OtherReadAt { get; set; }
        public List<MessageDto> Messages { get; set; } = new();
    }

    public class SendMessageRequest
    {
        public string? Body { get; set; }
        /// <summary>An open job to share with the message (optional).</summary>
        public int? SharePostingId { get; set; }
    }

    public class StartPersonConversationRequest
    {
        public int PostingId { get; set; }
    }

    public class StartCompanyConversationRequest
    {
        /// <summary>The person, or (from the hiring page) an application to one of the company's jobs.</summary>
        public Guid? CandidateKey { get; set; }
        public int? ApplicationId { get; set; }
        /// <summary>One of the company's jobs it is about (optional).</summary>
        public int? PostingId { get; set; }
    }

    public class BlockConversationRequest
    {
        public bool Blocked { get; set; }
    }
}
