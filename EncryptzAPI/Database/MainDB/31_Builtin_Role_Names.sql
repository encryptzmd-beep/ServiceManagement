/* =============================================================================
   MainDB · 31 · Built-in roles keep their names
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz. SAFE TO RE-RUN.

   The application finds roles BY NAME: login sets IsPlatformAdmin when the global
   role is 'Admin', and a member's role in a company (CompanyUsers.RoleInCompany) is
   joined to dbo.Roles on RoleName. sp_Mgmt_SaveRole let the Roles screen rename any
   role, and 'Admin' and 'CompanyAdmin' were renamed: every platform administrator
   then logged in as a normal user, and company administrators lost their menus.

     1. the renamed built-in roles get their names back (found by their seeded
        description, only while no role has the name already)
     2. sp_Mgmt_SaveRole refuses to rename a built-in role (the same list
        sp_Mgmt_DeleteRole refuses to delete); its description and Active flag can
        still be changed. The API shows the refusal (Status = 'Refused', Message).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Roles') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Names back
   ----------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Admin')
    UPDATE dbo.Roles SET RoleName = N'Admin'
    WHERE RoleId = (SELECT MIN(RoleId) FROM dbo.Roles WHERE Description = N'Full access');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'CompanyAdmin')
    UPDATE dbo.Roles SET RoleName = N'CompanyAdmin'
    WHERE RoleId = (SELECT MIN(RoleId) FROM dbo.Roles WHERE Description = N'Company administrator');
GO

SELECT r.RoleId, r.RoleName, r.Description, r.IsActive,
       (SELECT COUNT(*) FROM dbo.Users u WHERE u.RoleId = r.RoleId) AS GlobalUsers
FROM dbo.Roles r
ORDER BY r.RoleId;
GO

/* -----------------------------------------------------------------------------
   2. No renaming of a built-in role
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveRole
    @RoleId      INT,
    @RoleName    NVARCHAR(100),
    @Description NVARCHAR(300) = NULL,
    @IsActive    BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @RoleId IS NULL OR @RoleId = 0
    BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, IsActive)
        VALUES (@RoleName, @Description, @IsActive);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS RoleId, 'Inserted' AS Status, CAST(NULL AS NVARCHAR(200)) AS Message;
        RETURN;
    END

    DECLARE @OldName NVARCHAR(100) = (SELECT RoleName FROM dbo.Roles WHERE RoleId = @RoleId);

    IF @OldName IN ('Admin', 'CompanyAdmin', 'Manager', 'Technician', 'Customer') AND @RoleName COLLATE Latin1_General_BIN <> @OldName COLLATE Latin1_General_BIN
    BEGIN
        SELECT @RoleId AS RoleId, 'Refused' AS Status,
               CAST('The built-in role ''' + @OldName + ''' cannot be renamed' AS NVARCHAR(200)) AS Message;
        RETURN;
    END

    UPDATE dbo.Roles SET RoleName = @RoleName, Description = @Description, IsActive = @IsActive
    WHERE RoleId = @RoleId;
    SELECT @RoleId AS RoleId, 'Updated' AS Status, CAST(NULL AS NVARCHAR(200)) AS Message;
END
GO

PRINT 'MainDB built-in role names applied.';
GO
