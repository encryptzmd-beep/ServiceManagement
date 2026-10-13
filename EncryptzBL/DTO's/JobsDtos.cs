namespace EncryptzBL.DTO_s
{
    // Job Portal (personal application). None of these carries a user id: the user is
    // always the one who is logged in.

    public class JobProfileDto
    {
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string Summary { get; set; } = "";
        public string City { get; set; } = "";
        public string ContactEmail { get; set; } = "";
        public string ContactPhone { get; set; } = "";
        public DateTime? DateOfBirth { get; set; }
        /// <summary>"Employers can find me". Changed only through the visibility endpoint.</summary>
        public bool IsVisible { get; set; }
    }

    public class JobExperienceDto
    {
        public int ExperienceId { get; set; }
        public string Organisation { get; set; } = "";
        public string Title { get; set; } = "";
        /// <summary>First day of the month.</summary>
        public DateTime StartMonth { get; set; }
        /// <summary>Null = works there now.</summary>
        public DateTime? EndMonth { get; set; }
        public string Description { get; set; } = "";
    }

    public class JobEducationDto
    {
        public int EducationId { get; set; }
        public string Institution { get; set; } = "";
        public string Course { get; set; } = "";
        public string FieldOfStudy { get; set; } = "";
        public int? StartYear { get; set; }
        public int? EndYear { get; set; }
    }

    public class JobSkillDto
    {
        public int SkillId { get; set; }
        public string SkillName { get; set; } = "";
        /// <summary>Beginner | Intermediate | Expert</summary>
        public string Level { get; set; } = "";
        /// <summary>https:// only ('' or null when none).</summary>
        public string? EvidenceUrl { get; set; }
    }

    public class JobCertificateDto
    {
        public int CertificateId { get; set; }
        public string Title { get; set; } = "";
        public string Issuer { get; set; } = "";
        public DateTime? IssuedOn { get; set; }
        /// <summary>'Uploaded' for now: the person supplied it and nobody checked it.</summary>
        public string Status { get; set; } = "Uploaded";
        public int FileId { get; set; }
        public string FileName { get; set; } = "";
        public int SizeBytes { get; set; }
    }

    public class JobFileInfoDto
    {
        public int FileId { get; set; }
        public string FileName { get; set; } = "";
        public int SizeBytes { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    /// <summary>Everything the Job Portal page shows. File content is never part of it.</summary>
    public class JobProfilePageDto
    {
        public JobProfileDto Profile { get; set; } = new();
        public List<JobExperienceDto> Experience { get; set; } = new();
        public List<JobEducationDto> Education { get; set; } = new();
        public List<JobSkillDto> Skills { get; set; } = new();
        public List<JobCertificateDto> Certificates { get; set; } = new();
        public JobFileInfoDto? Resume { get; set; }
        /// <summary>0 to 100.</summary>
        public int Completeness { get; set; }
    }

    public class SetJobVisibilityRequest
    {
        public bool IsVisible { get; set; }
    }

    /// <summary>A file as it is stored and as it is given back to its owner.</summary>
    public sealed record JobFileContent(string FileName, string ContentType, byte[] Content);
}
