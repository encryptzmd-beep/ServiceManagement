using System.Text.RegularExpressions;
using EncryptzBL.Common.Sales;
using Xunit;

namespace EncryptzTests
{
    // ── Sales Order → Sales Confirmed → Billed (invoice attached) → Despatch ─────
    public class SalesOrderWorkflowTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] parts) => File.ReadAllText(Path.Combine(new[] { Root() }.Concat(parts).ToArray()));
        private static string Script30() => Read("EncryptzAPI", "Database", "ProjectDB", "30_Sales_Order_Workflow.sql").Replace("\r\n", "\n");

        private static string Proc(string name)
        {
            var m = Regex.Match(Script30(), @"CREATE OR ALTER PROCEDURE " + Regex.Escape(name) + @"\b(.*?)\nGO", RegexOptions.Singleline);
            Assert.True(m.Success, name + " not found");
            return m.Groups[1].Value;
        }

        [Theory]
        [InlineData("Sales Order", "Sales Confirmed")]
        [InlineData("Sales Confirmed", "Billed")]
        public void The_order_moves_one_step_at_a_time(string from, string to)
        {
            Assert.Equal(to, SalesOrderStatus.Next(from));
            Assert.Null(SalesOrderStatus.MoveProblem(from, to, hasInvoice: true));
        }

        [Fact]
        public void Billed_needs_the_invoice_and_a_confirmed_sale()
        {
            Assert.Equal("Attach the invoice PDF before marking the sales order billed.",
                SalesOrderStatus.MoveProblem("Sales Confirmed", "Billed", hasInvoice: false));
            Assert.Equal("Confirm the sale before marking it billed.",
                SalesOrderStatus.MoveProblem("Sales Order", "Billed", hasInvoice: true));
            Assert.NotNull(SalesOrderStatus.MoveProblem("Despatched", "Billed", hasInvoice: true));
            Assert.NotNull(SalesOrderStatus.MoveProblem("Sales Order", "Despatched", hasInvoice: true));
            Assert.Null(SalesOrderStatus.Next("Billed"));
        }

        [Fact]
        public void A_new_order_never_starts_as_billed()
        {
            Assert.True(SalesOrderStatus.IsStart("Sales Order"));
            Assert.True(SalesOrderStatus.IsStart("Sales Confirmed"));
            Assert.False(SalesOrderStatus.IsStart("Billed"));

            var save = Proc("dbo.sp_SalesOrder_Save");
            Assert.Contains("@Status         NVARCHAR(20)   = 'Sales Order'", save);
            Assert.Contains("IF @Status NOT IN ('Sales Order', 'Sales Confirmed')", save);
            Assert.DoesNotContain("'Billed', @UserId", save);
            // an order is changed only before it is billed
            Assert.Contains("IF @CurStatus NOT IN ('Sales Order', 'Sales Confirmed')", save);
            Assert.Contains("DEFAULT (N'Sales Order') FOR [Status]", Script30());
        }

        [Fact]
        public void The_status_is_not_taken_from_the_request()
        {
            // a client could otherwise save an order as Billed without its invoice
            Assert.DoesNotContain("Status", Regex.Match(Read("EncryptzBL", "DTO's", "SalesDtos.cs"),
                @"class SalesOrderSaveDto\s*\{(.*?)\n    \}", RegexOptions.Singleline).Groups[1].Value);
        }

        [Fact]
        public void A_crm_convert_starts_as_sales_confirmed()
            => Assert.Contains("userId, SalesOrderStatus.Confirmed)", Read("EncryptzBL", "Infrastructure", "Crm", "CrmService.Convert.cs"));

        [Fact]
        public void Billed_is_set_only_with_an_invoice_attached()
        {
            var set = Proc("dbo.sp_SalesOrder_SetStatus");
            Assert.Contains("(@Current = 'Sales Order' AND @Status = 'Sales Confirmed') OR (@Current = 'Sales Confirmed' AND @Status = 'Billed')", set);
            Assert.Contains("DocumentType = 'Invoice' AND IsDeleted = 0", set);
            Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", set);
        }

        [Fact]
        public void Only_a_billed_order_is_despatched_and_it_keeps_its_invoice()
        {
            Assert.Contains("IF @Status <> 'Billed'", Proc("dbo.sp_Despatch_Create"));
            var delete = Proc("dbo.sp_SalesDocument_Delete");
            Assert.Contains("@DocumentType = 'Invoice' AND @OrderStatus IN ('Billed', 'Despatched')", delete);
        }

        [Fact]
        public void Quotation_defaults_are_print_settings_with_the_ui_choices()
        {
            var s = Read("EncryptzAPI", "Database", "ProjectDB", "31_Quotation_Defaults.sql").Replace("\r\n", "\n");
            Assert.Contains("('Print.QuotationValidity', N'none', 'Print', 'select:none,7d,14d,15d,30d,1m,2m,3m'", s);
            Assert.Contains("('Print.QuotationPrices', N'exclusive', 'Print', 'select:exclusive,inclusive'", s);
            Assert.Contains("WHEN NOT MATCHED THEN", s);   // an admin's choice is never overwritten
            Assert.Contains(@"Database\ProjectDB\31_Quotation_Defaults.sql", Read("EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("31_Quotation_Defaults.sql", s).Batches);

            // the admin page offers the same values the setting row accepts
            var ui = Read("encryptzUI", "src", "app", "Encryptz", "components", "shared", "quotation-defaults.ts");
            foreach (var v in new[] { "none", "7d", "14d", "15d", "30d", "1m", "2m", "3m", "exclusive", "inclusive" })
                Assert.Contains($"value: '{v}'", ui);
        }

        [Fact]
        public void Job_card_reads_one_assignment_and_only_its_own_technician_may_open_it()
        {
            var s = Read("EncryptzAPI", "Database", "ProjectDB", "32_Job_Card.sql").Replace("\r\n", "\n");
            Assert.Contains("CREATE OR ALTER PROCEDURE dbo.sp_JobCard_Get", s);
            Assert.Contains("WHERE a.AssignmentId = @AssignmentId;", s);
            Assert.Contains("a.Status NOT IN ('Removed', 'Cancelled')", s);
            Assert.Contains(@"Database\ProjectDB\32_Job_Card.sql", Read("EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("32_Job_Card.sql", s).Batches);

            // a technician gets only an own assignment (GuardAssignment), as on the work order details
            var api = Read("EncryptzAPI", "Controllers", "TechnicianController.cs");
            var at = api.IndexOf("[HttpGet(\"job-card/{assignmentId:int}\")]", StringComparison.Ordinal);
            Assert.True(at > 0, "the job card endpoint is missing");
            var body = api.Substring(at, api.IndexOf("_service.GetJobCard(", at, StringComparison.Ordinal) - at);
            Assert.Contains("await GuardAssignment(assignmentId)", body);
        }

        [Fact]
        public void Script_is_shipped_and_parses_as_a_follow_up()
        {
            Assert.Contains(@"Database\ProjectDB\30_Sales_Order_Workflow.sql", Read("EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains("dbo.Locations is missing", Script30());
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("30_Sales_Order_Workflow.sql", Script30()).Batches);
        }
    }
}
