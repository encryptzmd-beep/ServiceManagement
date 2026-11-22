namespace EncryptzBL.DTO_s
{
    /// <summary>A lead as the screen saves it (field names follow crm.Leads; the owner and company come from the token).</summary>
    public class LeadSaveDto
    {
        public int LeadId { get; set; }
        public DateTime LeadDate { get; set; } = DateTime.Today;
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? Landmark { get; set; }
        public int? LeadSourceId { get; set; }
        public string? ProductCategory { get; set; }
        public int? ProductMasterId { get; set; }
        public string? ModelRequirement { get; set; }
        public int? EstimatedQty { get; set; }
        public DateTime? ExpectedPurchaseDate { get; set; }
        public int? OwnerUserId { get; set; }
        public string? Priority { get; set; }
        public string? Remarks { get; set; }
        /// <summary>The products of the lead, first one first. Null leaves them as they are.</summary>
        public List<LeadProductSaveDto>? Products { get; set; }
    }

    public class LeadProductSaveDto
    {
        public int ProductMasterId { get; set; }
        public int Qty { get; set; } = 1;
    }

    /// <summary>What this person may do with the lead Excel files now.</summary>
    public class LeadDataAccessDto
    {
        public bool IsAdmin { get; set; }
        public bool CanImport { get; set; }
        public bool CanExport { get; set; }
        public bool ImportApproved { get; set; }
        public bool ExportApproved { get; set; }
        public bool ImportPending { get; set; }
        public bool ExportPending { get; set; }
        public int PendingCount { get; set; }
    }

    public class LeadDataRequestDto
    {
        public string? RequestType { get; set; }
        public string? Note { get; set; }
    }

    public class LeadDataDecisionDto
    {
        public bool Approve { get; set; }
        public string? Note { get; set; }
    }

    public class LeadDataRequestRowDto
    {
        public int RequestId { get; set; }
        public string RequestType { get; set; } = string.Empty;
        public int RequestedBy { get; set; }
        public string RequestedByName { get; set; } = string.Empty;
        public DateTime RequestedAt { get; set; }
        public string Note { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string DecidedByName { get; set; } = string.Empty;
        public DateTime? DecidedAt { get; set; }
        public string DecisionNote { get; set; } = string.Empty;
        public DateTime? UsedAt { get; set; }
    }

    public class LeadExportRowDto
    {
        public string LeadNo { get; set; } = string.Empty;
        public DateTime LeadDate { get; set; }
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string PinCode { get; set; } = string.Empty;
        public string Landmark { get; set; } = string.Empty;
        public string SourceName { get; set; } = string.Empty;
        public string ProductCategory { get; set; } = string.Empty;
        public string Products { get; set; } = string.Empty;
        public string ModelRequirement { get; set; } = string.Empty;
        public int? EstimatedQty { get; set; }
        public DateTime? ExpectedPurchaseDate { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }

    public class LeadImportRowDto
    {
        public int RowNumber { get; set; }
        public string? ContactName { get; set; }
        public string? Mobile { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? Landmark { get; set; }
        public string? ProductCategory { get; set; }
        public string? ModelRequirement { get; set; }
        public string? Priority { get; set; }
        public string? Remarks { get; set; }
    }

    public class LeadImportProblemDto
    {
        public int RowNumber { get; set; }
        public string ContactName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class LeadImportResultDto
    {
        public int Created { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }
        public List<LeadImportProblemDto> Problems { get; set; } = new();
    }

    /// <summary>One row of the lead list.</summary>
    public class LeadListDto
    {
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public DateTime LeadDate { get; set; }
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string SourceName { get; set; } = string.Empty;
        public string ProductCategory { get; set; } = string.Empty;
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public string? OrderNo { get; set; }
        public int TotalCount { get; set; }
    }

    /// <summary>A lead with everything the detail screen shows.</summary>
    public class LeadDetailDto
    {
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public DateTime LeadDate { get; set; }
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string PinCode { get; set; } = string.Empty;
        public string Landmark { get; set; } = string.Empty;
        public int? LeadSourceId { get; set; }
        public string SourceName { get; set; } = string.Empty;
        public string ProductCategory { get; set; } = string.Empty;
        public int? ProductMasterId { get; set; }
        public string? ProductName { get; set; }
        public List<LeadProductDto> Products { get; set; } = new();
        public string ModelRequirement { get; set; } = string.Empty;
        public int? EstimatedQty { get; set; }
        public DateTime? ExpectedPurchaseDate { get; set; }
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int? LostReasonId { get; set; }
        public string LostReasonName { get; set; } = string.Empty;
        public DateTime? LostAt { get; set; }
        public string? OrderNo { get; set; }
        public string LostNote { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public int? CustomerId { get; set; }
        public int? SalesOrderId { get; set; }
        public DateTime? ConvertedAt { get; set; }
        /// <summary>The order call of a convert failed: a manager checks the sales orders, then links the order or cancels the convert.</summary>
        public bool ConvertNeedsCheck { get; set; }
        public string Remarks { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<FollowUpDto> FollowUps { get; set; } = new();
        public List<LeadHistoryDto> History { get; set; } = new();
        public List<QuotationSummaryDto> Quotations { get; set; } = new();
    }

    /// <summary>One status change or reassignment of a lead (crm.sp_Lead_History).</summary>
    public class LeadHistoryDto
    {
        public int LeadStatusHistoryId { get; set; }
        public string? FromStatus { get; set; }
        public string ToStatus { get; set; } = string.Empty;
        public int ChangedBy { get; set; }
        public string ChangedByName { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    /// <summary>One row of crm.sp_Quotation_ListForLead.</summary>
    public class QuotationSummaryDto
    {
        public int QuotationId { get; set; }
        public int LeadId { get; set; }
        public string QuotationNo { get; set; } = string.Empty;
        public int RevisionNo { get; set; }
        public DateTime QuoteDate { get; set; }
        public DateTime? ValidUntil { get; set; }
        public bool IsInterState { get; set; }
        public decimal TaxableTotal { get; set; }
        public decimal GrandTotal { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsLatest { get; set; }
    }

    /// <summary>The lead list filters. Status may be several, comma separated.</summary>
    /// <summary>One status tab of the lead list: the status and how many leads have it under the list's filters.</summary>
    public class LeadStatusCountDto
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class LeadFilterDto
    {
        public string? Search { get; set; }
        public string? Status { get; set; }
        public int? SourceId { get; set; }
        public int? OwnerUserId { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        /// <summary>Today, Overdue or Pending (open leads by next follow-up date); empty for all.</summary>
        public string? Due { get; set; }
        /// <summary>Keeps Converted leads by ConvertedAt and Lost leads by LostAt (the dashboard "this month" tiles).</summary>
        public DateTime? ClosedFrom { get; set; }
        public DateTime? ClosedTo { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
    }

    public class FollowUpSaveDto
    {
        public DateTime FollowUpAt { get; set; } = DateTime.Now;
        public string Type { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime? NextFollowUpAt { get; set; }
        public string? NextAction { get; set; }
        public string? Remarks { get; set; }
    }

    public class FollowUpDto
    {
        public int FollowUpId { get; set; }
        public int LeadId { get; set; }
        public DateTime FollowUpAt { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public string NextAction { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class StatusChangeDto
    {
        public string Status { get; set; } = string.Empty;
        public int? LostReasonId { get; set; }
        public string? Note { get; set; }
    }

    public class ReassignDto
    {
        public int OwnerUserId { get; set; }
    }

    /// <summary>One quotation line. Property names are the camelCase paths sp_Quotation_Save reads from its JSON.</summary>
    public class QuotationItemDto
    {
        public int QuotationItemId { get; set; }
        public int? ProductMasterId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? HsnSac { get; set; }
        public int Qty { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal GstPercent { get; set; } = 18;
        public int WarrantyMonths { get; set; } = 12;
        public decimal TaxableAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal LineTotal { get; set; }
        public int SortOrder { get; set; }
        /// <summary>From the product master, for the print; never saved with the line.</summary>
        public string? ProductDescription { get; set; }
        public decimal? Mrp { get; set; }
    }

    public class QuotationSaveDto
    {
        public int QuotationId { get; set; }
        public int LeadId { get; set; }
        public DateTime QuoteDate { get; set; } = DateTime.Today;
        public DateTime? ValidUntil { get; set; }
        public bool IsInterState { get; set; }
        public string? Terms { get; set; }
        public string? ReferenceNo { get; set; }
        public DateTime? PaymentDueDate { get; set; }
        public string? CustomerGstin { get; set; }
        /// <summary>The rates already contain GST; the taxable value is worked back from them.</summary>
        public bool PricesIncludeGst { get; set; }
        public string? WarrantyText { get; set; }
        public List<QuotationItemDto> Items { get; set; } = new();
    }

    public class QuoteTotals
    {
        public decimal SubTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public decimal TaxableTotal { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public decimal GrandTotal { get; set; }
    }

    public class QuotationDto
    {
        public int QuotationId { get; set; }
        public int LeadId { get; set; }
        public string QuotationNo { get; set; } = string.Empty;
        public int RevisionNo { get; set; } = 1;
        public DateTime QuoteDate { get; set; }
        public DateTime? ValidUntil { get; set; }
        public bool IsInterState { get; set; }
        public decimal SubTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public decimal TaxableTotal { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public decimal GrandTotal { get; set; }
        public string Terms { get; set; } = string.Empty;
        public string? ReferenceNo { get; set; }
        public DateTime? PaymentDueDate { get; set; }
        public string? CustomerGstin { get; set; }
        public bool PricesIncludeGst { get; set; }
        public string WarrantyText { get; set; } = string.Empty;
        public string Status { get; set; } = "Draft";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public bool IsLatest { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string PinCode { get; set; } = string.Empty;
        public string LeadStatus { get; set; } = string.Empty;
        public List<QuotationItemDto> Items { get; set; } = new();
    }

    public class QuotationStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    /// <summary>One row of crm.sp_Product_Search.</summary>
    public class CrmProductDto
    {
        public int ProductMasterId { get; set; }
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal MRP { get; set; }
        public int WarrantyMonths { get; set; }
        public string? HsnSac { get; set; }
    }

    /// <summary>A product of a lead, with its quantity.</summary>
    public class LeadProductDto : CrmProductDto
    {
        public int Qty { get; set; } = 1;
    }

    /// <summary>A lead source or a lost reason.</summary>
    public class CrmMasterDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class CrmMemberDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public bool IsManager { get; set; }
        public bool IsActive { get; set; } = true;
    }

    /// <summary>The sales team, and the active users of the company that could be added to it.</summary>
    public class CrmMemberListDto
    {
        public List<CrmMemberDto> Members { get; set; } = new();
        public List<CrmUserOptionDto> Available { get; set; } = new();
    }

    public class CrmUserOptionDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
    }

    /// <summary>Before converting: customers that may be the same person, and the quotation that becomes the order.</summary>
    public class ConvertPreviewDto
    {
        public List<SalesCustomerDto> Matches { get; set; } = new();
        public QuotationDto Quotation { get; set; } = new();
    }

    public class ConvertRequestDto
    {
        public int QuotationId { get; set; }
        public int? CustomerId { get; set; }
        public DateTime OrderDate { get; set; } = DateTime.Today;
        public string? PaymentMode { get; set; }
        /// <summary>Delivery instructions and the like: printed in the Notes of the invoice.</summary>
        public string? Comment { get; set; }
    }

    /// <summary>A manager links a sales order that exists already (made by a convert that could not finish).</summary>
    public class LinkOrderDto
    {
        public string OrderNo { get; set; } = string.Empty;
        /// <summary>The quotation the order was made from; it becomes Accepted.</summary>
        public int? QuotationId { get; set; }
    }

    public class ConvertResultDto
    {
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public int CustomerId { get; set; }
    }

    /// <summary>The counters of crm.sp_Dashboard (its first result set).</summary>
    public class CrmDashboardCountsDto
    {
        public int NewLeads { get; set; }
        public int FollowUpPending { get; set; }
        public int TodayFollowUps { get; set; }
        public int Overdue { get; set; }
        public int Qualified { get; set; }
        public int QuotationPending { get; set; }
        public int ConvertedThisMonth { get; set; }
        public int LostThisMonth { get; set; }
    }

    /// <summary>A lead whose follow-up is due or overdue (second result set of crm.sp_Dashboard).</summary>
    public class CrmDueFollowUpDto
    {
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public string NextAction { get; set; } = string.Empty;
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public bool IsOverdue { get; set; }
    }

    /// <summary>What the dashboard screen gets: the counters of crm.sp_Dashboard plus its due follow-ups.</summary>
    public class CrmDashboardDto : CrmDashboardCountsDto
    {
        public List<CrmDueFollowUpDto> DueFollowUps { get; set; } = new();
    }

    /// <summary>
    /// One row of crm.sp_Report_Conversion. The procedure returns three sets that share Leads, Converted,
    /// ConversionPct and ConvertedValue: by source (SourceName), by owner (OwnerUserId, OwnerName), by month (Month, yyyy-MM).
    /// Only the group columns of the set being read are filled.
    /// </summary>
    public class CrmConversionRowDto
    {
        public string? SourceName { get; set; }
        public int? OwnerUserId { get; set; }
        public string? OwnerName { get; set; }
        public string? Month { get; set; }
        public int Leads { get; set; }
        public int Converted { get; set; }
        public decimal ConversionPct { get; set; }
        public decimal ConvertedValue { get; set; }
    }

    /// <summary>One row of crm.sp_Report_FollowUps.</summary>
    public class CrmFollowUpReportRowDto
    {
        public int FollowUpId { get; set; }
        public DateTime FollowUpAt { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public string NextAction { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string LeadStatus { get; set; } = string.Empty;
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public string SourceName { get; set; } = string.Empty;
    }

    /// <summary>One open lead card of crm.sp_Lead_Board (set 1).</summary>
    public class CrmBoardCardDto
    {
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string? City { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public DateTime? NextFollowUpAt { get; set; }
        public DateTime? StatusSince { get; set; }
        public int DaysInStage { get; set; }
        public int? QuotationId { get; set; }
        public string? QuotationNo { get; set; }
        public string? QuotationStatus { get; set; }
        public decimal? QuotationValue { get; set; }
        public DateTime? QuotationSentAt { get; set; }
        public bool IsOverdue { get; set; }
        public bool IsDueToday { get; set; }
        public bool IsNewNotContacted { get; set; }
        public bool HasNoFollowUp { get; set; }
        public bool IsQuotationWaiting { get; set; }
        public bool IsStuck { get; set; }
    }

    /// <summary>The counts row of crm.sp_Lead_Board (set 2).</summary>
    public class CrmAttentionCountsDto
    {
        public int Overdue { get; set; }
        public int DueToday { get; set; }
        public int NewNotContacted { get; set; }
        public int NoFollowUp { get; set; }
        public int QuotationWaiting { get; set; }
        public int Stuck { get; set; }
        public int OpenLeads { get; set; }
        public int ConvertedThisMonth { get; set; }
        public int LostThisMonth { get; set; }
    }

    public class CrmBoardDto
    {
        public List<CrmBoardCardDto> Cards { get; set; } = new();
        public CrmAttentionCountsDto Counts { get; set; } = new();
        /// <summary>True when more leads are open than the cards shown (the procedure returns at most 500).</summary>
        public bool Truncated { get; set; }

        public static bool IsTruncated(int openLeads, int shown) => openLeads > shown;
    }

    /// <summary>One row of crm.sp_Quotation_List.</summary>
    public class QuotationListRowDto
    {
        public int QuotationId { get; set; }
        public string QuotationNo { get; set; } = string.Empty;
        public int RevisionNo { get; set; }
        public DateTime QuoteDate { get; set; }
        public int LeadId { get; set; }
        public string LeadNo { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal GrandTotal { get; set; }
        public DateTime? SentAt { get; set; }
        public int AgeDays { get; set; }
        public int TotalCount { get; set; }
    }

    public class QuotationFilterDto
    {
        public string? Search { get; set; }
        public string? Status { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
    }

    /// <summary>One row of crm.sp_Report_Pipeline.</summary>
    public class CrmPipelineRowDto
    {
        public string Status { get; set; } = string.Empty;
        public int Leads { get; set; }
        public decimal QuotationValue { get; set; }
        public decimal AvgDaysInStage { get; set; }
    }

    /// <summary>One row of crm.sp_Report_Sources.</summary>
    public class CrmSourceRowDto
    {
        public string SourceName { get; set; } = string.Empty;
        public int Leads { get; set; }
        public int Converted { get; set; }
        public int Lost { get; set; }
        public int OpenLeads { get; set; }
        public decimal ConversionPct { get; set; }
        public decimal ConvertedValue { get; set; }
    }

    /// <summary>One row of crm.sp_Report_Team.</summary>
    public class CrmTeamRowDto
    {
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public int Leads { get; set; }
        public int FollowUpsDone { get; set; }
        public int OverdueNow { get; set; }
        public int Converted { get; set; }
        public int Lost { get; set; }
        public decimal ConvertedValue { get; set; }
    }

    /// <summary>One row of crm.sp_Report_LostReasons.</summary>
    public class CrmLostReasonRowDto
    {
        public string ReasonName { get; set; } = string.Empty;
        public int Leads { get; set; }
        public decimal PctOfLost { get; set; }
        public decimal ValueLost { get; set; }
    }
}
