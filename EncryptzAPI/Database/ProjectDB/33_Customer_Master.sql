/* =============================================================================
   ProjectDB (company database) · Customer master: one record per party
   -----------------------------------------------------------------------------
   dbo.Customers is the one party record shared by CRM quotations, Sales orders,
   repeat supplies and Service Management. The same party is never saved twice:

     the same party  = the same mobile number (compared on its last 10 digits,
                       so +91 98460-12345 and 9846012345 are one) OR the same GSTIN

   ADDS
     dbo.fn_MobileKey                the last 10 digits of a mobile, for comparing
     dbo.sp_Customer_Matches         the customers that are the same party as a
                                     mobile / GSTIN (the warning before creating)
     dbo.sp_Customer_List            the Customers screen: search, paged, with the
                                     number of orders, complaints and products
     crm.sp_Lead_SetCustomer         links a lead to its customer when its
                                     quotation is saved
   CHANGES
     dbo.sp_Sales_Customer_Save      copied from 09_Sales_Order_Despatch.sql: a new
                                     customer matching a mobile OR a GSTIN updates
                                     that customer instead of making a second one;
                                     a changed mobile / GSTIN may not be another
                                     party's. Customers that are duplicates already
                                     are left as they are.

   Runs AFTER 32_Job_Card.sql. Run in EACH company database (select it in SSMS
   first; no USE on purpose). New company databases created by the API get it
   automatically. SAFE TO RE-RUN.
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
ELSE IF COL_LENGTH('dbo.Customers', 'GSTIN') IS NULL OR OBJECT_ID('crm.Leads') IS NULL OR COL_LENGTH('crm.Leads', 'IsDeleted') IS NULL
    SET @problem = 'Run the sales (09) and CRM (14, 22) scripts first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* the last 10 digits of a mobile as typed ('' when there are none): +91 98460-12345 -> 9846012345 */
CREATE OR ALTER FUNCTION dbo.fn_MobileKey (@Mobile NVARCHAR(50))
RETURNS NVARCHAR(20)
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @d NVARCHAR(50) = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(@Mobile, N''))),
                                N' ', N''), N'-', N''), N'+', N''), N'(', N''), N')', N''), N'.', N'');
    RETURN RIGHT(@d, 10);
END
GO

/* the customers that are the same party as this mobile / GSTIN (an existing customer left out by @ExcludeCustomerId) */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_Matches
    @MobileNumber      NVARCHAR(20) = NULL,
    @GSTIN             NVARCHAR(20) = NULL,
    @ExcludeCustomerId INT          = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MobileKey NVARCHAR(20) = NULLIF(dbo.fn_MobileKey(@MobileNumber), N'');
    SET @GSTIN = NULLIF(UPPER(LTRIM(RTRIM(@GSTIN))), N'');

    SELECT c.CustomerId, c.CustomerName, c.MobileNumber, c.AlternatePhone, c.Email,
           c.Address, c.City, c.[State], c.PinCode, c.Landmark, c.GSTIN, c.Latitude, c.Longitude,
           (SELECT COUNT(*) FROM dbo.Products p WHERE p.CustomerId = c.CustomerId AND p.IsActive = 1) AS TotalProducts,
           CASE WHEN @MobileKey IS NOT NULL AND dbo.fn_MobileKey(c.MobileNumber) = @MobileKey THEN N'Mobile' ELSE N'GSTIN' END AS MatchedOn
    FROM dbo.Customers c
    WHERE c.IsActive = 1
      AND c.CustomerId <> ISNULL(@ExcludeCustomerId, 0)
      AND ((@MobileKey IS NOT NULL AND dbo.fn_MobileKey(c.MobileNumber) = @MobileKey)
           OR (@GSTIN IS NOT NULL AND UPPER(LTRIM(RTRIM(c.GSTIN))) = @GSTIN))
    ORDER BY CASE WHEN @MobileKey IS NOT NULL AND dbo.fn_MobileKey(c.MobileNumber) = @MobileKey THEN 0 ELSE 1 END, c.CustomerId;
END
GO

