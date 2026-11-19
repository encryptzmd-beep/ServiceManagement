using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── 18_Service_Workflow_Settings.sql: completion photo settings ─────

    public class ServiceWorkflowScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Script18() => File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "18_Service_Workflow_Settings.sql"));

        [Fact]
        public void Script_has_header_guards_and_no_use()
        {
            var s = Script18();
            Assert.Contains("dbo.Locations is missing", s);
            Assert.Contains("SET NOEXEC ON", s);
            Assert.DoesNotMatch(new Regex(@"(?m)^\s*USE\s"), s);
            Assert.DoesNotContain("crm.", s);
        }

        [Fact]
        public void Seeds_both_settings_with_felix_defaults()
        {
            var s = Script18();
            Assert.Contains("'Service.MinCompletionPhotos', N'1', 'ServiceWorkflow', 'int'", s);
            Assert.Contains("'Service.PhotoCategories', N'Before,After,Part,Signature,Other', 'ServiceWorkflow', 'string'", s);
        }

        [Fact]
        public void Merge_only_inserts()
        {
            var s = Script18();
            Assert.Contains("WHEN NOT MATCHED THEN", s);
            Assert.DoesNotMatch(new Regex(@"WHEN\s+MATCHED"), s);
            Assert.DoesNotContain("UPDATE dbo.SystemSettings", s);
        }

        [Fact]
        public void Csproj_ships_18()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\18_Service_Workflow_Settings.sql", project);
        }

        [Fact]
        public void Script_parses_as_follow_up()
        {
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("18_Service_Workflow_Settings.sql", Script18()).Batches);
        }
    }
}
