/* =============================================================================
   MainDB · Company-level tenancy · ROLLBACK, part 2: connections
   -----------------------------------------------------------------------------
   Run right AFTER 15_Company_Tenancy_Rollback.sql and BEFORE the previous API
   is started.

   After the cut-over a tenant's connection (server, database, user, password,
   extra options, active / ready) lives only on its dbo.Companies row. Script 15
   restores the project tables but does not copy connection changes made since
   the cut-over back to dbo.ProjectConnections, so the previous API would read
   stale connection rows. This script copies them back:

     - for every ACTIVE project whose company was migrated (Companies.TenantKey
       equals Projects.ProjectKey) and whose company row has a server, a database
       and a user:
         * the project's ProjectConnections row is updated when something differs
           (the password is kept when the company has none; IsActive is 1 only for
           a company that is Ready and active);
         * a row is added when the project has none and the company has a password.

   It first lists the rows it will change (never the passwords), then changes
   them in ONE transaction. On an error everything is rolled back and the
   message is shown. It changes nothing in any tenant database.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN: when nothing differs it changes nothing.
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
        OR OBJECT_ID('dbo.ProjectConnections') IS NULL
        OR COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL)
BEGIN
    RAISERROR('Run 15_Company_Tenancy_Rollback.sql first: dbo.Projects, dbo.ProjectConnections and dbo.Companies.TenantKey must exist.', 16, 1);
    SET NOEXEC ON;
END
GO

/* The statements that name Projects, ProjectConnections or the columns added by
   script 13 are dynamic SQL on purpose: this batch is compiled even when the
   guards above stopped execution, and a column that does not exist would be a
   compile error that hides the guard message. Inside the text a tilde stands for
   a single quote. */
DECLARE @Cte NVARCHAR(MAX), @Report NVARCHAR(MAX), @UpdateSql NVARCHAR(MAX), @InsertSql NVARCHAR(MAX),
        @Updated INT = 0, @Inserted INT = 0, @CopyError NVARCHAR(2048);

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
           CAST(CASE WHEN c.ProvisionStatus = ~Ready~ AND c.IsActive = 1 THEN 1 ELSE 0 END AS BIT) AS NewIsActive
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

    COMMIT TRANSACTION;

    PRINT 'Connections copied back to the project tables: '
          + CAST(@Updated AS VARCHAR(10)) + ' updated, ' + CAST(@Inserted AS VARCHAR(10)) + ' added.';
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