/* the Customers screen: name / mobile / GSTIN / city, paged, with what each party has done */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_List
    @SearchTerm NVARCHAR(100) = NULL,
    @PageNumber INT = 1,
    @PageSize   INT = 25
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @PageNumber = CASE WHEN ISNULL(@PageNumber, 0) < 1 THEN 1 ELSE @PageNumber END;
    SET @PageSize   = CASE WHEN ISNULL(@PageSize, 0) BETWEEN 1 AND 200 THEN @PageSize ELSE 25 END;

    SELECT c.CustomerId, c.CustomerName, c.MobileNumber, c.AlternatePhone, c.Email,
           c.Address, c.City, c.[State], c.PinCode, c.Landmark, c.GSTIN,
           (SELECT COUNT(*) FROM dbo.Products p    WHERE p.CustomerId = c.CustomerId AND p.IsActive = 1) AS TotalProducts,
           (SELECT COUNT(*) FROM dbo.SalesOrders s WHERE s.CustomerId = c.CustomerId AND s.IsActive = 1) AS TotalOrders,
           (SELECT COUNT(*) FROM dbo.Complaints k  WHERE k.CustomerId = c.CustomerId)                    AS TotalComplaints,
           c.CreatedAt,
           COUNT(*) OVER () AS TotalCount
    FROM dbo.Customers c
    WHERE c.IsActive = 1
      AND (@SearchTerm IS NULL
           OR c.CustomerName LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber LIKE '%' + @SearchTerm + '%'
           OR c.GSTIN        LIKE '%' + @SearchTerm + '%'
           OR c.Email        LIKE '%' + @SearchTerm + '%'
           OR c.City         LIKE '%' + @SearchTerm + '%')
    ORDER BY c.CustomerName, c.CustomerId
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* a lead's customer, set when its quotation is saved (only while it has none) */
CREATE OR ALTER PROCEDURE crm.sp_Lead_SetCustomer
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT,
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN SELECT CAST(0 AS BIT) AS Success, N'Customer not found' AS Message, CAST(0 AS INT) AS Id; RETURN; END

    UPDATE crm.Leads
    SET CustomerId = @CustomerId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND IsDeleted = 0 AND CustomerId IS NULL
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    DECLARE @Linked INT = @@ROWCOUNT;
    SELECT CAST(1 AS BIT) AS Success,
           CASE WHEN @Linked = 1 THEN N'Customer linked' ELSE N'The lead has its customer already' END AS Message,
           @LeadId AS Id;
END
GO

/* copied from 09_Sales_Order_Despatch.sql; changed: the same party is found by mobile (last 10 digits) OR GSTIN,
   and a changed mobile / GSTIN may not be another party's */
