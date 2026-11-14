using System.Text.RegularExpressions;
using EncryptzBL.Common.Jobs;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The flexible candidate search of Job Consultancy (script PersonalDB/21).</summary>
    public class CandidateSearchTests
    {
        private static readonly string Script = Load();

        private static string Load()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return File.ReadAllText(Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "21_Jobs_Candidate_Search.sql"));
        }

        private static string Search
            => Regex.Match(Script, @"CREATE OR ALTER PROCEDURE jobs\.sp_Candidate_Search(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        [Fact]
        public void A_list_filter_is_trimmed_without_blanks_or_repeats_and_bounded()
        {
            Assert.Equal("[\"Kochi\",\"Thrissur\"]", ConsultancyRules.FilterList(new[] { " Kochi ", "", "kochi", "Thrissur" }));
            Assert.Null(ConsultancyRules.FilterList(new[] { "  ", "" }));
            Assert.Null(ConsultancyRules.FilterList(null));
            Assert.Null(ConsultancyRules.FilterList(new[] { new string('a', 101) }));
            Assert.Equal(20, System.Text.Json.JsonSerializer.Deserialize<List<string>>(
                ConsultancyRules.FilterList(Enumerable.Range(1, 30).Select(i => $"City {i}"))!)!.Count);
        }

        [Fact]
        public void A_list_with_known_values_takes_only_those_in_their_spelling()
        {
            Assert.Equal("[\"Remote\",\"On-site\"]", ConsultancyRules.FilterList(new[] { "remote", "On-site", "Moon" }, JobsRules.WorkModes));
            // the JSON may escape "+": the database reads it back the same
            Assert.Equal(new[] { "3-5", "10+" }, System.Text.Json.JsonSerializer.Deserialize<string[]>(
                ConsultancyRules.FilterList(new[] { "3-5", "10+", "99" }, ConsultancyRules.ExperienceBands)!));
        }

        [Fact]
        public void Only_people_who_let_employers_find_them_are_searched_and_never_by_user_id()
        {
            Assert.Contains("pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> '' AND ISNULL(@CompanyId, 0) <> 0", Search);
            var page = Search.Substring(Search.IndexOf("/* ── the page ── */", StringComparison.Ordinal));
            var columns = page.Substring(0, page.IndexOf("FROM #Found", StringComparison.Ordinal));
            // a user id is used inside, never answered as a column
            Assert.DoesNotMatch(@"SELECT\s+pr\.UserId|,\s*pr\.UserId\s*,|UserId AS", columns);
            Assert.DoesNotContain("ContactEmail", Search);
            Assert.DoesNotContain("DateOfBirth", Search);
        }

        [Fact]
        public void Each_word_is_looked_for_in_titles_skills_experience_education_and_preferences()
        {
            foreach (var field in new[] { "pr.FullName LIKE w.Pat", "pr.Headline LIKE w.Pat", "s.SkillName LIKE w.Pat", "e.Title LIKE w.Pat",
                                          "j.Kind = 'Job' AND j.Value LIKE w.Pat", "u.SubSkillName LIKE w.Pat", "e.Organisation LIKE w.Pat",
                                          "d.Course LIKE w.Pat", "l.Kind = 'Location' AND l.Value LIKE w.Pat", "pr.Summary LIKE w.Pat" })
                Assert.Contains(field, Search);
        }

        [Fact]
        public void Every_word_or_any_word_must_be_found_and_the_best_match_comes_first()
        {
            Assert.Contains("CASE WHEN @MatchAll = 1 THEN @WordCount ELSE 1 END", Search);
            Assert.Contains("ORDER BY f.Score DESC, pr.UpdatedAt DESC", Search);
            // the wildcards of LIKE in a word are taken literally
            Assert.Contains("REPLACE(REPLACE(REPLACE(w.Word, '[', '[[]'), '%', '[%]'), '_', '[_]')", Search);
        }

        [Fact]
        public void The_choices_of_the_filters_come_from_the_words_only_so_a_ticked_box_never_hides_the_others()
        {
            var choices = Search.Substring(Search.IndexOf("the choices of the filters, among the people", StringComparison.Ordinal));

            Assert.Contains("FROM #Matched m", choices);
            Assert.DoesNotContain("#Found", choices);
            foreach (var kind in new[] { "'City'", "'Skill'", "'Mode'", "'Band'" })
                Assert.Contains(kind, choices);
        }

        [Fact]
        public void A_ticked_city_or_skill_is_found_inside_a_longer_one_with_its_wildcards_taken_literally()
        {
            Assert.Contains("UPDATE @CityList  SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'", Search);
            Assert.Contains("UPDATE @SkillList SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'", Search);
            Assert.Contains("pr.City LIKE c.Pat", Search);
            Assert.Contains("s.SkillName LIKE c.Pat", Search);
        }

        [Fact]
        public void Each_filter_narrows_the_list_and_all_filters_apply_together()
        {
            var filters = Search.Substring(Search.IndexOf("/* ── the filters ── */", StringComparison.Ordinal));
            filters = filters.Substring(0, filters.IndexOf("/* ── the page ── */", StringComparison.Ordinal));

            // one WHERE, every filter joined by AND, each one open when nothing is ticked
            foreach (var open in new[] { "NOT EXISTS (SELECT 1 FROM @CityList)", "NOT EXISTS (SELECT 1 FROM @BandList)", "NOT EXISTS (SELECT 1 FROM @ModeList)",
                                         "NOT EXISTS (SELECT 1 FROM @SkillList)", "@VerifiedOnly = 0 OR pr.VerifiedAt IS NOT NULL",
                                         "@WithResume = 0 OR EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume')" })
                Assert.Contains(open, filters);
            // every filter line of the one WHERE starts with AND: none of them can widen the list
            var lines = filters.Split('\n').Select(l => l.Trim()).ToList();
            var where = lines.FindIndex(l => l.StartsWith("WHERE (@City = ''", StringComparison.Ordinal));
            Assert.True(where > 0, "the WHERE of the filters was not found");
            var top = lines.Skip(where + 1).Where(l => l.StartsWith("AND (", StringComparison.Ordinal)).ToList();
            // min years, mode, cities, bands, modes, skills, verified, resume
            Assert.Equal(8, top.Count);
        }

        private static string Search23
            => Regex.Match(File.ReadAllText(Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(ScriptPath21()))!, "PersonalDB", "23_Jobs_Candidate_Experience.sql")),
                @"CREATE OR ALTER PROCEDURE jobs\.sp_Candidate_Search(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;

        private static string ScriptPath21()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return Path.Combine(folder!.FullName, "EncryptzAPI", "Database", "PersonalDB", "21_Jobs_Candidate_Search.sql");
        }

        [Fact]
        public void Without_experience_entered_the_years_come_from_the_headline_else_they_are_not_added()
        {
            var search = Search23;

            Assert.Contains("CHARINDEX('year', h0.H)", search);
            Assert.Contains("WHEN h3.Years BETWEEN 0 AND 50 THEN 'Headline' ELSE 'None' END AS Source", search);
            Assert.Contains("CASE WHEN y.Months IS NULL THEN 'none'", search);
            Assert.Contains("('none', '0-1', '1-3', '3-5', '5-10', '10+')", search);
            Assert.Contains("b.Source AS ExperienceSource", search);
            // nobody without experience passes "at least N years"
            Assert.Contains("ISNULL(b.Months, -1) >= @MinYears * 12", search);
        }

        [Fact]
        public void Script_23_is_script_21_with_the_experience_only()
        {
            // the words, the filters and the choices are the same as in script 21
            foreach (var part in new[] { "CASE WHEN @MatchAll = 1 THEN @WordCount ELSE 1 END", "s.SkillName LIKE c.Pat", "FROM #Matched m",
                                         "ORDER BY f.Score DESC, pr.UpdatedAt DESC" })
                Assert.Contains(part, Search23);
        }

        [Fact]
        public void Not_added_is_a_band_the_filter_takes()
            => Assert.Equal("[\"none\"]", ConsultancyRules.FilterList(new[] { "NONE" }, ConsultancyRules.ExperienceBands));

        [Fact]
        public void The_parameters_of_the_first_search_still_work()
        {
            foreach (var p in new[] { "@City ", "@MinYears ", "@WorkMode ", "@Keys " })
                Assert.Contains(p, Search);
        }
    }
}
