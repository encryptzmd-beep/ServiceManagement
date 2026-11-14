/* =============================================================================
   MainDB · Individual ID: one lifelong ID per user
   -----------------------------------------------------------------------------
   Run AFTER 21_Applications.sql. Run it AGAIN every time script 04 or script 09
   is run again: they re-create sp_GetUserById and sp_User_GetProfile without
   the ID.

   Every user gets an Individual ID: 14 characters, 'EZ' + 11 random symbols +
   1 check character, shown as EZ-7K4M-2P9Q-XD3T. It is given once and never
   changed. It tells nothing about the person and the next one cannot be guessed.
   The UserId stays the internal key of every table.

     alphabet   23456789ABCDEFGHJKMNPQRSTUVWXYZ   (31 symbols: no 0 1 O I L)
     check      sum of position (1..11) x value, modulo 31
                (the same rule as EncryptzBL.Common.IndividualId: change both
                 together, and never once an ID was given out)

   ADDS (nothing is removed, no other column is changed):
     dbo.Users.IndividualId         CHAR(14) NOT NULL, unique. A new row starts
                                    with a random placeholder ('TMP...') that the
                                    trigger replaces in the same statement, so
                                    every way of adding a user gets an ID.
     dbo.fn_IndividualId_Check      the check character of 11 symbols
     dbo.sp_User_AssignIndividualId gives one user an ID when it has none
     dbo.TR_Users_IndividualId      on INSERT: gives the ID; on UPDATE: refuses
                                    to change an ID that was given
     every existing user gets an ID (rows that have one keep it)
   RE-CREATES with one more column at the end, IndividualId:
     sp_GetUserById (script 04), sp_User_GetProfile (script 09)

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. The column. Not NULL from the start: each row, also each existing one, gets
      its own placeholder, so the unique constraint never meets two equal values.
      (A placeholder starts with 'TMP'; an ID starts with 'EZ'.)
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Users', 'IndividualId') IS NULL
    ALTER TABLE dbo.Users ADD IndividualId CHAR(14) NOT NULL
        CONSTRAINT DF_Users_IndividualId DEFAULT (LEFT('TMP' + REPLACE(CONVERT(CHAR(36), NEWID()), '-', ''), 14));
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Users_IndividualId' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users ADD CONSTRAINT UQ_Users_IndividualId UNIQUE (IndividualId);
GO

/* -----------------------------------------------------------------------------
   2. The check character of 11 symbols (NULL when a symbol is not in the alphabet)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION dbo.fn_IndividualId_Check (@Body VARCHAR(11))
RETURNS CHAR(1)
AS
BEGIN
    DECLARE @Alphabet CHAR(31) = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    DECLARE @i INT = 1, @Sum INT = 0, @Value INT;

    IF @Body IS NULL OR LEN(@Body) <> 11 RETURN NULL;

    WHILE @i <= 11
    BEGIN
        -- binary: 'a' is not 'A', whatever the collation of the database
        SET @Value = CHARINDEX(SUBSTRING(@Body, @i, 1) COLLATE Latin1_General_BIN, @Alphabet COLLATE Latin1_General_BIN) - 1;
        IF @Value < 0 RETURN NULL;

        SET @Sum = @Sum + @i * @Value;
        SET @i = @i + 1;
    END

    RETURN SUBSTRING(@Alphabet, (@Sum % 31) + 1, 1);
END
GO

/* -----------------------------------------------------------------------------
   3. Gives one user an ID when it has none. Does nothing for a user that has one.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_AssignIndividualId
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Alphabet CHAR(31) = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    DECLARE @Prefix CHAR(2) = 'EZ';
    DECLARE @Bytes VARBINARY(11), @Body VARCHAR(11), @Id CHAR(14), @i INT, @Tries INT = 0;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId AND IndividualId LIKE 'TMP%')
        RETURN;

    WHILE @Tries < 20
    BEGIN
        SET @Tries = @Tries + 1;
        SET @Bytes = CRYPT_GEN_RANDOM(11);
        SET @Body = '';
        SET @i = 1;

        WHILE @i <= 11
        BEGIN
            SET @Body = @Body + SUBSTRING(@Alphabet, (CAST(SUBSTRING(@Bytes, @i, 1) AS INT) % 31) + 1, 1);
            SET @i = @i + 1;
        END

        SET @Id = @Prefix + @Body + dbo.fn_IndividualId_Check(@Body);

        -- the unique constraint is the real guard; this only avoids its error in the usual case
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE IndividualId = @Id)
        BEGIN
            UPDATE dbo.Users SET IndividualId = @Id
            WHERE UserId = @UserId AND IndividualId LIKE 'TMP%';
            RETURN;
        END
    END

    RAISERROR('An Individual ID could not be created. Try again.', 16, 1);
END
GO

/* -----------------------------------------------------------------------------
   4. Every insert gets an ID; an ID that was given is never changed.
      The trigger adds no result set and no identity value: procedures that
      insert a user and read SCOPE_IDENTITY() or @@ROWCOUNT work as before.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER TRIGGER dbo.TR_Users_IndividualId
ON dbo.Users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- the update this trigger makes itself (through sp_User_AssignIndividualId)
    IF TRIGGER_NESTLEVEL(@@PROCID) > 1 RETURN;

    IF UPDATE(IndividualId)
       AND EXISTS (SELECT 1
                   FROM deleted d
                   INNER JOIN inserted i ON i.UserId = d.UserId
                   WHERE d.IndividualId NOT LIKE 'TMP%'
                     AND i.IndividualId <> d.IndividualId)
    BEGIN
        RAISERROR('The Individual ID of a user cannot be changed.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    DECLARE @UserId INT;
    DECLARE NewUsers CURSOR LOCAL FAST_FORWARD FOR
        SELECT UserId FROM inserted WHERE IndividualId LIKE 'TMP%';

    OPEN NewUsers;
    FETCH NEXT FROM NewUsers INTO @UserId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_User_AssignIndividualId @UserId = @UserId;
        FETCH NEXT FROM NewUsers INTO @UserId;
    END
    CLOSE NewUsers;
    DEALLOCATE NewUsers;
END
GO

/* -----------------------------------------------------------------------------
   5. Existing users (rows that have an ID keep it)
   ----------------------------------------------------------------------------- */
