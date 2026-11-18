/* =============================================================================
   MainDB · 32 · CRM: release the application
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 21_Applications.sql. SAFE TO RE-RUN: it changes one row at most.

   Script 21 seeded the CRM app as not released. Run this when the CRM screens and
   14_CRM.sql (company databases) are in place: the app then shows in Platform Admin
   > Companies for enabling, under the family Sales.

     dbo.Modules   CRM: IsReleased 0 -> 1, Family 'Commercial' -> 'Sales'

   PHASE 1 NOTE: every CRM user must ALSO be granted the Service module. The
   tenant user sync mirrors Service users only, so a user who has CRM without
   Service is refused when opening CRM on a branch (set-scope) with
   "Your user is not set up for this company".
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.Modules', 'IsReleased') IS NULL OR COL_LENGTH('dbo.Modules', 'Family') IS NULL
BEGIN
    RAISERROR('Run 21_Applications.sql in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

UPDATE dbo.Modules SET IsReleased = 1, Family = N'Sales' WHERE ModuleKey = N'CRM';

PRINT 'CRM: released, family Sales.';
GO
SET NOEXEC OFF;
GO
