using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.LoginAds;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The service and the endpoints of the login page advertisements.</summary>
    public class LoginAdsEndpointsTests
    {
        private static readonly byte[] Pdf = "%PDF-1.4 x"u8.ToArray();
        private static readonly PlatformActor NotAdmin = new() { UserId = 5, IsPlatformAdmin = false, IsCompanyAdmin = true, CompanyId = 3 };
        private static readonly PlatformActor Admin = new() { UserId = 1, IsPlatformAdmin = true };

        private static LoginAdService Svc()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                // never reached by a refusal; the public list must survive it
                ["ConnectionStrings:MainConnection"] = "Server=nowhere.invalid;Database=x;Connect Timeout=1"
            }).Build();
            return new LoginAdService(new EncryptzBL.Common.MainDbHelper(config), NullLogger<LoginAdService>.Instance);
        }

        // ── the service ───────────────────────────────────────────────────────

        [Fact]
        public async Task A_non_admin_cannot_list() => Assert.False((await Svc().ListAll(NotAdmin)).Success);

        [Fact]
        public async Task A_non_admin_cannot_save() => Assert.False((await Svc().Save(new SaveLoginAdRequest(), null, NotAdmin)).Success);

        [Fact]
        public async Task A_non_admin_cannot_activate() => Assert.False((await Svc().SetActive(1, true, NotAdmin)).Success);

        [Fact]
        public async Task A_non_admin_cannot_delete() => Assert.False((await Svc().Delete(1, NotAdmin)).Success);

        [Fact]
        public async Task A_non_admin_cannot_reorder() => Assert.False((await Svc().Reorder(new[] { 1 }, NotAdmin)).Success);

        [Fact]
        public async Task A_non_admin_gets_no_hidden_image() => Assert.Null(await Svc().GetAdminImage(1, NotAdmin));

        [Fact]
        public async Task A_new_slide_needs_an_image()
            => Assert.Equal("Choose an image", (await Svc().Save(new SaveLoginAdRequest { LoginAdId = 0 }, null, Admin)).Message);

        [Fact]
        public async Task A_bad_image_is_refused_before_the_database()
            => Assert.Equal("The content of the file does not match its type",
                (await Svc().Save(new SaveLoginAdRequest(), new LoginAdUpload("a.png", Pdf), Admin)).Message);

        [Fact]
        public async Task A_bad_link_is_refused_before_the_database()
            => Assert.Equal("The link must start with http:// or https://",
                (await Svc().Save(new SaveLoginAdRequest { LoginAdId = 4, LinkUrl = "javascript:alert(1)" }, null, Admin)).Message);

        [Fact]
        public async Task An_empty_order_is_refused()
            => Assert.False((await Svc().Reorder(Array.Empty<int>(), Admin)).Success);

        [Fact]
        public async Task The_public_list_never_fails_even_without_a_database()
        {
            var r = await Svc().ListPublic();
            Assert.True(r.Success);
            Assert.Empty(r.Data!);
        }

        [Fact]
        public async Task A_public_image_without_a_database_is_simply_missing()
            => Assert.Null(await Svc().GetPublicImage(1));

        [Fact]
        public void An_unsafe_stored_link_is_cleared_but_the_slide_stays()
        {
            var list = new List<PublicLoginAdDto>
            {
                new() { LoginAdId = 1, LinkUrl = "javascript:alert(1)", Title = "A" },
                new() { LoginAdId = 2, LinkUrl = "https://encryptz.com" }
            };

            LoginAdService.ClearUnsafeLinks(list);

            Assert.Equal(2, list.Count);
            Assert.Equal("", list[0].LinkUrl);
            Assert.Equal("https://encryptz.com", list[1].LinkUrl);
        }
    }
}
