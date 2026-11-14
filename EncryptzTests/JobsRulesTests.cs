using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class JobsRulesTests
    {
        private static readonly DateTime Today = new(2026, 10, 13);

        // ── profile ───────────────────────────────────────────────────────────

        private static JobProfileDto Profile() => new()
        {
            FullName = "Leo Joseph", Headline = "Accountant, 5 years", Summary = "s", City = "Kochi",
            ContactEmail = "leo@example.com", ContactPhone = "+91 97443 61916", DateOfBirth = new DateTime(1990, 5, 1)
        };

        [Fact]
        public void A_complete_profile_has_no_problem_and_is_trimmed()
        {
            var p = Profile();
            p.FullName = "  Leo Joseph ";
            p.City = " Kochi ";

            Assert.Null(JobsRules.ProfileProblem(p, Today));
            Assert.Equal("Leo Joseph", p.FullName);
            Assert.Equal("Kochi", p.City);
        }

        [Fact]
        public void A_profile_needs_a_date_of_birth_and_nothing_else_to_be_saved()
        {
            // a person fills it in over time; visibility is what needs name and headline
            Assert.Equal("Enter your date of birth", JobsRules.ProfileProblem(new JobProfileDto(), Today));
            Assert.Null(JobsRules.ProfileProblem(new JobProfileDto { DateOfBirth = new DateTime(1990, 5, 1) }, Today));
        }

        [Fact]
        public void Only_the_profile_started_from_the_user_master_is_taken_without_a_date_of_birth()
            => Assert.Null(JobsRules.ProfileProblem(new JobProfileDto { FullName = "Leo" }, Today, requireBirthDate: false));

        [Fact]
        public void Nothing_sent_is_a_problem()
        {
            Assert.Equal("Nothing to save", JobsRules.ProfileProblem(null, Today));
        }

        [Theory]
        [InlineData("FullName", 201, "The name is too long")]
        [InlineData("Headline", 201, "The headline is too long")]
        [InlineData("Summary", 2001, "The summary is too long")]
        [InlineData("City", 101, "The city is too long")]
        public void Each_text_has_its_length(string field, int length, string expected)
        {
            var p = Profile();
            typeof(JobProfileDto).GetProperty(field)!.SetValue(p, new string('x', length));

            Assert.Equal(expected, JobsRules.ProfileProblem(p, Today));
        }

        [Theory]
        [InlineData("not-an-email")]
        [InlineData("a@b")]
        [InlineData("a b@c.de")]
        [InlineData("<script>@x.yz")]
        public void A_contact_email_must_look_like_one(string email)
        {
            var p = Profile();
            p.ContactEmail = email;

            Assert.Equal("Enter a valid contact email", JobsRules.ProfileProblem(p, Today));
        }

        [Theory]
        [InlineData("abc")]
        [InlineData("12")]
        [InlineData("+91 97443 61916 ext <b>")]
        public void A_contact_phone_is_digits_blanks_and_a_few_signs(string phone)
        {
            var p = Profile();
            p.ContactPhone = phone;

            Assert.Equal("Enter a valid contact phone number", JobsRules.ProfileProblem(p, Today));
        }

        [Theory]
        [InlineData(2026, 10, 14)]   // tomorrow
        [InlineData(1899, 12, 31)]
        public void A_date_of_birth_is_in_the_past_and_not_absurd(int y, int m, int d)
        {
            var p = Profile();
            p.DateOfBirth = new DateTime(y, m, d);

            Assert.Equal("Enter a valid date of birth", JobsRules.ProfileProblem(p, Today));
        }

        [Theory]
        [InlineData(2016, 1, 15)]    // 10 years old (QA BUG-004)
        [InlineData(2012, 10, 14)]   // 14 tomorrow
        public void A_person_younger_than_14_cannot_make_a_profile(int y, int m, int d)
        {
            var p = Profile();
            p.DateOfBirth = new DateTime(y, m, d);

            Assert.Equal("You must be at least 14 years old to use Job Portal", JobsRules.ProfileProblem(p, Today));
        }

        [Fact]
        public void A_person_of_14_today_can_make_a_profile()
        {
            var p = Profile();
            p.DateOfBirth = new DateTime(2012, 10, 13);

            Assert.Null(JobsRules.ProfileProblem(p, Today));
        }

        // ── experience ────────────────────────────────────────────────────────

        private static JobExperienceDto Experience() => new()
        {
            Organisation = "Acme", Title = "Clerk", StartMonth = new DateTime(2019, 4, 17), EndMonth = new DateTime(2022, 3, 9), Description = "d"
        };

        [Fact]
        public void An_experience_is_stored_by_month()
        {
            var e = Experience();

            Assert.Null(JobsRules.ExperienceProblem(e, Today));
            Assert.Equal(new DateTime(2019, 4, 1), e.StartMonth);
            Assert.Equal(new DateTime(2022, 3, 1), e.EndMonth);
        }

        [Fact]
        public void A_current_job_has_no_end()
        {
            var e = Experience();
            e.EndMonth = null;

            Assert.Null(JobsRules.ExperienceProblem(e, Today));
        }

        [Theory]
        [InlineData("", "Clerk", "Enter the organisation and your title")]
        [InlineData("Acme", "  ", "Enter the organisation and your title")]
        public void Organisation_and_title_are_required(string organisation, string title, string expected)
        {
            var e = Experience();
            e.Organisation = organisation;
            e.Title = title;

            Assert.Equal(expected, JobsRules.ExperienceProblem(e, Today));
        }

        [Fact]
        public void An_experience_cannot_end_before_it_starts_or_start_in_the_future()
        {
            var e = Experience();
            e.EndMonth = new DateTime(2019, 3, 1);
            Assert.Equal("The end cannot be before the start", JobsRules.ExperienceProblem(e, Today));

            e = Experience();
            e.StartMonth = new DateTime(2026, 11, 1);
            e.EndMonth = null;
            Assert.Equal("The start cannot be in the future", JobsRules.ExperienceProblem(e, Today));

            e = Experience();
            e.StartMonth = new DateTime(1949, 12, 1);
            Assert.Equal("Enter a valid start month", JobsRules.ExperienceProblem(e, Today));

            e = Experience();
            e.EndMonth = new DateTime(2026, 11, 1);
            Assert.Equal("The end cannot be in the future. Leave it empty for a current job", JobsRules.ExperienceProblem(e, Today));
        }

        // ── education ─────────────────────────────────────────────────────────

        private static JobEducationDto Education() => new()
        {
            Institution = "MG University", Course = "B.Com", FieldOfStudy = "Finance", StartYear = 2012, EndYear = 2015
        };

        [Fact]
        public void An_education_entry_needs_institution_and_course_only()
        {
            Assert.Null(JobsRules.EducationProblem(Education(), 2026));
            Assert.Null(JobsRules.EducationProblem(new JobEducationDto { Institution = "School", Course = "SSLC" }, 2026));
            Assert.Equal("Enter the institution and the course",
                JobsRules.EducationProblem(new JobEducationDto { Institution = "School" }, 2026));
        }

        [Theory]
        [InlineData(1949, 2015, "Enter a valid start year")]
        [InlineData(2012, 2037, "Enter a valid end year")]    // more than ten years ahead
        [InlineData(2016, 2015, "The end year cannot be before the start year")]
        public void Years_are_within_reason(int start, int end, string expected)
        {
            var e = Education();
            e.StartYear = start;
            e.EndYear = end;

            Assert.Equal(expected, JobsRules.EducationProblem(e, 2026));
        }

        [Fact]
        public void A_course_that_is_still_running_may_end_up_to_ten_years_ahead()
        {
            var e = Education();
            e.StartYear = 2025;
            e.EndYear = 2036;

            Assert.Null(JobsRules.EducationProblem(e, 2026));
        }

        // ── skills ────────────────────────────────────────────────────────────

        [Theory]
        [InlineData(1, "Beginner")]
        [InlineData(2, "Beginner")]
        [InlineData(3, "Intermediate")]
        [InlineData(4, "Intermediate")]
        [InlineData(5, "Expert")]
        public void The_level_follows_the_rating(int rating, string level)
        {
            var s = new JobSkillDto { SkillName = " Tally ", Rating = rating, Level = "Guru" };

            Assert.Null(JobsRules.SkillProblem(s));
            Assert.Equal(level, s.Level);
            Assert.Equal("Tally", s.SkillName);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(6)]
        [InlineData(-1)]
        public void A_skill_is_rated_from_1_to_5(int rating)
        {
            Assert.Equal("Rate the skill from 1 to 5", JobsRules.SkillProblem(new JobSkillDto { SkillName = "Tally", Rating = rating }));
        }

        [Fact]
        public void Every_sub_skill_is_rated_from_1_to_5_and_empty_rows_are_dropped()
        {
            var s = new JobSkillDto
            {
                SkillName = "Accounting", Rating = 4,
                SubSkills = { new() { Name = " GST ", Rating = 4 }, new() { Name = " ", Rating = 0 }, new() { Name = "Payroll", Rating = 3 } }
            };

            Assert.Null(JobsRules.SkillProblem(s));
            Assert.Equal(new[] { "GST", "Payroll" }, s.SubSkills.Select(u => u.Name));

            s.SubSkills.Add(new() { Name = "TDS", Rating = 6 });
            Assert.Equal("Rate every sub-skill from 1 to 5", JobsRules.SkillProblem(s));
        }

        [Fact]
        public void With_sub_skills_the_overall_rating_is_their_average_whatever_was_sent()
        {
            // 4 + 3 + 3 = 3.33 -> 3; the rating sent is not used
            var s = new JobSkillDto
            {
                SkillName = "Accounting", Rating = 0,
                SubSkills = { new() { Name = "GST", Rating = 4 }, new() { Name = "Payroll", Rating = 3 }, new() { Name = "TDS", Rating = 3 } }
            };

            Assert.Null(JobsRules.SkillProblem(s));
            Assert.Equal(3, s.Rating);
            Assert.Equal("Intermediate", s.Level);
            Assert.Equal(3.3, JobsRules.AverageRating(s.SubSkills));

            // 4.5 is 5
            Assert.Equal(5, JobsRules.OverallRating(new List<JobSubSkillDto> { new() { Name = "A", Rating = 4 }, new() { Name = "B", Rating = 5 } }));
        }

        [Fact]
        public void A_sub_skill_is_listed_once_and_there_are_at_most_20()
        {
            var twice = new JobSkillDto { SkillName = "Accounting", Rating = 4, SubSkills = { new() { Name = "GST", Rating = 4 }, new() { Name = "gst", Rating = 2 } } };
            Assert.Equal("A sub-skill is in the list twice", JobsRules.SkillProblem(twice));

            var many = new JobSkillDto { SkillName = "Accounting", Rating = 4 };
            many.SubSkills.AddRange(Enumerable.Range(1, 21).Select(i => new JobSubSkillDto { Name = "Part " + i, Rating = 3 }));
            Assert.Equal("A skill can have up to 20 sub-skills", JobsRules.SkillProblem(many));
        }

        [Fact]
        public void A_skill_needs_a_name_and_a_rating()
        {
            Assert.Equal("Enter the skill", JobsRules.SkillProblem(new JobSkillDto { SkillName = " ", Rating = 5 }));
            Assert.Equal("The skill name is too long", JobsRules.SkillProblem(new JobSkillDto { SkillName = new string('s', 101), Rating = 5 }));
        }

        [Theory]
        [InlineData("https://youtube.com/watch?v=abc")]
        [InlineData("https://www.instagram.com/p/xyz/")]
        [InlineData("")]
        [InlineData(null)]
        public void An_evidence_link_is_https_or_empty(string? url)
        {
            Assert.Null(JobsRules.SkillProblem(new JobSkillDto { SkillName = "Singing", Rating = 5, EvidenceUrl = url }));
        }

        [Theory]
        [InlineData("http://youtube.com/watch?v=abc")]
        [InlineData("javascript:alert(1)")]
        [InlineData("JAVASCRIPT:alert(1)")]
        [InlineData("data:text/html,<script>alert(1)</script>")]
        [InlineData("//evil.example/x")]
        [InlineData("youtube.com/abc")]
        [InlineData("https://")]
        [InlineData("https://exa mple.com")]
        [InlineData("https://user:pw@example.com/")]
        public void Any_other_link_is_refused(string url)
        {
            Assert.Equal("The link must start with https:// and be a full address",
                JobsRules.SkillProblem(new JobSkillDto { SkillName = "Singing", Rating = 5, EvidenceUrl = url }));
        }

        [Fact]
        public void A_link_of_more_than_400_characters_is_refused()
        {
            Assert.Equal("The link is too long",
                JobsRules.SkillProblem(new JobSkillDto { SkillName = "Singing", Rating = 5, EvidenceUrl = "https://example.com/" + new string('a', 400) }));
        }

        // ── certificates ──────────────────────────────────────────────────────

        [Fact]
        public void A_certificate_needs_a_title_and_a_date_that_is_not_in_the_future()
        {
            Assert.Null(JobsRules.CertificateProblem(new JobCertificateDto { Title = "Tally Prime", Issuer = "Institute", IssuedOn = new DateTime(2020, 1, 15) }, Today));
            Assert.Null(JobsRules.CertificateProblem(new JobCertificateDto { Title = "Tally Prime" }, Today));
            Assert.Equal("Enter the title of the certificate", JobsRules.CertificateProblem(new JobCertificateDto { Title = " " }, Today));
            Assert.Equal("The date cannot be in the future",
                JobsRules.CertificateProblem(new JobCertificateDto { Title = "T", IssuedOn = Today.AddDays(1) }, Today));
        }

        // ── files ─────────────────────────────────────────────────────────────

        private static readonly byte[] Pdf = { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34 };              // %PDF-1.4
        private static readonly byte[] Jpg = { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 };
        private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] Doc = { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 };              // OLE2
        private static readonly byte[] Docx = { 0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00 };             // ZIP
        private static readonly byte[] Exe = { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00 };              // MZ
        private static readonly byte[] Html = "<html><s"u8.ToArray();

        [Theory]
        [InlineData("Resume", "cv.pdf", "pdf")]
        [InlineData("Resume", "CV.PDF", "pdf")]
        [InlineData("Resume", "cv.doc", "doc")]
        [InlineData("Resume", "cv.docx", "docx")]
        [InlineData("Certificate", "c.pdf", "pdf")]
        [InlineData("Certificate", "c.jpg", "jpg")]
        [InlineData("Certificate", "c.jpeg", "jpg")]
        [InlineData("Certificate", "c.png", "png")]
        public void A_file_of_an_allowed_type_whose_content_fits_is_accepted(string kind, string name, string content)
        {
            var head = content switch { "pdf" => Pdf, "doc" => Doc, "docx" => Docx, "jpg" => Jpg, _ => Png };

            Assert.Null(JobsRules.FileProblem(kind, name, 1000, head));
        }

        [Theory]
        [InlineData("Resume", "cv.jpg", "jpg", "A resume must be a PDF, DOC or DOCX file")]
        [InlineData("Resume", "cv.exe", "exe", "A resume must be a PDF, DOC or DOCX file")]
        [InlineData("Resume", "cv", "pdf", "A resume must be a PDF, DOC or DOCX file")]
        [InlineData("Certificate", "c.docx", "docx", "A certificate must be a PDF, JPG or PNG file")]
        [InlineData("Certificate", "c.html", "html", "A certificate must be a PDF, JPG or PNG file")]
        [InlineData("Certificate", "c.pdf.exe", "exe", "A certificate must be a PDF, JPG or PNG file")]
        public void Another_type_is_refused_with_the_allowed_ones(string kind, string name, string content, string expected)
        {
            var head = content switch { "pdf" => Pdf, "docx" => Docx, "jpg" => Jpg, "exe" => Exe, _ => Html };

            Assert.Equal(expected, JobsRules.FileProblem(kind, name, 1000, head));
        }

        [Theory]
        [InlineData("Resume", "cv.pdf", "exe")]
        [InlineData("Resume", "cv.pdf", "html")]
        [InlineData("Resume", "cv.docx", "pdf")]
        [InlineData("Resume", "cv.doc", "docx")]
        [InlineData("Certificate", "c.png", "jpg")]
        [InlineData("Certificate", "c.jpg", "html")]
        public void A_file_whose_content_is_not_what_its_name_says_is_refused(string kind, string name, string content)
        {
            var head = content switch { "pdf" => Pdf, "docx" => Docx, "jpg" => Jpg, "exe" => Exe, _ => Html };

            Assert.Equal("The content of the file does not match its type", JobsRules.FileProblem(kind, name, 1000, head));
        }

        [Fact]
        public void Size_and_presence_are_checked()
        {
            Assert.Equal("Choose a file", JobsRules.FileProblem("Resume", "cv.pdf", 0, Pdf));
            Assert.Equal("Choose a file", JobsRules.FileProblem("Resume", null, 10, Pdf));
            Assert.Equal("The file is larger than 5 MB", JobsRules.FileProblem("Resume", "cv.pdf", 5 * 1024 * 1024 + 1, Pdf));
            Assert.Null(JobsRules.FileProblem("Resume", "cv.pdf", 5 * 1024 * 1024, Pdf));
            Assert.Equal("The content of the file does not match its type", JobsRules.FileProblem("Resume", "cv.pdf", 3, new byte[] { 0x25, 0x50, 0x44 }));
        }

        [Fact]
        public void An_unknown_kind_is_never_accepted()
        {
            Assert.Equal("Choose a file", JobsRules.FileProblem("Other", "cv.pdf", 10, Pdf));
        }

        [Theory]
        [InlineData("cv.pdf", "cv.pdf")]
        [InlineData(@"C:\Users\leo\Desktop\cv.pdf", "cv.pdf")]
        [InlineData("../../etc/passwd.pdf", "passwd.pdf")]
        [InlineData("my\r\ncv\".pdf", "my__cv_.pdf")]
        [InlineData("  spaced name.pdf ", "spaced name.pdf")]
        public void A_stored_file_name_has_no_path_and_no_control_characters(string given, string stored)
        {
            Assert.Equal(stored, JobsRules.SafeFileName(given));
        }

        [Fact]
        public void A_very_long_file_name_keeps_its_extension()
        {
            var name = JobsRules.SafeFileName(new string('a', 300) + ".pdf");

            Assert.True(name.Length <= 120);
            Assert.EndsWith(".pdf", name);
        }

        [Theory]
        [InlineData("cv.pdf", "application/pdf")]
        [InlineData("cv.DOC", "application/msword")]
        [InlineData("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
        [InlineData("c.jpg", "image/jpeg")]
        [InlineData("c.jpeg", "image/jpeg")]
        [InlineData("c.png", "image/png")]
        [InlineData("c.html", "application/octet-stream")]
        [InlineData("c", "application/octet-stream")]
        public void The_content_type_comes_from_a_fixed_list(string name, string expected)
        {
            Assert.Equal(expected, JobsRules.ContentTypeFor(name));
        }

        // ── completeness ──────────────────────────────────────────────────────

        [Fact]
        public void An_empty_page_is_zero_and_a_full_one_is_a_hundred()
        {
            Assert.Equal(0, JobsRules.Completeness(new JobProfilePageDto()));

            var page = new JobProfilePageDto
            {
                Profile = Profile(),
                Experience = { Experience() },
                Education = { Education() },
                Skills = { new JobSkillDto(), new JobSkillDto(), new JobSkillDto() },
                Resume = new JobFileInfoDto { FileId = 1, FileName = "cv.pdf" }
            };

            Assert.Equal(100, JobsRules.Completeness(page));
        }

        [Fact]
        public void Each_part_adds_its_share()
        {
            var page = new JobProfilePageDto { Profile = new JobProfileDto { FullName = "Leo" } };
            Assert.Equal(10, JobsRules.Completeness(page));

            page.Profile.Headline = "Accountant";
            Assert.Equal(25, JobsRules.Completeness(page));

            page.Skills.Add(new JobSkillDto());
            page.Skills.Add(new JobSkillDto());
            Assert.Equal(25, JobsRules.Completeness(page));     // three skills are needed

            page.Skills.Add(new JobSkillDto());
            Assert.Equal(35, JobsRules.Completeness(page));

            page.Profile.ContactPhone = "9744361916";           // one way to reach the person is enough
            Assert.Equal(40, JobsRules.Completeness(page));
        }
    }
}
