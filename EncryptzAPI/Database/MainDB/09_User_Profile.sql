/* =============================================================================
   MainDB  ·  The logged-in user's own profile (header > Profile)
   -----------------------------------------------------------------------------
     sp_User_GetProfile      details + role in the selected company
     sp_User_UpdateProfile   name and mobile number (the e-mail is the login id
                             and is not changed here)

   Run against MainDB. SAFE TO RE-RUN.
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_User_GetProfile
    @UserId    INT,
    @CompanyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.FullName,
        u.Email,
        ISNULL(u.MobileNumber, '')   AS MobileNumber,
        ISNULL(u.AadhaarNumber, '')  AS AadhaarNumber,
        ISNULL(r.RoleName, '')       AS GlobalRole,
        ISNULL(cu.RoleInCompany, '') AS RoleInCompany,
        ISNULL(c.CompanyId, 0)       AS CompanyId,
        ISNULL(c.CompanyName, '')    AS CompanyName,
        ISNULL(c.CompanyCode, '')    AS CompanyCode,
        u.CreatedAt,
        cu.AssignedAt                AS MemberSince
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r         ON r.RoleId = u.RoleId
    LEFT JOIN dbo.CompanyUsers cu ON cu.UserId = u.UserId AND cu.CompanyId = @CompanyId AND cu.IsActive = 1
    LEFT JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId
    WHERE u.UserId = @UserId AND u.IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_UpdateProfile
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @MobileNumber NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @FullName     = LTRIM(RTRIM(ISNULL(@FullName, '')));
    SET @MobileNumber = NULLIF(LTRIM(RTRIM(ISNULL(@MobileNumber, ''))), '');

    IF @FullName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Name is required' AS Message; RETURN;
    END
    IF @MobileNumber IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber AND UserId <> @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This mobile number is used by another account' AS Message; RETURN;
    END

    UPDATE dbo.Users
    SET FullName = @FullName, MobileNumber = @MobileNumber
    WHERE UserId = @UserId AND IsActive = 1;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, 'Profile updated' AS Message;
END
GO

PRINT 'MainDB user profile procs applied.';
GO
