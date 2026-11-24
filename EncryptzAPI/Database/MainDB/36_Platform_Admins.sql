/* =============================================================================
   MainDB · 36 · More than one platform administrator
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz. SAFE TO RE-RUN.

   A platform (SaaS) administrator is a user whose GLOBAL role (Users.RoleId) is
   'Admin'. Platform Admin > Platform Admins lists them and lets a platform
   administrator make an existing user one, or take it away again.

     1. dbo.PlatformAdminGrants: who made the user an administrator, and the global
        role the user had before (given back on removal)
     2. sp_Platform_GetAdmins        the administrators
     3. sp_Platform_FindAdminCandidates  active users who are not one yet (search)
     4. sp_Platform_AddAdmin         makes an existing, active user an administrator
     5. sp_Platform_RemoveAdmin      gives the previous global role back; refuses the
                                     caller's own account and the last active one
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL OR OBJECT_ID('dbo.Roles') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Grants
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PlatformAdminGrants') IS NULL
CREATE TABLE dbo.PlatformAdminGrants
(
    UserId          INT      NOT NULL CONSTRAINT PK_PlatformAdminGrants PRIMARY KEY
                             CONSTRAINT FK_PlatformAdminGrants_User REFERENCES dbo.Users(UserId),
    PreviousRoleId  INT      NULL,
    GrantedBy       INT      NULL,
    GrantedAt       DATETIME NOT NULL CONSTRAINT DF_PlatformAdminGrants_GrantedAt DEFAULT (GETDATE())
);
GO

/* -----------------------------------------------------------------------------
   2. The administrators
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetAdmins
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.UserId,
           u.FullName,
           u.Email,
           ISNULL(u.MobileNumber, '') AS MobileNumber,
           u.IsActive,
           g.GrantedAt,
           ISNULL(gb.FullName, '') AS GrantedByName
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.RoleId = u.RoleId AND r.RoleName = N'Admin'
    LEFT JOIN dbo.PlatformAdminGrants g ON g.UserId = u.UserId
    LEFT JOIN dbo.Users gb ON gb.UserId = g.GrantedBy
    ORDER BY u.IsActive DESC, u.FullName;
END
GO

/* -----------------------------------------------------------------------------
   3. Users who can be made an administrator (active, not one yet)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_FindAdminCandidates
    @Search NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search = LTRIM(RTRIM(ISNULL(@Search, '')));
    IF LEN(@Search) < 3
    BEGIN
        SELECT TOP (0) CAST(0 AS INT) AS UserId, CAST('' AS NVARCHAR(200)) AS FullName,
               CAST('' AS NVARCHAR(256)) AS Email, CAST('' AS NVARCHAR(20)) AS MobileNumber;
        RETURN;
    END

    DECLARE @Like NVARCHAR(210) = N'%' + REPLACE(REPLACE(REPLACE(@Search, '[', '[[]'), '%', '[%]'), '_', '[_]') + N'%';

    SELECT TOP (10) u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.IsActive = 1
      AND ISNULL(r.RoleName, N'') <> N'Admin'
      AND (u.Email LIKE @Like OR u.MobileNumber LIKE @Like OR u.FullName LIKE @Like)
    ORDER BY u.FullName;
END
GO

/* -----------------------------------------------------------------------------
   4. Make an existing user an administrator
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_AddAdmin
    @UserId    INT,
    @GrantedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @AdminRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Admin');
    DECLARE @CurrentRoleId INT, @IsActive BIT;

    SELECT @CurrentRoleId = RoleId, @IsActive = IsActive FROM dbo.Users WHERE UserId = @UserId;

    IF @AdminRoleId IS NULL
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The Admin role is missing' AS Message; RETURN; END
    IF @IsActive IS NULL
    BEGIN SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message; RETURN; END
    IF @IsActive = 0
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The user is inactive' AS Message; RETURN; END
    IF @CurrentRoleId = @AdminRoleId
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The user is already a platform administrator' AS Message; RETURN; END

    BEGIN TRANSACTION;

    DELETE FROM dbo.PlatformAdminGrants WHERE UserId = @UserId;
    INSERT INTO dbo.PlatformAdminGrants (UserId, PreviousRoleId, GrantedBy)
    VALUES (@UserId, @CurrentRoleId, @GrantedBy);

    UPDATE dbo.Users SET RoleId = @AdminRoleId WHERE UserId = @UserId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Platform administrator added' AS Message;
END
GO

/* -----------------------------------------------------------------------------
   5. Take it away: the previous global role comes back (none = no global role)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_RemoveAdmin
    @UserId    INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @AdminRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Admin');

    IF @UserId = @RemovedBy
    BEGIN SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own administrator access' AS Message; RETURN; END
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId AND RoleId = @AdminRoleId)
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The user is not a platform administrator' AS Message; RETURN; END
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE RoleId = @AdminRoleId AND IsActive = 1 AND UserId <> @UserId)
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The last active platform administrator cannot be removed' AS Message; RETURN; END

    BEGIN TRANSACTION;

    UPDATE u
    SET RoleId = CASE WHEN g.PreviousRoleId = @AdminRoleId THEN NULL ELSE g.PreviousRoleId END
    FROM dbo.Users u
    LEFT JOIN dbo.PlatformAdminGrants g ON g.UserId = u.UserId
    WHERE u.UserId = @UserId;

    DELETE FROM dbo.PlatformAdminGrants WHERE UserId = @UserId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Platform administrator removed' AS Message;
END
GO

SELECT u.UserId, u.FullName, u.Email, u.IsActive
FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId AND r.RoleName = N'Admin'
ORDER BY u.UserId;
GO

PRINT 'MainDB platform administrators applied.';
GO
