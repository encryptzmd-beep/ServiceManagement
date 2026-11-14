using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Inside a company only the commercial applications are listed.</summary>
    public class ModuleListTests
    {
        private static ModuleDto Module(string key) => new() { ModuleKey = key, State = "Available" };

        [Fact]
        public void A_personal_application_is_never_listed_inside_a_company()
        {
            var listed = new[] { Module("SERVICE"), Module("JOBPORTAL"), Module("expense"), Module("JOBCONSULTANCY") };

            var shown = ModuleAccess.WithoutPersonal(listed, m => m.ModuleKey, new[] { "JOBPORTAL", "EXPENSE" });

            Assert.Equal(new[] { "SERVICE", "JOBCONSULTANCY" }, shown.Select(m => m.ModuleKey));
        }

        [Fact]
        public void Without_a_list_of_personal_applications_nothing_is_dropped()
        {
            var listed = new[] { Module("SERVICE"), Module("JOBPORTAL") };

            Assert.Equal(2, ModuleAccess.WithoutPersonal(listed, m => m.ModuleKey, null).Count);
            Assert.Equal(2, ModuleAccess.WithoutPersonal(listed, m => m.ModuleKey, new[] { "", " " }).Count);
        }

        [Fact]
        public void The_company_list_goes_through_the_filter()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            var source = File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzBL", "Infrastructure", "User", "Modules", "AuthService.cs"));

            var start = source.IndexOf("public async Task<ApiResponse<List<ModuleDto>>> GetModules(", StringComparison.Ordinal);
            var end = source.IndexOf("public async Task<ApiResponse<List<PersonalAppDto>>> GetPersonalApps(", StringComparison.Ordinal);

            Assert.Contains("ModuleAccess.WithoutPersonal(", source.Substring(start, end - start));
        }
    }
}
