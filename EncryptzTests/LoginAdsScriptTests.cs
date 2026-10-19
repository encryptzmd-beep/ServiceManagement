using Xunit;

namespace EncryptzTests
{
    /// <summary>MainDB script 25: the advertisements of the login page.</summary>
    public class LoginAdsScriptTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "MainDB", "25_Login_Ads.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "MainDB", "25_Login_Ads.sql"));
        }

        private static string Procedure(string name)
        {
            var s = Script();
            var body = s.Substring(s.IndexOf($"PROCEDURE dbo.{name}", StringComparison.Ordinal));
            return body.Substring(0, body.IndexOf("\nGO", StringComparison.Ordinal));
        }

        [Fact]
        public void The_script_guards_the_database_and_is_rerunnable()
        {
            var s = Script();
            Assert.Contains("OBJECT_ID('dbo.Users') IS NULL", s);
            Assert.Contains("IF OBJECT_ID('dbo.LoginAds') IS NULL", s);
            Assert.DoesNotContain("DROP TABLE", s, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("sp_LoginAd_ListPublic")]
        [InlineData("sp_LoginAd_ListAll")]
        [InlineData("sp_LoginAd_GetImage")]
        [InlineData("sp_LoginAd_Save")]
        [InlineData("sp_LoginAd_SetActive")]
        [InlineData("sp_LoginAd_Delete")]
        [InlineData("sp_LoginAd_Reorder")]
        public void Each_procedure_is_create_or_alter(string sp)
            => Assert.Contains($"CREATE OR ALTER PROCEDURE dbo.{sp}", Script());

        [Theory]
        [InlineData("sp_LoginAd_ListPublic")]
        [InlineData("sp_LoginAd_GetImage")]
        public void Only_slides_shown_today_are_public(string sp)
        {
            var body = Procedure(sp);
            Assert.Contains("CAST(GETDATE() AS DATE)", body);
            Assert.Contains("ShowFrom IS NULL OR ShowFrom <=", body);
            Assert.Contains("ShowUntil IS NULL OR ShowUntil >=", body);
            Assert.Contains("IsActive = 1", body);
        }

        [Theory]
        [InlineData("sp_LoginAd_ListPublic")]
        [InlineData("sp_LoginAd_ListAll")]
        public void The_lists_never_return_image_bytes(string sp)
            => Assert.DoesNotMatch(@"\bImage\b(?!Version|Name|Type)", Procedure(sp).Replace($"dbo.{sp}", ""));

        [Fact]
        public void A_new_slide_without_an_image_is_refused()
            => Assert.Contains("Choose an image", Procedure("sp_LoginAd_Save"));

        [Fact]
        public void A_new_image_bumps_the_image_version()
            => Assert.Contains("ImageVersion = ImageVersion + 1", Procedure("sp_LoginAd_Save"));
    }
}
