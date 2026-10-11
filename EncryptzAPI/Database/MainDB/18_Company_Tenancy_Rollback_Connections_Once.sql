/* =============================================================================
   MainDB · Company-level tenancy · ROLLBACK, part 2: connections (run once)
   -----------------------------------------------------------------------------
   REPLACES 17_Company_Tenancy_Rollback_Connections.sql. Do not run script 17.

   Run right AFTER 15_Company_Tenancy_Rollback.sql has printed
   "Project tables restored." and BEFORE the previous API is started.

   After the cut-over a tenant's connection (server, database, user, password,
   extra options, ready or not) lives only on its dbo.Companies row. Script 15
   restores the project tables but does not copy connection changes made since
   the cut-over back to dbo.ProjectConnections. This script copies them back:

     - for every ACTIVE project whose company was migrated (Companies.TenantKey
       equals Projects.ProjectKey) and whose company row has a server, a database
       and a user:
         * the project's ProjectConnections row is updated when something differs
           (the password is kept when the company has none; IsActive is 1 only for
           a company whose database is Ready);
         * a row is added when the project has none and the company has a password.

   IT COPIES ONCE PER CUT-OVER. Once the previous API is running again,
   dbo.ProjectConnections is the live data and the company rows are stale. The
   script records the cut-over it copied for in dbo.TenancyRollbackLog and
   refuses to copy for the same cut-over again. (A cut-over is identified by the
   date script 14 last created dbo.sp_Tenant_GetConnection.)

   IT ALSO REFUSES when any dbo.ProjectConnections row was changed after the
   rollback (later than the date script 15 created dbo.sp_Project_GetConnection).
   That means the previous API has saved a connection since the rollback: the
   project tables are the live data and copying the company values would point a
   tenant back at an old server, database or password. It lists those rows
   (never the passwords) and changes nothing. If script 15 printed "No project
   tables were restored in this run", or the previous API has been started, do
   not run this script. Correct connections in Platform Admin instead.

   It first lists the rows it will change (never the passwords), then changes
   them in ONE transaction. On an error everything is rolled back and the
   message is shown. It changes nothing in any tenant database.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. Running it again changes nothing: it stops with a message.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* OBJECT_ID and COL_LENGTH are functions: this batch compiles whatever exists. */
IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   OBJECT_ID('dbo.Projects') IS NULL
        OR OBJECT_ID('dbo.ProjectConnections') IS NULL)
BEGIN
    RAISERROR('The project tables are not there. Run 15_Company_Tenancy_Rollback.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
        OR OBJECT_ID('dbo.sp_Tenant_GetConnection') IS NULL)
