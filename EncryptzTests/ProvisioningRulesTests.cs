using EncryptzBL.Common.Provisioning;
using Xunit;

namespace EncryptzTests
{
    public class TenantDatabaseNameTests
    {
        [Theory]
        [InlineData(1, "EncryptzTenant_000001")]
        [InlineData(123, "EncryptzTenant_000123")]
        [InlineData(999999, "EncryptzTenant_999999")]
        [InlineData(1234567, "EncryptzTenant_1234567")]
        public void The_name_is_built_from_the_company_id_only(int companyId, string expected)
        {
            Assert.Equal(expected, TenantDatabaseName.For(companyId));
            Assert.True(TenantDatabaseName.IsGenerated(expected));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public void There_is_no_name_without_a_company(int companyId)
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => TenantDatabaseName.For(companyId));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("master")]
        [InlineData("MainDBEncryptz")]
        [InlineData("FelixServiceDB")]
        [InlineData("EncryptzTenant_")]
        [InlineData("EncryptzTenant_12")]
        [InlineData("EncryptzTenant_000001]; DROP DATABASE x--")]
        [InlineData("EncryptzTenant_00000a")]
        [InlineData(" EncryptzTenant_000001")]
        [InlineData("encryptztenant_000001")]
        [InlineData("EncryptzTenant_000000")]
        public void Anything_else_is_not_a_generated_name(string? name)
        {
            Assert.False(TenantDatabaseName.IsGenerated(name));
        }

