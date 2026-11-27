/* =============================================================================
   ProjectDB (company database) · Job card
   -----------------------------------------------------------------------------
   dbo.sp_JobCard_Get @AssignmentId: everything printed on the job card of one
   technician assignment, so the technician can carry it (PDF) where there is no
   network and write down what was done.

     Table[0]  the job: complaint, visit (date / time / slot), customer, product
               and warranty, and the technician of this assignment
     Table[1]  every technician on the complaint (not removed), with mobile

   Reads only. Runs AFTER 31_Quotation_Defaults.sql. Run in EACH company database
   (select it in SSMS first; no USE on purpose). New company databases created by
   the API get it automatically. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);
IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.TechnicianAssignments') IS NULL OR COL_LENGTH('dbo.Complaints', 'NatureOfJob') IS NULL
    SET @problem = 'Run the service scripts first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_JobCard_Get
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ComplaintId INT = (SELECT ComplaintId FROM dbo.TechnicianAssignments WHERE AssignmentId = @AssignmentId);

    SELECT a.AssignmentId,
           a.ComplaintId,
           ISNULL(c.ComplaintNumber, c.ComplaintNo)        AS ComplaintNumber,
           c.Subject,
           c.Description,
           c.NatureOfJob,
           c.Category                                      AS ComplaintCategory,
           ISNULL(a.Priority, c.Priority)                  AS Priority,
           c.SLADeadline,
           c.CreatedAt                                     AS ComplaintDate,
           c.PreferredDate,
           c.PreferredTimeSlot,
           c.IsWarranty,
           st.StatusName,
           a.AssignmentRole,
           a.Status                                        AS AssignmentStatus,
           DATEADD(MINUTE, 330, a.AssignedAt)              AS AssignedAt,
           a.ScheduledDate,
           a.StartTime,
           a.EndTime,
           a.TimeSlot,
           a.EstimatedDuration,
           a.Notes,
           tu.FullName                                     AS TechnicianName,
           tu.MobileNumber                                 AS TechnicianMobile,
           cust.CustomerName,
           ISNULL(NULLIF(c.ContactNumber, ''), cust.MobileNumber) AS CustomerMobile,
           cust.AlternatePhone                             AS CustomerAlternatePhone,
           cust.Email                                      AS CustomerEmail,
           ISNULL(NULLIF(c.LocationAddress, ''), cust.Address) AS CustomerAddress,
           cust.Landmark,
           cust.City,
           cust.[State],
           cust.PinCode,
           ISNULL(c.Latitude, cust.Latitude)               AS Latitude,
           ISNULL(c.Longitude, cust.Longitude)             AS Longitude,
           p.ProductName,
           ISNULL(NULLIF(p.Brand, ''), c.BrandName)        AS Brand,
           ISNULL(NULLIF(p.Model, ''), ISNULL(NULLIF(p.ModelNumber, ''), c.ModelNumber)) AS Model,
           p.SerialNumber,
           p.Category                                      AS ProductCategory,
           p.PurchaseDate,
           p.WarrantyExpiryDate
    FROM dbo.TechnicianAssignments a
    INNER JOIN dbo.Complaints c        ON c.ComplaintId = a.ComplaintId
    LEFT JOIN dbo.ComplaintStatuses st ON st.StatusId = c.StatusId
    LEFT JOIN dbo.Customers cust       ON cust.CustomerId = c.CustomerId
    LEFT JOIN dbo.Products p           ON p.ProductId = c.ProductId
    LEFT JOIN dbo.Technicians t        ON t.TechnicianId = a.TechnicianId
    LEFT JOIN dbo.Users tu             ON tu.UserId = t.UserId
    WHERE a.AssignmentId = @AssignmentId;

    SELECT a.AssignmentId,
           tu.FullName     AS TechnicianName,
           tu.MobileNumber AS TechnicianMobile,
           a.AssignmentRole,
           a.ScheduledDate,
           a.StartTime,
           a.EndTime
    FROM dbo.TechnicianAssignments a
    LEFT JOIN dbo.Technicians t ON t.TechnicianId = a.TechnicianId
    LEFT JOIN dbo.Users tu      ON tu.UserId = t.UserId
    WHERE a.ComplaintId = @ComplaintId AND a.Status NOT IN ('Removed', 'Cancelled')
    ORDER BY CASE WHEN a.AssignmentRole = 'Primary' THEN 0 ELSE 1 END, a.AssignmentId;
END
GO

PRINT 'Job card is in place.';
GO
SET NOEXEC OFF;
GO
