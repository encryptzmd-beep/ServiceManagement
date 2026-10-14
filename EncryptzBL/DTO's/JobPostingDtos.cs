namespace EncryptzBL.DTO_s
{
    // ── Job Portal, phase 2: job postings and applications ──
    // No DTO carries a user id or a company id: the API takes both from the login.

    /// <summary>A job as a company writes it.</summary>
    public class JobPostingDto
    {
        public int PostingId { get; set; }
        public string Title { get; set; } = "";
        public string City { get; set; } = "";
        /// <summary>Full-time, Part-time, Contract or Internship.</summary>
        public string EmploymentType { get; set; } = "";
        /// <summary>On-site, Remote or Hybrid.</summary>
        public string WorkMode { get; set; } = "";
        public int? ExperienceMinYears { get; set; }
        public int? ExperienceMaxYears { get; set; }
        /// <summary>Per month, in rupees.</summary>
        public int? SalaryMin { get; set; }
        public int? SalaryMax { get; set; }
        public string Skills { get; set; } = "";
        public string Description { get; set; } = "";
        public DateTime? ClosesOn { get; set; }
    }

    /// <summary>A job of the company with its state and how many applied.</summary>
    public class CompanyPostingDto : JobPostingDto
    {
        /// <summary>Draft, InReview (the platform administrator checks it), Open or Closed.</summary>
        public string Status { get; set; } = "";
        /// <summary>Why the platform administrator returned the job ('' when not returned).</summary>
        public string ReviewNote { get; set; } = "";
        public DateTime? PublishedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public int Applied { get; set; }
        public int Shortlisted { get; set; }
        public int Rejected { get; set; }
        public int Hired { get; set; }
    }

    /// <summary>A job as a person sees it. The description is filled only when one job is opened.</summary>
    public class JobPostingViewDto
    {
        public int PostingId { get; set; }
        public string Title { get; set; } = "";
        public string CompanyName { get; set; } = "";
        public string City { get; set; } = "";
        public string EmploymentType { get; set; } = "";
        public string WorkMode { get; set; } = "";
        public int? ExperienceMinYears { get; set; }
        public int? ExperienceMaxYears { get; set; }
        public int? SalaryMin { get; set; }
        public int? SalaryMax { get; set; }
        public string Skills { get; set; } = "";
        public string Description { get; set; } = "";
        public DateTime? PublishedAt { get; set; }
        public DateTime? ClosesOn { get; set; }
        public bool IsSaved { get; set; }
        /// <summary>The state of this person's application ('' when they did not apply).</summary>
        public string MyStatus { get; set; } = "";
        /// <summary>It still takes applications.</summary>
        public bool IsOpen { get; set; }
        /// <summary>How well it fits the person's preferences: job 3, location 2, working mode 1 (0 = not at all).</summary>
        public int MatchScore { get; set; }
    }

    /// <summary>A company looked at the person's profile or resume for one of its jobs.</summary>
    public class JobProfileViewDto
    {
        public string CompanyName { get; set; } = "";
        public string PostingTitle { get; set; } = "";
        public int ProfileViews { get; set; }
        public int ResumeViews { get; set; }
        public DateTime LastViewedAt { get; set; }
    }

    public class JobPostingSearchResultDto
    {
        public List<JobPostingViewDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    /// <summary>One application of the person.</summary>
    public class JobApplicationDto
    {
        public int ApplicationId { get; set; }
        public int PostingId { get; set; }
        public string Title { get; set; } = "";
        public string CompanyName { get; set; } = "";
        public string City { get; set; } = "";
        public string EmploymentType { get; set; } = "";
        public string WorkMode { get; set; } = "";
        /// <summary>Applied, Shortlisted, Rejected, Hired or Withdrawn.</summary>
        public string Status { get; set; } = "";
        public string Note { get; set; } = "";
        public DateTime AppliedAt { get; set; }
        public DateTime StatusAt { get; set; }
        public bool IsOpen { get; set; }
    }

    public class JobApplyRequest
    {
        public string? Note { get; set; }
    }

    /// <summary>An applicant as the company's list shows them.</summary>
    public class JobApplicantDto
    {
        public int ApplicationId { get; set; }
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string City { get; set; } = "";
        public string Status { get; set; } = "";
        public string Note { get; set; } = "";
        public DateTime AppliedAt { get; set; }
        public DateTime StatusAt { get; set; }
        public bool HasResume { get; set; }
    }

    /// <summary>One applicant opened by the company: the application and the person's profile as it is now.</summary>
    public class JobApplicantPageDto
    {
        public int ApplicationId { get; set; }
        public string PostingTitle { get; set; } = "";
        public string Status { get; set; } = "";
        public string Note { get; set; } = "";
        public DateTime AppliedAt { get; set; }
        public JobProfilePageDto Profile { get; set; } = new();
    }

    // ── verification by the platform administrator ──

    /// <summary>A certificate with a file that waits to be checked.</summary>
    public class CertificateReviewDto
    {
        public int CertificateId { get; set; }
        public string Title { get; set; } = "";
        public string Issuer { get; set; } = "";
        public DateTime? IssuedOn { get; set; }
        public string FileName { get; set; } = "";
        public DateTime SubmittedAt { get; set; }
        public string PersonName { get; set; } = "";
        public string PersonHeadline { get; set; } = "";
    }

    /// <summary>A job a company wants to publish (or changed), waiting to be checked.</summary>
    public class PostingReviewDto : JobPostingDto
    {
        public string CompanyName { get; set; } = "";
        public DateTime SubmittedAt { get; set; }
        /// <summary>It was public before: this is a change of a job people already saw.</summary>
        public bool WasPublished { get; set; }
    }

    public class VerificationQueueDto
    {
        public List<CertificateReviewDto> Certificates { get; set; } = new();
        public List<PostingReviewDto> Postings { get; set; } = new();
    }

    public class VerificationDecisionRequest
    {
        public bool Approve { get; set; }
        /// <summary>Needed when it is not approved: the person or the company reads it.</summary>
        public string? Note { get; set; }
    }

    public class SetJobStatusRequest
    {
        public string? Status { get; set; }
    }
}