        [Theory]
        [InlineData("EncryptzTenant_000007\n")]
        [InlineData("EncryptzTenant_000007\r\n")]
        [InlineData("EncryptzTenant_0000007")]
        [InlineData("EncryptzTenant_2147483648")]
        [InlineData("EncryptzTenant_9999999999")]
        [InlineData("EncryptzTenant_\u0660\u0660\u0660\u0660\u0660\u0667")]   // Arabic-Indic digits
        [InlineData("EncryptzTenant_\uFF10\uFF10\uFF10\uFF10\uFF10\uFF17")]   // full-width digits
        public void A_name_that_only_looks_generated_is_not_one(string name)
        {
            Assert.False(TenantDatabaseName.IsGenerated(name));
        }
    }

    public class SqlBatchSplitterTests
    {
        [Fact]
        public void A_script_is_split_at_lines_that_hold_only_GO()
        {
            var batches = SqlBatchSplitter.Split("SELECT 1;\r\nGO\r\nSELECT 2;\nGO\nSELECT 3;");

            Assert.Equal(new[] { "SELECT 1;", "SELECT 2;", "SELECT 3;" }, batches);
        }

        [Fact]
        public void GO_is_recognised_in_any_case_with_blanks_around_it()
        {
            var batches = SqlBatchSplitter.Split("SELECT 1\n  go  \nSELECT 2\n\tGo\nSELECT 3");

            Assert.Equal(3, batches.Count);
        }

        [Fact]
        public void GO_inside_a_line_does_not_split()
        {
            var batches = SqlBatchSplitter.Split("SELECT 'GO';\nSELECT GOAL FROM t; -- GO\nPRINT 'let us GO'");

            Assert.Single(batches);
        }

        [Fact]
        public void Empty_batches_are_left_out()
        {
            var batches = SqlBatchSplitter.Split("GO\n\nGO\nSELECT 1\nGO\n   \nGO\n");

            Assert.Equal(new[] { "SELECT 1" }, batches);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   \n ")]
        public void Nothing_gives_no_batches(string? script)
        {
            Assert.Empty(SqlBatchSplitter.Split(script!));
        }

        [Fact]
        public void A_byte_order_mark_at_the_start_is_not_part_of_the_first_batch()
        {
            Assert.Equal(new[] { "SELECT 1;", "SELECT 2;" }, SqlBatchSplitter.Split("\uFEFFSELECT 1;\nGO\nSELECT 2;"));
            Assert.Equal(new[] { "SELECT 1;" }, SqlBatchSplitter.Split("\uFEFFGO\nSELECT 1;\nGO"));
            Assert.Empty(SqlBatchSplitter.Split("\uFEFF"));
        }

        [Fact]
        public void A_lone_carriage_return_is_a_line_end()
        {
            var batches = SqlBatchSplitter.Split("SELECT 1;\rGO\rSELECT 2;\r  go\rSELECT 3;");

            Assert.Equal(new[] { "SELECT 1;", "SELECT 2;", "SELECT 3;" }, batches);
        }
    }

    public class CompanyCreateRulesTests
    {
        [Fact]
        public void A_request_is_trimmed_and_the_code_upper_cased()
        {
            var (company, error) = CompanyCreateRules.Normalize("  Hamster A/C  ", " ham-01 ", "  Kochi  ", " MG Road ", " Kochi ", " 0484 123 ");

            Assert.Null(error);
            Assert.Equal(new NewCompany("Hamster A/C", "HAM-01", "Kochi", "MG Road", "Kochi", "0484 123"), company);
        }

        [Fact]
        public void The_first_branch_is_Head_Office_when_none_is_given()
        {
            var (company, _) = CompanyCreateRules.Normalize("Acme", "ACME", "  ", null, null, null);

            Assert.Equal("Head Office", company!.FirstBranchName);
            Assert.Null(company.Address);
            Assert.Null(company.City);
            Assert.Null(company.PhoneNumber);
        }

        [Theory]
        [InlineData(null, "ACME")]
        [InlineData("", "ACME")]
        [InlineData("A", "ACME")]
        public void A_company_needs_a_name_of_two_characters_or_more(string? name, string code)
        {
            var (company, error) = CompanyCreateRules.Normalize(name, code, null, null, null, null);

            Assert.Null(company);
            Assert.Equal("Enter the company name", error);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("A")]
        [InlineData("AB CD")]
        [InlineData("AB'CD")]
        [InlineData("AB]CD")]
        [InlineData("AB;CD")]
        [InlineData("-ABCD")]
        [InlineData("ÄBCD")]
        [InlineData("ABCDEFGHIJKLMNOPQRSTU")]
        public void A_company_code_is_2_to_20_letters_digits_dash_or_underscore(string? code)
        {
            var (company, error) = CompanyCreateRules.Normalize("Acme", code, null, null, null, null);

            Assert.Null(company);
            Assert.Equal("The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit", error);
        }

        [Theory]
        [InlineData("\uFF21\uFF22\uFF23\uFF24")]   // full-width ABCD
        [InlineData("\u0131d")]                     // dotless i: upper-cases to I
        [InlineData("\u017Fa")]                     // long s: upper-cases to S
        [InlineData("AB\nCD")]
        [InlineData("AB\u200DCD")]
        public void A_company_code_that_only_looks_plain_is_refused(string code)
        {
            var (company, error) = CompanyCreateRules.Normalize("Acme", code, null, null, null, null);

            Assert.Null(company);
            Assert.Equal("The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit", error);
        }

        [Fact]
        public void A_line_end_after_the_company_code_is_trimmed_away()
        {
            var (company, error) = CompanyCreateRules.Normalize("Acme", "AB\n", null, null, null, null);

            Assert.Null(error);
            Assert.Equal("AB", company!.CompanyCode);
        }

        [Theory]
        [InlineData("\u200B\u200B")]      // two zero-width spaces
        [InlineData("--")]
        [InlineData("\u200D\u200D")]
        [InlineData("' ; [")]
        public void A_company_name_needs_a_letter_or_a_digit(string name)
        {
            var (company, error) = CompanyCreateRules.Normalize(name, "ACME", null, null, null, null);

            Assert.Null(company);
            Assert.Equal("Enter the company name", error);
        }

        [Theory]
        [InlineData("--")]
        [InlineData("\u200D\u200D")]
        [InlineData("...")]
        public void A_branch_name_needs_a_letter_or_a_digit(string branch)
        {
            var (company, error) = CompanyCreateRules.Normalize("Acme", "ACME", branch, null, null, null);

            Assert.Null(company);
            Assert.Equal("Enter the branch name", error);
        }

        [Theory]
        [InlineData("Ac\u202Eme")]          // right-to-left override
        [InlineData("Ac\u200Bme")]          // zero-width space
        [InlineData("Ac\u2060me")]          // word joiner
        [InlineData("Ac\uFEFFme")]          // byte order mark
        [InlineData("Ac\u00ADme")]          // soft hyphen
        [InlineData("Ac\u2028me")]          // line separator
        [InlineData("Ac\u2029me")]          // paragraph separator
        [InlineData("Ac\uE000me")]          // private use
        [InlineData("Ac\u0378me")]          // not assigned
        [InlineData("Ac\uDB80\uDC00me")]    // private use, plane 15
        public void Invisible_and_unusable_characters_are_refused_in_every_free_text(string text)
        {
            const string expected = "One of the values contains characters that are not allowed";

            Assert.Equal(expected, CompanyCreateRules.Normalize(text, "ACME", null, null, null, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", text, null, null, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, text, null, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, text, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, null, text).Error);
        }

        // not InlineData: half a surrogate pair does not survive being stored in an attribute
        [Fact]
        public void Half_a_surrogate_pair_is_refused_in_every_free_text()
        {
            const string expected = "One of the values contains characters that are not allowed";
            var texts = new[]
            {
                "Ac" + (char)0xD83D + "me",                           // high half alone
                "Ac" + (char)0xDE00 + "me",                           // low half alone
                "Acme" + (char)0xD83D,                                // high half at the end
                "Ac" + (char)0xDE00 + (char)0xD83D + "me",            // the two halves in the wrong order
                "Ac" + (char)0xD83D + (char)0xD83D + (char)0xDE00,    // a high half before a valid pair
                "Ac" + (char)0xFFFF + "me"                            // not a character
            };

            foreach (var text in texts)
            {
                Assert.Equal(expected, CompanyCreateRules.Normalize(text, "ACME", null, null, null, null).Error);
                Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", text, null, null, null).Error);
                Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, text, null, null).Error);
                Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, text, null).Error);
                Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, null, text).Error);
            }
        }

        [Theory]
        [InlineData("Ac\u0000me")]
        [InlineData("Ac\nme")]
        [InlineData("Ac\tme")]
        [InlineData("Ac\u0085me")]
        public void Control_characters_are_refused_in_address_city_and_phone_too(string text)
        {
            const string expected = "One of the values contains characters that are not allowed";

            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, text, null, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, text, null).Error);
            Assert.Equal(expected, CompanyCreateRules.Normalize("Acme", "ACME", null, null, null, text).Error);
        }

        [Theory]
        [InlineData("\u0D15\u0D4D\u200D\u0D37 Traders")]     // Malayalam with a zero-width joiner
        [InlineData("\u0D15\u0D4D\u200C\u0D37 Traders")]     // ... with a zero-width non-joiner
        [InlineData("Cool Air \uD83D\uDE00")]                 // an emoji (a valid surrogate pair)
        [InlineData("\uD840\uDC00\uD840\uDC01")]             // letters outside the basic plane only
        public void Joiners_of_Indic_scripts_and_valid_surrogate_pairs_are_kept_unchanged(string text)
        {
            var (company, error) = CompanyCreateRules.Normalize(text, "ACME", text, text, null, null);

            Assert.Null(error);
            Assert.Equal(text, company!.CompanyName);
            Assert.Equal(text, company.FirstBranchName);
            Assert.Equal(text, company.Address);
        }

        [Fact]
        public void Text_longer_than_its_column_is_refused()
        {
            Assert.NotNull(CompanyCreateRules.Normalize(new string('a', 201), "ACME", null, null, null, null).Error);
            Assert.NotNull(CompanyCreateRules.Normalize("Acme", "ACME", new string('b', 201), null, null, null).Error);
            Assert.NotNull(CompanyCreateRules.Normalize("Acme", "ACME", null, new string('c', 401), null, null).Error);
            Assert.NotNull(CompanyCreateRules.Normalize("Acme", "ACME", null, null, new string('d', 101), null).Error);
            Assert.NotNull(CompanyCreateRules.Normalize("Acme", "ACME", null, null, null, new string('1', 31)).Error);
            Assert.Null(CompanyCreateRules.Normalize(new string('a', 200), "ACME", new string('b', 200), new string('c', 400), new string('d', 100), new string('1', 30)).Error);
        }

        [Theory]
        [InlineData("Ac\u0000me")]
        [InlineData("Ac\nme")]
        [InlineData("Ac\tme")]
        public void Control_characters_are_refused(string name)
        {
            Assert.NotNull(CompanyCreateRules.Normalize(name, "ACME", null, null, null, null).Error);
            Assert.NotNull(CompanyCreateRules.Normalize("Acme", "ACME", name, null, null, null).Error);
        }

        [Fact]
        public void Quotes_and_brackets_in_free_text_are_allowed_because_it_is_only_ever_a_parameter()
        {
            var (company, error) = CompanyCreateRules.Normalize("O'Brien [Kochi]; Ltd", "OB1", "Main -- branch", null, null, null);

            Assert.Null(error);
            Assert.Equal("O'Brien [Kochi]; Ltd", company!.CompanyName);
        }

        [Theory]
        [InlineData(0, 1, false, null)]
        [InlineData(1, 1, false, "You can create 1 company. You have reached the limit.")]
        [InlineData(2, 3, false, null)]
        [InlineData(3, 3, false, "You can create 3 companies. You have reached the limit.")]
        [InlineData(5, 3, false, "You can create 3 companies. You have reached the limit.")]
        [InlineData(0, 0, false, "Company creation is not available right now")]
        [InlineData(0, -1, false, "Company creation is not available right now")]
        [InlineData(50, 1, true, null)]
        [InlineData(0, 0, true, null)]
        public void The_limit_counts_for_everyone_but_platform_administrators(int created, int limit, bool platformAdmin, string? expected)
        {
            Assert.Equal(expected, CompanyCreateRules.LimitMessage(created, limit, platformAdmin));
        }
    }

    public class PlatformSettingRulesTests
    {
        [Theory]
        [InlineData("1", "1")]
        [InlineData(" 5 ", "5")]
        [InlineData("0", "0")]
        [InlineData("100", "100")]
        [InlineData("007", "7")]
        [InlineData("5\n", "5")]
        public void The_company_limit_is_a_number_from_0_to_100(string input, string stored)
        {
            var (value, error) = PlatformSettingRules.Validate(PlatformSettingRules.MaxCompaniesPerUser, input);

            Assert.Null(error);
            Assert.Equal(stored, value);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("-1")]
        [InlineData("101")]
        [InlineData("two")]
        [InlineData("1.5")]
        [InlineData("+5")]
        [InlineData("\uFF10\uFF10\uFF15")]   // full-width 005
        [InlineData("\u0665")]               // Arabic-Indic 5
        [InlineData("99999999999")]
        [InlineData("1e1")]
        [InlineData("0x5")]
        public void Any_other_company_limit_is_refused(string? input)
        {
            Assert.NotNull(PlatformSettingRules.Validate(PlatformSettingRules.MaxCompaniesPerUser, input).Error);
        }

        [Theory]
        [InlineData("", "")]
        [InlineData(null, "")]
        [InlineData("  ", "")]
        [InlineData("FelixServiceDB", "FelixServiceDB")]
        [InlineData(" Tenant_Template_1 ", "Tenant_Template_1")]
        [InlineData("db\n", "db")]
        public void The_lookup_source_is_empty_or_a_plain_database_name(string? input, string stored)
        {
            var (value, error) = PlatformSettingRules.Validate(PlatformSettingRules.TenantLookupSourceDb, input);

            Assert.Null(error);
            Assert.Equal(stored, value);
        }

        [Theory]
        [InlineData("x]; DROP DATABASE y--")]
        [InlineData("my db")]
        [InlineData("db.dbo")]
        [InlineData("[db]")]
        [InlineData("db'")]
        [InlineData("d\nb")]
        [InlineData("\uFF44\uFF42")]   // full-width db
        [InlineData("master")]
        [InlineData("TEMPDB")]
        [InlineData("model")]
        [InlineData("msdb")]
        public void A_lookup_source_that_is_not_a_plain_user_database_name_is_refused(string input)
        {
            Assert.NotNull(PlatformSettingRules.Validate(PlatformSettingRules.TenantLookupSourceDb, input).Error);
        }

        [Fact]
        public void A_lookup_source_longer_than_a_database_name_is_refused()
        {
            Assert.NotNull(PlatformSettingRules.Validate(PlatformSettingRules.TenantLookupSourceDb, new string('a', 129)).Error);
            Assert.Null(PlatformSettingRules.Validate(PlatformSettingRules.TenantLookupSourceDb, new string('a', 128)).Error);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("Jwt:Key")]
        [InlineData("maxcompaniesperuser")]
        public void Only_the_known_settings_exist(string? key)
        {
            Assert.Equal("Unknown setting", PlatformSettingRules.Validate(key, "1").Error);
        }
    }
}
