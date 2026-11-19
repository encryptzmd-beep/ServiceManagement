/* =============================================================================
   ProjectDB (company database) · Product category / sub category master
   -----------------------------------------------------------------------------
   Adds dbo.ProductCategories: a category (ParentId NULL) and its sub categories
   (ParentId = the category). It is filled once from the Category / SubCategory
   text the products already have, so nothing is lost; a re-run adds only what is
   missing. dbo.ProductMaster keeps the names as text (no column changes), so
   reports and every screen that reads them work as before.

     dbo.sp_ProductCategory_List   the tree, with the number of products of each
     dbo.sp_ProductCategory_Save   add / rename / activate; a rename also renames
                                   the products that use the name
     crm.sp_Product_Categories     (only when the CRM is installed) the active
                                   categories of the master

   Runs AFTER 20_Transaction_Toolbar.sql. Run in EACH company database (select it
   in SSMS first; no USE on purpose). New company databases created by the API
   get it automatically after 20. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.SchemaInfo') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the Personal DB. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.ProductMaster') IS NULL
    SET @problem = 'dbo.ProductMaster is missing in [' + DB_NAME() + ']. This is not a Service company database.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* 1. The master */
IF OBJECT_ID('dbo.ProductCategories') IS NULL
BEGIN
    CREATE TABLE dbo.ProductCategories
    (
        CategoryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductCategories PRIMARY KEY,
        ParentId   INT            NULL CONSTRAINT FK_ProductCategories_Parent REFERENCES dbo.ProductCategories (CategoryId),
        Name       NVARCHAR(100)  NOT NULL,
        IsActive   BIT            NOT NULL CONSTRAINT DF_ProductCategories_IsActive DEFAULT (1),
        CreatedAt  DATETIME2      NOT NULL CONSTRAINT DF_ProductCategories_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        UpdatedAt  DATETIME2      NULL,
        ParentKey  AS (ISNULL(ParentId, 0)) PERSISTED
    );
    CREATE UNIQUE INDEX UX_ProductCategories_Parent_Name ON dbo.ProductCategories (ParentKey, Name);
END
GO

/* 2. Filled from the products (only what is missing) */
INSERT INTO dbo.ProductCategories (ParentId, Name)
SELECT NULL, c.Name
FROM (SELECT DISTINCT LTRIM(RTRIM(pm.Category)) AS Name
      FROM dbo.ProductMaster pm
      WHERE LTRIM(RTRIM(ISNULL(pm.Category, ''))) <> '') c
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.ParentId IS NULL AND x.Name = c.Name);
GO

INSERT INTO dbo.ProductCategories (ParentId, Name)
SELECT p.CategoryId, s.Name
FROM (SELECT DISTINCT LTRIM(RTRIM(pm.Category)) AS Category, LTRIM(RTRIM(pm.SubCategory)) AS Name
      FROM dbo.ProductMaster pm
      WHERE LTRIM(RTRIM(ISNULL(pm.Category, ''))) <> '' AND LTRIM(RTRIM(ISNULL(pm.SubCategory, ''))) <> '') s
INNER JOIN dbo.ProductCategories p ON p.ParentId IS NULL AND p.Name = s.Category
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductCategories x WHERE x.ParentId = p.CategoryId AND x.Name = s.Name);
GO

/* 3. The tree, with the number of products that use each name */
CREATE OR ALTER PROCEDURE dbo.sp_ProductCategory_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CategoryId, c.ParentId, c.Name, c.IsActive,
           CASE WHEN c.ParentId IS NULL
                THEN (SELECT COUNT(*) FROM dbo.ProductMaster pm WHERE LTRIM(RTRIM(pm.Category)) = c.Name)
                ELSE (SELECT COUNT(*) FROM dbo.ProductMaster pm
                      WHERE LTRIM(RTRIM(pm.SubCategory)) = c.Name AND LTRIM(RTRIM(pm.Category)) = p.Name) END AS ProductCount
    FROM dbo.ProductCategories c
    LEFT JOIN dbo.ProductCategories p ON p.CategoryId = c.ParentId
    ORDER BY ISNULL(p.Name, c.Name), CASE WHEN c.ParentId IS NULL THEN 0 ELSE 1 END, c.Name;
