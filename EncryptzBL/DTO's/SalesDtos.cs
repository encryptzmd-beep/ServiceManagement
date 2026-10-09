using System;
using System.Collections.Generic;

namespace EncryptzBL.DTO_s
{
    // =========================================================================
    // Sales Order (bill) -> Despatch -> Installation complaint -> Warranty
    // =========================================================================

    /// <summary>A customer of the master as the Sales Order screen picks it.</summary>
    public class SalesCustomerDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string MobileNumber { get; set; } = string.Empty;
        public string? AlternatePhone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? Landmark { get; set; }
        public string? GSTIN { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public int TotalProducts { get; set; }
    }

    /// <summary>Create / update a customer of the master from the bill.</summary>
    public class SalesCustomerSaveDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string MobileNumber { get; set; } = string.Empty;
        public string? AlternatePhone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? Landmark { get; set; }
        public string? GSTIN { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
    }

    public class SalesCustomerSaveResultDto
    {
        public int CustomerId { get; set; }
        public bool IsNew { get; set; }
        public SalesCustomerDto? Customer { get; set; }
    }

    /// <summary>One bill line as the screen sends it (amounts are recomputed by the proc).</summary>
    public class SalesOrderItemSaveDto
    {
        public int SalesOrderItemId { get; set; }
        public int? ProductMasterId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? HsnSac { get; set; }
        public int Qty { get; set; } = 1;
        public decimal Rate { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal GstPercent { get; set; } = 18;
        public int WarrantyMonths { get; set; } = 12;
    }

    public class SalesOrderSaveDto
    {
        public int SalesOrderId { get; set; }
        public DateTime OrderDate { get; set; } = DateTime.Today;
        public int CustomerId { get; set; }
        public string? PaymentMode { get; set; }
        public string? ReferenceNo { get; set; }
        public string? ContactNumber { get; set; }
        public string? GSTIN { get; set; }
        public string? BillingAddress { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public bool IsInterState { get; set; }
        public string? Notes { get; set; }
        public List<SalesOrderItemSaveDto> Items { get; set; } = new();
    }

    public class SalesOrderSaveResultDto
    {
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
    }