DECLARE @UserId INT;
DECLARE Waiting CURSOR LOCAL FAST_FORWARD FOR
    SELECT UserId FROM dbo.Users WHERE IndividualId LIKE 'TMP%' ORDER BY UserId;

OPEN Waiting;
FETCH NEXT FROM Waiting INTO @UserId;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC dbo.sp_User_AssignIndividualId @UserId = @UserId;
    FETCH NEXT FROM Waiting INTO @UserId;
END
CLOSE Waiting;
DEALLOCATE Waiting;
GO

/* =============================================================================
   6. Re-created from script 04, with the ID at the end
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, ISNULL(r.RoleName, '') AS RoleName,
           CASE WHEN u.IndividualId LIKE 'EZ%' THEN u.IndividualId ELSE '' END AS IndividualId
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;
END
GO

/* =============================================================================
   7. Re-created from script 09, with the ID at the end
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
        cu.AssignedAt                AS MemberSince,
        CASE WHEN u.IndividualId LIKE 'EZ%' THEN u.IndividualId ELSE '' END AS IndividualId
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r         ON r.RoleId = u.RoleId
    LEFT JOIN dbo.CompanyUsers cu ON cu.UserId = u.UserId AND cu.CompanyId = @CompanyId AND cu.IsActive = 1
    LEFT JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId
    WHERE u.UserId = @UserId AND u.IsActive = 1;
END
GO

SELECT COUNT(*) AS Users,
       SUM(CASE WHEN IndividualId LIKE 'EZ%' THEN 1 ELSE 0 END) AS WithIndividualId
FROM dbo.Users;

PRINT 'Every user has an Individual ID. Run this script again after script 04 or script 09.';
GO
SET NOEXEC OFF;
GO
