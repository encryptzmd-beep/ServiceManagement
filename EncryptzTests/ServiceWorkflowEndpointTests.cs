using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // Completion photo rule in the API (source checks, like CrmEndpointsTests)
    public class ServiceWorkflowEndpointTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Service() => File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Technician", "modules", "TechnicianService.cs"));
        private static string Controller() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Controllers", "TechnicianController.cs"));

        private static string Method(string source, string signatureStart)
        {
            var i = source.IndexOf(signatureStart, StringComparison.Ordinal);
            Assert.True(i >= 0, signatureStart + " not found");
            var next = Regex.Match(source.Substring(i + signatureStart.Length), @"\n\s*(\[Http|public |private |//\s*(GET|POST|PUT))");
            return next.Success ? source.Substring(i, signatureStart.Length + next.Index) : source.Substring(i);
        }

        [Fact]
        public void Count_uses_the_complaint_of_the_assignment()
        {
            var body = Method(Service(), "public async Task<int> CountServiceImages(int assignmentId)");
            Assert.Contains("COUNT(", body);
            Assert.Contains("a.ComplaintId = si.ComplaintId", body);
            Assert.Contains("a.AssignmentId = @AssignmentId", body);
        }

        [Fact]
        public void Rules_read_both_keys()
        {
            var body = Method(Service(), "public async Task<CompletionRulesDto> GetCompletionRules(int? assignmentId)");
            Assert.Contains("ServiceWorkflowRules.MinPhotosKey", body);
            Assert.Contains("ServiceWorkflowRules.CategoriesKey", body);
            Assert.Contains("ParseMinPhotos", body);
            Assert.Contains("ParseCategories", body);
            Assert.Contains("CountServiceImages", body);
        }

        [Fact]
        public void Completion_rules_route()
        {
            var c = Controller();
            var m = Regex.Match(c, @"((?:\s*\[[^\]]+\])+)\s*public async Task<IActionResult> GetCompletionRules");
            Assert.True(m.Success, "GetCompletionRules action not found");
            Assert.Contains("[HttpGet(\"completion-rules\")]", m.Groups[1].Value);
            Assert.DoesNotContain("Authorize(Roles", m.Groups[1].Value);
            Assert.Contains("GuardAssignment", Method(c, "public async Task<IActionResult> GetCompletionRules"));
        }

        [Fact]
        public void Completion_rules_return_the_minimum_the_server_enforces()
        {
            // back office, or the appsettings switch off: the dialog must not block either
            var body = Method(Controller(), "public async Task<IActionResult> GetCompletionRules");
            Assert.Contains("RequireCompletionPhoto && User.IsTechnicianScoped()", body);
            Assert.Contains("rules.MinPhotos = 0", body);
        }

        [Fact]
        public void Update_status_uses_the_count()
        {
            var body = Method(Controller(), "public async Task<IActionResult> UpdateStatus(");
            Assert.Contains("RequireCompletionPhoto && User.IsTechnicianScoped()", body);
            Assert.Contains("CountServiceImages", body);
            Assert.Contains("PhotoProblem", body);
            Assert.DoesNotContain("HasServiceImage", body);
        }
    }
}
