/* =============================================================================
   ProjectDB (company database) · More than one product on a lead
   -----------------------------------------------------------------------------
   Adds crm.LeadProducts. The product a lead already has becomes its first row.
   crm.Leads.ProductMasterId stays, holding the first product, so reports and
   every screen that reads it work as before.

     crm.sp_LeadProducts_List   the products of a lead
     crm.sp_LeadProducts_Save   replaces the products of an open lead

   Runs AFTER 25_Unified_Despatch.sql. Run in EACH company database (select it
   in SSMS first; no USE on purpose). SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('crm.Leads') IS NULL
    SET @problem = 'crm.Leads is missing in [' + DB_NAME() + ']. Run the CRM scripts first.';
ELSE IF COL_LENGTH('crm.Leads', 'ProductMasterId') IS NULL OR COL_LENGTH('dbo.ProductMaster', 'IsDeleted') IS NULL
    SET @problem = 'Run 17_CRM_Product_Fixes.sql and 24_QA_Product_Job_Fixes.sql first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('crm.LeadProducts') IS NULL
BEGIN
    CREATE TABLE crm.LeadProducts
    (
        LeadProductId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadProducts PRIMARY KEY,
        CompanyId       INT NOT NULL,
        LeadId          INT NOT NULL CONSTRAINT FK_LeadProducts_Lead REFERENCES crm.Leads (LeadId),
        ProductMasterId INT NOT NULL,
        Qty             INT NOT NULL CONSTRAINT DF_LeadProducts_Qty DEFAULT (1) CONSTRAINT CK_LeadProducts_Qty CHECK (Qty >= 1),
        SortOrder       INT NOT NULL CONSTRAINT DF_LeadProducts_Sort DEFAULT (1)
    );
    CREATE UNIQUE INDEX UX_LeadProducts_Lead_Product ON crm.LeadProducts (LeadId, ProductMasterId);
END
GO

/* the product each lead has today becomes its first row */
INSERT INTO crm.LeadProducts (CompanyId, LeadId, ProductMasterId, Qty, SortOrder)
SELECT l.CompanyId, l.LeadId, l.ProductMasterId, CASE WHEN ISNULL(l.EstimatedQty, 1) < 1 THEN 1 ELSE ISNULL(l.EstimatedQty, 1) END, 1
FROM crm.Leads l
WHERE l.ProductMasterId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM crm.LeadProducts x WHERE x.LeadId = l.LeadId);
GO

CREATE OR ALTER PROCEDURE crm.sp_LeadProducts_List
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT lp.ProductMasterId, lp.Qty, p.ProductCode, p.ProductName, p.Brand, p.Model, p.Category, p.MRP, p.WarrantyMonths,
           CAST(NULL AS NVARCHAR(20)) AS HsnSac
    FROM crm.LeadProducts lp
    INNER JOIN crm.Leads l ON l.LeadId = lp.LeadId AND l.CompanyId = @CompanyId
    INNER JOIN dbo.ProductMaster p ON p.ProductMasterId = lp.ProductMasterId
    WHERE lp.LeadId = @LeadId AND lp.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY lp.SortOrder, lp.LeadProductId;
END
GO

/* @Items: [{ "productMasterId": 9, "qty": 2 }, ...] in the order shown. An empty list clears the products.
   A new product must be active; one the lead already has may stay after it was switched off. */
CREATE OR ALTER PROCEDURE crm.sp_LeadProducts_Save
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT,
    @Items      NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(ISNULL(@Items, N'')) <> 1
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The product list could not be read' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DECLARE @List TABLE (ProductMasterId INT NOT NULL PRIMARY KEY, Qty INT NOT NULL, SortOrder INT NOT NULL);

    IF EXISTS (SELECT 1 FROM OPENJSON(@Items) WITH (ProductMasterId INT '$.productMasterId', Qty INT '$.qty')
               WHERE ISNULL(ProductMasterId, 0) <= 0 OR ISNULL(Qty, 0) < 1)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter a quantity of at least 1 for every product' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    INSERT INTO @List (ProductMasterId, Qty, SortOrder)
    SELECT j.ProductMasterId, SUM(j.Qty), MIN(j.Position)
    FROM (SELECT x.ProductMasterId, x.Qty, CAST(k.[key] AS INT) + 1 AS Position
          FROM OPENJSON(@Items) k
          CROSS APPLY OPENJSON(k.[value]) WITH (ProductMasterId INT '$.productMasterId', Qty INT '$.qty') x) j
    GROUP BY j.ProductMasterId;

    IF (SELECT COUNT(*) FROM @List) > 50
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'A lead can have at most 50 products' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Status NVARCHAR(20);
    SELECT @Status = Status FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND IsDeleted = 0
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @Status IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Status IN ('Converted', 'Lost')
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted or lost lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF EXISTS (SELECT 1 FROM @List i
               WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductMaster p
                                 WHERE p.ProductMasterId = i.ProductMasterId AND p.CompanyId = @CompanyId AND p.IsDeleted = 0 AND p.IsActive = 1)
                 AND NOT EXISTS (SELECT 1 FROM crm.LeadProducts x WHERE x.LeadId = @LeadId AND x.ProductMasterId = i.ProductMasterId))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Choose active products from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DELETE FROM crm.LeadProducts WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

    INSERT INTO crm.LeadProducts (CompanyId, LeadId, ProductMasterId, Qty, SortOrder)
    SELECT @CompanyId, @LeadId, ProductMasterId, Qty, SortOrder FROM @List;

    /* the first product and the total stay on the lead for the reports */
    DECLARE @First INT = (SELECT TOP (1) ProductMasterId FROM @List ORDER BY SortOrder);
    UPDATE l
    SET ProductMasterId = @First,
        ProductCategory = CASE WHEN @First IS NULL THEN l.ProductCategory ELSE ISNULL(NULLIF(LTRIM(RTRIM(p.Category)), ''), l.ProductCategory) END,
        EstimatedQty    = CASE WHEN @First IS NULL THEN l.EstimatedQty ELSE (SELECT SUM(Qty) FROM @List) END,
        UpdatedAt       = DATEADD(MINUTE, 330, GETUTCDATE())
    FROM crm.Leads l
    LEFT JOIN dbo.ProductMaster p ON p.ProductMasterId = @First
    WHERE l.LeadId = @LeadId AND l.CompanyId = @CompanyId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Products saved' AS Message, @LeadId AS Id;
END
GO

SET NOEXEC OFF;
GO
