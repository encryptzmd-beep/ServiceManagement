-- Run this in SSMS to update sp_GetAllComplaintPayments to include ComplaintNumber
-- This enables the complaint number filter in the All Payments Report

CREATE OR ALTER PROCEDURE [dbo].[sp_GetAllComplaintPayments]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cp.PaymentId,
        cp.ComplaintId,
        c.ComplaintNumber,
        cu.CustomerName,
        cu.MobileNo,
        cp.PaymentType,
        cp.ServiceChargeAmount,
        cp.SparePartsAmount,
        cp.DiscountAmount,
        cp.TotalAmount,
        cp.AmountPaid,
        cp.PaymentMethod,
        cp.UpiIdUsed,
        cp.TransactionReference,
        cp.PaymentStatus,
        cp.Remarks,
        cp.CreatedAt,
        u.FullName   AS CreatedByName,
        cp.IsVerified,
        vu.FullName  AS VerifiedByName,
        cp.VerifiedAt
    FROM  [dbo].[ComplaintPayments] cp
    LEFT JOIN [dbo].[Complaints]  c  ON c.ComplaintId  = cp.ComplaintId
    LEFT JOIN [dbo].[Customers]   cu ON cu.CustomerId  = c.CustomerId
    LEFT JOIN [dbo].[Users]       u  ON u.UserId       = cp.CreatedBy
    LEFT JOIN [dbo].[Users]       vu ON vu.UserId      = cp.VerifiedBy
    ORDER BY cp.CreatedAt DESC;
END
GO
