using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The photo of a Job Portal profile: what is taken, and the script that stores it.</summary>
    public class JobsPhotoTests
    {
        private static readonly byte[] Jpg = { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3 };
        private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1 };
        private static readonly byte[] Pdf = "%PDF-1.4 x"u8.ToArray();

        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "PersonalDB", "04_Jobs_Photo.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "PersonalDB", "04_Jobs_Photo.sql"));
        }

        [Theory]
        [InlineData("me.jpg")]
        [InlineData("me.JPEG")]
        public void A_jpg_photo_is_taken(string name)
            => Assert.Null(JobsRules.FileProblem(JobsRules.PhotoKind, name, Jpg.Length, Jpg));

        [Fact]
        public void A_png_photo_is_taken()
            => Assert.Null(JobsRules.FileProblem(JobsRules.PhotoKind, "me.png", Png.Length, Png));

        [Theory]
        [InlineData("me.pdf")]
        [InlineData("me.gif")]
        [InlineData("me.svg")]
        [InlineData("me")]
        public void Anything_but_jpg_and_png_is_refused(string name)
            => Assert.Equal("A photo must be a JPG or PNG file", JobsRules.FileProblem(JobsRules.PhotoKind, name, Pdf.Length, Pdf));

        [Fact]
        public void A_photo_whose_content_is_something_else_is_refused()
            => Assert.Equal("The content of the file does not match its type",
                JobsRules.FileProblem(JobsRules.PhotoKind, "me.png", Pdf.Length, Pdf));

        [Fact]
        public void A_photo_larger_than_2_MB_is_refused()
            => Assert.Equal("The photo is larger than 2 MB",
                JobsRules.FileProblem(JobsRules.PhotoKind, "me.jpg", JobsRules.MaxPhotoBytes + 1, Jpg));

        [Fact]
        public async Task Without_a_personal_database_the_photo_calls_say_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SavePhoto(11, new JobUpload("me.jpg", Jpg))).Message);
            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.DeletePhoto(11)).Message);
            Assert.False((await jobs.GetPhoto(11)).Success);
            Assert.Equal("Please log in again", (await jobs.GetPhoto(0)).Message);
        }

        [Fact]
        public void The_script_allows_the_kind_and_has_the_three_procedures()
        {
            var script = Script();

            Assert.Contains("CHECK (Kind IN ('Resume', 'Certificate', 'Photo'))", script);
            foreach (var procedure in new[] { "sp_Photo_Save", "sp_Photo_Delete", "sp_Photo_Get" })
                Assert.Contains($"CREATE OR ALTER PROCEDURE jobs.{procedure}", script);
        }

        /// <summary>The rule of schema jobs: no statement on jobs.Files without the user.</summary>
        [Fact]
        public void Every_statement_on_the_files_names_the_user()
        {
            var script = Script();
            var statements = script.Split(';')
                .Where(s => s.Contains("jobs.Files") && (s.Contains("DELETE FROM") || s.Contains("SELECT TOP") || s.Contains("INSERT INTO")))
                .ToList();

            Assert.Equal(4, statements.Count);
            Assert.All(statements, s => Assert.Contains("@UserId", s));
        }

        [Fact]
        public void The_script_refuses_any_database_but_the_personal_one()
        {
            var script = Script();

            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.Contains("SET NOEXEC ON", script);
        }
    }
}
