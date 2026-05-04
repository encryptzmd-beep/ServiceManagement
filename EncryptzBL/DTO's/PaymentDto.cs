using System;

namespace EncryptzBL.DTO_s
{
    public class UPIConfigurationDto
    {
        public int Id { get; set; }
        public string UpiId { get; set; }
        public string DisplayName { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public class ComplaintPaymentDto
    {
        public int PaymentId { get; set; }
        public int ComplaintId { get; set; }
        public string PaymentType { get; set; }
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; }
        public string UpiIdUsed { get; set; }
        public string TransactionReference { get; set; }
        public string PaymentStatus { get; set; }
        public string Remarks { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public class RecordPaymentRequest
    {
        public int ComplaintId { get; set; }
        public string PaymentType { get; set; }
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; }
        public string UpiIdUsed { get; set; }
        public string TransactionReference { get; set; }
        public string Remarks { get; set; }
    }

    public class AdminPaymentDto : ComplaintPaymentDto
    {
        public string CustomerName { get; set; }
        public string MobileNo { get; set; }
        public string CreatedByName { get; set; }
    }

    public class UpdatePaymentRequest
    {
        public int PaymentId { get; set; }
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; }
        public string PaymentStatus { get; set; }
        public string TransactionReference { get; set; }
        public string Remarks { get; set; }
        public string AdminPassword { get; set; }
    }
}