BEGIN
    RAISERROR('Script 14 (the cut-over) was never run on this database: there is nothing to copy back.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   The record of what was copied back, one row per cut-over
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.TenancyRollbackLog') IS NULL
CREATE TABLE dbo.TenancyRollbackLog
(
    CutoverStamp DATETIME NOT NULL CONSTRAINT PK_TenancyRollbackLog PRIMARY KEY,
    CopiedAt     DATETIME NOT NULL CONSTRAINT DF_TRL_CopiedAt DEFAULT (GETDATE()),
    UpdatedRows  INT      NOT NULL,
    InsertedRows INT      NOT NULL
);
GO

/* Already copied for this cut-over: stop. ProjectConnections is the live data now. */
DECLARE @Done DATETIME, @DoneText VARCHAR(30);

SELECT @Done = l.CopiedAt
FROM dbo.TenancyRollbackLog l
WHERE l.CutoverStamp = (SELECT o.modify_date FROM sys.objects o
                        WHERE o.object_id = OBJECT_ID('dbo.sp_Tenant_GetConnection'));

IF @Done IS NOT NULL
BEGIN
    SET @DoneText = CONVERT(VARCHAR(30), @Done, 120);
    RAISERROR('The connections were already copied back for this cut-over on %s. Nothing was changed. The project tables are the live data now.', 16, 1, @DoneText);
    SET NOEXEC ON;
END
GO

/* Connections changed after the rollback: stop. Script 15 creates
   dbo.sp_Project_GetConnection again when it restores the project tables (script 14
   drops it), so its create date is the moment of the rollback. The previous API sets
   ProjectConnections.UpdatedAt on every save. A newer row means ProjectConnections is
   the live data and the company rows are stale. The statements that name
   dbo.ProjectConnections and UpdatedAt are dynamic SQL, see the note below. */
DECLARE @RolledBackAt DATETIME, @Changed INT = 0;

SELECT @RolledBackAt = o.create_date
FROM sys.objects o
WHERE o.object_id = OBJECT_ID('dbo.sp_Project_GetConnection');

IF @RolledBackAt IS NULL
BEGIN
    RAISERROR('Run 15_Company_Tenancy_Rollback.sql first: the previous procedures are not restored.', 16, 1);
    SET NOEXEC ON;
END
ELSE
BEGIN
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM dbo.ProjectConnections WHERE UpdatedAt > @since',
         N'@n INT OUTPUT, @since DATETIME', @n = @Changed OUTPUT, @since = @RolledBackAt;

    IF @Changed > 0
    BEGIN
        EXEC sp_executesql N'SELECT ''Connection changed after the rollback'' AS Info, pc.ProjectKey, pc.DatabaseName, pc.IsActive, pc.UpdatedAt
                             FROM dbo.ProjectConnections pc WHERE pc.UpdatedAt > @since ORDER BY pc.ProjectKey',
             N'@since DATETIME', @since = @RolledBackAt;
        RAISERROR('%d connection row(s) were changed after the rollback. The project tables are the live data now: nothing was copied. Correct connections in Platform Admin instead.', 16, 1, @Changed);
        SET NOEXEC ON;
    END
END
GO

/* The statements that name Projects, ProjectConnections or the columns added by
   script 13 are dynamic SQL on purpose: this batch is compiled even when a guard
   above stopped execution, and a column that does not exist would be a compile
   error that hides the guard message. Inside the text a tilde stands for a
   single quote. */
DECLARE @Cte NVARCHAR(MAX), @Report NVARCHAR(MAX), @UpdateSql NVARCHAR(MAX), @InsertSql NVARCHAR(MAX),
        @Updated INT = 0, @Inserted INT = 0, @CopyError NVARCHAR(2048), @Stamp DATETIME;

SELECT @Stamp = o.modify_date
FROM sys.objects o
WHERE o.object_id = OBJECT_ID('dbo.sp_Tenant_GetConnection');

SET @Cte = N'
WITH Cand AS (
    SELECT c.CompanyId, c.CompanyName, p.ProjectId, p.ProjectKey,
           pc.ProjectConnectionId,
           pc.ServerName AS OldServer, pc.DatabaseName AS OldDatabase, pc.DbUser AS OldUser,
           pc.DbPasswordEnc AS OldPassword, pc.ExtraOptions AS OldExtra, pc.IsActive AS OldIsActive,
           c.ServerName AS NewServer, c.DatabaseName AS NewDatabase, c.DbUser AS NewUser,
           c.DbPasswordEnc AS CompanyPassword,
           /* keep the stored password when the company has none (or only the placeholder) */
           CASE WHEN ISNULL(c.DbPasswordEnc, ~~) IN (~~, ~<ENCRYPTED_PW>~) THEN pc.DbPasswordEnc
                ELSE c.DbPasswordEnc END AS NewPassword,
           c.ExtraOptions AS NewExtra,
           /* the database status only: whether the COMPANY is active is not a connection property */
           CAST(CASE WHEN c.ProvisionStatus = ~Ready~ THEN 1 ELSE 0 END AS BIT) AS NewIsActive
    FROM dbo.Projects p
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId AND c.TenantKey = p.ProjectKey
    LEFT  JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId
    WHERE p.IsActive = 1
      AND ISNULL(LTRIM(RTRIM(c.ServerName)), ~~)   <> ~~
      AND ISNULL(LTRIM(RTRIM(c.DatabaseName)), ~~) <> ~~
      AND ISNULL(LTRIM(RTRIM(c.DbUser)), ~~)       <> ~~
),
Chg AS (
    SELECT k.*, CASE WHEN k.ProjectConnectionId IS NULL THEN ~Insert~ ELSE ~Update~ END AS Action
    FROM Cand k
    WHERE (    k.ProjectConnectionId IS NULL
           AND ISNULL(k.CompanyPassword, ~~) NOT IN (~~, ~<ENCRYPTED_PW>~)
           AND NOT EXISTS (SELECT 1 FROM dbo.ProjectConnections x WHERE x.ProjectKey = k.ProjectKey))
       OR (    k.ProjectConnectionId IS NOT NULL
           AND (   k.OldServer   <> k.NewServer
                OR k.OldDatabase <> k.NewDatabase
                OR k.OldUser     <> k.NewUser
                OR k.OldPassword <> k.NewPassword
                OR ISNULL(k.OldExtra, ~~) <> ISNULL(k.NewExtra, ~~)
                OR k.OldIsActive <> k.NewIsActive))
)
';

SET @Report = REPLACE(@Cte + N'
SELECT k.Action, k.CompanyId, k.CompanyName, k.ProjectKey,
       k.OldDatabase AS OldDatabaseName, k.NewDatabase AS NewDatabaseName,
       k.OldIsActive, k.NewIsActive,
       CASE WHEN k.Action = ~Insert~ THEN ~new row~ ELSE STUFF(  CASE WHEN k.OldServer   <> k.NewServer   THEN ~, server~   ELSE ~~ END
             + CASE WHEN k.OldDatabase <> k.NewDatabase THEN ~, database~ ELSE ~~ END
             + CASE WHEN k.OldUser     <> k.NewUser     THEN ~, user~     ELSE ~~ END
             + CASE WHEN k.OldPassword <> k.NewPassword THEN ~, password~ ELSE ~~ END
             + CASE WHEN ISNULL(k.OldExtra, ~~) <> ISNULL(k.NewExtra, ~~) THEN ~, options~ ELSE ~~ END
             + CASE WHEN k.OldIsActive <> k.NewIsActive THEN ~, active~   ELSE ~~ END, 1, 2, ~~) END AS Differs
FROM Chg k
ORDER BY k.CompanyId;', N'~', N'''');

SET @UpdateSql = REPLACE(@Cte + N'
UPDATE pc
SET pc.ServerName    = k.NewServer,
    pc.DatabaseName  = k.NewDatabase,
    pc.DbUser        = k.NewUser,
    pc.DbPasswordEnc = k.NewPassword,
    pc.ExtraOptions  = k.NewExtra,
    pc.IsActive      = k.NewIsActive,
    pc.UpdatedAt     = GETDATE()
FROM dbo.ProjectConnections pc
INNER JOIN Chg k ON k.ProjectConnectionId = pc.ProjectConnectionId AND k.Action = ~Update~;
SET @n = @@ROWCOUNT;', N'~', N'''');

SET @InsertSql = REPLACE(@Cte + N'
INSERT INTO dbo.ProjectConnections
       (ProjectId, ProjectKey, ServerName, DatabaseName, DbUser, DbPasswordEnc, ExtraOptions, IsActive, UpdatedAt)
SELECT k.ProjectId, k.ProjectKey, k.NewServer, k.NewDatabase, k.NewUser, k.NewPassword, k.NewExtra, k.NewIsActive, GETDATE()
FROM Chg k
WHERE k.Action = ~Insert~;
SET @n = @@ROWCOUNT;', N'~', N'''');

BEGIN TRY
    /* what will change (no passwords) */
    EXEC sp_executesql @Report;

    BEGIN TRANSACTION;

    EXEC sp_executesql @UpdateSql, N'@n INT OUTPUT', @n = @Updated OUTPUT;
    EXEC sp_executesql @InsertSql, N'@n INT OUTPUT', @n = @Inserted OUTPUT;

    /* remember this cut-over: a second run must not overwrite live connections */
    INSERT INTO dbo.TenancyRollbackLog (CutoverStamp, UpdatedRows, InsertedRows)
    VALUES (@Stamp, @Updated, @Inserted);

    COMMIT TRANSACTION;

    PRINT 'Connections copied back to the project tables: '
          + CAST(@Updated AS VARCHAR(10)) + ' updated, ' + CAST(@Inserted AS VARCHAR(10)) + ' added.';
    PRINT 'This script will not copy again for this cut-over.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    SET @CopyError = ERROR_MESSAGE();
    RAISERROR('Copying the connections back failed and was rolled back. %s', 16, 1, @CopyError);
    SET NOEXEC ON;
END CATCH
GO

SET NOEXEC OFF;
GO
