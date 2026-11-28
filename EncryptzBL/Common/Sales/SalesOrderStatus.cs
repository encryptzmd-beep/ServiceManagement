namespace EncryptzBL.Common.Sales
{
    /// <summary>
    /// The steps of a sales order: Sales Order → Sales Confirmed → Billed → Despatched (Cancelled before Despatched).
    /// Billed needs an Invoice PDF attached; a billed order is what the Despatch screen lists as pending.
    /// dbo.sp_SalesOrder_SetStatus (30_Sales_Order_Workflow.sql) holds the same rules; it decides.
    /// </summary>
    public static class SalesOrderStatus
    {
        public const string Order = "Sales Order";
        public const string Confirmed = "Sales Confirmed";
        public const string Billed = "Billed";
        public const string Despatched = "Despatched";
        public const string Cancelled = "Cancelled";

        /// <summary>The document type that must be attached before an order is marked Billed.</summary>
        public const string InvoiceDocumentType = "Invoice";

        /// <summary>A new order starts here (the Sales Order screen) or as Confirmed (a CRM convert).</summary>
        public static bool IsStart(string? status) => status is Order or Confirmed;

        /// <summary>The next step a person may set, or null when the order cannot move on by hand.</summary>
        public static string? Next(string? current) => current switch
        {
            Order => Confirmed,
            Confirmed => Billed,
            _ => null,
        };

        /// <summary>Why the order cannot be marked <paramref name="target"/>, or null when it may.</summary>
        public static string? MoveProblem(string? current, string? target, bool hasInvoice)
        {
            target = target?.Trim();
            if (target is not (Confirmed or Billed)) return "A sales order can be marked Sales Confirmed or Billed.";
            if (Next(current) != target)
                return current is Billed or Despatched or Cancelled ? $"The sales order is {current.ToLowerInvariant()} already."
                    : target == Billed ? "Confirm the sale before marking it billed."
                    : "The status moves from Sales Order to Sales Confirmed to Billed.";
            if (target == Billed && !hasInvoice) return "Attach the invoice PDF before marking the sales order billed.";
            return null;
        }
    }
}
