using System.Text.RegularExpressions;
using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    // ── Convert to Sale: the order made from a lead and its quotation ────────

    public class CrmConvertTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string ConvertSource()
            => File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "Crm", "CrmService.Convert.cs"));

        private static LeadDetailDto Lead() => new()
        {
            LeadId = 12, LeadNo = "LD-0012", ContactName = "Anil Kumar", Mobile = "9847012345", Email = "anil@example.in",
            Address = "12 MG Road", City = "Kochi", State = "Kerala", PinCode = "682016", Status = "Negotiation"
        };

        private static QuotationDto Quote() => new()
        {
            QuotationId = 30, LeadId = 12, QuotationNo = "QT-0007", RevisionNo = 2, IsInterState = true, Status = "Sent", IsLatest = true,
            Items =
            {
                new QuotationItemDto { ProductMasterId = 5, ProductName = "RO Purifier", HsnSac = "8421", Qty = 2, Rate = 12500m, DiscountAmount = 500m, GstPercent = 18m, WarrantyMonths = 24 },
                new QuotationItemDto { ProductMasterId = null, ProductName = "Installation", HsnSac = "9987", Qty = 1, Rate = 750m, DiscountAmount = 0m, GstPercent = 18m, WarrantyMonths = 0 }
            }
        };

        private static ConvertRequestDto Request() => new() { QuotationId = 30, OrderDate = new DateTime(2026, 11, 18, 15, 30, 0), PaymentMode = " Cash " };

        [Fact]
        public void Order_carries_quotation_lines_unchanged()
        {
            var q = Quote();
            var order = CrmRules.BuildOrder(Lead(), q, 77, Request());

            Assert.Equal(q.Items.Count, order.Items.Count);
            for (var n = 0; n < q.Items.Count; n++)
            {
                var a = q.Items[n];
                var b = order.Items[n];
                Assert.Equal(a.ProductMasterId, b.ProductMasterId);
                Assert.Equal(a.ProductName, b.ProductName);
                Assert.Equal(a.HsnSac, b.HsnSac);
                Assert.Equal(a.Qty, b.Qty);
                Assert.Equal(a.Rate, b.Rate);
                Assert.Equal(a.DiscountAmount, b.DiscountAmount);
                Assert.Equal(a.GstPercent, b.GstPercent);
                Assert.Equal(a.WarrantyMonths, b.WarrantyMonths);
                Assert.Equal(0, b.SalesOrderItemId);
            }
        }

        [Fact]
        public void Order_references_quote_and_lead()
        {
            var order = CrmRules.BuildOrder(Lead(), Quote(), 77, Request());

            Assert.Equal("QT-0007/R2", order.ReferenceNo);
            Assert.Equal("From lead LD-0012", order.Notes);
            Assert.Equal(0, order.SalesOrderId);
            Assert.Equal(77, order.CustomerId);
            Assert.Equal(new DateTime(2026, 11, 18), order.OrderDate);
            Assert.Equal("Cash", order.PaymentMode);
            Assert.Equal("9847012345", order.ContactNumber);
            Assert.Equal("12 MG Road", order.BillingAddress);
            Assert.Equal("Kochi", order.City);
            Assert.Equal("Kerala", order.State);
            Assert.Equal("682016", order.PinCode);
            Assert.True(order.IsInterState);
        }

        [Fact]
        public void Several_matches_need_a_choice()
        {
            Assert.Equal("More than one customer has this mobile. Choose one", CrmRules.CustomerChoiceProblem(matches: 2, chosen: null));
            Assert.Null(CrmRules.CustomerChoiceProblem(matches: 0, chosen: null));
            Assert.Null(CrmRules.CustomerChoiceProblem(matches: 1, chosen: null));

            // the chosen customer must be one of the matches
            Assert.Null(CrmRules.CustomerChoiceProblem(new[] { 3, 4 }, 4));
            Assert.Equal("More than one customer has this mobile. Choose one", CrmRules.CustomerChoiceProblem(new[] { 3, 4 }, null));
            Assert.Equal("Choose one of the customers that have this mobile", CrmRules.CustomerChoiceProblem(new[] { 3, 4 }, 9));
            Assert.Equal("Choose one of the customers that have this mobile", CrmRules.CustomerChoiceProblem(Array.Empty<int>(), 9));
            Assert.Null(CrmRules.CustomerChoiceProblem(new[] { 3 }, null));
        }

        [Fact]
        public void Matches_use_the_same_mobile_normalisation()
        {
            Assert.True(CrmRules.SameMobile("+91 98470 12345", "9847012345"));
            Assert.True(CrmRules.SameMobile("09847012345", "98470-12345"));
            Assert.False(CrmRules.SameMobile("9847012346", "9847012345"));
            Assert.False(CrmRules.SameMobile("", ""));
        }

        [Fact]
        public void Superseded_quotation_cannot_convert()
        {
            var q = Quote(); q.Status = "Superseded"; q.IsLatest = false;
            Assert.Equal("This quotation was revised. Convert the latest revision", CrmRules.ConvertProblem(Lead(), q));

            q = Quote(); q.IsLatest = false;
            Assert.Equal("This quotation was revised. Convert the latest revision", CrmRules.ConvertProblem(Lead(), q));

            q = Quote(); q.Status = "Rejected";
            Assert.Equal("Only a draft or sent quotation can be converted", CrmRules.ConvertProblem(Lead(), q));

            Assert.Null(CrmRules.ConvertProblem(Lead(), Quote()));
        }

        [Fact]
        public void Only_an_open_quoted_lead_without_an_order_converts()
        {
            var l = Lead(); l.SalesOrderId = 4;
            Assert.Equal("This lead already has a sales order", CrmRules.ConvertProblem(l, Quote()));

            l = Lead(); l.Status = "Qualified";
            Assert.Equal("Only a lead in Quotation or Negotiation can be converted", CrmRules.ConvertProblem(l, Quote()));

            var q = Quote(); q.LeadId = 99;
            Assert.Equal("Quotation not found", CrmRules.ConvertProblem(Lead(), q));

            q = Quote(); q.Items.Clear();
            Assert.Equal("The quotation has no product lines", CrmRules.ConvertProblem(Lead(), q));
        }

        [Fact]
        public void Convert_request_is_checked()
        {
            Assert.Equal("Nothing to save", CrmRules.ConvertRequestProblem(null));
            Assert.Equal("Choose the quotation to convert", CrmRules.ConvertRequestProblem(new ConvertRequestDto { QuotationId = 0 }));
            Assert.Equal("The payment mode is too long", CrmRules.ConvertRequestProblem(new ConvertRequestDto { QuotationId = 1, PaymentMode = new string('x', 31) }));
            Assert.Equal("Enter the order date", CrmRules.ConvertRequestProblem(new ConvertRequestDto { QuotationId = 1, OrderDate = default }));
            Assert.Null(CrmRules.ConvertRequestProblem(Request()));
        }

        [Fact]
        public void Second_convert_is_refused()
        {
            var source = ConvertSource();
            var begin = source.IndexOf("\"crm.sp_Lead_BeginConvert\"", StringComparison.Ordinal);
            var order = source.IndexOf("_sales.SaveOrder(", StringComparison.Ordinal);
            Assert.True(begin >= 0, "crm.sp_Lead_BeginConvert is not called");
            Assert.True(order > begin, "the order is made before the convert is begun");

            // a failed begin returns before any customer or order is made
            var between = source.Substring(begin, order - begin);
            Assert.Matches(new Regex(@"if \(!\w+\.Success\)\s*return"), between);
            Assert.Contains("This lead is already being converted or has a sale", source);
            var refusal = between.IndexOf("return", StringComparison.Ordinal);
            Assert.DoesNotContain("_sales.SaveCustomer(", between.Substring(0, refusal));
        }

        [Fact]
        public void A_failure_is_handled_on_each_side_of_the_order()
        {
            var source = ConvertSource();
            var order = source.IndexOf("_sales.SaveOrder(", StringComparison.Ordinal);
            var finish = source.IndexOf("\"crm.sp_Lead_FinishConvert\"", StringComparison.Ordinal);
            Assert.True(finish > order, "the lead is finished before the order exists");
            Assert.Contains("\"crm.sp_Lead_CancelConvert\"", source);
            Assert.Contains("was made but the lead could not be updated. A manager can link it from the lead", source);
            Assert.Contains("_logger.LogError(", source.Substring(order));

            foreach (var proc in new[] { "crm.sp_Lead_BeginConvert", "crm.sp_Lead_FinishConvert", "crm.sp_Lead_CancelConvert", "crm.sp_Lead_LinkOrder", "crm.sp_Lead_MarkConvertUnknown" })
            {
                var at = source.IndexOf("\"" + proc + "\"", StringComparison.Ordinal);
                Assert.True(at >= 0, proc + " is not called");
                var call = source.Substring(at, source.IndexOf("});", at, StringComparison.Ordinal) - at);
                Assert.Contains("@CompanyId", call);
                Assert.Contains("@LocationId", call);
                Assert.Contains("@UserId", call);
            }
        }

        [Fact]
        public void An_exception_once_the_order_was_attempted_keeps_the_mark()
        {
            var source = ConvertSource();
            var flag = source.IndexOf("orderAttempted = true;", StringComparison.Ordinal);
            var order = source.IndexOf("_sales.SaveOrder(", StringComparison.Ordinal);
            Assert.True(flag >= 0 && flag < order, "the flag is not set just before the order call");
            // nothing else is awaited between the flag and the order call
            Assert.Single(Regex.Matches(source.Substring(flag, order - flag), "await"));

            // the guarded catch comes first and does not cancel; only the plain catch (no order attempted) cancels
            var guarded = source.IndexOf("catch (Exception ex) when (orderAttempted)", StringComparison.Ordinal);
            var plain = source.IndexOf("catch\n", guarded, StringComparison.Ordinal) is var p and >= 0 ? p : source.IndexOf("catch\r\n", guarded, StringComparison.Ordinal);
            Assert.True(guarded > order, "no catch keeps the mark once the order was attempted");
            Assert.True(plain > guarded, "the cancelling catch must come after the guarded one");
            var guardedBody = source.Substring(guarded, plain - guarded);
            Assert.DoesNotContain("CancelConvert", guardedBody);
            Assert.Contains("_logger.LogError(", guardedBody);
            Assert.Contains("{LeadId}", guardedBody);
            Assert.Contains("{QuotationId}", guardedBody);
            Assert.Contains("return ApiResponse<ConvertResultDto>.Fail(OrderMayBeMade);", guardedBody);
            Assert.Contains("CancelConvert(", source.Substring(plain, source.IndexOf("throw;", plain, StringComparison.Ordinal) - plain));
            Assert.Contains("The sale may have been made but the lead could not be updated. A manager can check the sales orders and link it from the lead", source);
        }

        [Fact]
        public void Begin_convert_frees_a_stale_marker()
        {
            var sql = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "Database", "ProjectDB", "15_CRM_Convert_Check.sql"));
            var at = sql.IndexOf("CREATE OR ALTER PROCEDURE crm.sp_Lead_BeginConvert", StringComparison.Ordinal);
            var body = sql.Substring(at, sql.IndexOf("\nGO", at, StringComparison.Ordinal) - at);
            Assert.Contains("(ConvertingAt IS NULL OR (ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND ConvertNeedsCheck = 0))", body);
        }

        [Fact]
        public void An_exception_once_the_order_was_attempted_flags_the_lead_for_a_manager()
        {
            var source = ConvertSource();
            var guarded = source.IndexOf("catch (Exception ex) when (orderAttempted)", StringComparison.Ordinal);
            var plain = source.IndexOf("catch\n", guarded, StringComparison.Ordinal) is var p and >= 0 ? p : source.IndexOf("catch\r\n", guarded, StringComparison.Ordinal);
            var guardedBody = source.Substring(guarded, plain - guarded);

            // flagged before the manager-link message is returned
            var mark = guardedBody.IndexOf("await MarkConvertUnknown(userId, isManager, companyId, leadId);", StringComparison.Ordinal);
            var fail = guardedBody.IndexOf("return ApiResponse<ConvertResultDto>.Fail(OrderMayBeMade);", StringComparison.Ordinal);
            Assert.True(mark >= 0, "the attempted-and-threw path does not call MarkConvertUnknown");
            Assert.True(mark < fail, "MarkConvertUnknown must run before the message is returned");

            // the helper calls the proc and never fails the caller: a failure is logged only
            var helper = source.IndexOf("private async Task MarkConvertUnknown(", StringComparison.Ordinal);
            Assert.True(helper >= 0);
            var helperBody = source.Substring(helper, source.IndexOf("\n        }", helper, StringComparison.Ordinal) - helper);
            Assert.Contains("\"crm.sp_Lead_MarkConvertUnknown\"", helperBody);
            Assert.Contains("catch (Exception ex) when (ex is not OperationCanceledException)", helperBody);
            Assert.Contains("_logger.LogError(", helperBody);
            Assert.DoesNotContain("throw", helperBody);
        }

        [Fact]
        public void Cancel_convert_by_a_manager_is_offered_by_the_api()
        {
            var source = ConvertSource();
            var at = source.IndexOf("public Task<ApiResponse<int>> ManagerCancelConvert(", StringComparison.Ordinal);
            Assert.True(at >= 0);
            var body = source.Substring(at, source.IndexOf("});", source.IndexOf("});", at, StringComparison.Ordinal) + 3, StringComparison.Ordinal) - at);
            Assert.Contains("if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);", body);
            Assert.Contains("\"crm.sp_Lead_CancelConvert\"", body);
            Assert.NotNull(typeof(EncryptzBL.Infrastructure.Crm.ICrmService).GetMethod("ManagerCancelConvert"));
        }
    }
}
