/* =============================================================================
   ProjectDB (company database) آ· 24 آ· Product status and job timeline fixes
   -----------------------------------------------------------------------------
   ProductMaster.IsDeleted   Delete hides a product for good. Deactivate keeps it in
                             the product master as Inactive, so it can be activated.
                             Rows inactive before this script were hidden from every
                             list, so they stay hidden (IsDeleted = 1).
   sp_ProductMaster_Upsert   refuses a duplicate product code; @IncludeInactive
   sp_ManageComplaintDetails an assignment note shows who assigned the job
   sp_Complaint_AssignTechnician  AssignedAt in India time

   Run in EACH company database (select it in SSMS first; no USE on purpose).
   Runs AFTER 23_Sales_Documents_Despatch_Mode.sql. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('dbo.Locations') IS NULL OR OBJECT_ID('dbo.ProductMaster') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database.';
ELSE IF OBJECT_ID('dbo.SalesDocuments') IS NULL
    SET @problem = 'Run 23_Sales_Documents_Despatch_Mode.sql first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.ProductMaster', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE dbo.ProductMaster ADD IsDeleted BIT NOT NULL CONSTRAINT DF_ProductMaster_IsDeleted DEFAULT (0);
    EXEC (N'UPDATE dbo.ProductMaster SET IsDeleted = 1 WHERE IsActive = 0;');
END
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_ProductMaster_Upsert]
    @OperationType VARCHAR(20), -- 'CREATE', 'UPDATE', 'DELETE', 'GET', 'GETBYID', 'GETDROPDOWNS', 'BULKDELETE', 'BULKUPDATE'
    @ProductMasterId INT = NULL,
    @ProductCode VARCHAR(50) = NULL,
    @ProductName VARCHAR(200) = NULL,
    @Brand VARCHAR(100) = 'AEROFIT',
    @Category VARCHAR(100) = NULL,
    @SubCategory VARCHAR(100) = NULL,
    @Model VARCHAR(100) = NULL,
    @Description VARCHAR(500) = NULL,
    @MRP DECIMAL(18,2) = NULL,
    @Org VARCHAR(10) = NULL,
    @PriceChangeStatus VARCHAR(50) = NULL,
    @PriceEffectiveDate DATE = NULL,
    @WarrantyMonths INT = 12,
    @IsActive BIT = 1,
    @UserId INT = NULL,
    @SearchTerm VARCHAR(200) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20,
    @SortColumn VARCHAR(50) = 'ProductMasterId',
    @SortDirection VARCHAR(4) = 'DESC',
    @ProductIds VARCHAR(MAX) = NULL,  -- For bulk operations (comma-separated IDs)
    @IncludeInactive BIT = 0          -- the product master screen lists inactive products too
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- CREATE OPERATION
        IF @OperationType = 'CREATE'
        BEGIN
            IF EXISTS (SELECT 1 FROM [dbo].[ProductMaster] WHERE ProductCode = LTRIM(RTRIM(@ProductCode)) AND IsDeleted = 0)
            BEGIN
                SELECT 0 AS Result, 'Product code ' + LTRIM(RTRIM(@ProductCode)) + ' already exists' AS Message;
                RETURN;
            END
INSERT INTO [dbo].[ProductMaster] (
                ProductCode, ProductName, Brand, Category, SubCategory, Model, 
                Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate, 
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate
            )
            VALUES (
                @ProductCode, @ProductName, @Brand, @Category, @SubCategory, @Model,
                @Description, @MRP, @Org, @PriceChangeStatus, @PriceEffectiveDate,
                @WarrantyMonths, @IsActive, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE())
            );

            SELECT @ProductMasterId = SCOPE_IDENTITY();

            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Product created successfully' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
        END

        -- UPDATE OPERATION
        ELSE IF @OperationType = 'UPDATE'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [dbo].[ProductMaster] WHERE ProductMasterId = @ProductMasterId)
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
                RETURN;
            END

            IF @ProductCode IS NOT NULL AND EXISTS (
                SELECT 1 FROM [dbo].[ProductMaster]
                WHERE ProductCode = LTRIM(RTRIM(@ProductCode)) AND ProductMasterId <> @ProductMasterId AND IsDeleted = 0)
            BEGIN
                SELECT 0 AS Result, 'Product code ' + LTRIM(RTRIM(@ProductCode)) + ' already exists' AS Message;
                RETURN;
            END

            UPDATE [dbo].[ProductMaster] SET
                ProductCode = ISNULL(@ProductCode, ProductCode),
                ProductName = ISNULL(@ProductName, ProductName),
                Brand = ISNULL(@Brand, Brand),
                Category = ISNULL(@Category, Category),
                SubCategory = ISNULL(@SubCategory, SubCategory),
                Model = ISNULL(@Model, Model),
                Description = ISNULL(@Description, Description),
                MRP = ISNULL(@MRP, MRP),
                Org = ISNULL(@Org, Org),
                PriceChangeStatus = ISNULL(@PriceChangeStatus, PriceChangeStatus),
                PriceEffectiveDate = ISNULL(@PriceEffectiveDate, PriceEffectiveDate),
                WarrantyMonths = ISNULL(@WarrantyMonths, WarrantyMonths),
                IsActive = ISNULL(@IsActive, IsActive),
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId = @ProductMasterId;

            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Product updated successfully' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
        END

        -- DELETE OPERATION (Soft Delete)
        ELSE IF @OperationType = 'DELETE'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [dbo].[ProductMaster] WHERE ProductMasterId = @ProductMasterId)
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
                RETURN;
            END

            UPDATE [dbo].[ProductMaster] SET
                IsActive = 0,
                IsDeleted = 1,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId = @ProductMasterId;

            SELECT 1 AS Result, 'Product deleted successfully' AS Message, @ProductMasterId AS ProductMasterId;
        END

        -- BULK DELETE OPERATION
        ELSE IF @OperationType = 'BULKDELETE'
        BEGIN
            IF @ProductIds IS NULL OR @ProductIds = ''
            BEGIN
                SELECT 0 AS Result, 'No product IDs provided' AS Message;
                RETURN;
            END

            -- Create temp table for IDs
            DECLARE @Ids TABLE (Id INT);
            INSERT INTO @Ids
            SELECT value FROM STRING_SPLIT(@ProductIds, ',');

            UPDATE [dbo].[ProductMaster] SET
                IsActive = 0,
                IsDeleted = 1,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId IN (SELECT Id FROM @Ids);

            DECLARE @DeletedCount INT = @@ROWCOUNT;
            SELECT 1 AS Result, CONCAT(@DeletedCount, ' products deleted successfully') AS Message;
        END

        -- BULK UPDATE STATUS
        ELSE IF @OperationType = 'BULKUPDATE'
        BEGIN
            IF @ProductIds IS NULL OR @ProductIds = ''
            BEGIN
                SELECT 0 AS Result, 'No product IDs provided' AS Message;
                RETURN;
            END

            DECLARE @Ids2 TABLE (Id INT);
            INSERT INTO @Ids2
            SELECT value FROM STRING_SPLIT(@ProductIds, ',');

            UPDATE [dbo].[ProductMaster] SET 
                IsActive = @IsActive,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId IN (SELECT Id FROM @Ids2) AND IsDeleted = 0;

            DECLARE @UpdatedCount INT = @@ROWCOUNT;
            SELECT 1 AS Result, CONCAT(@UpdatedCount, ' products updated successfully') AS Message;
        END

        -- GET BY ID OPERATION
        ELSE IF @OperationType = 'GETBYID'
        BEGIN
            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Success' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
            
            IF @@ROWCOUNT = 0
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
            END
        END

        -- GET ALL WITH PAGINATION AND SEARCH
        ELSE IF @OperationType = 'GET'
        BEGIN
            DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
            DECLARE @TotalCount INT;

            -- Get total count
            SELECT @TotalCount = COUNT(*)
            FROM [dbo].[ProductMaster]
            WHERE (@SearchTerm IS NULL OR 
                   ProductCode LIKE '%' + @SearchTerm + '%' OR
                   ProductName LIKE '%' + @SearchTerm + '%' OR
                   Model LIKE '%' + @SearchTerm + '%' OR
                   Category LIKE '%' + @SearchTerm + '%' OR
                   Description LIKE '%' + @SearchTerm + '%')
                   AND IsDeleted = 0 AND (@IncludeInactive = 1 OR IsActive = 1);

            -- Get paginated data
            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                @TotalCount AS TotalCount,
                @PageNumber AS CurrentPage,
                CASE WHEN @TotalCount = 0 THEN 1 ELSE CEILING(CAST(@TotalCount AS FLOAT) / @PageSize) END AS TotalPages,
                1 AS Result, 'Success' AS Message
            FROM [dbo].[ProductMaster]
            WHERE (@SearchTerm IS NULL OR 
                   ProductCode LIKE '%' + @SearchTerm + '%' OR
                   ProductName LIKE '%' + @SearchTerm + '%' OR
                   Model LIKE '%' + @SearchTerm + '%' OR
                   Category LIKE '%' + @SearchTerm + '%' OR
                   Description LIKE '%' + @SearchTerm + '%')
                   AND IsDeleted = 0 AND (@IncludeInactive = 1 OR IsActive = 1)
            ORDER BY 
                CASE WHEN @SortColumn = 'ProductMasterId' AND @SortDirection = 'ASC' THEN ProductMasterId END ASC,
                CASE WHEN @SortColumn = 'ProductMasterId' AND @SortDirection = 'DESC' THEN ProductMasterId END DESC,
                CASE WHEN @SortColumn = 'ProductCode' AND @SortDirection = 'ASC' THEN ProductCode END ASC,
                CASE WHEN @SortColumn = 'ProductCode' AND @SortDirection = 'DESC' THEN ProductCode END DESC,
                CASE WHEN @SortColumn = 'ProductName' AND @SortDirection = 'ASC' THEN ProductName END ASC,
                CASE WHEN @SortColumn = 'ProductName' AND @SortDirection = 'DESC' THEN ProductName END DESC,
                CASE WHEN @SortColumn = 'Model' AND @SortDirection = 'ASC' THEN Model END ASC,
                CASE WHEN @SortColumn = 'Model' AND @SortDirection = 'DESC' THEN Model END DESC,
                CASE WHEN @SortColumn = 'MRP' AND @SortDirection = 'ASC' THEN MRP END ASC,
                CASE WHEN @SortColumn = 'MRP' AND @SortDirection = 'DESC' THEN MRP END DESC,
                CASE WHEN @SortColumn = 'Category' AND @SortDirection = 'ASC' THEN Category END ASC,
                CASE WHEN @SortColumn = 'Category' AND @SortDirection = 'DESC' THEN Category END DESC,
                ProductMasterId DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY;
        END

        -- GET DROPDOWN DATA - Now returns single result set with Type column
        ELSE IF @OperationType = 'GETDROPDOWNS'
        BEGIN
            -- Categories
            SELECT 'Category' AS Type, Category AS Value, Category AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Category IS NOT NULL AND Category != ''
            GROUP BY Category
            
            UNION ALL
            
            -- Sub Categories
            SELECT 'SubCategory' AS Type, SubCategory AS Value, SubCategory AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND SubCategory IS NOT NULL AND SubCategory != ''
            GROUP BY SubCategory
            
            UNION ALL
            
            -- Brands
            SELECT 'Brand' AS Type, Brand AS Value, Brand AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Brand IS NOT NULL AND Brand != ''
            GROUP BY Brand
            
            UNION ALL
            
            -- Orgs
            SELECT 'Org' AS Type, Org AS Value, Org AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Org IS NOT NULL AND Org != ''
            GROUP BY Org
            
            ORDER BY Type, Label;
        END

    END TRY
    BEGIN CATCH
        SELECT 
            0 AS Result,
            ERROR_MESSAGE() AS Message,
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_LINE() AS ErrorLine;
    END CATCH
END;
GO

-- =========================================================================
-- sp_ManageComplaintDetails   (v6 — complete with ComplaintImages)
--
-- All previous fixes preserved:
--   • GET: uniform columns, Product fallback (LEFT JOIN + COALESCE + HasProductRecord)
--   • UPDATE_COMPLAINT / UPDATE_CUSTOMER (cascades to Users) / UPDATE_PRODUCT
--   • UPDATE_LOCATION
--   • ASSIGN_TECHNICIAN (moves New → In Progress)
--   • UPDATE_ASSIGNMENT (reassign + Mark Complete + auto-resolve)
--   • UNASSIGN_TECHNICIAN
--   • ADD_SPARE / UPDATE_SPARE / DELETE_SPARE
--   • ADD_COMMENT / UPDATE_COMMENT / DELETE_COMMENT
--   • CREATE_PRODUCT (INSERTs Products + links Complaints.ProductId)
--   • Uniform 5-column result shape on every non-GET branch
--
-- NEW in v6:
--   • GET returns ComplaintImages as result set #7 (between Comments and
--     Spare Parts Dropdown). Returns ImagePath, ImageData (base64),
--     ContentType, ImageName, ImageType, UploadedAt, UploadedBy +
--     resolver's name for display.
-- =========================================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_ManageComplaintDetails]
    @OperationType NVARCHAR(30),

    -- Complaint Parameters
    @ComplaintId INT = NULL,
    @Subject NVARCHAR(200) = NULL,
    @Description NVARCHAR(2000) = NULL,
    @NatureOfJob NVARCHAR(50) = NULL,
    @Priority NVARCHAR(20) = NULL,
    @Category NVARCHAR(100) = NULL,
    @BrandName NVARCHAR(100) = NULL,
    @ModelNumber NVARCHAR(100) = NULL,
    @PreferredDate DATE = NULL,
    @PreferredTimeSlot NVARCHAR(50) = NULL,
    @Latitude DECIMAL(10,7) = NULL,
    @Longitude DECIMAL(10,7) = NULL,
    @LocationAddress NVARCHAR(500) = NULL,
    @LocationName NVARCHAR(200) = NULL,

    -- Customer Parameters
    @CustomerId INT = NULL,
    @CustomerName NVARCHAR(200) = NULL,
    @CustomerEmail NVARCHAR(200) = NULL,
    @CustomerMobile NVARCHAR(15) = NULL,
    @AlternatePhone NVARCHAR(15) = NULL,
    @CustomerAddress NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @Landmark NVARCHAR(200) = NULL,
    @CustomerLatitude DECIMAL(10,7) = NULL,
    @CustomerLongitude DECIMAL(10,7) = NULL,

    -- Product Parameters
    @ProductId INT = NULL,
    @ProductName NVARCHAR(200) = NULL,
    @SerialNumber NVARCHAR(100) = NULL,
    @ProductModelNumber NVARCHAR(100) = NULL,
    @ProductBrand NVARCHAR(100) = NULL,
    @ProductCategory NVARCHAR(100) = NULL,
    @PurchaseDate DATE = NULL,
    @WarrantyExpiryDate DATE = NULL,

    -- Assignment Parameters
    @AssignmentId INT = NULL,
    @TechnicianId INT = NULL,
    @AssignmentRole NVARCHAR(20) = NULL,
    @AssignmentNotes NVARCHAR(500) = NULL,
    @ScheduledDate DATE = NULL,
    @StartTime NVARCHAR(10) = NULL,
    @EndTime NVARCHAR(10) = NULL,
    @EstimatedDuration INT = NULL,
    @WorkDone NVARCHAR(1000) = NULL,
    @PartsUsed NVARCHAR(500) = NULL,
    @CompletionRemarks NVARCHAR(500) = NULL,
    @Status NVARCHAR(50) = NULL,

    -- Spare Part Parameters
    @SpareRequestId INT = NULL,
    @SparePartId INT = NULL,
    @SpareQuantity INT = NULL,
    @SpareUrgency NVARCHAR(20) = NULL,
    @SpareRemarks NVARCHAR(500) = NULL,
    @SpareStatus NVARCHAR(30) = NULL,

    -- Comment Parameters
    @CommentId INT = NULL,
    @CommentText NVARCHAR(MAX) = NULL,
    @IsInternal BIT = 0,

    -- Common Parameters
    @UserId INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        -- =====================================================
        -- GET : multi-result-set read
        -- =====================================================
        IF @OperationType = 'GET'
        BEGIN
            -- 1. Complaint Basic Info
            SELECT
                c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.NatureOfJob,
                c.CreatedAt, c.UpdatedAt, c.Priority, c.PriorityId,
                c.StatusId, cs.StatusName, cs.StatusColor,
                CASE WHEN c.SLADeadline < ISNULL(c.ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END AS IsSLABreached,
                c.SLADeadline, c.ContactNumber,
                c.PreferredDate, c.PreferredTimeSlot,
                c.Category, c.BrandName, c.ModelNumber,
                c.LocationName, c.LocationAddress, c.Latitude, c.Longitude,
                c.ClosedAt
            FROM Complaints c
            INNER JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
            WHERE c.ComplaintId = @ComplaintId;

            -- 2. Customer Details
            SELECT
                cust.CustomerId, cust.CustomerName, cust.Email, cust.MobileNumber,
                cust.AlternatePhone, cust.Address, cust.City, cust.State,
                cust.PinCode, cust.Landmark, cust.Latitude, cust.Longitude,
                cust.CreatedAt, cust.UpdatedAt
            FROM Customers cust
            INNER JOIN Complaints c ON cust.CustomerId = c.CustomerId
            WHERE c.ComplaintId = @ComplaintId;

            -- 3. Product Details (LEFT JOIN + COALESCE + HasProductRecord)
            SELECT
                p.ProductId,
                p.ProductName,
                p.SerialNumber,
                COALESCE(p.ModelNumber, c.ModelNumber) AS ModelNumber,
                COALESCE(p.Brand,       c.BrandName)   AS Brand,
                COALESCE(p.Category,    c.Category)    AS ProductCategory,
                p.PurchaseDate,
                p.WarrantyExpiryDate,
                CASE
                    WHEN p.WarrantyExpiryDate IS NULL                       THEN 'No Warranty'
                    WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 'Active'
                    ELSE 'Expired'
                END AS WarrantyStatus,
                p.CreatedAt,
                p.UpdatedAt,
                CASE WHEN p.ProductId IS NULL THEN CAST(0 AS BIT)
                                              ELSE CAST(1 AS BIT)
                END AS HasProductRecord
            FROM Complaints c
            LEFT JOIN Products p ON p.ProductId = c.ProductId
            WHERE c.ComplaintId = @ComplaintId;

            -- 4. Technician Assignments (exclude Removed)
            SELECT
                ta.AssignmentId, ta.TechnicianId,
                u.FullName AS TechnicianName,
                u.MobileNumber AS TechnicianPhone,
                tp.Specialization, tp.EmployeeCode,
                ta.AssignmentRole AS [Role],
                ta.Status,
                ta.AssignedAt, ta.CompletedAt,
                ta.ScheduledDate, ta.StartTime, ta.EndTime,
                ta.EstimatedDuration,
                ta.Notes, ta.Priority,
                ta.WorkDone, ta.PartsUsed, ta.CompletionRemarks,
                assignedBy.FullName AS AssignedByName
            FROM TechnicianAssignments ta
            INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            LEFT JOIN Users assignedBy ON ta.AssignedBy = assignedBy.UserId
            WHERE ta.ComplaintId = @ComplaintId
              AND ISNULL(ta.Status, '') <> 'Removed'
            ORDER BY ta.AssignedAt DESC;

            -- 5. Spare Parts Requests
            SELECT
                spr.RequestId, spr.SparePartId,
                sp.PartName, sp.PartNumber, sp.UnitPrice,
                spr.Quantity, spr.Status, spr.UrgencyLevel,
                spr.RequestedAt, spr.ApprovedAt, spr.Remarks,
                u.FullName AS TechnicianName, spr.TechnicianId,
                appr.FullName AS ApprovedByName
            FROM SparePartRequests spr
            INNER JOIN SpareParts sp ON spr.SparePartId = sp.SparePartId
            INNER JOIN Technicians t ON spr.TechnicianId = t.TechnicianId
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN Users appr ON spr.ApprovedBy = appr.UserId
            WHERE spr.ComplaintId = @ComplaintId
            ORDER BY spr.RequestedAt DESC;

            -- 6. Comments (union of timeline + assignment notes + work-done + completion)
            SELECT CommentId, Comment, PostedByRole, PostedBy, PostedAt, IsInternal
            FROM (
                SELECT
                    ct.TimelineId AS CommentId,
                    ct.Remarks AS Comment,
                    ISNULL(r.RoleName, 'System') AS PostedByRole,
                    ISNULL(u.FullName, 'System') AS PostedBy,
                    ct.CreatedAt AS PostedAt,
                    CAST(0 AS BIT) AS IsInternal
                FROM ComplaintTimeline ct
                LEFT JOIN Users u ON ct.ActionBy = u.UserId
                LEFT JOIN Roles r ON u.RoleId = r.RoleId
                WHERE ct.ComplaintId = @ComplaintId
                  AND ct.Remarks IS NOT NULL

                UNION ALL

                SELECT
                    ta.AssignmentId + 100000 AS CommentId,
                    ta.Notes AS Comment,
                    ISNULL(abr.RoleName, 'System') AS PostedByRole,
                    ISNULL(ab.FullName, 'System') AS PostedBy,
                    ta.AssignedAt AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                LEFT JOIN Users ab ON ta.AssignedBy = ab.UserId
                LEFT JOIN Roles abr ON ab.RoleId = abr.RoleId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.Notes IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'

                UNION ALL

                SELECT
                    ta.AssignmentId + 200000 AS CommentId,
                    ta.WorkDone AS Comment,
                    'Technician' AS PostedByRole,
                    u.FullName AS PostedBy,
                    ISNULL(ta.CompletedAt, ta.AssignedAt) AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
                INNER JOIN Users u ON t.UserId = u.UserId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.WorkDone IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'

                UNION ALL

                SELECT
                    ta.AssignmentId + 300000 AS CommentId,
                    ta.CompletionRemarks AS Comment,
                    'Technician' AS PostedByRole,
                    u.FullName AS PostedBy,
                    ISNULL(ta.CompletedAt, ta.AssignedAt) AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
                INNER JOIN Users u ON t.UserId = u.UserId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.CompletionRemarks IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'
            ) AS Combined
            ORDER BY PostedAt DESC;

            -- 7. Complaint Images  (NEW in v6)
            --    Returns ImagePath (file URL) OR ImageData (base64) so the
            --    Angular popup can render either form. UploadedByName lets
            --    the UI say who uploaded each image.
            SELECT
                ci.ImageId,
                ci.ComplaintId,
                ci.ImagePath,
                ci.ImageData,
                ci.ImageName,
                ci.ContentType,
                ci.ImageType,
                ci.UploadedAt,
                ci.UploadedBy,
                u.FullName    AS UploadedByName,
                ISNULL(r.RoleName, 'Customer') AS UploadedByRole
            FROM ComplaintImages ci
            LEFT JOIN Users u ON ci.UploadedBy = u.UserId
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            WHERE ci.ComplaintId = @ComplaintId
            ORDER BY ci.UploadedAt DESC, ci.ImageId DESC;

            -- 8. Spare Parts Dropdown
            SELECT SparePartId, PartName, PartNumber, StockQuantity, UnitPrice
            FROM SpareParts
            WHERE IsActive = 1
            ORDER BY PartName;

            -- 9. Technicians Dropdown
            SELECT
                t.TechnicianId,
                u.FullName AS TechnicianName,
                tp.Specialization,
                tp.AvailabilityStatus,
                tp.EmployeeCode
            FROM Technicians t
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            WHERE t.IsActive = 1
            ORDER BY u.FullName;

            RETURN;
        END

        -- =====================================================
        -- UPDATE_COMPLAINT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_COMPLAINT'
        BEGIN
            UPDATE Complaints
            SET Subject           = ISNULL(@Subject, Subject),
                Description       = ISNULL(@Description, Description),
                NatureOfJob       = CASE WHEN @NatureOfJob IS NULL THEN NatureOfJob ELSE LEFT(@NatureOfJob, 50) END,
                Priority          = ISNULL(@Priority, Priority),
                Category          = ISNULL(@Category, Category),
                BrandName         = ISNULL(@BrandName, BrandName),
                ModelNumber       = ISNULL(@ModelNumber, ModelNumber),
                PreferredDate     = ISNULL(@PreferredDate, PreferredDate),
                PreferredTimeSlot = ISNULL(@PreferredTimeSlot, PreferredTimeSlot),
                UpdatedAt         = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            SELECT @ComplaintId, StatusId, 'Complaint details updated', @UserId, DATEADD(MINUTE, 330, GETUTCDATE())
            FROM Complaints WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Complaint updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_CUSTOMER (also syncs the Users record)
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_CUSTOMER'
        BEGIN
            UPDATE Customers
            SET CustomerName   = ISNULL(@CustomerName, CustomerName),
                Email          = ISNULL(@CustomerEmail, Email),
                MobileNumber   = ISNULL(@CustomerMobile, MobileNumber),
                AlternatePhone = ISNULL(@AlternatePhone, AlternatePhone),
                Address        = ISNULL(@CustomerAddress, Address),
                City           = ISNULL(@City, City),
                State          = ISNULL(@State, State),
                PinCode        = ISNULL(@PinCode, PinCode),
                Landmark       = ISNULL(@Landmark, Landmark),
                Latitude       = ISNULL(@CustomerLatitude, Latitude),
                Longitude      = ISNULL(@CustomerLongitude, Longitude),
                UpdatedAt      = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE CustomerId = @CustomerId;

            UPDATE Users
            SET FullName     = ISNULL(@CustomerName, FullName),
                Email        = ISNULL(@CustomerEmail, Email),
                MobileNumber = ISNULL(@CustomerMobile, MobileNumber),
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE UserId = (SELECT UserId FROM Customers WHERE CustomerId = @CustomerId);

            SELECT CAST(1 AS BIT) AS Success,
                   'Customer updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_PRODUCT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_PRODUCT'
        BEGIN
            UPDATE Products
            SET ProductName        = ISNULL(@ProductName, ProductName),
                SerialNumber       = ISNULL(@SerialNumber, SerialNumber),
                ModelNumber        = ISNULL(@ProductModelNumber, ModelNumber),
                Brand              = ISNULL(@ProductBrand, Brand),
                Category           = ISNULL(@ProductCategory, Category),
                PurchaseDate       = ISNULL(@PurchaseDate, PurchaseDate),
                WarrantyExpiryDate = ISNULL(@WarrantyExpiryDate, WarrantyExpiryDate),
                UpdatedAt          = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductId = @ProductId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Product updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- CREATE_PRODUCT  (insert new Products row + link to complaint)
        -- =====================================================
        ELSE IF @OperationType = 'CREATE_PRODUCT'
        BEGIN
            IF @ComplaintId IS NULL
            BEGIN
                SELECT CAST(0 AS BIT) AS Success,
                       'ComplaintId is required' AS Message,
                       CAST(NULL AS INT) AS AssignmentId,
                       CAST(NULL AS INT) AS CommentId,
                       CAST(NULL AS INT) AS RequestId;
                RETURN;
            END

            IF @ProductName IS NULL OR LTRIM(RTRIM(@ProductName)) = ''
            BEGIN
                SELECT CAST(0 AS BIT) AS Success,
                       'Product name is required' AS Message,
                       CAST(NULL AS INT) AS AssignmentId,
                       CAST(NULL AS INT) AS CommentId,
                       CAST(NULL AS INT) AS RequestId;
                RETURN;
            END

            DECLARE @NewCustomerId INT;
            SELECT @NewCustomerId = CustomerId FROM Complaints WHERE ComplaintId = @ComplaintId;

            -- Note: remove CustomerId column + value if your Products table
            -- doesn't have one.
            INSERT INTO Products (
                CustomerId,
                ProductName, SerialNumber, ModelNumber,
                Brand, Category, PurchaseDate, WarrantyExpiryDate,
                CreatedAt, IsActive
            )
            VALUES (
                @NewCustomerId,
                @ProductName, @SerialNumber, @ProductModelNumber,
                @ProductBrand, @ProductCategory, @PurchaseDate, @WarrantyExpiryDate,
                DATEADD(MINUTE, 330, GETUTCDATE()), 1
            );

            DECLARE @NewProductId INT = SCOPE_IDENTITY();

            UPDATE Complaints
            SET ProductId   = @NewProductId,
                Category    = ISNULL(@ProductCategory,    Category),
                BrandName   = ISNULL(@ProductBrand,       BrandName),
                ModelNumber = ISNULL(@ProductModelNumber, ModelNumber),
                UpdatedAt   = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            SELECT @ComplaintId, StatusId,
                   CONCAT('Product record created and linked: ', @ProductName),
                   @UserId, DATEADD(MINUTE, 330, GETUTCDATE())
            FROM Complaints WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Product created and linked successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @NewProductId AS RequestId;
        END

        -- =====================================================
        -- UPDATE_LOCATION
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_LOCATION'
        BEGIN
            UPDATE Complaints
            SET Latitude        = ISNULL(@Latitude, Latitude),
                Longitude       = ISNULL(@Longitude, Longitude),
                LocationAddress = ISNULL(@LocationAddress, LocationAddress),
                LocationName    = ISNULL(@LocationName, LocationName),
                UpdatedAt       = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Location updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- ASSIGN_TECHNICIAN  (new assignment)
        -- =====================================================
        ELSE IF @OperationType = 'ASSIGN_TECHNICIAN'
        BEGIN
            INSERT INTO TechnicianAssignments (
                ComplaintId, TechnicianId, AssignmentRole, AssignedBy,
                Notes, ScheduledDate, StartTime, EndTime, EstimatedDuration,
                Priority, Status, AssignedAt
            )
            VALUES (
                @ComplaintId, @TechnicianId, ISNULL(@AssignmentRole,'Primary'), @UserId,
                @AssignmentNotes, @ScheduledDate, @StartTime, @EndTime, @EstimatedDuration,
                @Priority, 'Assigned', DATEADD(MINUTE, 330, GETUTCDATE())
            );

            SET @AssignmentId = SCOPE_IDENTITY();

            IF EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId = @ComplaintId AND StatusId = 1)
            BEGIN
                UPDATE Complaints SET StatusId = 2, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE ComplaintId = @ComplaintId;
            END

            INSERT INTO AssignmentAuditLog
                (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks, ChangedAt)
            VALUES
                (@AssignmentId, @ComplaintId, 'Created', @TechnicianId,
                 ISNULL(@AssignmentRole,'Primary'), @UserId, 'Technician assigned', DATEADD(MINUTE, 330, GETUTCDATE()));

            SELECT CAST(1 AS BIT) AS Success,
                   'Technician assigned successfully' AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_ASSIGNMENT  (handles reassign + mark complete)
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_ASSIGNMENT'
        BEGIN
            DECLARE @OldTechnicianId INT, @OldRole NVARCHAR(20),
                    @ExistingComplaintId INT, @OldStatus NVARCHAR(50);

            SELECT @OldTechnicianId     = TechnicianId,
                   @OldRole             = AssignmentRole,
                   @ExistingComplaintId = ComplaintId,
                   @OldStatus           = [Status]
            FROM TechnicianAssignments
            WHERE AssignmentId = @AssignmentId;

            UPDATE TechnicianAssignments
            SET TechnicianId       = ISNULL(@TechnicianId, TechnicianId),
                AssignmentRole     = ISNULL(@AssignmentRole, AssignmentRole),
                Notes              = ISNULL(@AssignmentNotes, Notes),
                ScheduledDate      = ISNULL(@ScheduledDate, ScheduledDate),
                StartTime          = ISNULL(@StartTime, StartTime),
                EndTime            = ISNULL(@EndTime, EndTime),
                EstimatedDuration  = ISNULL(@EstimatedDuration, EstimatedDuration),
                Priority           = ISNULL(@Priority, Priority),
                WorkDone           = ISNULL(@WorkDone, WorkDone),
                PartsUsed          = ISNULL(@PartsUsed, PartsUsed),
                CompletionRemarks  = ISNULL(@CompletionRemarks, CompletionRemarks),
                [Status]           = ISNULL(@Status, [Status]),
                CompletedAt        = CASE
                                        WHEN @Status = 'Completed' AND CompletedAt IS NULL
                                            THEN DATEADD(MINUTE, 330, GETUTCDATE())
                                        ELSE CompletedAt
                                     END,
                UpdatedAt          = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE AssignmentId = @AssignmentId;

            IF @TechnicianId IS NOT NULL AND @TechnicianId <> @OldTechnicianId
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, OldTechnicianId, NewTechnicianId,
                     OldRole, NewRole, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId, 'Reassigned',
                     @OldTechnicianId, @TechnicianId,
                     @OldRole, ISNULL(@AssignmentRole, @OldRole),
                     @UserId, 'Technician reassigned', DATEADD(MINUTE, 330, GETUTCDATE()));
            END

            IF @Status IS NOT NULL AND @Status <> ISNULL(@OldStatus, '')
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId,
                     CASE WHEN @Status = 'Completed' THEN 'Completed' ELSE 'StatusChanged' END,
                     @UserId,
                     CONCAT('Status → ', @Status), DATEADD(MINUTE, 330, GETUTCDATE()));

                IF @Status = 'Completed'
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM TechnicianAssignments
                         WHERE ComplaintId = @ExistingComplaintId
                           AND ISNULL([Status],'') NOT IN ('Completed', 'Removed')
                    )
                    BEGIN
                        UPDATE Complaints
                        SET StatusId     = 3,
                            ResolvedDate = DATEADD(MINUTE, 330, GETUTCDATE()),
                            UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
                        WHERE ComplaintId = @ExistingComplaintId
                          AND StatusId NOT IN (3, 4);

                        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
                        VALUES (@ExistingComplaintId, 3,
                                'Auto-resolved: all assignments completed',
                                @UserId, DATEADD(MINUTE, 330, GETUTCDATE()));
                    END
                END
            END
            ELSE IF @TechnicianId IS NULL OR @TechnicianId = @OldTechnicianId
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId, 'Updated', @UserId,
                     'Assignment details updated', DATEADD(MINUTE, 330, GETUTCDATE()));
            END

            SELECT CAST(1 AS BIT) AS Success,
                   CASE
                       WHEN @Status = 'Completed'                              THEN 'Assignment marked complete'
                       WHEN @TechnicianId IS NOT NULL AND @TechnicianId <> @OldTechnicianId THEN 'Technician reassigned successfully'
                       ELSE 'Assignment updated successfully'
                   END AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UNASSIGN_TECHNICIAN
        -- =====================================================
        ELSE IF @OperationType = 'UNASSIGN_TECHNICIAN'
        BEGIN
            DECLARE @UnassignComplaintId INT;
            SELECT @UnassignComplaintId = ComplaintId
            FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;

            UPDATE TechnicianAssignments
            SET Status    = 'Removed',
                UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE AssignmentId = @AssignmentId;

            INSERT INTO AssignmentAuditLog
                (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
            VALUES
                (@AssignmentId, @UnassignComplaintId, 'Removed', @UserId,
                 'Technician unassigned', DATEADD(MINUTE, 330, GETUTCDATE()));

            SELECT CAST(1 AS BIT) AS Success,
                   'Technician unassigned successfully' AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- ADD_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'ADD_SPARE'
        BEGIN
            DECLARE @PartName NVARCHAR(200), @PartNumber NVARCHAR(100);
            SELECT @PartName = PartName, @PartNumber = PartNumber
            FROM SpareParts WHERE SparePartId = @SparePartId;

            INSERT INTO SparePartRequests (
                ComplaintId, TechnicianId, SparePartId, Quantity,
                UrgencyLevel, Remarks, Status, RequestedAt, CreatedAt,
                PartName, PartNumber
            )
            VALUES (
                @ComplaintId, @TechnicianId, @SparePartId, ISNULL(@SpareQuantity, 1),
                ISNULL(@SpareUrgency, 'Normal'), @SpareRemarks, 'Requested',
                DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()),
                @PartName, @PartNumber
            );

            SET @SpareRequestId = SCOPE_IDENTITY();

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request added successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- UPDATE_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_SPARE'
        BEGIN
            UPDATE SparePartRequests
            SET Quantity     = ISNULL(@SpareQuantity, Quantity),
                UrgencyLevel = ISNULL(@SpareUrgency, UrgencyLevel),
                Remarks      = ISNULL(@SpareRemarks, Remarks),
                Status       = ISNULL(@SpareStatus, Status),
                ApprovedBy   = CASE WHEN @SpareStatus IN ('Approved','Rejected')
                                    THEN @UserId ELSE ApprovedBy END,
                ApprovedAt   = CASE WHEN @SpareStatus IN ('Approved','Rejected')
                                    THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE ApprovedAt END,
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE RequestId = @SpareRequestId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- DELETE_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'DELETE_SPARE'
        BEGIN
            DELETE FROM SparePartRequests WHERE RequestId = @SpareRequestId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request deleted successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- ADD_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'ADD_COMMENT'
        BEGIN
            DECLARE @CurrentStatusId INT;
            SELECT @CurrentStatusId = StatusId FROM Complaints WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            VALUES (@ComplaintId, @CurrentStatusId, @CommentText, @UserId, DATEADD(MINUTE, 330, GETUTCDATE()));

            SET @CommentId = SCOPE_IDENTITY();

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment added successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_COMMENT'
        BEGIN
            UPDATE ComplaintTimeline
            SET Remarks = @CommentText
            WHERE TimelineId = @CommentId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- DELETE_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'DELETE_COMMENT'
        BEGIN
            DELETE FROM ComplaintTimeline WHERE TimelineId = @CommentId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment deleted successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- Dropdowns
        -- =====================================================
        ELSE IF @OperationType = 'GET_SPARE_PARTS_DROPDOWN'
        BEGIN
            SELECT SparePartId, PartName, PartNumber, StockQuantity, UnitPrice
            FROM SpareParts
            WHERE IsActive = 1
            ORDER BY PartName;
        END

        ELSE IF @OperationType = 'GET_TECHNICIANS_DROPDOWN'
        BEGIN
            SELECT
                t.TechnicianId,
                u.FullName AS TechnicianName,
                tp.Specialization,
                tp.AvailabilityStatus,
                tp.EmployeeCode
            FROM Technicians t
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            WHERE t.IsActive = 1
            ORDER BY u.FullName;
        END

        -- =====================================================
        -- Unknown op
        -- =====================================================
        ELSE
        BEGIN
            SELECT CAST(0 AS BIT) AS Success,
                   'Unknown operation: ' + ISNULL(@OperationType,'<null>') AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

    END TRY
    BEGIN CATCH
        SELECT CAST(0 AS BIT) AS Success,
               ERROR_MESSAGE() AS Message,
               CAST(NULL AS INT) AS AssignmentId,
               CAST(NULL AS INT) AS CommentId,
               CAST(NULL AS INT) AS RequestId;
    END CATCH
END
GO

-- ============================================================
-- SP 1: Assign Technician (with schedule + multi-assign)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[sp_Complaint_AssignTechnician]
    @ComplaintId       INT,
    @TechnicianId      INT,
    @AssignmentRole    NVARCHAR(20),
    @AssignedBy        INT,
    @Priority          NVARCHAR(20) = NULL,
    @Notes             NVARCHAR(500) = NULL,
    @ScheduledDate     DATE = NULL,
    @StartTime         NVARCHAR(10) = NULL,
    @EndTime           NVARCHAR(10) = NULL,
    @EstimatedDuration INT = NULL,
    @TimeSlot          NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM TechnicianAssignments
        WHERE ComplaintId=@ComplaintId AND TechnicianId=@TechnicianId AND Status NOT IN ('Removed','Completed'))
    BEGIN
        SELECT -1 AS AssignmentId, 'This technician is already assigned to this complaint' AS [Message];
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId=@ComplaintId)
    BEGIN
        SELECT -2 AS AssignmentId, 'Complaint not found' AS [Message];
        RETURN;
    END

    INSERT INTO TechnicianAssignments (ComplaintId, TechnicianId, AssignmentRole, AssignedBy,
        ScheduledDate, StartTime, EndTime, EstimatedDuration, TimeSlot, Notes, Priority, AssignedAt)
    VALUES (@ComplaintId, @TechnicianId, @AssignmentRole, @AssignedBy,
        @ScheduledDate, @StartTime, @EndTime, @EstimatedDuration, @TimeSlot, @Notes, @Priority, DATEADD(MINUTE, 330, GETUTCDATE()));

    DECLARE @NewId INT = SCOPE_IDENTITY();

    DECLARE @Remark NVARCHAR(500) = 'Assigned as ' + @AssignmentRole;
    IF @ScheduledDate IS NOT NULL
        SET @Remark += ' | Scheduled: ' + CONVERT(NVARCHAR,@ScheduledDate,106) + ISNULL(' '+@StartTime+'-'+@EndTime,'');

    INSERT INTO AssignmentAuditLog (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
    VALUES (@NewId, @ComplaintId, 'Created', @TechnicianId, @AssignmentRole, @AssignedBy, @Remark);

    UPDATE TechnicianProfiles SET AvailabilityStatus=2
    WHERE UserId=(SELECT UserId FROM Technicians WHERE TechnicianId=@TechnicianId);

    IF EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId=@ComplaintId AND StatusId=1)
        UPDATE Complaints SET StatusId=2, UpdatedAt=DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId=@ComplaintId;

    IF @Priority IS NOT NULL
        UPDATE Complaints SET Priority=@Priority, UpdatedAt=DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId=@ComplaintId;

    SELECT @NewId AS AssignmentId, 'Technician assigned successfully' AS [Message];
END
GO

SET NOEXEC OFF;
GO
