/* =============================================================================
   PersonalDB · 01 · Marks a database as the Personal DB
   -----------------------------------------------------------------------------
   The Personal DB holds the data of personal applications (Job Portal, Expense
   Manager, ...). Rows are keyed by the UserId of the SaaS main database. Each
   application gets its own schema in a later script of this folder.

   Create an EMPTY database by hand, select it in SSMS, then run this script.
   There is no USE statement on purpose. It refuses to run in a system database,
   in the SaaS main database and in a company database. SAFE TO RE-RUN.

   The API reads it through ConnectionStrings:PersonalConnection. A company
   database never connects to it.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
BEGIN
    RAISERROR('Select the Personal DB before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
BEGIN
    RAISERROR('This is the SaaS main database. The Personal DB is a database of its own.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Locations') IS NOT NULL
BEGIN
    RAISERROR('This is a company database. The Personal DB is a database of its own.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.SchemaInfo') IS NULL
CREATE TABLE dbo.SchemaInfo
(
    SchemaKey NVARCHAR(50) NOT NULL CONSTRAINT PK_SchemaInfo PRIMARY KEY,
    AppliedAt DATETIME NOT NULL CONSTRAINT DF_SchemaInfo_AppliedAt DEFAULT (GETDATE())
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
    INSERT INTO dbo.SchemaInfo (SchemaKey) VALUES ('PERSONAL_DB');
GO

PRINT 'This database is marked as the Personal DB.';
GO
SET NOEXEC OFF;
GO