END
GO

/* 4. Add (@CategoryId 0) or change one; a new name is also given to the products that had the old one */
CREATE OR ALTER PROCEDURE dbo.sp_ProductCategory_Save
    @CategoryId INT,
    @ParentId   INT = NULL,
    @Name       NVARCHAR(100),
    @IsActive   BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Name = LTRIM(RTRIM(ISNULL(@Name, '')));
    SET @ParentId = NULLIF(@ParentId, 0);
    SET @CategoryId = ISNULL(@CategoryId, 0);

    IF @Name = ''
    BEGIN SELECT CAST(0 AS BIT) AS Success, N'Enter the name' AS Message, 0 AS CategoryId; RETURN; END

    IF @ParentId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories WHERE CategoryId = @ParentId AND ParentId IS NULL)
    BEGIN SELECT CAST(0 AS BIT) AS Success, N'A sub category cannot have sub categories' AS Message, 0 AS CategoryId; RETURN; END

    IF @CategoryId > 0 AND NOT EXISTS (SELECT 1 FROM dbo.ProductCategories WHERE CategoryId = @CategoryId)
    BEGIN SELECT CAST(0 AS BIT) AS Success, N'Category not found' AS Message, 0 AS CategoryId; RETURN; END

    IF @CategoryId > 0
        SELECT @ParentId = ParentId FROM dbo.ProductCategories WHERE CategoryId = @CategoryId;   -- the level never changes

    IF EXISTS (SELECT 1 FROM dbo.ProductCategories
               WHERE ISNULL(ParentId, 0) = ISNULL(@ParentId, 0) AND Name = @Name AND CategoryId <> @CategoryId)
    BEGIN SELECT CAST(0 AS BIT) AS Success, N'This name is already in the list' AS Message, 0 AS CategoryId; RETURN; END

    BEGIN TRANSACTION;

    IF @CategoryId = 0
    BEGIN
        INSERT INTO dbo.ProductCategories (ParentId, Name, IsActive) VALUES (@ParentId, @Name, ISNULL(@IsActive, 1));
        SET @CategoryId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        DECLARE @OldName NVARCHAR(100), @ParentName NVARCHAR(100);
        SELECT @OldName = c.Name, @ParentName = p.Name
        FROM dbo.ProductCategories c LEFT JOIN dbo.ProductCategories p ON p.CategoryId = c.ParentId
        WHERE c.CategoryId = @CategoryId;

        UPDATE dbo.ProductCategories
        SET Name = @Name, IsActive = ISNULL(@IsActive, IsActive), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE CategoryId = @CategoryId;

        IF @OldName <> @Name COLLATE Latin1_General_CS_AS
        BEGIN
            IF @ParentId IS NULL
                UPDATE dbo.ProductMaster SET Category = @Name WHERE LTRIM(RTRIM(Category)) = @OldName;
            ELSE
                UPDATE dbo.ProductMaster SET SubCategory = @Name
                WHERE LTRIM(RTRIM(SubCategory)) = @OldName AND LTRIM(RTRIM(Category)) = @ParentName;
        END
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Saved' AS Message, @CategoryId AS CategoryId;
END
GO

/* 5. The CRM lists the active categories of the master (when the CRM is installed) */
IF SCHEMA_ID('crm') IS NOT NULL
    EXEC (N'
CREATE OR ALTER PROCEDURE crm.sp_Product_Categories
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.Name AS Category
    FROM dbo.ProductCategories c
    WHERE c.ParentId IS NULL AND c.IsActive = 1
    ORDER BY c.Name;
END');
GO

PRINT 'Product categories applied.';
GO
SET NOEXEC OFF;
GO
