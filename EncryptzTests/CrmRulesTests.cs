using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class CrmRulesTests
    {
        private static LeadSaveDto Lead(string name = "Anil", string mobile = "9847012345")
            => new() { ContactName = name, Mobile = mobile };

        [Fact]
        public void Lead_needs_name_and_mobile()
        {
            Assert.Null(CrmRules.LeadProblem(Lead()));
            Assert.Equal("Enter the contact name", CrmRules.LeadProblem(Lead(" ")));
            Assert.Equal("Enter a valid 10-digit mobile number", CrmRules.LeadProblem(Lead(mobile: "12345")));
            Assert.Equal("Enter a valid 10-digit mobile number", CrmRules.LeadProblem(Lead(mobile: "5847012345")));
            Assert.Equal("Nothing to save", CrmRules.LeadProblem(null));
        }

        [Fact]
        public void Lead_email_and_qty_are_checked()
        {
            var l = Lead(); l.Email = "bad";
            Assert.Equal("Enter a valid e-mail address", CrmRules.LeadProblem(l));
            l.Email = " a@b.in "; l.EstimatedQty = 0;
            Assert.Equal("The quantity must be at least 1", CrmRules.LeadProblem(l));
            l.EstimatedQty = 2;
            Assert.Null(CrmRules.LeadProblem(l));
            Assert.Equal("a@b.in", l.Email);
        }

        [Fact]
        public void Mobile_is_normalised()
        {
            var l = Lead(mobile: " +91 98470 12345 ");
            Assert.Null(CrmRules.LeadProblem(l));
            Assert.Equal("9847012345", l.Mobile);
        }

        [Fact]
        public void Follow_up_type_from_list()
        {
            var f = new FollowUpSaveDto { Type = " meeting ", FollowUpAt = new DateTime(2026, 1, 5) };
            Assert.Null(CrmRules.FollowUpProblem(f));
            Assert.Equal("Meeting", f.Type);
            f.Type = "Smoke signal";
            Assert.Equal("Choose the type of follow-up from the list", CrmRules.FollowUpProblem(f));
            f.Type = "Email"; f.NextFollowUpAt = new DateTime(2026, 1, 4);
            Assert.Equal("The next follow-up cannot be before this one", CrmRules.FollowUpProblem(f));
            f.NextFollowUpAt = new DateTime(2026, 1, 5);
            Assert.Null(CrmRules.FollowUpProblem(f));
        }

        [Fact]
        public void Lost_needs_a_reason()
        {
            Assert.Equal("Choose why the lead was lost", CrmRules.StatusChangeProblem("Qualified", new StatusChangeDto { Status = "Lost" }, false));
            Assert.Null(CrmRules.StatusChangeProblem("Qualified", new StatusChangeDto { Status = "Lost", LostReasonId = 3 }, false));
        }

        [Fact]
        public void Converted_cannot_be_set_by_hand()
        {
            Assert.NotNull(CrmRules.StatusChangeProblem("Quotation", new StatusChangeDto { Status = "Converted" }, true));
            Assert.NotNull(CrmRules.StatusChangeProblem("Converted", new StatusChangeDto { Status = "New" }, true));
        }

        [Fact]
        public void Only_manager_reopens_lost()
        {
            var to = new StatusChangeDto { Status = "Contacted" };
            Assert.Equal("Only a manager can reopen a lost lead", CrmRules.StatusChangeProblem("Lost", to, false));
            Assert.Null(CrmRules.StatusChangeProblem("Lost", to, true));
        }

        [Fact]
        public void First_follow_up_moves_new_to_contacted()
        {
            Assert.Equal("Contacted", CrmRules.AutoStatusAfterFollowUp("New"));
            Assert.Null(CrmRules.AutoStatusAfterFollowUp("Qualified"));
        }

        [Fact]
        public void Quote_sent_moves_to_quotation_only_forward()
        {
            Assert.Equal("Quotation", CrmRules.AutoStatusAfterQuoteSent("New"));
            Assert.Equal("Quotation", CrmRules.AutoStatusAfterQuoteSent("Qualified"));
            Assert.Null(CrmRules.AutoStatusAfterQuoteSent("Quotation"));
            Assert.Null(CrmRules.AutoStatusAfterQuoteSent("Negotiation"));
            Assert.Null(CrmRules.AutoStatusAfterQuoteSent("Lost"));
        }

        [Fact]
        public void Quotation_needs_valid_items()
        {
            QuotationSaveDto Q(Action<QuotationItemDto>? tweak = null)
            {
                var i = new QuotationItemDto { ProductName = "AC", Qty = 1, Rate = 100, GstPercent = 18 };
                tweak?.Invoke(i);
                return new QuotationSaveDto { Items = new() { i } };
            }
            Assert.Null(CrmRules.QuotationProblem(Q()));
            Assert.Equal("Add at least one product line", CrmRules.QuotationProblem(new QuotationSaveDto()));
            Assert.NotNull(CrmRules.QuotationProblem(Q(i => i.Qty = 0)));
            Assert.NotNull(CrmRules.QuotationProblem(Q(i => i.Rate = -1)));
            Assert.NotNull(CrmRules.QuotationProblem(Q(i => i.DiscountAmount = 101)));
            Assert.NotNull(CrmRules.QuotationProblem(Q(i => i.GstPercent = 7)));
            Assert.NotNull(CrmRules.QuotationProblem(Q(i => i.Rate = 10.005m)));
            Assert.Null(CrmRules.QuotationProblem(Q(i => i.GstPercent = 0)));
        }

        private static List<QuotationItemDto> OddItems() => new()
        {
            new QuotationItemDto { ProductName = "A", Qty = 1, Rate = 1000.25m, GstPercent = 18 },
            new QuotationItemDto { ProductName = "B", Qty = 2, Rate = 333.33m, DiscountAmount = 10m, GstPercent = 28 },
        };

        [Theory]
        [InlineData("Sent")]
        [InlineData("Rejected")]
        [InlineData("Superseded")]
        [InlineData("Accepted")]
        public void Only_draft_is_editable(string status)
            => Assert.Equal("Only a draft quotation can be changed. Revise it instead", CrmRules.QuotationEditProblem(status));

        [Fact]
        public void Draft_is_editable() => Assert.Null(CrmRules.QuotationEditProblem("Draft"));

        [Fact]
        public void Totals_match_sales_order_rounding()
        {
            // A: taxable 1000.25, gst ROUND(180.045)=180.05. B: taxable 656.66, gst ROUND(183.8648)=183.86.
            // GstTotal 363.91 -> CGST ROUND(181.955)=181.96 (half away from zero, as SQL ROUND), SGST = 181.95.
            var items = OddItems();
            var t = CrmRules.Totals(items, false);
            Assert.Equal(1000.25m, items[0].TaxableAmount);
            Assert.Equal(180.05m, items[0].GstAmount);
            Assert.Equal(1180.30m, items[0].LineTotal);
            Assert.Equal(656.66m, items[1].TaxableAmount);
            Assert.Equal(183.86m, items[1].GstAmount);
            Assert.Equal(1666.91m, t.SubTotal);
            Assert.Equal(10m, t.DiscountTotal);
            Assert.Equal(1656.91m, t.TaxableTotal);
            Assert.Equal(181.96m, t.CGST);
            Assert.Equal(181.95m, t.SGST);
            Assert.Equal(0m, t.IGST);
            Assert.Equal(2020.82m, t.GrandTotal);

            var inter = CrmRules.Totals(OddItems(), true);
            Assert.Equal(363.91m, inter.IGST);
            Assert.Equal(0m, inter.CGST);
            Assert.Equal(0m, inter.SGST);
            Assert.Equal(2020.82m, inter.GrandTotal);
        }

        [Fact]
        public void Conversion_percent_is_zero_without_leads()
        {
            Assert.Equal(0m, CrmRules.Percent(0, 0));
            Assert.Equal(37.5m, CrmRules.Percent(3, 8));
        }
    }
}
