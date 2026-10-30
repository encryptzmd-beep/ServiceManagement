namespace EncryptzBL.DTO_s
{
    public class WalletBalanceDto
    {
        public int Balance { get; set; }
    }

    public class WalletEntryDto
    {
        public long EntryId { get; set; }
        public int Amount { get; set; }
        public string Kind { get; set; } = "";
        public string Note { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public int TotalCount { get; set; }
    }

    public class WalletLedgerDto
    {
        public int Balance { get; set; }
        public int TotalCount { get; set; }
        public List<WalletEntryDto> Entries { get; set; } = new();
    }

    public class ReferralDto
    {
        public int ReferralId { get; set; }
        public string Email { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime SentAt { get; set; }
        public DateTime? JoinedAt { get; set; }
        public DateTime? CreditedAt { get; set; }
        public string FriendName { get; set; } = "";
    }

    public class InviteFriendRequest
    {
        public string? Email { get; set; }
    }

    public class InviteResultDto
    {
        public string Result { get; set; } = "";
        public bool MailSent { get; set; }
    }

    /// <summary>The person's own invite link: anyone who signs up with it is their friend.</summary>
    public class InviteLinkDto
    {
        public string Key { get; set; } = "";
        public string Url { get; set; } = "";
    }

    public class WalletOfferDto
    {
        public int ReferralCredits { get; set; }
    }
}
