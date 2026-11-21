using System;

namespace EncryptzBL.DTO_s
{
    public class UPIConfigurationDto
    {
        public int Id { get; set; }
        public string UpiId { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public class ComplaintPaymentDto
    {
        public int PaymentId { get; set; }
        public int ComplaintId { get; set; }
        public string PaymentType { get; set; } = null!;
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string UpiIdUsed { get; set; } = null!;
        public string TransactionReference { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string Remarks { get; set; } = null!;
        public DateTime? CreatedAt { get; set; }
    }

    public class RecordPaymentRequest
    {
        public int ComplaintId { get; set; }
        public string PaymentType { get; set; } = null!;
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string UpiIdUsed { get; set; } = null!;
        public string TransactionReference { get; set; } = null!;
        public string Remarks { get; set; } = null!;
    }

    public class AdminPaymentDto : ComplaintPaymentDto
    {
        public string ComplaintNumber { get; set; } = null!;
        public string CustomerName { get; set; } = null!;
        public string MobileNo { get; set; } = null!;
        public string CreatedByName { get; set; } = null!;
        public bool IsVerified { get; set; }
        public string VerifiedByName { get; set; } = null!;
        public DateTime? VerifiedAt { get; set; }
    }

    public class VerifyPaymentRequest
    {
        public int PaymentId { get; set; }
        public bool IsVerified { get; set; }
    }

    public class UpdatePaymentRequest
    {
        public int PaymentId { get; set; }
        public decimal ServiceChargeAmount { get; set; }
        public decimal SparePartsAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal AmountPaid { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string TransactionReference { get; set; } = null!;
        public string Remarks { get; set; } = null!;
        public string AdminPassword { get; set; } = null!;
    }
}
