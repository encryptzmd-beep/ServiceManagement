/* =============================================================================
   MainDB · Delete an unused role
   -----------------------------------------------------------------------------
   Roles could only be switched off (Edit -> uncheck Active). A role that nobody
   uses can now be removed, together with its menu permissions.

   Refused for:
     - the built-in roles the application itself checks for
     - a role that is still given to a user, or named in a pending invitation /
       join request (switch it off instead)

   SAFE TO RE-RUN.
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_DeleteRole
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RoleName NVARCHAR(100) = (SELECT RoleName FROM dbo.Roles WHERE RoleId = @RoleId);

    IF @RoleName IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Role not found' AS Message; RETURN;
    END

    IF @RoleName IN ('Admin', 'CompanyAdmin', 'Manager', 'Technician', 'Customer')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The built-in role ''' + @RoleName + ''' cannot be deleted' AS Message; RETURN;
    END

    DECLARE @InUse INT =
          (SELECT COUNT(*) FROM dbo.CompanyUsers WHERE RoleInCompany = @RoleName)
        + (SELECT COUNT(*) FROM dbo.Users        WHERE RoleId = @RoleId)
        + (SELECT COUNT(*) FROM dbo.Invitations  WHERE RoleInCompany = @RoleName AND Status = 'Pending')
        + (SELECT COUNT(*) FROM dbo.JoinRequests WHERE RequestedRole = @RoleName AND Status = 'Pending');

    IF @InUse > 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success,
               'This role is in use (' + CAST(@InUse AS VARCHAR(12)) + ' user(s) / pending request(s)). Deactivate it instead.' AS Message;
        RETURN;
    END

    BEGIN TRANSACTION;
    DELETE FROM dbo.RoleMenuAccess WHERE RoleId = @RoleId;
    DELETE FROM dbo.Roles          WHERE RoleId = @RoleId;
    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Role deleted' AS Message;
END
GO

PRINT 'MainDB role delete proc applied.';
GO
