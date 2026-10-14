namespace EncryptzBL.DTO_s
{
    // ── Job Consultancy: candidates, clients and placements ──
    // No DTO carries a user id or a company id. A candidate is named by a random key.

    public class ConsultClientDto
    {
        public int ClientId { get; set; }
        public string Name { get; set; } = "";
        public string ContactPerson { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Email { get; set; } = "";
        public string City { get; set; } = "";
        public string Industry { get; set; } = "";
        public string Notes { get; set; } = "";
        public bool IsActive { get; set; } = true;
        /// <summary>Jobs for this client that are open or in review (read only).</summary>
        public int OpenJobs { get; set; }
        /// <summary>Placements at this client (read only).</summary>
        public int Placements { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>Which job of the company is for which client.</summary>
    public class PostingClientDto
    {
        public int PostingId { get; set; }
        public int ClientId { get; set; }
        public string ClientName { get; set; } = "";
    }

    public class SetPostingClientRequest
    {
        /// <summary>null or 0 = for no client.</summary>
        public int? ClientId { get; set; }
    }

    /// <summary>A person who chose "Employers can find me", as the search lists them.</summary>
    public class CandidateDto
    {
        public Guid CandidateKey { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string City { get; set; } = "";
        public int ExperienceYears { get; set; }
        public string Skills { get; set; } = "";
        public string PreferredJobs { get; set; } = "";
        public string WorkModes { get; set; } = "";
        public bool HasResume { get; set; }
        /// <summary>In this company's pool.</summary>
        public bool InPool { get; set; }
        /// <summary>The stage in the pool ('' when not in it).</summary>
        public string Stage { get; set; } = "";
    }

    public class CandidateSearchResultDto
    {
        public List<CandidateDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    /// <summary>One candidate opened: the pool row, what they look for, their profile as it is now.</summary>
    public class CandidatePageDto
    {
        public Guid CandidateKey { get; set; }
        public bool InPool { get; set; }
        public string Stage { get; set; } = "";
        public string Note { get; set; } = "";
        public List<string> PreferredJobs { get; set; } = new();
        public List<string> PreferredLocations { get; set; } = new();
        public List<string> WorkModes { get; set; } = new();
        public JobProfilePageDto Profile { get; set; } = new();
    }

    public class TalentSaveRequest
    {
        public string? Stage { get; set; }
        public string? Note { get; set; }
    }

    public class CandidateInviteRequest
    {
        public int PostingId { get; set; }
        public string? Message { get; set; }
    }

    public class PlacementDto
    {
        public int PlacementId { get; set; }
        public int? ClientId { get; set; }
        public string ClientName { get; set; } = "";
        public int? PostingId { get; set; }
        public string CandidateName { get; set; } = "";
        public string JobTitle { get; set; } = "";
        public DateTime JoinDate { get; set; }
        /// <summary>Per year, in rupees.</summary>
        public int? AnnualCtc { get; set; }
        public int? FeeAmount { get; set; }
        /// <summary>Pending, Invoiced or Paid.</summary>
        public string FeeStatus { get; set; } = "Pending";
        public DateTime? GuaranteeUntil { get; set; }
        public string Notes { get; set; } = "";
        /// <summary>The candidate has a Job Portal profile (read only).</summary>
        public bool OnJobPortal { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>A placement as it is saved: the candidate by key (pool), by application, or by name only.</summary>
    public class PlacementSaveRequest : PlacementDto
    {
        public Guid? CandidateKey { get; set; }
        public int? ApplicationId { get; set; }
    }

    public class PlacementListDto
    {
        public List<PlacementDto> Items { get; set; } = new();
        public int ThisMonth { get; set; }
        public int Total { get; set; }
        public long FeeOutstanding { get; set; }
        public long FeePaidThisYear { get; set; }
    }
}