    public class SalesOrderFilterDto
    {
        public string? SearchTerm { get; set; }
        public string? Status { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class SalesOrderListDto
    {
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PaymentMode { get; set; }
        public string? ReferenceNo { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerMobile { get; set; }
        public string? City { get; set; }
        public decimal SubTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public decimal GrandTotal { get; set; }
        public int LineCount { get; set; }
        public int? TotalQty { get; set; }
        public int? DespatchId { get; set; }
        public string? DespatchNo { get; set; }
        public DateTime? DespatchDate { get; set; }
        public int? InstallationComplaintId { get; set; }
        public string? InstallationComplaintNo { get; set; }
        public string? InstallationStatus { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TotalCount { get; set; }
    }

    public class SalesOrderHeaderDto
    {
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PaymentMode { get; set; }
        public string? ReferenceNo { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerMobile { get; set; }
        public string? CustomerEmail { get; set; }
        public string? ContactNumber { get; set; }
        public string? GSTIN { get; set; }
        public string? BillingAddress { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public bool IsInterState { get; set; }
        public string? Notes { get; set; }
        public decimal SubTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public decimal TaxableTotal { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public decimal GrandTotal { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class SalesOrderItemDto
    {
        public int SalesOrderItemId { get; set; }
        public int SalesOrderId { get; set; }
        public int? ProductMasterId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Model { get; set; }
        public string? Category { get; set; }
        public string? HsnSac { get; set; }
        public int Qty { get; set; }
        public decimal Rate { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal GstPercent { get; set; }
        public decimal TaxableAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal LineTotal { get; set; }
        public int WarrantyMonths { get; set; }
        public int DespatchedQty { get; set; }
        public string? SerialNumbers { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
    }

    public class DespatchSummaryDto
    {
        public int DespatchId { get; set; }
        public string DespatchNo { get; set; } = string.Empty;
        public DateTime DespatchDate { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactNumber { get; set; }
        public string? TransporterName { get; set; }
        public string? VehicleNo { get; set; }
        public string? DriverName { get; set; }
        public string? TrackingNo { get; set; }
        public string? Remarks { get; set; }
        public string Status { get; set; } = string.Empty;
        public int? InstallationComplaintId { get; set; }
        public string? InstallationComplaintNo { get; set; }
        public string? InstallationStatus { get; set; }
        public string? InstallationStatusColor { get; set; }
        public string? AssignedTechnicians { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SalesOrderDetailDto
    {
        public SalesOrderHeaderDto Order { get; set; } = new();
        public List<SalesOrderItemDto> Items { get; set; } = new();
        public List<DespatchSummaryDto> Despatches { get; set; } = new();
    }

    /// <summary>One unit to despatch: the bill line and its serial number.</summary>
    public class DespatchUnitDto
    {
        public int SalesOrderItemId { get; set; }
        public string? SerialNumber { get; set; }
    }

    public class DespatchCreateDto
    {
        public int SalesOrderId { get; set; }
        public DateTime? DespatchDate { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactNumber { get; set; }
        public string? TransporterName { get; set; }
        public string? VehicleNo { get; set; }
        public string? DriverName { get; set; }
        public string? TrackingNo { get; set; }
        public string? Remarks { get; set; }
        /// <summary>Create the "New Installation" complaint for the dashboard (default true).</summary>
        public bool CreateInstallationComplaint { get; set; } = true;
        public string? Priority { get; set; } = "Medium";
        public DateTime? PreferredDate { get; set; }
        public List<DespatchUnitDto> Units { get; set; } = new();
    }

    public class DespatchCreateResultDto
    {
        public int DespatchId { get; set; }
        public string DespatchNo { get; set; } = string.Empty;
        public int? ComplaintId { get; set; }
        public string? ComplaintNumber { get; set; }
    }

    public class DespatchFilterDto
    {
        public string? SearchTerm { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class DespatchListDto
    {
        public int DespatchId { get; set; }
        public string DespatchNo { get; set; } = string.Empty;
        public DateTime DespatchDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? TransporterName { get; set; }
        public string? VehicleNo { get; set; }
        public string? TrackingNo { get; set; }
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public decimal GrandTotal { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerMobile { get; set; }
        public string? City { get; set; }
        public int UnitCount { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string? WarrantyStatus { get; set; }
        public int? InstallationComplaintId { get; set; }
        public string? InstallationComplaintNo { get; set; }
        public string? InstallationStatus { get; set; }
        public string? InstallationStatusColor { get; set; }
        public string? AssignedTechnicians { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TotalCount { get; set; }
    }

    public class DespatchHeaderDto : DespatchSummaryDto
    {
        public int SalesOrderId { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public decimal GrandTotal { get; set; }
        public string? PaymentMode { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerMobile { get; set; }
        public string? CustomerEmail { get; set; }
    }

    public class DespatchUnitDetailDto
    {
        public int DespatchItemId { get; set; }
        public int SalesOrderItemId { get; set; }
        public int? ProductId { get; set; }
        public string SerialNumber { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Model { get; set; }
        public string? Category { get; set; }
        public string? HsnSac { get; set; }
        public int WarrantyMonths { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string? WarrantyStatus { get; set; }
        public int? WarrantyDaysLeft { get; set; }
    }

    public class DespatchDetailDto
    {
        public DespatchHeaderDto Despatch { get; set; } = new();
        public List<DespatchUnitDetailDto> Units { get; set; } = new();
    }

    /// <summary>A unit of the installed base with its warranty and complaint history.</summary>
    public class WarrantyLookupDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Model { get; set; }
        public string? Category { get; set; }
        public DateTime? PurchaseDate { get; set; }
        public DateTime? WarrantyExpiryDate { get; set; }
        public string WarrantyStatus { get; set; } = string.Empty;
        public int? WarrantyDaysLeft { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerMobile { get; set; }
        public string? City { get; set; }
        public int? SalesOrderId { get; set; }
        public string? OrderNo { get; set; }
        public DateTime? OrderDate { get; set; }
        public int? DespatchId { get; set; }
        public string? DespatchNo { get; set; }
        public DateTime? DespatchDate { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public int? WarrantyMonths { get; set; }
        public int TotalComplaints { get; set; }
        public int OpenComplaints { get; set; }
        public string? LastComplaintNo { get; set; }
        public string? LastComplaintStatus { get; set; }
        public DateTime? LastComplaintAt { get; set; }
        public string? LastComplaintType { get; set; }
        public int TotalCount { get; set; }
    }

    public class WarrantyLookupFilterDto
    {
        public string? Search { get; set; }
        public int? CustomerId { get; set; }
        /// <summary>true = in warranty only, false = expired / no warranty only, null = all.</summary>
        public bool? OnlyActive { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
}
