/* =============================================================================
   ProjectDB · Users/technicians come from MainDB
   -----------------------------------------------------------------------------
   Users, roles, company membership and project access are owned by MainDB. This
   DB's dbo.Users is only a MIRROR of the MainDB users allowed into the project,
   kept so the existing business procs/FKs (ComplaintTimeline.ActionBy,
   Technicians.UserId, ...) keep working with a local UserId.

     Users.MainUserId  -> MainDB.dbo.Users.UserId   (NULL = legacy, local-only row)

   The API calls sp_Tenant_SyncUsers with the project's MainDB users whenever a
   user enters the project (set-scope) or membership changes (invite accepted,
   role changed, user removed, technician added).

   Sections:
     1. Users.MainUserId link column
     2. Scope column defaults read the API's SESSION_CONTEXT (stamps every insert)
     3. sp_Tenant_SyncUsers
     4. Technician procs: list/create driven by MainDB users
     5. OPTIONAL: retire legacy technicians that have no MainDB user

   Run against each service-app DB. SAFE TO RE-RUN.
   Run MainDB/05_Tenant_User_Sync.sql against MainDB as well.
   ============================================================================= */

/* =============================================================================
   1. Link column
   ============================================================================= */
IF COL_LENGTH('dbo.Users', 'MainUserId') IS NULL
    ALTER TABLE dbo.Users ADD MainUserId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_MainUserId' AND object_id = OBJECT_ID('dbo.Users'))
    CREATE UNIQUE INDEX UX_Users_MainUserId ON dbo.Users(MainUserId) WHERE MainUserId IS NOT NULL;
GO

/* =============================================================================
   2. Scope defaults from SESSION_CONTEXT
   -----------------------------------------------------------------------------
   The API sets CompanyId / ProjectId / LocationId in SESSION_CONTEXT on every
   tenant connection (DbHelper). Pointing the column defaults at it stamps the
   scope on every INSERT, including procs that were not rewritten to take
   @CompanyId/@ProjectId/@LocationId yet (they used to write 0/0/0).
   ============================================================================= */
DECLARE @exclude TABLE (Name SYSNAME);
INSERT INTO @exclude (Name) VALUES ('Locations'), ('sysdiagrams');

DECLARE @work TABLE (TableName SYSNAME, ColumnName SYSNAME, DefaultName SYSNAME NULL);
INSERT INTO @work (TableName, ColumnName, DefaultName)
SELECT t.name, c.name, dc.name
FROM sys.tables t
INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.name IN ('CompanyId', 'ProjectId', 'LocationId')
                          AND c.is_identity = 0      -- e.g. the legacy Companies.CompanyId key
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = t.object_id AND dc.parent_column_id = c.column_id
WHERE t.is_ms_shipped = 0
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND t.name NOT IN (SELECT Name FROM @exclude)
  AND (dc.definition IS NULL OR dc.definition NOT LIKE '%SESSION_CONTEXT%');

DECLARE @t SYSNAME, @c SYSNAME, @df SYSNAME, @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT TableName, ColumnName, DefaultName FROM @work;

OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @df;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @df IS NOT NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.' + QUOTENAME(@t) + ' DROP CONSTRAINT ' + QUOTENAME(@df) + ';';
        EXEC sp_executesql @sql;
    END

    SET @sql = 'ALTER TABLE dbo.' + QUOTENAME(@t) + ' ADD CONSTRAINT ' + QUOTENAME('DF_' + @t + '_' + @c) +
               ' DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N''' + @c + ''')), 0)) FOR ' + QUOTENAME(@c) + ';';
    EXEC sp_executesql @sql;

    PRINT 'Scope default -> SESSION_CONTEXT: dbo.' + @t + '.' + @c;
    FETCH NEXT FROM cur INTO @t, @c, @df;
END
CLOSE cur; DEALLOCATE cur;
GO

/* =============================================================================
   3. sp_Tenant_SyncUsers
   -----------------------------------------------------------------------------
   @UsersJson: [{ "userId":1, "fullName":"..", "email":"..", "mobileNumber":"..",
                  "role":"Technician" }, ...]   (the project's MainDB users)

   For each user: link/insert the local Users row (match on MainUserId, then on an
   unlinked row with the same email, then the same mobile), keep name/contact/role
   in step with MainDB, and make sure a Technician has Technicians +
   TechnicianProfiles rows. Linked users that are no longer in the list lose
   access here (IsActive = 0).

   Returns the MainDB -> local id map (TenantUserId, TechnicianId, ProfileId).
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Tenant_SyncUsers
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT = 0,
    @UsersJson  NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME = DATEADD(MINUTE, 330, GETUTCDATE());

    /* Membership changes happen outside a location; stamp the project's first one */
    IF ISNULL(@LocationId, 0) = 0
        SELECT TOP 1 @LocationId = LocationId
        FROM dbo.Locations
        WHERE CompanyId = @CompanyId AND ProjectId = @ProjectId AND IsActive = 1
        ORDER BY LocationId;
    SET @LocationId = ISNULL(@LocationId, 0);

    DECLARE @src TABLE
    (
        MainUserId   INT PRIMARY KEY,
        FullName     NVARCHAR(150) NOT NULL,
        Email        NVARCHAR(200) NULL,
        MobileNumber NVARCHAR(15)  NULL,
        RoleName     NVARCHAR(50)  NOT NULL
    );

    INSERT INTO @src (MainUserId, FullName, Email, MobileNumber, RoleName)
    SELECT j.userId,
           LEFT(ISNULL(NULLIF(LTRIM(RTRIM(j.fullName)), ''), 'User ' + CAST(j.userId AS VARCHAR(12))), 150),
           NULLIF(LTRIM(RTRIM(j.email)), ''),
           LEFT(NULLIF(LTRIM(RTRIM(j.mobileNumber)), ''), 15),
           LEFT(ISNULL(NULLIF(LTRIM(RTRIM(j.[role])), ''), 'User'), 50)
    FROM OPENJSON(ISNULL(@UsersJson, '[]'))
         WITH (userId INT '$.userId', fullName NVARCHAR(200) '$.fullName', email NVARCHAR(256) '$.email',
               mobileNumber NVARCHAR(20) '$.mobileNumber', [role] NVARCHAR(100) '$.role') j
    WHERE j.userId IS NOT NULL;

    DECLARE @MainUserId INT, @FullName NVARCHAR(150), @Email NVARCHAR(200), @Mobile NVARCHAR(15), @RoleName NVARCHAR(50);
    DECLARE @TenantUserId INT, @WasActive BIT, @RoleId INT, @LastCode INT, @NewCode VARCHAR(20);

    BEGIN TRANSACTION;

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT MainUserId, FullName, Email, MobileNumber, RoleName FROM @src ORDER BY MainUserId;
    OPEN cur; FETCH NEXT FROM cur INTO @MainUserId, @FullName, @Email, @Mobile, @RoleName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @TenantUserId = NULL, @WasActive = NULL, @RoleId = NULL;

        /* ---- locate the local row ---------------------------------------- */
        SELECT @TenantUserId = UserId, @WasActive = IsActive
        FROM dbo.Users WHERE MainUserId = @MainUserId;

        IF @TenantUserId IS NULL AND @Email IS NOT NULL
            SELECT TOP 1 @TenantUserId = UserId, @WasActive = IsActive
            FROM dbo.Users
            WHERE MainUserId IS NULL AND Email = @Email AND UserType <> 'Customer'
            ORDER BY UserId;

        IF @TenantUserId IS NULL AND @Mobile IS NOT NULL
            SELECT TOP 1 @TenantUserId = UserId, @WasActive = IsActive
            FROM dbo.Users
            WHERE MainUserId IS NULL AND MobileNumber = @Mobile AND UserType <> 'Customer'
            ORDER BY UserId;

        /* ---- role (MainDB company role, by name) ------------------------- */
        SELECT @RoleId = RoleId FROM dbo.Roles WHERE RoleName = @RoleName;
        IF @RoleId IS NULL
        BEGIN
            INSERT INTO dbo.Roles (RoleName, Description, IsActive, CompanyId, ProjectId, LocationId)
            VALUES (@RoleName, 'Synced from MainDB', 1, @CompanyId, @ProjectId, @LocationId);
            SET @RoleId = SCOPE_IDENTITY();
        END

        /* ---- MobileNumber is NOT NULL + UNIQUE here ---------------------- */
        IF @Mobile IS NULL
           OR EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @Mobile AND UserId <> ISNULL(@TenantUserId, 0))
            SET @Mobile = 'MU-' + CAST(@MainUserId AS VARCHAR(12));

        IF @TenantUserId IS NULL
        BEGIN
            INSERT INTO dbo.Users (MainUserId, FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive,
                                   CreatedAt, CompanyId, ProjectId, LocationId)
            VALUES (@MainUserId, @FullName, @Email, @Mobile, NULL, @RoleId, 1,
                    @Now, @CompanyId, @ProjectId, @LocationId);
            SET @TenantUserId = SCOPE_IDENTITY();
            SET @WasActive = 1;
        END
        ELSE
        BEGIN
            UPDATE dbo.Users
            SET MainUserId   = @MainUserId,
                FullName     = @FullName,
                Email        = @Email,
                MobileNumber = @Mobile,
                RoleId       = @RoleId,
                IsActive     = 1,
                UpdatedAt    = @Now
            WHERE UserId = @TenantUserId;
        END

        /* ---- technician rows --------------------------------------------- */
        IF @RoleName = 'Technician'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Technicians WHERE UserId = @TenantUserId)
                INSERT INTO dbo.Technicians (UserId, Specialization, IsAvailable, IsActive, CompanyId, ProjectId, LocationId)
                VALUES (@TenantUserId, 'General', 1, 1, @CompanyId, @ProjectId, @LocationId);

            IF NOT EXISTS (SELECT 1 FROM dbo.TechnicianProfiles WHERE UserId = @TenantUserId)
            BEGIN
                SELECT @LastCode = ISNULL(MAX(TRY_CAST(REPLACE(EmployeeCode, 'EMP-', '') AS INT)), 0)
                FROM dbo.TechnicianProfiles WHERE EmployeeCode LIKE 'EMP-%';

                SET @NewCode = 'EMP-' + RIGHT('000' + CAST(@LastCode + 1 AS VARCHAR(10)),
                                              CASE WHEN @LastCode + 1 > 999 THEN LEN(CAST(@LastCode + 1 AS VARCHAR(10))) ELSE 3 END);

                INSERT INTO dbo.TechnicianProfiles (UserId, EmployeeCode, Specialization, ExperienceYears, MaxDailyAssignments,
                                                    JoinDate, IsActive, AvailabilityStatus, CompanyId, ProjectId, LocationId)
                VALUES (@TenantUserId, @NewCode, 'General', 0, 5,
                        CAST(@Now AS DATE), 1, 1, @CompanyId, @ProjectId, @LocationId);
            END

            /* Access was lost earlier and is back: reactivate. A technician an admin
               marked inactive on the Technicians page (user still active) is left alone. */
            IF @WasActive = 0
            BEGIN
                UPDATE dbo.Technicians        SET IsActive = 1, UpdatedAt = @Now       WHERE UserId = @TenantUserId;
                UPDATE dbo.TechnicianProfiles SET IsActive = 1, ModifiedDate = @Now    WHERE UserId = @TenantUserId;
            END
        END
        ELSE
        BEGIN
            /* No longer a technician in MainDB */
            UPDATE dbo.Technicians        SET IsActive = 0, UpdatedAt = @Now    WHERE UserId = @TenantUserId AND IsActive = 1;
            UPDATE dbo.TechnicianProfiles SET IsActive = 0, ModifiedDate = @Now WHERE UserId = @TenantUserId AND IsActive = 1;
        END

        FETCH NEXT FROM cur INTO @MainUserId, @FullName, @Email, @Mobile, @RoleName;
    END
    CLOSE cur; DEALLOCATE cur;

    /* ---- linked users that lost access to this project ------------------- */
    DECLARE @lost TABLE (UserId INT PRIMARY KEY);

    UPDATE u
    SET u.IsActive = 0, u.UpdatedAt = @Now
    OUTPUT inserted.UserId INTO @lost (UserId)
    FROM dbo.Users u
    WHERE u.MainUserId IS NOT NULL
      AND u.CompanyId = @CompanyId
      AND u.ProjectId = @ProjectId
      AND u.IsActive  = 1
      AND NOT EXISTS (SELECT 1 FROM @src s WHERE s.MainUserId = u.MainUserId);

    UPDATE t SET t.IsActive = 0, t.UpdatedAt = @Now
    FROM dbo.Technicians t INNER JOIN @lost l ON l.UserId = t.UserId;

    UPDATE tp SET tp.IsActive = 0, tp.ModifiedDate = @Now
    FROM dbo.TechnicianProfiles tp INNER JOIN @lost l ON l.UserId = tp.UserId;

    COMMIT TRANSACTION;

    /* ---- MainDB -> local id map ------------------------------------------ */
    SELECT
        u.MainUserId,
        u.UserId AS TenantUserId,
        ISNULL((SELECT TOP 1 t.TechnicianId FROM dbo.Technicians t
                WHERE t.UserId = u.UserId AND t.IsActive = 1 ORDER BY t.TechnicianId), 0) AS TechnicianId,
        ISNULL((SELECT TOP 1 tp.ProfileId FROM dbo.TechnicianProfiles tp WHERE tp.UserId = u.UserId), 0) AS ProfileId
    FROM dbo.Users u
    INNER JOIN @src s ON s.MainUserId = u.MainUserId;
END
GO

/* =============================================================================
   4. Technician procs
   ============================================================================= */

/* ---- LIST: technicians of the current company + project that are MainDB users.
        Technicians belong to the project, not to one location, so LocationId is
        accepted (Scoped()) but not filtered on. -------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Technician_GetAll
    @CompanyId     INT,
    @ProjectId     INT,
    @LocationId    INT,
    @SearchTerm    NVARCHAR(100) = NULL,
    @StatusFilter  INT = NULL,
    @PageNumber    INT = 1,
    @PageSize      INT = 10,
    @SortBy        NVARCHAR(50) = 'FullName',
    @SortDir       NVARCHAR(4) = 'ASC'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        t.TechnicianId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        tp.Specialization,
        tp.AvailabilityStatus,
        tp.IsActive,
        tp.ProfileId,
        tp.EmployeeCode,
        tp.ExperienceYears,
        tp.Rating,
        tp.TotalCompletedJobs,
        tp.MaxDailyAssignments,
        tp.JoinDate,
        tp.CurrentLatitude,
        tp.CurrentLongitude,
        tp.LastLocationUpdate,
        0 AS TodayAssignments,
        0 AS ActiveComplaints,
        COUNT(*) OVER() AS TotalCount

    FROM TechnicianProfiles tp
    INNER JOIN Users u ON tp.UserId = u.UserId
    INNER JOIN Technicians t ON t.UserId = u.UserId

    WHERE
        u.MainUserId IS NOT NULL
        AND tp.CompanyId = @CompanyId
        AND tp.ProjectId = @ProjectId
        AND (
            @SearchTerm IS NULL
            OR u.FullName LIKE '%' + @SearchTerm + '%'
            OR tp.EmployeeCode LIKE '%' + @SearchTerm + '%'
            OR tp.Specialization LIKE '%' + @SearchTerm + '%'
        )
        AND (
            @StatusFilter IS NULL

            OR (@StatusFilter = 1 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 1) -- Available
            OR (@StatusFilter = 2 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 2) -- On Job
            OR (@StatusFilter = 3 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 3) -- On Leave
            OR (@StatusFilter = 4 AND tp.IsActive = 0)                               -- Inactive
        )

    ORDER BY
        CASE WHEN @SortBy='FullName' AND @SortDir='ASC' THEN u.FullName END ASC,
        CASE WHEN @SortBy='FullName' AND @SortDir='DESC' THEN u.FullName END DESC,
        u.FullName ASC

    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* ---- CREATE: the login itself is created in MainDB
        (MainDB.dbo.sp_Company_CreateTechnicianUser) and mirrored here by
        sp_Tenant_SyncUsers; this only fills in the technician profile. ---------- */
CREATE OR ALTER PROCEDURE dbo.sp_Technician_Create
    @CompanyId            INT,
    @ProjectId            INT,
    @LocationId           INT,
    @MainUserId           INT,
    @Specialization       NVARCHAR(100),
    @ExperienceYears      INT = 0,
    @CertificationDetails NVARCHAR(500) = NULL,
    @MaxDailyAssignments  INT = 5,
    @JoinDate             DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @ProfileId INT, @Code VARCHAR(20);

    SELECT @UserId = UserId FROM dbo.Users WHERE MainUserId = @MainUserId AND IsActive = 1;

    SELECT @ProfileId = ProfileId, @Code = EmployeeCode
    FROM dbo.TechnicianProfiles WHERE UserId = @UserId;

    IF @UserId IS NULL OR @ProfileId IS NULL
    BEGIN
        SELECT -1 AS ProfileId, CAST(NULL AS VARCHAR(20)) AS EmployeeCode, ISNULL(@UserId, 0) AS UserId,
               'Technician user is not synced to this project yet' AS [Message];
        RETURN;
    END

    UPDATE dbo.TechnicianProfiles
    SET Specialization       = @Specialization,
        ExperienceYears      = ISNULL(@ExperienceYears, 0),
        CertificationDetails = @CertificationDetails,
        MaxDailyAssignments  = ISNULL(@MaxDailyAssignments, 5),
        JoinDate             = ISNULL(@JoinDate, JoinDate),
        IsActive             = 1,
        ModifiedDate         = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ProfileId = @ProfileId;

    UPDATE dbo.Technicians
    SET Specialization = @Specialization,
        IsActive       = 1,
        UpdatedAt      = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE UserId = @UserId;

    SELECT @ProfileId AS ProfileId, @Code AS EmployeeCode,
           @UserId AS UserId, 'Technician created successfully' AS [Message];
END
GO

/* =============================================================================
   5. OPTIONAL — retire legacy technicians that have no MainDB user
   -----------------------------------------------------------------------------
   Legacy rows (Users.MainUserId IS NULL) are hidden from the Technicians page by
   sp_Technician_GetAll, but the assignment/schedule dropdowns list every
   Technicians row with IsActive = 1. After the first sync (log in once and pick
   the project), review what is still unlinked:

       SELECT t.TechnicianId, u.UserId, u.FullName, u.Email, u.MobileNumber
       FROM dbo.Technicians t INNER JOIN dbo.Users u ON u.UserId = t.UserId
       WHERE u.MainUserId IS NULL AND t.IsActive = 1;

   To keep one of them, invite the same email / mobile from MainDB — the sync links
   the existing row and keeps its history. To retire the rest (history is kept,
   nothing is deleted), run:

       UPDATE t  SET t.IsActive = 0
       FROM dbo.Technicians t INNER JOIN dbo.Users u ON u.UserId = t.UserId
       WHERE u.MainUserId IS NULL;

       UPDATE tp SET tp.IsActive = 0
       FROM dbo.TechnicianProfiles tp INNER JOIN dbo.Users u ON u.UserId = tp.UserId
       WHERE u.MainUserId IS NULL;
   ============================================================================= */

PRINT 'ProjectDB user sync applied.';
GO
