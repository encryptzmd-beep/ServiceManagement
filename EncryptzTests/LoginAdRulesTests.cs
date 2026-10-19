using EncryptzBL.Common.LoginAds;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    /// <summary>What a login page advertisement may hold: its image, its link and its texts.</summary>
    public class LoginAdRulesTests
    {
        private static readonly byte[] Jpg = { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3 };
        private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1 };
        private static readonly byte[] Webp = "RIFF\x10\0\0\0WEBPVP8 "u8.ToArray();
        private static readonly byte[] Pdf = "%PDF-1.4 x"u8.ToArray();

        // ── image ─────────────────────────────────────────────────────────────

        [Theory]
        [InlineData("a.jpg")]
        [InlineData("a.JPEG")]
        public void Jpg_is_taken(string name) => Assert.Null(LoginAdRules.ImageProblem(name, Jpg.Length, Jpg));

        [Fact]
        public void Png_is_taken() => Assert.Null(LoginAdRules.ImageProblem("a.png", Png.Length, Png));

        [Fact]
        public void Webp_is_taken() => Assert.Null(LoginAdRules.ImageProblem("a.webp", Webp.Length, Webp));

        [Theory]
        [InlineData("a.gif")]
        [InlineData("a.svg")]
        [InlineData("a.pdf")]
        [InlineData("a")]
        public void Other_types_are_refused(string name)
            => Assert.Equal("The image must be a JPG, PNG or WebP file", LoginAdRules.ImageProblem(name, Pdf.Length, Pdf));

        [Fact]
        public void A_missing_file_is_refused()
            => Assert.Equal("Choose an image", LoginAdRules.ImageProblem("", 0, ReadOnlySpan<byte>.Empty));

        [Fact]
        public void A_renamed_file_is_refused()
            => Assert.Equal("The content of the file does not match its type", LoginAdRules.ImageProblem("a.png", Pdf.Length, Pdf));

        [Fact]
        public void A_riff_file_that_is_not_webp_is_refused()   // a WAV is RIFF....WAVE
            => Assert.Equal("The content of the file does not match its type",
                LoginAdRules.ImageProblem("a.webp", 12, "RIFF\0\0\0\0WAVE"u8));

        [Fact]
        public void Over_2_MB_is_refused()
            => Assert.Equal("The image is larger than 2 MB", LoginAdRules.ImageProblem("a.jpg", LoginAdRules.MaxImageBytes + 1, Jpg));

        [Fact]
        public void Exactly_2_MB_is_taken()
        {
            Assert.Equal(2 * 1024 * 1024, LoginAdRules.MaxImageBytes);
            Assert.Null(LoginAdRules.ImageProblem("a.jpg", LoginAdRules.MaxImageBytes, Jpg));
        }

        [Theory]
        [InlineData("a.jpg", "image/jpeg")]
        [InlineData("a.JPEG", "image/jpeg")]
        [InlineData("a.png", "image/png")]
        [InlineData("a.webp", "image/webp")]
        [InlineData("a.html", "application/octet-stream")]
        [InlineData(null, "application/octet-stream")]
        public void Content_type_comes_from_our_list(string? name, string type)
            => Assert.Equal(type, LoginAdRules.ContentTypeFor(name));

        // ── link ──────────────────────────────────────────────────────────────

        [Theory]
        [InlineData("https://encryptz.com/x")]
        [InlineData("http://encryptz.com")]
        [InlineData("HTTPS://encryptz.com/a?b=c")]
        public void Web_links_are_taken(string url) => Assert.True(LoginAdRules.IsWebLink(url));

        [Theory]
        [InlineData("javascript:alert(1)")]
        [InlineData("data:text/html,x")]
        [InlineData("ftp://a.com")]
        [InlineData("https://user@a.com")]
        [InlineData("https://a.com/ x")]
        [InlineData("/relative")]
        [InlineData("")]
        [InlineData(null)]
        public void Other_links_are_refused(string? url) => Assert.False(LoginAdRules.IsWebLink(url));

        // ── the texts ─────────────────────────────────────────────────────────

        [Fact]
        public void An_empty_slide_saves() => Assert.Null(LoginAdRules.SaveProblem(new SaveLoginAdRequest { LinkUrl = "  " }));

        [Fact]
        public void Nothing_to_save_is_refused() => Assert.Equal("Nothing to save", LoginAdRules.SaveProblem(null));

        [Fact]
        public void A_bad_link_does_not_save()
            => Assert.Equal("The link must start with http:// or https://",
                LoginAdRules.SaveProblem(new SaveLoginAdRequest { LinkUrl = "javascript:x" }));

        [Theory]
        [InlineData(nameof(SaveLoginAdRequest.Tag), 40, "The tag is too long")]
        [InlineData(nameof(SaveLoginAdRequest.Title), 120, "The headline is too long")]
        [InlineData(nameof(SaveLoginAdRequest.Body), 250, "The short text is too long")]
        [InlineData(nameof(SaveLoginAdRequest.ButtonText), 30, "The button text is too long")]
        public void Text_fields_have_their_limits(string field, int limit, string message)
        {
            var atLimit = new SaveLoginAdRequest();
            typeof(SaveLoginAdRequest).GetProperty(field)!.SetValue(atLimit, new string('x', limit));
            Assert.Null(LoginAdRules.SaveProblem(atLimit));

            var over = new SaveLoginAdRequest();
            typeof(SaveLoginAdRequest).GetProperty(field)!.SetValue(over, new string('x', limit + 1));
            Assert.Equal(message, LoginAdRules.SaveProblem(over));
        }

        [Fact]
        public void A_link_over_500_characters_is_refused()
        {
            var url = "https://encryptz.com/" + new string('a', 500 - "https://encryptz.com/".Length);
            Assert.Null(LoginAdRules.SaveProblem(new SaveLoginAdRequest { LinkUrl = url }));
            Assert.Equal("The link is too long", LoginAdRules.SaveProblem(new SaveLoginAdRequest { LinkUrl = url + "a" }));
        }

        [Fact]
        public void Until_before_from_is_refused()
            => Assert.Equal("'Show until' is before 'Show from'",
                LoginAdRules.SaveProblem(new SaveLoginAdRequest { ShowFrom = new DateTime(2026, 10, 10), ShowUntil = new DateTime(2026, 10, 9) }));

        [Fact]
        public void The_same_day_for_both_dates_saves()
            => Assert.Null(LoginAdRules.SaveProblem(new SaveLoginAdRequest { ShowFrom = new DateTime(2026, 10, 10), ShowUntil = new DateTime(2026, 10, 10) }));

        [Fact]
        public void Fields_are_trimmed_and_dates_lose_their_time()
        {
            var r = new SaveLoginAdRequest { Title = "  Hi  ", Tag = null, ShowFrom = new DateTime(2026, 10, 10, 15, 30, 0) };
            LoginAdRules.SaveProblem(r);
            Assert.Equal("Hi", r.Title);
            Assert.Equal("", r.Tag);
            Assert.Equal(new DateTime(2026, 10, 10), r.ShowFrom);
        }
    }
}