CREATE OR ALTER PROCEDURE dbo.sp_Sales_Customer_Save
    @CustomerId     INT = 0,
    @CustomerName   NVARCHAR(150),
    @MobileNumber   NVARCHAR(20),
    @Email          NVARCHAR(150) = NULL,
    @AlternatePhone NVARCHAR(15)  = NULL,
    @Address        NVARCHAR(500) = NULL,
    @City           NVARCHAR(100) = NULL,
    @State          NVARCHAR(100) = NULL,
    @PinCode        NVARCHAR(10)  = NULL,
    @Landmark       NVARCHAR(200) = NULL,
    @GSTIN          NVARCHAR(20)  = NULL,
    @Latitude       DECIMAL(9,6)  = NULL,
    @Longitude      DECIMAL(9,6)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CustomerName   = NULLIF(LTRIM(RTRIM(@CustomerName)), '');
    SET @MobileNumber   = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');
    SET @Email          = NULLIF(LTRIM(RTRIM(@Email)), '');
    SET @GSTIN          = NULLIF(UPPER(LTRIM(RTRIM(@GSTIN))), '');
    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());

    IF @CustomerName IS NULL
    BEGIN SELECT 0 AS Success, 'Customer name is required.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN; END
    IF @MobileNumber IS NULL
    BEGIN SELECT 0 AS Success, 'Mobile number is required.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN; END

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @IsNew BIT = 0;

        /* the same party already in the master (same mobile, or same GSTIN): update that one, never a second record */
        DECLARE @MobileKey NVARCHAR(20) = dbo.fn_MobileKey(@MobileNumber);
        IF ISNULL(@CustomerId, 0) = 0
            SELECT TOP 1 @CustomerId = CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
            WHERE dbo.fn_MobileKey(MobileNumber) = @MobileKey
               OR (@GSTIN IS NOT NULL AND UPPER(LTRIM(RTRIM(GSTIN))) = @GSTIN)
            ORDER BY CASE WHEN dbo.fn_MobileKey(MobileNumber) = @MobileKey THEN 0 ELSE 1 END, IsActive DESC, CustomerId;

        IF ISNULL(@CustomerId, 0) = 0
        BEGIN
            DECLARE @UserId INT;
            SELECT TOP 1 @UserId = UserId FROM dbo.Users WHERE MobileNumber = @MobileNumber;

            IF @UserId IS NULL
            BEGIN
                DECLARE @CustomerRoleId INT;
                SELECT TOP 1 @CustomerRoleId = RoleId FROM dbo.Roles WHERE RoleName = N'Customer' ORDER BY IsActive DESC, RoleId;
                IF @CustomerRoleId IS NULL
                    SELECT TOP 1 @CustomerRoleId = RoleId FROM dbo.Roles ORDER BY RoleId;

                INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, CreatedAt, UpdatedAt, UserType)
                VALUES (@CustomerName, @Email, @MobileNumber, @CustomerRoleId, 1, @Now, @Now, 'Customer');
                SET @UserId = SCOPE_IDENTITY();
            END

            INSERT INTO dbo.Customers
                (UserId, CustomerName, MobileNumber, AlternatePhone, Email, Address, City, [State], PinCode,
                 Landmark, GSTIN, Latitude, Longitude, IsActive, CreatedAt, UpdatedAt)
            VALUES
                (@UserId, @CustomerName, @MobileNumber, @AlternatePhone, @Email, @Address, @City, @State, @PinCode,
                 @Landmark, @GSTIN, @Latitude, @Longitude, 1, @Now, @Now);
            SET @CustomerId = SCOPE_IDENTITY();
            SET @IsNew = 1;
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Customer not found.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN;
            END

            /* a changed mobile or GSTIN must not be another party's (older duplicates keep working as they are) */
            DECLARE @OldMobileKey NVARCHAR(20), @OldGstin NVARCHAR(20);
            SELECT @OldMobileKey = dbo.fn_MobileKey(MobileNumber), @OldGstin = UPPER(LTRIM(RTRIM(GSTIN)))
            FROM dbo.Customers WHERE CustomerId = @CustomerId;
            IF @MobileKey <> ISNULL(@OldMobileKey, N'')
               AND EXISTS (SELECT 1 FROM dbo.Customers WHERE dbo.fn_MobileKey(MobileNumber) = @MobileKey AND CustomerId <> @CustomerId)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Another customer already uses this mobile number.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN;
            END
            IF @GSTIN IS NOT NULL AND @GSTIN <> ISNULL(@OldGstin, N'')
               AND EXISTS (SELECT 1 FROM dbo.Customers WHERE UPPER(LTRIM(RTRIM(GSTIN))) = @GSTIN AND CustomerId <> @CustomerId)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Another customer already has this GSTIN.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN;
            END

            UPDATE dbo.Customers
            SET CustomerName   = @CustomerName,
                MobileNumber   = @MobileNumber,
                AlternatePhone = ISNULL(@AlternatePhone, AlternatePhone),
                Email          = ISNULL(@Email, Email),
                Address        = ISNULL(@Address, Address),
                City           = ISNULL(@City, City),
                [State]        = ISNULL(@State, [State]),
                PinCode        = ISNULL(@PinCode, PinCode),
                Landmark       = ISNULL(@Landmark, Landmark),
                GSTIN          = ISNULL(@GSTIN, GSTIN),
                Latitude       = ISNULL(@Latitude, Latitude),
                Longitude      = ISNULL(@Longitude, Longitude),
                IsActive       = 1,
                UpdatedAt      = @Now
            WHERE CustomerId = @CustomerId;

            /* keep the login row in step (name / e-mail) */
            UPDATE u
            SET u.FullName = @CustomerName,
                u.Email    = ISNULL(@Email, u.Email),
                u.UpdatedAt = @Now
            FROM dbo.Users u
            INNER JOIN dbo.Customers c ON c.UserId = u.UserId
            WHERE c.CustomerId = @CustomerId;
        END

        COMMIT TRANSACTION;

        SELECT 1 AS Success,
               CASE WHEN @IsNew = 1 THEN 'Customer created.' ELSE 'Customer updated.' END AS Message,
               @CustomerId AS CustomerId, @IsNew AS IsNew;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS CustomerId, 0 AS IsNew;
    END CATCH
END
GO

PRINT 'Customer master is in place.';
GO
SET NOEXEC OFF;
GO
