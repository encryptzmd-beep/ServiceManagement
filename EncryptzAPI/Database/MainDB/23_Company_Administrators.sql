/* =============================================================================
   MainDB · Members and administrators of a company, set by the platform
   -----------------------------------------------------------------------------
   Run AFTER 22_Individual_Id.sql. It adds three procedures and changes no table
   and no row. SAFE TO RE-RUN.

   The person who creates a company is its administrator (sp_Company_Create,
   script 20). Everything else about who administers a company is decided in
   Platform Admin, Companies, Administrators - never by a script:

     sp_Platform_GetCompanyMembers     the active members with their role, their
                                       Individual ID and who created the company
     sp_Platform_SetCompanyMemberRole  changes the role of a member. A company
                                       always keeps at least one administrator.
     sp_Platform_AddCompanyMember      adds a registered person (found by e-mail
                                       or Individual ID) with a role

   A member who is not an administrator gets the applications the company has
   (sp_Company_GrantDefaultModules): an administrator needs no grant, anybody
   else would be locked out without one.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL OR OBJECT_ID('dbo.CompanyUsers') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   COL_LENGTH('dbo.Companies', 'CreatedBy') IS NULL
        OR COL_LENGTH('dbo.Users', 'IndividualId') IS NULL
        OR OBJECT_ID('dbo.sp_Company_GrantDefaultModules') IS NULL)
BEGIN
    RAISERROR('Run 14_Company_Tenancy_Cutover.sql, 20_Company_Provisioning.sql and 22_Individual_Id.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   The active members of a company, administrators first
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanyMembers
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId, u.FullName, u.Email,
        CASE WHEN u.IndividualId LIKE 'EZ%' THEN u.IndividualId ELSE '' END AS IndividualId,
        cu.RoleInCompany,
        CAST(CASE WHEN c.CreatedBy = u.UserId THEN 1 ELSE 0 END AS BIT) AS IsCreator,
        cu.AssignedAt
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u     ON u.UserId = cu.UserId AND u.IsActive = 1
    INNER JOIN dbo.Companies c ON c.CompanyId = cu.CompanyId
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 0 ELSE 1 END,
             u.FullName;
END
GO

/* -----------------------------------------------------------------------------
   Change the role of a member
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetCompanyMemberRole
    @CompanyId INT,
    @UserId    INT,
    @RoleName  NVARCHAR(100),
    @ChangedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Current NVARCHAR(100), @OtherAdmins INT, @IsAdminNow BIT, @WillBeAdmin BIT;

    SET @RoleName = LTRIM(RTRIM(ISNULL(@RoleName, '')));

    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = @RoleName AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Role not found' AS Message; RETURN;
    END

    SET @WillBeAdmin = CASE WHEN @RoleName IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END;

    BEGIN TRANSACTION;

    /* every member row of the company is held until the end: two changes at once
       cannot both take the last administrator away */
    SELECT @OtherAdmins = COUNT(*)
    FROM dbo.CompanyUsers cu WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId AND u.IsActive = 1
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND cu.UserId <> @UserId
      AND LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin');

    SELECT @Current = cu.RoleInCompany
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId AND u.IsActive = 1
    WHERE cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This person is not an active member of the company' AS Message; RETURN;
    END

    SET @IsAdminNow = CASE WHEN LTRIM(RTRIM(@Current)) IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END;

    IF @IsAdminNow = 1 AND @WillBeAdmin = 0 AND @OtherAdmins = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'A company needs at least one administrator. Make someone else administrator first' AS Message; RETURN;
    END

    UPDATE dbo.CompanyUsers
    SET RoleInCompany = @RoleName
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;

    /* an administrator needs no grant; anybody else keeps what the company has */
    IF @WillBeAdmin = 0
        EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @ChangedBy;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @WillBeAdmin = 1 THEN 'Made administrator of the company' ELSE 'Role changed to ' + @RoleName END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   Add a registered person to a company. Exactly one of @Email / @IndividualId
   is given (the API decides which from what was typed).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_AddCompanyMember
    @CompanyId    INT,
    @Email        NVARCHAR(256) = NULL,
    @IndividualId CHAR(14)      = NULL,
    @RoleName     NVARCHAR(100),
    @AddedBy      INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT, @FullName NVARCHAR(200), @WillBeAdmin BIT, @WasMember BIT = 0, @WasActive BIT = 0;

    SET @RoleName     = LTRIM(RTRIM(ISNULL(@RoleName, '')));
    SET @Email        = NULLIF(LTRIM(RTRIM(ISNULL(@Email, ''))), '');
    SET @IndividualId = NULLIF(LTRIM(RTRIM(ISNULL(@IndividualId, ''))), '');

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS UserId; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = @RoleName AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Role not found' AS Message, CAST(0 AS INT) AS UserId; RETURN;
    END

    SELECT TOP (1) @UserId = u.UserId, @FullName = u.FullName
    FROM dbo.Users u
    WHERE u.IsActive = 1
      AND (   (@IndividualId IS NOT NULL AND u.IndividualId = @IndividualId)
           OR (@IndividualId IS NULL AND @Email IS NOT NULL AND u.Email = @Email));

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Nobody is registered with this e-mail or Individual ID' AS Message, CAST(0 AS INT) AS UserId; RETURN;
    END

    SET @WillBeAdmin = CASE WHEN @RoleName IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END;

    BEGIN TRANSACTION;

    SELECT @WasMember = 1, @WasActive = IsActive
    FROM dbo.CompanyUsers WITH (UPDLOCK, HOLDLOCK)
    WHERE CompanyId = @CompanyId AND UserId = @UserId;

    IF @WasMember = 1 AND @WasActive = 1
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This person is already a member of the company. Change the role in the list' AS Message, CAST(0 AS INT) AS UserId; RETURN;
    END

    IF @WasMember = 1
        UPDATE dbo.CompanyUsers
        SET RoleInCompany = @RoleName, IsActive = 1, AssignedBy = @AddedBy, AssignedAt = GETDATE()
        WHERE CompanyId = @CompanyId AND UserId = @UserId;
    ELSE
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @RoleName, @AddedBy, 1);

    IF @WillBeAdmin = 0
        EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @AddedBy;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           @FullName + CASE WHEN @WillBeAdmin = 1 THEN ' is now an administrator of the company' ELSE ' was added as ' + @RoleName END AS Message,
           @UserId AS UserId;
END
GO

PRINT 'Company members and administrators can be managed in Platform Admin.';
GO
SET NOEXEC OFF;
GO
