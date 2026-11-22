using System.Text.RegularExpressions;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Crm
{
    /// <summary>
    /// What the CRM lets a sales person write: leads, follow-ups, status changes and quotations.
    /// Every Problem method returns the sentence that is shown, or null when the entry is fine, and
    /// trims the entry. Who may write it is checked in the database procedures.
    /// </summary>
    public static class CrmRules
    {
        public static readonly string[] LeadStatuses = { "New", "Contacted", "Qualified", "Quotation", "Negotiation", "Converted", "Lost" };
        public static readonly string[] FollowUpTypes = { "Phone Call", "Meeting", "Site Visit", "WhatsApp", "Email", "Other" };
        public static readonly string[] Priorities = { "Low", "Medium", "High" };
        public static readonly decimal[] GstRates = { 0m, 5m, 12m, 18m, 28m };

        private const decimal MaxAmount = 1_000_000_000m;

        private static readonly Regex Email = new(@"^[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""'.]{2,}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Mobile = new(@"^[6-9][0-9]{9}\z", RegexOptions.CultureInvariant);

        private static string T(string? s) => (s ?? "").Trim();

        private static string? Pick(string[] list, string? value)
            => list.FirstOrDefault(x => string.Equals(x, T(value), StringComparison.OrdinalIgnoreCase));

        /// <summary>A mobile as its 10 digits (spaces, dashes and a +91 / 91 / 0 prefix removed); the text itself when it does not fit.</summary>
        public static string NormaliseMobile(string? mobile)
        {
            var s = T(mobile);
            var digits = new string(s.Where(char.IsAsciiDigit).ToArray());
            if (s.StartsWith("+91") && digits.Length == 12) digits = digits.Substring(2);
            else if (digits.Length == 12 && digits.StartsWith("91")) digits = digits.Substring(2);
            else if (digits.Length == 11 && digits.StartsWith("0")) digits = digits.Substring(1);
            return Mobile.IsMatch(digits) ? digits : s;
        }

        public static string? LeadProblem(LeadSaveDto? l)
        {
            if (l == null) return "Nothing to save";

            l.ContactName = T(l.ContactName).ToUpperInvariant();
            l.Mobile = NormaliseMobile(l.Mobile);
            if (l.ProductMasterId <= 0) l.ProductMasterId = null;
            l.Email = T(l.Email);
            l.Address = T(l.Address);
            l.City = T(l.City);
            l.State = T(l.State);
            l.PinCode = T(l.PinCode);
            l.Landmark = T(l.Landmark);
            l.ProductCategory = T(l.ProductCategory);
            l.ModelRequirement = T(l.ModelRequirement);
            l.Remarks = T(l.Remarks);

            if (l.ContactName.Length == 0) return "Enter the contact name";
            if (l.ContactName.Length > 200) return "The name is too long";
            if (!Mobile.IsMatch(l.Mobile)) return "Enter a valid 10-digit mobile number";
            if (l.Email.Length > 0 && (l.Email.Length > 256 || !Email.IsMatch(l.Email))) return "Enter a valid e-mail address";
            if (l.Address.Length > 500) return "The address is too long";
            if (l.City.Length > 100 || l.State.Length > 100 || l.ProductCategory.Length > 100) return "The city, the state or the product is too long";
            if (l.PinCode.Length > 10) return "The pin code is too long";
            if (l.Landmark.Length > 200) return "The landmark is too long";
            if (l.ModelRequirement.Length > 500) return "The requirement is too long";
            if (l.Remarks.Length > 2000) return "The remarks are too long";
            if (l.EstimatedQty is < 1) return "The quantity must be at least 1";

            var priority = Pick(Priorities, l.Priority);
            if (T(l.Priority).Length > 0 && priority == null) return "Choose the priority from the list";
            l.Priority = priority ?? "Medium";
            return null;
        }

        public static string? FollowUpProblem(FollowUpSaveDto? f)
        {
            if (f == null) return "Nothing to save";

            var type = Pick(FollowUpTypes, f.Type);
            if (type == null) return "Choose the type of follow-up from the list";
            f.Type = type;
            f.Notes = T(f.Notes);
            f.NextAction = T(f.NextAction);
            f.Remarks = T(f.Remarks);

            if (f.Notes.Length > 2000) return "The notes are too long";
            if (f.NextAction.Length > 500) return "The next action is too long";
            if (f.Remarks.Length > 1000) return "The remarks are too long";
            if (f.NextFollowUpAt.HasValue && f.NextFollowUpAt.Value < f.FollowUpAt) return "The next follow-up cannot be before this one";
            return null;
        }

        /// <summary>
        /// A change of status by hand. Converted only comes from converting the lead to a sales order and is
        /// read-only after; Lost is read-only too, but a manager may reopen it. Lost needs a reason.
        /// </summary>
        public static string? StatusChangeProblem(string from, StatusChangeDto? to, bool isManager)
        {
            if (to == null) return "Nothing to save";
            var target = Pick(LeadStatuses, to.Status);
            if (target == null) return "Choose the status from the list";
            to.Status = target;
            to.Note = T(to.Note);
            if (to.Note.Length > 1000) return "The note can have at most 1000 characters";

            var current = Pick(LeadStatuses, from) ?? T(from);
            if (current == "Converted") return "A converted lead cannot be changed";
            if (target == "Converted") return "A lead becomes Converted only when it is converted to a sales order";
            if (current == "Lost")
            {
                if (!isManager) return "Only a manager can reopen a lost lead";
            }
            if (target == "Lost" && to.LostReasonId is null or <= 0) return "Choose why the lead was lost";
            return null;
        }

        /// <summary>The first follow-up of a New lead makes it Contacted; null when the status stays.</summary>
        public static string? AutoStatusAfterFollowUp(string current)
            => string.Equals(T(current), "New", StringComparison.OrdinalIgnoreCase) ? "Contacted" : null;

        /// <summary>Sending a quotation moves a lead to Quotation only when it is earlier in the flow (New, Contacted, Qualified).</summary>
        public static string? AutoStatusAfterQuoteSent(string current)
        {
            var i = Array.FindIndex(LeadStatuses, s => string.Equals(s, T(current), StringComparison.OrdinalIgnoreCase));
            return i >= 0 && i < Array.IndexOf(LeadStatuses, "Quotation") ? "Quotation" : null;
        }

        /// <summary>Only a Draft quotation is changed; a sent one is revised into a new revision.</summary>
        public static string? QuotationEditProblem(string? status)
            => string.Equals(T(status), "Draft", StringComparison.OrdinalIgnoreCase)
                ? null : "Only a draft quotation can be changed. Revise it instead";

        public static string? QuotationProblem(QuotationSaveDto? q)
        {
            if (q == null) return "Nothing to save";
            q.Terms = T(q.Terms);
            if (q.Terms.Length > 4000) return "The terms are too long";
            q.ReferenceNo = T(q.ReferenceNo);
            q.CustomerGstin = T(q.CustomerGstin).ToUpperInvariant();
            if (q.ReferenceNo.Length > 100) return "The quotation reference is too long";
            if (q.CustomerGstin.Length > 20) return "The GSTIN is too long";
            if (q.PaymentDueDate.HasValue && q.PaymentDueDate.Value.Date < q.QuoteDate.Date) return "The payment due date cannot be before the quotation date";
            if (q.Items == null || q.Items.Count == 0) return "Add at least one product line";
            if (q.ValidUntil.HasValue && q.ValidUntil.Value.Date < q.QuoteDate.Date) return "The quotation cannot be valid until a date before it is dated";

            foreach (var i in q.Items)
            {
                i.ProductName = T(i.ProductName);
                i.HsnSac = T(i.HsnSac);
                if (i.ProductName.Length == 0) return "Enter the product on every line";
                if (i.ProductName.Length > 200 || i.HsnSac.Length > 20) return "The product or the HSN is too long";
                if (i.Qty < 1) return "The quantity must be at least 1";
                if (i.Rate < 0 || i.Rate > MaxAmount || Math.Round(i.Rate, 2) != i.Rate) return "Enter the rate as an amount with at most 2 decimals";
                if (Math.Round(i.DiscountAmount, 2) != i.DiscountAmount) return "Enter the discount as an amount with at most 2 decimals";
                if (i.DiscountAmount < 0 || i.DiscountAmount > i.Qty * i.Rate) return "The discount cannot exceed the line amount";
                if (!GstRates.Contains(i.GstPercent)) return "GST must be 0, 5, 12, 18 or 28 percent";
                if (i.WarrantyMonths < 0 || i.WarrantyMonths > 120) return "Warranty is from 0 to 120 months";
            }
            return null;
        }

        /// <summary>
        /// Fills each item's amounts and returns the totals, exactly as sp_SalesOrder_Save does: taxable = qty x rate - discount,
        /// GST = ROUND(taxable x percent / 100, 2) (half away from zero, as SQL), intra-state CGST = ROUND(gst / 2, 2) and
        /// SGST = gst - CGST, inter-state all IGST. With pricesIncludeGst the line amount already holds the GST:
        /// taxable = ROUND(amount x 100 / (100 + percent), 2), GST = amount - taxable, so the total stays what was quoted.
        /// </summary>
        public static QuoteTotals Totals(IEnumerable<QuotationItemDto> items, bool isInterState, bool pricesIncludeGst = false)
        {
            var list = items.ToList();
            foreach (var i in list)
            {
                var lineAmount = i.Qty * i.Rate - i.DiscountAmount;
                if (pricesIncludeGst)
                {
                    i.TaxableAmount = Math.Round(lineAmount * 100m / (100m + i.GstPercent), 2, MidpointRounding.AwayFromZero);
                    i.GstAmount = lineAmount - i.TaxableAmount;
                }
                else
                {
                    i.TaxableAmount = lineAmount;
                    i.GstAmount = Math.Round(i.TaxableAmount * i.GstPercent / 100m, 2, MidpointRounding.AwayFromZero);
                }
                i.LineTotal = i.TaxableAmount + i.GstAmount;
            }

            var gst = list.Sum(i => i.GstAmount);
            var cgst = isInterState ? 0m : Math.Round(gst / 2m, 2, MidpointRounding.AwayFromZero);
            var taxable = list.Sum(i => i.TaxableAmount);
            return new QuoteTotals
            {
                SubTotal = list.Sum(i => i.Qty * i.Rate),
                DiscountTotal = list.Sum(i => i.DiscountAmount),
                TaxableTotal = taxable,
                CGST = cgst,
                SGST = isInterState ? 0m : gst - cgst,
                IGST = isInterState ? gst : 0m,
                GrandTotal = taxable + gst,
            };
        }

        // ── convert to sale ───────────────────────────────────────────────────

        private const string ChooseOneCustomer = "More than one customer has this mobile. Choose one";

        /// <summary>Two mobiles are the same when both are valid and equal after NormaliseMobile.</summary>
        public static bool SameMobile(string? a, string? b)
        {
            var x = NormaliseMobile(a);
            return Mobile.IsMatch(x) && x == NormaliseMobile(b);
        }

        /// <summary>
        /// Whether a lead and its quotation can become a sales order: an open lead in Quotation or Negotiation
        /// without an order, and the latest draft or sent revision of a quotation of that lead.
        /// </summary>
        public static string? ConvertProblem(LeadDetailDto? lead, QuotationDto? q)
        {
            if (lead == null) return "Lead not found";
            if (q == null || q.LeadId != lead.LeadId) return "Quotation not found";
            if (lead.SalesOrderId.HasValue) return "This lead already has a sales order";
            var status = Pick(LeadStatuses, lead.Status);
            if (status != "Quotation" && status != "Negotiation") return "Only a lead in Quotation or Negotiation can be converted";
            if (string.Equals(T(q.Status), "Superseded", StringComparison.OrdinalIgnoreCase) || !q.IsLatest)
                return "This quotation was revised. Convert the latest revision";
            if (!string.Equals(T(q.Status), "Draft", StringComparison.OrdinalIgnoreCase) && !string.Equals(T(q.Status), "Sent", StringComparison.OrdinalIgnoreCase))
                return "Only a draft or sent quotation can be converted";
            if (q.Items == null || q.Items.Count == 0) return "The quotation has no product lines";
            return null;
        }

        public static string? ConvertRequestProblem(ConvertRequestDto? r)
        {
            if (r == null) return "Nothing to save";
            if (r.QuotationId <= 0) return "Choose the quotation to convert";
            r.PaymentMode = T(r.PaymentMode);
            if (r.PaymentMode.Length > 30) return "The payment mode is too long";
            r.Comment = T(r.Comment);
            if (r.Comment.Length > 1000) return "The comment is too long";
            if (r.OrderDate == default) return "Enter the order date";
            return null;
        }

        /// <summary>With several customers on the lead's mobile the user picks one; with one or none nothing is asked.</summary>
        public static string? CustomerChoiceProblem(int matches, int? chosen)
            => matches > 1 && chosen is null or <= 0 ? ChooseOneCustomer : null;

        /// <summary>As above, and a chosen customer must be one of the matches.</summary>
        public static string? CustomerChoiceProblem(IReadOnlyCollection<int> matchIds, int? chosen)
        {
            if (chosen is > 0 && !matchIds.Contains(chosen.Value)) return "Choose one of the customers that have this mobile";
            return CustomerChoiceProblem(matchIds.Count, chosen);
        }

        /// <summary>
        /// The sales order made from a lead and its quotation: the quotation lines unchanged, ReferenceNo the quotation
        /// number and revision (QT-0007/R2), the lead's mobile and address, IsInterState from the quotation, and
        /// Notes "From lead LD-0012". sp_SalesOrder_Save works out the amounts again, as for any bill.
        /// </summary>
        public static SalesOrderSaveDto BuildOrder(LeadDetailDto lead, QuotationDto q, int customerId, ConvertRequestDto req)
            => new()
            {
                SalesOrderId = 0,
                CustomerId = customerId,
                OrderDate = req.OrderDate.Date,
                PaymentMode = T(req.PaymentMode),
                ReferenceNo = $"{q.QuotationNo}/R{q.RevisionNo}",
                ContactNumber = lead.Mobile,
                BillingAddress = lead.Address,
                City = lead.City,
                State = lead.State,
                PinCode = lead.PinCode,
                IsInterState = q.IsInterState,
                Notes = string.IsNullOrWhiteSpace(req.Comment) ? $"From lead {lead.LeadNo}" : $"From lead {lead.LeadNo}\n{T(req.Comment)}",
                Items = q.Items.Select(i =>
                {
                    // a sales order always adds GST to its rate, so an inclusive quotation hands over its pre-GST value
                    var rate = q.PricesIncludeGst ? Math.Ceiling(i.TaxableAmount * 100m / i.Qty) / 100m : i.Rate;
                    return new SalesOrderItemSaveDto
                    {
                        ProductMasterId = i.ProductMasterId,
                        ProductName = i.ProductName,
                        HsnSac = i.HsnSac,
                        Qty = i.Qty,
                        Rate = rate,
                        DiscountAmount = q.PricesIncludeGst ? i.Qty * rate - i.TaxableAmount : i.DiscountAmount,
                        GstPercent = i.GstPercent,
                        WarrantyMonths = i.WarrantyMonths
                    };
                }).ToList()
            };

        /// <summary>part as a percentage of whole to one decimal; 0 when there is no whole.</summary>
        public static decimal Percent(int part, int whole)
            => whole <= 0 ? 0m : Math.Round(100m * part / whole, 1, MidpointRounding.AwayFromZero);
    }
}
