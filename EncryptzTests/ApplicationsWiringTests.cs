using Xunit;

namespace EncryptzTests
{
    /// <summary>
    /// The rules are tested on their own (ModuleAccessTests, ApplicationRulesTests). These
    /// checks pin that the services really call them: read from the source, because a
    /// service cannot be started in a test without the live database.
    /// </summary>
    public class ApplicationsWiringTests
    {
        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Source(string file)
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzBL", "Infrastructure", "User", "Modules", file));

        /// <summary>Text of one method: from its signature to the next member of the class.</summary>
        private static string Method(string source, string signature)
        {
            var start = source.IndexOf(signature, StringComparison.Ordinal);
            Assert.True(start >= 0, signature + " was not found");
            var next = source.IndexOf("\n        public ", start + signature.Length, StringComparison.Ordinal);
            return source.Substring(start, (next < 0 ? source.Length : next) - start);
        }

        [Fact]
        public void Entering_a_module_asks_whether_it_is_released()
        {
            var body = Method(Source("AuthService.cs"), "ResolveModuleScope(int userId, int companyId, string moduleKey)");

            Assert.Contains("ModuleAccess.IsReleasedOf(row)", body);
        }

        [Fact]
        public void The_module_list_asks_whether_each_module_is_released()
        {
            var body = Method(Source("AuthService.cs"), "public async Task<ApiResponse<List<ModuleDto>>> GetModules(int userId, int companyId)");

            Assert.Contains("ModuleAccess.IsReleasedOf(r)", body);
        }

        [Fact]
        public void Personal_applications_are_an_empty_list_while_script_21_is_missing()
        {
            var body = Method(Source("AuthService.cs"), "public async Task<ApiResponse<List<PersonalAppDto>>> GetPersonalApps()");

            Assert.Contains("catch (Exception ex) when (CompanyCreateRules.IsNotInstalled(ex))", body);
            Assert.Contains("ApiResponse<List<PersonalAppDto>>.Ok(new List<PersonalAppDto>()", body);
        }

        [Theory]
        [InlineData("public async Task<ApiResponse<List<ApplicationDto>>> GetApplications(PlatformActor actor)")]
        [InlineData("public async Task<ApiResponse<int>> SaveApplication(ApplicationDto dto, PlatformActor actor)")]
        public void The_catalogue_is_refused_to_everyone_but_a_platform_administrator_before_any_database_call(string signature)
        {
            var body = Method(Source("PlatformService.cs"), signature);

            var refusal = body.IndexOf("if (!actor.IsPlatformAdmin)", StringComparison.Ordinal);
            var database = body.IndexOf("Async", body.IndexOf('{'), StringComparison.Ordinal);

            Assert.True(refusal >= 0, "no platform administrator check");
            Assert.True(refusal < database, "the database is called before the check");
        }
    }
}
