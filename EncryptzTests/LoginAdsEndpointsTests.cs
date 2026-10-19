using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.LoginAds;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
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

        // ── the endpoints ─────────────────────────────────────────────────────

        private static MethodInfo PlatformAction(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetLoginAds", "GET", "login-ads")]
        [InlineData("GetLoginAdImage", "GET", "login-ads/{id:int}/image")]
        [InlineData("SaveLoginAd", "POST", "login-ads/save")]
        [InlineData("SetLoginAdActive", "POST", "login-ads/{id:int}/active")]
        [InlineData("ReorderLoginAds", "POST", "login-ads/reorder")]
        [InlineData("DeleteLoginAd", "DELETE", "login-ads/{id:int}")]
        public void Admin_endpoints_exist_behind_the_platform_unlock(string action, string verb, string template)
        {
            var http = PlatformAction(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
            Assert.NotNull(PlatformAction(action).GetCustomAttribute<PlatformUnlockedAttribute>());
        }

        [Fact]
        public void Saving_a_slide_takes_at_most_the_image_and_a_little_more()
        {
            var limit = PlatformAction("SaveLoginAd").GetCustomAttribute<RequestSizeLimitAttribute>();
            Assert.NotNull(limit);
        }

        [Fact]
        public void The_public_controller_is_anonymous()
        {
            Assert.NotNull(typeof(LoginAdsController).GetCustomAttribute<AllowAnonymousAttribute>());
            Assert.Equal("api/loginads", typeof(LoginAdsController).GetCustomAttribute<RouteAttribute>()!.Template);
        }

        private sealed class FakeAds : ILoginAdService
        {
            public LoginAdImage? Image;
            public int? AskedPublic;
            public Task<ApiResponse<List<PublicLoginAdDto>>> ListPublic() => Task.FromResult(ApiResponse<List<PublicLoginAdDto>>.Ok(new()));
            public Task<LoginAdImage?> GetPublicImage(int id) { AskedPublic = id; return Task.FromResult(Image); }
            public Task<LoginAdImage?> GetAdminImage(int id, PlatformActor actor) => Task.FromResult(Image);
            public Task<ApiResponse<List<LoginAdDto>>> ListAll(PlatformActor a) => throw new NotSupportedException();
            public Task<ApiResponse<int>> Save(SaveLoginAdRequest? r, LoginAdUpload? i, PlatformActor a) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> SetActive(int id, bool on, PlatformActor a) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> Delete(int id, PlatformActor a) => throw new NotSupportedException();
            public Task<ApiResponse<bool>> Reorder(IReadOnlyList<int>? ids, PlatformActor a) => throw new NotSupportedException();
        }

        private static LoginAdsController PublicController(FakeAds ads)
            => new(ads) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        [Fact]
        public async Task The_public_image_only_serves_slides_being_shown()
        {
            var ads = new FakeAds();
            await PublicController(ads).Image(3);
            Assert.Equal(3, ads.AskedPublic);
        }

        [Fact]
        public async Task A_missing_public_image_is_404()
            => Assert.IsType<NotFoundResult>(await PublicController(new FakeAds()).Image(3));

        [Fact]
        public async Task The_public_image_has_nosniff_and_our_content_type()
        {
            var ads = new FakeAds { Image = new LoginAdImage("a.webp", "text/html", new byte[] { 1, 2 }) };
            var controller = PublicController(ads);

            var file = Assert.IsType<FileContentResult>(await controller.Image(3));

            Assert.Equal("image/webp", file.ContentType);
            Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"].ToString());
        }

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
