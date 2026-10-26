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
        /// <summary>The platform administrator verified the person (script 16). Read only: saving the profile ignores it.</summary>
        public bool IsVerified { get; set; }
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
        /// <summary>
        /// 1 to 5. With sub-skills it is their average, rounded, and the API sets it; without
        /// them the person rates the skill.
        /// </summary>
        public int Rating { get; set; }
        /// <summary>What is shown: the average of the sub-skills to one decimal (3.7), or the rating.</summary>
        public double Overall { get; set; }
        /// <summary>Beginner | Intermediate | Expert: follows the rating, never typed (1-2, 3-4, 5).</summary>
        public string Level { get; set; } = "";
        /// <summary>https:// only ('' or null when none).</summary>
        public string? EvidenceUrl { get; set; }
        /// <summary>The parts of the skill, each rated 1 to 5. Up to 20.</summary>
        public List<JobSubSkillDto> SubSkills { get; set; } = new();
    }

    public class JobSubSkillDto
    {
        public string Name { get; set; } = "";
        /// <summary>1 to 5.</summary>
        public int Rating { get; set; }
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
        public JobPreferencesDto Preferences { get; set; } = new();
        public JobInterestsDto Interests { get; set; } = new();
        public List<JobSocialLinkDto> SocialLinks { get; set; } = new();
        /// <summary>0 to 100.</summary>
        public int Completeness { get; set; }
    }

    /// <summary>What the person is looking for. All of it is optional.</summary>
    public class JobPreferencesDto
    {
        public List<string> Jobs { get; set; } = new();
        public List<string> Locations { get; set; } = new();
        /// <summary>Any of On-site, Remote, Hybrid.</summary>
        public List<string> WorkModes { get; set; } = new();
        /// <summary>Per year, in rupees; null = not said.</summary>
        public int? ExpectedCtc { get; set; }
    }

    /// <summary>What the person likes to do. Both lists are optional.</summary>
    public class JobInterestsDto
    {
        public List<string> Interests { get; set; } = new();
        public List<string> Hobbies { get; set; } = new();
    }

    /// <summary>A professional or social media profile of the person.</summary>
    public class JobSocialLinkDto
    {
        /// <summary>LinkedIn, GitHub, X, ...; Website for any other address. The API names it from the address.</summary>
        public string Platform { get; set; } = "";
        /// <summary>A full https address.</summary>
        public string Url { get; set; } = "";
    }

    /// <summary>The person's shareable profile link (script 19): on or off, and its code ('' before it was first switched on).</summary>
    public class JobProfileShareDto
    {
        public bool IsOn { get; set; }
        public string Code { get; set; } = "";
    }

    public class SetJobProfileShareRequest
    {
        public bool On { get; set; }
    }

    /// <summary>A certificate on the public profile: its title and whether it was checked, never the file.</summary>
    public class PublicCertificateDto
    {
        public string Title { get; set; } = "";
        public string Issuer { get; set; } = "";
        public DateTime? IssuedOn { get; set; }
        /// <summary>Uploaded, Verified or Rejected.</summary>
        public string Status { get; set; } = "";
    }

    /// <summary>
    /// The public page of a shared profile (/p/code). Never the email, the phone, the date of
    /// birth, the resume, a file, the preferences or a user id.
    /// </summary>
    public class PublicProfileDto
    {
        public string FullName { get; set; } = "";
        public string Headline { get; set; } = "";
        public string Summary { get; set; } = "";
        public string City { get; set; } = "";
        public bool IsVerified { get; set; }
        public bool HasPhoto { get; set; }
        public List<JobExperienceDto> Experience { get; set; } = new();
        public List<JobEducationDto> Education { get; set; } = new();
        public List<JobSkillDto> Skills { get; set; } = new();
        public List<PublicCertificateDto> Certificates { get; set; } = new();
        public List<JobSocialLinkDto> SocialLinks { get; set; } = new();
    }

    public class SaveJobSocialLinksRequest
    {
        public List<JobSocialLinkDto> Links { get; set; } = new();
    }

    public class SetJobVisibilityRequest
    {
        public bool IsVisible { get; set; }
    }

    /// <summary>A file as it is stored and as it is given back to its owner.</summary>
    public sealed record JobFileContent(string FileName, string ContentType, byte[] Content);
}
