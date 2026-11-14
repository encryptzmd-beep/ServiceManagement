using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Interests, hobbies and social media links: what is taken, and the script that stores them.</summary>
    public class JobsInterestsAndSocialLinksTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "PersonalDB", "15_Jobs_Interests_And_Social_Links.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "PersonalDB", "15_Jobs_Interests_And_Social_Links.sql"));
        }

        // ── interests and hobbies ─────────────────────────────────────────────

        [Fact]
        public void Interests_are_trimmed_blanks_and_repeats_are_dropped_and_the_order_is_kept()
        {
            var i = new JobInterestsDto
            {
                Interests = new List<string> { " Photography ", "", "photography", "Travel" },
                Hobbies = new List<string> { "Cricket", "  ", "CRICKET", " Reading" }
            };

            Assert.Null(JobsRules.InterestsProblem(i));
            Assert.Equal(new[] { "Photography", "Travel" }, i.Interests);
            Assert.Equal(new[] { "Cricket", "Reading" }, i.Hobbies);
        }

        [Fact]
        public void Missing_interest_lists_become_empty()
        {
            var i = new JobInterestsDto { Interests = null!, Hobbies = null! };

            Assert.Null(JobsRules.InterestsProblem(i));
            Assert.Empty(i.Interests);
            Assert.Empty(i.Hobbies);
        }

        [Fact]
        public void More_than_fifteen_of_a_kind_or_a_long_entry_is_refused()
        {
            var sixteen = Enumerable.Range(1, 16).Select(n => $"Thing {n}").ToList();

            Assert.Equal("Add at most 15 interests", JobsRules.InterestsProblem(new JobInterestsDto { Interests = sixteen }));
            Assert.Equal("Add at most 15 hobbies", JobsRules.InterestsProblem(new JobInterestsDto { Hobbies = sixteen }));
            Assert.Equal("A hobby can have at most 100 characters",
                JobsRules.InterestsProblem(new JobInterestsDto { Hobbies = new List<string> { new string('a', 101) } }));
            Assert.Equal("Nothing to save", JobsRules.InterestsProblem(null));
        }

        // ── social links ──────────────────────────────────────────────────────

        [Theory]
        [InlineData("https://www.linkedin.com/in/someone", "LinkedIn")]
        [InlineData("https://in.linkedin.com/in/someone", "LinkedIn")]
        [InlineData("https://github.com/someone", "GitHub")]
        [InlineData("https://twitter.com/someone", "X")]
        [InlineData("https://x.com/someone", "X")]
        [InlineData("https://m.facebook.com/someone", "Facebook")]
        [InlineData("https://www.instagram.com/someone", "Instagram")]
        [InlineData("https://youtu.be/abc", "YouTube")]
        [InlineData("https://stackoverflow.com/users/1/someone", "Stack Overflow")]
        [InlineData("https://someone.dev", "Website")]
        [InlineData("https://notlinkedin.com/in/someone", "Website")]
        [InlineData("https://linkedin.com.evil.example/in/someone", "Website")]
        public void The_platform_is_named_by_the_host(string url, string platform)
            => Assert.Equal(platform, JobsRules.PlatformOf(url));

        [Fact]
        public void Links_are_tidied_and_the_platform_the_client_sent_is_replaced()
        {
            var req = new SaveJobSocialLinksRequest
            {
                Links = new List<JobSocialLinkDto>
                {
                    new() { Platform = "GitHub", Url = " https://www.linkedin.com/in/someone " },
                    new() { Url = "" },
                    new() { Url = "https://WWW.LINKEDIN.COM/in/someone" },
                    new() { Url = "https://github.com/someone" },
                }
            };

            Assert.Null(JobsRules.SocialLinksProblem(req));
            Assert.Equal(2, req.Links.Count);
            Assert.Equal(("LinkedIn", "https://www.linkedin.com/in/someone"), (req.Links[0].Platform, req.Links[0].Url));
            Assert.Equal(("GitHub", "https://github.com/someone"), (req.Links[1].Platform, req.Links[1].Url));
        }

        [Theory]
        [InlineData("http://github.com/someone")]
        [InlineData("javascript:alert(1)")]
        [InlineData("github.com/someone")]
        [InlineData("https://github.com/some one")]
        public void A_link_that_is_not_a_full_https_address_is_refused(string url)
            => Assert.Equal("A link must start with https:// and be a full address",
                JobsRules.SocialLinksProblem(new SaveJobSocialLinksRequest { Links = new() { new() { Url = url } } }));

        [Fact]
        public void More_than_ten_links_is_refused()
        {
            var eleven = Enumerable.Range(1, 11).Select(n => new JobSocialLinkDto { Url = $"https://site{n}.example" }).ToList();

            Assert.Equal("Add at most 10 links", JobsRules.SocialLinksProblem(new SaveJobSocialLinksRequest { Links = eleven }));
            Assert.Equal("Nothing to save", JobsRules.SocialLinksProblem(null));
        }

        // ── the script ────────────────────────────────────────────────────────

        [Fact]
        public void The_script_names_the_user_in_every_statement_on_its_tables_and_keeps_only_https()
        {
            var sql = Script();

            Assert.Contains("DELETE FROM jobs.Interests WHERE UserId = @UserId", sql);
            Assert.Contains("DELETE FROM jobs.SocialLinks WHERE UserId = @UserId", sql);
            Assert.Contains("WHERE i.UserId = @UserId", sql);
            Assert.Contains("WHERE s.UserId = @UserId", sql);
            Assert.Contains("CHECK (Url LIKE 'https://%')", sql);
            Assert.Contains("v.Url LIKE 'https://%'", sql);
        }
    }
}
