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
        /// <summary>Where the years come from (script 23): Entries (the experience entered), Headline (the years written there) or None.</summary>
        public string ExperienceSource { get; set; } = "";
        public string Skills { get; set; } = "";
        public string PreferredJobs { get; set; } = "";
        public string WorkModes { get; set; } = "";
        public bool HasResume { get; set; }
        /// <summary>The platform administrator verified the person.</summary>
        public bool IsVerified { get; set; }
        /// <summary>How well the words matched (0 without words).</summary>
        public int MatchScore { get; set; }
        /// <summary>In this company's pool.</summary>
        public bool InPool { get; set; }
        /// <summary>The stage in the pool ('' when not in it).</summary>
        public string Stage { get; set; } = "";
    }

    /// <summary>
    /// What the company searches candidates by (script PersonalDB/21). The words are looked for in the
    /// name, headline, skills, experience, education and preferences; every list filter takes any of
    /// its values. The query names of the first search (q, city, years, mode, pool, page) still work.
    /// </summary>
    public class CandidateSearchRequest
    {
        public string? Q { get; set; }
        /// <summary>true (the default): every word must be found; false: any word.</summary>
        public bool MatchAll { get; set; } = true;
        public List<string>? Cities { get; set; }
        /// <summary>Years of experience: none (not added), 0-1, 1-3, 3-5, 5-10, 10+.</summary>
        public List<string>? Bands { get; set; }
        public List<string>? Modes { get; set; }
        public List<string>? Skills { get; set; }
        /// <summary>true: every skill ticked; false (the default): any of them.</summary>
        public bool SkillsAll { get; set; }
        public bool VerifiedOnly { get; set; }
        public bool WithResume { get; set; }
        /// <summary>Only the pool of the company.</summary>
        public bool Pool { get; set; }
        public int? Page { get; set; }

        // the search of before script 21
        public string? City { get; set; }
        public int? Years { get; set; }
        public string? Mode { get; set; }
    }

    /// <summary>A choice of a filter and how many of the people the words found have it.</summary>
    public class CandidateFacetDto
    {
        /// <summary>City, Skill, Mode or Band.</summary>
        public string Kind { get; set; } = "";
        public string Value { get; set; } = "";
        public int People { get; set; }
    }

    public class CandidateSearchResultDto
    {
        public List<CandidateDto> Items { get; set; } = new();
        /// <summary>The choices of the filters (script 21; empty before it).</summary>
        public List<CandidateFacetDto> Facets { get; set; } = new();
        /// <summary>
        /// The candidates the company added itself that match the search (ProjectDB/13), best first: only this
        /// company ever sees them. Empty in the pool, with "verified only" or a work mode (they have neither).
        /// </summary>
        public List<OwnCandidateDto> OwnItems { get; set; } = new();
        public int OwnTotal { get; set; }
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

    /// <summary>A person who fits one job of the company (script PersonalDB/24), and why.</summary>
    public class CandidateMatchDto
    {
        public Guid CandidateKey { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string City { get; set; } = "";
        public int ExperienceYears { get; set; }
        /// <summary>Entries, Headline or None (as the candidate search).</summary>
        public string ExperienceSource { get; set; } = "";
        public bool IsVerified { get; set; }
        public bool HasResume { get; set; }
        /// <summary>The skills of the job the person has, and how many the job names.</summary>
        public string MatchedSkills { get; set; } = "";
        public int SkillHits { get; set; }
        public int SkillsWanted { get; set; }
        /// <summary>How many words of the title are in the headline, a past job title or a job the person looks for.</summary>
        public int TitleHits { get; set; }
        public bool CityMatch { get; set; }
        public bool ModeMatch { get; set; }
        /// <summary>1 in the range of the job, 0 out of it, -1 not known (no range, or no experience).</summary>
        public int ExperienceFit { get; set; }
        /// <summary>Invited to this job already.</summary>
        public bool AlreadyInvited { get; set; }
        public int MatchScore { get; set; }
    }

    public class PostingMatchCountDto
    {
        public int PostingId { get; set; }
        public int Suitable { get; set; }
    }

    /// <summary>
    /// A candidate the company added itself (ProjectDB/12): not on Job Portal, only the company sees
    /// them. An e-mail or a phone is needed; no two of a company share either.
    /// </summary>
    public class OwnCandidateDto
    {
        public int CandidateId { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public string City { get; set; } = "";
        public decimal? ExperienceYears { get; set; }
        /// <summary>Comma separated.</summary>
        public string Skills { get; set; } = "";
        public string PreferredJobs { get; set; } = "";
        /// <summary>Where the company met them: Walk-in, Referral, Job board, Social media, E-mail, Other.</summary>
        public string Source { get; set; } = "";
        /// <summary>New, Contacted, Interview, Placed or NotSuitable (as the pool).</summary>
        public string Stage { get; set; } = "New";
        public string Notes { get; set; } = "";
        public bool HasResume { get; set; }
        public string ResumeName { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        /// <summary>How well the words of a search matched (0 outside a search).</summary>
        public int MatchScore { get; set; }
    }

    public class OwnCandidateListDto
    {
        public List<OwnCandidateDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    /// <summary>A candidate of the company with the same e-mail or phone as the one being saved.</summary>
    public class OwnCandidateDuplicateDto
    {
        public int CandidateId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        /// <summary>Email or Phone.</summary>
        public string SameAs { get; set; } = "";
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
