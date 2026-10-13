using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The jobs and the places a person prefers: what is taken, and the script that stores it.</summary>
    public class JobsPreferencesTests
    {
        private static string Script()
        {
            var dir = AppContext.BaseDirectory;
            while (dir != null && !File.Exists(Path.Combine(dir, "EncryptzAPI", "Database", "PersonalDB", "05_Jobs_Preferences.sql")))
                dir = Path.GetDirectoryName(dir);
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "EncryptzAPI", "Database", "PersonalDB", "05_Jobs_Preferences.sql"));
        }

        [Fact]
        public void Entries_are_trimmed_blanks_and_repeats_are_dropped_and_the_order_is_kept()
        {
            var p = new JobPreferencesDto
            {
                Jobs = new List<string> { "  Site Engineer ", "", "site engineer", "Quantity Surveyor" },
                Locations = new List<string> { "Kochi", " Thrissur", "KOCHI", "   " }
            };

            Assert.Null(JobsRules.PreferencesProblem(p));
            Assert.Equal(new[] { "Site Engineer", "Quantity Surveyor" }, p.Jobs);
            Assert.Equal(new[] { "Kochi", "Thrissur" }, p.Locations);
        }

        [Fact]
        public void Empty_lists_are_fine_and_missing_lists_become_empty()
        {
            var p = new JobPreferencesDto { Jobs = null!, Locations = null! };

            Assert.Null(JobsRules.PreferencesProblem(p));
            Assert.Empty(p.Jobs);
            Assert.Empty(p.Locations);
        }

        [Fact]
        public void Nothing_is_refused()
            => Assert.Equal("Nothing to save", JobsRules.PreferencesProblem(null));

        [Fact]
        public void More_than_ten_of_a_kind_is_refused()
        {
            var eleven = Enumerable.Range(1, 11).Select(i => $"Job {i}").ToList();

            Assert.Equal("Choose at most 10 preferred jobs",
                JobsRules.PreferencesProblem(new JobPreferencesDto { Jobs = eleven }));
            Assert.Equal("Choose at most 10 preferred locations",
                JobsRules.PreferencesProblem(new JobPreferencesDto { Locations = eleven }));
        }

        [Fact]
        public void An_entry_that_is_too_long_is_refused()
        {
            var longText = new string('a', 101);

            Assert.Equal("A preferred job can have at most 100 characters",
                JobsRules.PreferencesProblem(new JobPreferencesDto { Jobs = new List<string> { longText } }));
            Assert.Equal("A preferred location can have at most 100 characters",
                JobsRules.PreferencesProblem(new JobPreferencesDto { Locations = new List<string> { longText } }));
        }

        [Fact]
        public void Working_modes_are_taken_from_the_list_only_and_once()
        {
            var p = new JobPreferencesDto { WorkModes = new List<string> { "remote", " Hybrid ", "Remote" } };

            Assert.Null(JobsRules.PreferencesProblem(p));
            Assert.Equal(new[] { "Remote", "Hybrid" }, p.WorkModes);

            Assert.Equal("Choose the working mode from the list",
                JobsRules.PreferencesProblem(new JobPreferencesDto { WorkModes = new List<string> { "From the beach" } }));
        }

        [Theory]
        [InlineData(null, true)]
        [InlineData(1, true)]
        [InlineData(600000, true)]
        [InlineData(999999999, true)]
        [InlineData(0, false)]
        [InlineData(-5, false)]
        [InlineData(1000000000, false)]
        public void The_expected_CTC_is_a_yearly_amount_or_nothing(int? ctc, bool fine)
        {
            var problem = JobsRules.PreferencesProblem(new JobPreferencesDto { ExpectedCtc = ctc });

            Assert.Equal(fine ? null : "Enter the expected CTC as a yearly amount", problem);
        }

        [Fact]
        public async Task Without_a_personal_database_saving_says_not_available()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
            var jobs = new JobsService(new PersonalDbHelper(config), NullLogger<JobsService>.Instance);

            Assert.Equal(PersonalDbHelper.NotAvailable, (await jobs.SavePreferences(11, new JobPreferencesDto())).Message);
            Assert.Equal("Please log in again", (await jobs.SavePreferences(0, new JobPreferencesDto())).Message);
        }

        [Fact]
        public void The_script_has_the_table_and_the_two_procedures_and_refuses_another_database()
        {
            var script = Script();

            Assert.Contains("CREATE TABLE jobs.Preferences", script);
            Assert.Contains("CHECK (Kind IN ('Job', 'Location', 'WorkMode'))", script);
            Assert.Contains("CREATE TABLE jobs.PreferenceTerms", script);
            Assert.Contains("ExpectedCtc", script);
            Assert.Contains("CREATE OR ALTER PROCEDURE jobs.sp_Preference_List", script);
            Assert.Contains("CREATE OR ALTER PROCEDURE jobs.sp_Preference_Save", script);
            Assert.Contains("SchemaKey = 'PERSONAL_DB'", script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        /// <summary>The rule of schema jobs: no statement on a jobs table without the user.</summary>
        [Fact]
        public void Every_statement_on_the_preferences_names_the_user()
        {
            var procedures = Script().Substring(Script().IndexOf("CREATE OR ALTER PROCEDURE", StringComparison.Ordinal));
            var statements = procedures.Split(';')
                .Where(s => s.Contains("jobs.Preferences") && (s.Contains("DELETE FROM") || s.Contains("INSERT INTO") || s.Contains("FROM jobs.Preferences")))
                .ToList();

            Assert.Equal(5, statements.Count);   // list, delete, insert jobs, locations, working modes
            Assert.All(statements, s => Assert.Contains("@UserId", s));

            var terms = procedures.Split(';').Where(s => s.Contains("jobs.PreferenceTerms")).ToList();

            Assert.Equal(3, terms.Count);        // read, update, insert
            Assert.All(terms, s => Assert.Contains("@UserId", s));
        }
    }
}
