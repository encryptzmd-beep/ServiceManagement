using System.Text.RegularExpressions;
using EncryptzBL.Common.Sales;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    // ── one customer (party) record: same mobile or same GSTIN is the same party ─────
    public class CustomerMasterTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] parts) => File.ReadAllText(Path.Combine(new[] { Root() }.Concat(parts).ToArray())).Replace("\r\n", "\n");
        private static string Script33() => Read("EncryptzAPI", "Database", "ProjectDB", "33_Customer_Master.sql");

        private static CustomerImportRowDto Row(int n, string name, string mobile, string? gstin = null)
            => new() { RowNumber = n, CustomerName = name, MobileNumber = mobile, GSTIN = gstin };

        [Theory]
        [InlineData("32ABCDE1234F1Z5", true)]
        [InlineData(" 32abcde1234f1z5 ", true)]
        [InlineData("32ABCDE1234F1Z", false)]
        [InlineData("", true)]
        public void A_gstin_has_its_15_character_shape(string value, bool ok)
            => Assert.Equal(ok, SalesInputRules.IsGstinOrBlank(value));

        [Fact]
        public void A_row_needs_a_name_and_a_valid_mobile()
        {
            Assert.Null(CustomerImportRules.RowProblem(Row(2, "Anil Kumar", "98460 12345")));
            Assert.NotNull(CustomerImportRules.RowProblem(Row(2, "", "9846012345")));
            Assert.NotNull(CustomerImportRules.RowProblem(Row(2, "Anil Kumar", "12345")));
            Assert.NotNull(CustomerImportRules.RowProblem(Row(2, "Anil Kumar", "9846012345", "BADGSTIN")));
        }

        [Fact]
        public void The_same_party_twice_in_a_file_is_found_by_mobile_or_gstin()
        {
            var rows = new List<CustomerImportRowDto>
            {
                Row(2, "ABC Enterprises", "9846012345", "32ABCDE1234F1Z5"),
                Row(3, "ABC Enterprises (Kochi)", "+91 98460-12345"),         // same mobile
                Row(4, "ABC Ent", "9847099999", "32abcde1234f1z5"),            // same GSTIN
                Row(5, "Meera Nair", "9895011111"),
            };
            var same = CustomerImportRules.SamePartyInFile(rows);
            Assert.Equal(2, same[3]);
            Assert.Equal(2, same[4]);
            Assert.False(same.ContainsKey(5));
        }

        [Fact]
        public void A_row_updates_the_mobile_match_and_refuses_two_different_parties()
        {
            var a = new CustomerMatchDto { CustomerId = 7, CustomerName = "ABC", MatchedOn = "Mobile" };
            var b = new CustomerMatchDto { CustomerId = 9, CustomerName = "XYZ", MatchedOn = "GSTIN" };
            Assert.Equal(7, CustomerImportRules.Existing(new List<CustomerMatchDto> { a }).CustomerId);
            Assert.Equal(9, CustomerImportRules.Existing(new List<CustomerMatchDto> { b }).CustomerId);
            Assert.Null(CustomerImportRules.Existing(new List<CustomerMatchDto>()).CustomerId);
            var (id, problem) = CustomerImportRules.Existing(new List<CustomerMatchDto> { a, b });
            Assert.Null(id);
            Assert.Contains("ABC", problem);
        }

        [Fact]
        public void The_save_never_makes_a_second_record_for_one_party()
        {
            var s = Script33();
            var save = Regex.Match(s, @"CREATE OR ALTER PROCEDURE dbo.sp_Sales_Customer_Save\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value;
            Assert.Contains("WHERE dbo.fn_MobileKey(MobileNumber) = @MobileKey", save);
            Assert.Contains("OR (@GSTIN IS NOT NULL AND UPPER(LTRIM(RTRIM(GSTIN))) = @GSTIN)", save);
            Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", save);
            Assert.Contains("Another customer already has this GSTIN.", save);
            Assert.Contains("RETURN RIGHT(@d, 10);", s);
            Assert.Contains("CREATE OR ALTER PROCEDURE dbo.sp_Customer_Matches", s);
            Assert.Contains("AND CustomerId IS NULL", Regex.Match(s, @"PROCEDURE crm.sp_Lead_SetCustomer\b(.*?)\nGO", RegexOptions.Singleline).Groups[1].Value);
            Assert.Contains(@"Database\ProjectDB\33_Customer_Master.sql", Read("EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("33_Customer_Master.sql", s).Batches);
        }

        [Fact]
        public void A_saved_quotation_links_its_customer_and_the_convert_uses_it()
        {
            var quotations = Read("EncryptzBL", "Infrastructure", "Crm", "CrmService.Quotations.cs");
            Assert.Contains("if (saved.Success) await LinkCustomer(", quotations);
            Assert.Contains("\"crm.sp_Lead_SetCustomer\"", quotations);
            var convert = Read("EncryptzBL", "Infrastructure", "Crm", "CrmService.Convert.cs");
            Assert.Contains("c.CustomerId == lead.CustomerId", convert);
            Assert.Contains("_sales.CustomerMatches(lead.Mobile, q?.CustomerGstin)", convert);
        }

        [Fact]
        public void The_customers_menu_is_given_to_the_admins()
        {
            var s = Read("EncryptzAPI", "Database", "MainDB", "37_Customers_Menu.sql");
            Assert.Contains("N'sales/customers'", s);
            Assert.Contains("WHERE r.RoleName IN ('Admin', 'CompanyAdmin')", s);
        }
    }
}
