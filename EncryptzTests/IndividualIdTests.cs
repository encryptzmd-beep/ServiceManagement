using System.Text.RegularExpressions;
using EncryptzBL.Common;
using Xunit;

namespace EncryptzTests
{
    public class IndividualIdTests
    {
        // 11 symbols and the check character they must give (weights 1..11, modulo 31)
        [Theory]
        [InlineData("22222222222", '2')]     // every value 0
        [InlineData("32222222222", '3')]     // 1 x 1
        [InlineData("22222222223", 'D')]     // 11 x 1 = 11
        [InlineData("ZZZZZZZZZZZ", 'W')]     // 30 x 66 = 1980 = 63 x 31 + 27, and 27 is 'W'
        [InlineData("23456789ABC", '8')]     // values 0..10: 440 = 14 x 31 + 6, and 6 is '8'
        [InlineData("7K4M2P9QXD3", 'Q')]     // what the rule of script 22 answers on SQL Server (run as a query on 2026-10-13)
        public void The_check_character_is_the_weighted_sum_modulo_31(string body, char expected)
        {
            Assert.Equal(expected, IndividualId.CheckChar(body));
        }

        [Fact]
        public void The_alphabet_has_31_symbols_and_none_that_is_easily_misread()
        {
            Assert.Equal(31, IndividualId.Alphabet.Length);
            Assert.Equal(31, IndividualId.Alphabet.Distinct().Count());
            foreach (var ch in "01OIL")
                Assert.DoesNotContain(ch, IndividualId.Alphabet);
        }

        private static string Stored(string body) => "EZ" + body + IndividualId.CheckChar(body);

        [Fact]
        public void A_stored_id_is_shown_in_groups_of_four_after_the_prefix()
        {
            var stored = Stored("7K4M2P9QXD3");

            Assert.Equal(14, stored.Length);
            Assert.Equal("EZ-7K4M-2P9Q-XD3" + stored[13], IndividualId.Format(stored));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("TMP0123456789A")]      // the placeholder a new row has for a moment
        [InlineData("EZ7K4M2P9QXD3")]       // 13 characters
        [InlineData("XX7K4M2P9QXD3T")]
        public void Anything_that_is_not_a_stored_id_is_shown_as_nothing(string? value)
        {
            Assert.Equal("", IndividualId.Format(value));
        }

        [Theory]
        [InlineData("EZ-7K4M-2P9Q-XD3{0}", false)]
        [InlineData("ez-7k4m-2p9q-xd3{0}", true)]
        [InlineData("  EZ 7K4M 2P9Q XD3{0} ", false)]
        [InlineData("EZ7K4M2P9QXD3{0}", false)]
        [InlineData("7K4M-2P9Q-XD3{0}", false)]          // typed without the prefix
        public void What_a_person_types_is_brought_to_the_stored_form(string typedPattern, bool lowerCase)
        {
            var stored = Stored("7K4M2P9QXD3");
            var check = stored[13].ToString();
            var typed = string.Format(typedPattern, lowerCase ? check.ToLowerInvariant() : check);

            Assert.Equal(stored, IndividualId.Normalize(typed));
            Assert.True(IndividualId.IsValid(stored));
        }

        [Fact]
        public void One_wrong_character_is_noticed_at_every_position()
        {
            var stored = Stored("7K4M2P9QXD3");

            for (var position = 2; position < stored.Length; position++)
            {
                foreach (var other in IndividualId.Alphabet.Where(c => c != stored[position]))
                {
                    var wrong = stored.Substring(0, position) + other + stored.Substring(position + 1);
                    Assert.False(IndividualId.IsValid(wrong), $"{wrong} was accepted");
                }
            }
        }

        [Fact]
        public void Two_neighbouring_characters_swapped_are_noticed()
        {
            var stored = Stored("7K4M2P9QXD3");

            for (var position = 2; position < stored.Length - 1; position++)
            {
                if (stored[position] == stored[position + 1]) continue;
                var swapped = stored.Substring(0, position) + stored[position + 1] + stored[position] + stored.Substring(position + 2);
                Assert.False(IndividualId.IsValid(swapped), $"{swapped} was accepted");
            }
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("EZ-0000-0000-0000")]           // 0 is not in the alphabet
        [InlineData("EZ-7K4M-2P9Q-XD3")]            // too short
        [InlineData("EZ-7K4M-2P9Q-XD3TT")]          // too long
        [InlineData("EZ-7K4M-2P9Q-XD3T; DROP")]
        [InlineData("EZ-７K4M-2P9Q-XD3T")]      // a full-width digit
        public void What_is_not_an_id_is_not_normalised(string? typed)
        {
            Assert.Null(IndividualId.Normalize(typed));
            Assert.False(IndividualId.IsValid(typed));
        }
    }

    /// <summary>Text checks on script 22: it cannot be run in a test (the server is live).</summary>
    public class IndividualIdScriptTests
    {
        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Script()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "22_Individual_Id.sql"));

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_or_drops(string forbidden)
        {
            var code = Regex.Replace(Script(), @"/\*.*?\*/", "", RegexOptions.Singleline);
            code = Regex.Replace(code, @"--[^\n]*", "");

            Assert.DoesNotContain(forbidden, code, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_database_uses_the_same_alphabet_and_prefix_as_the_api()
        {
            var script = Script();

            Assert.Contains("'" + IndividualId.Alphabet + "'", script);
            Assert.Contains("'" + IndividualId.Prefix + "'", script);
            Assert.Contains("% 31", script);
        }

        [Fact]
        public void The_column_is_added_only_when_it_is_missing_and_ids_are_unique()
        {
            var script = Script();

            Assert.Contains("IF COL_LENGTH('dbo.Users', 'IndividualId') IS NULL", script);
            Assert.Contains("UQ_Users_IndividualId", script);
        }

        [Fact]
        public void An_id_is_given_on_every_insert_and_never_changed()
        {
            var script = Script();

            Assert.Contains("CREATE OR ALTER TRIGGER dbo.TR_Users_IndividualId", script);
            Assert.Contains("AFTER INSERT, UPDATE", script);
            Assert.Contains("The Individual ID of a user cannot be changed", script);
        }

        [Theory]
        [InlineData("sp_GetUserById")]
        [InlineData("sp_User_GetProfile")]
        public void The_procedures_that_read_a_user_return_the_id(string procedure)
        {
            var script = Script();
            var start = script.IndexOf("CREATE OR ALTER PROCEDURE dbo." + procedure, StringComparison.Ordinal);
            Assert.True(start >= 0, procedure + " is not in script 22");
            var body = script.Substring(start, script.IndexOf("\nGO", start, StringComparison.Ordinal) - start);

            Assert.Contains("AS IndividualId", body);
        }
    }
}
