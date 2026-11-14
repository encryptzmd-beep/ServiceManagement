/* =============================================================================
   MainDB · 28 · Wallet: the route of the app starts with /
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 27_Wallet.sql. SAFE TO RE-RUN: it changes one row at most.

   Script 27 seeded the WALLET app with RoutePath 'apps/wallet'. The launcher opens only a
   route that starts with / (as Platform Admin > Applications requires), so Wallet showed
   greyed out and could not be opened. A route an administrator has already changed is kept.

     dbo.Modules   WALLET: RoutePath 'apps/wallet' -> '/apps/wallet'
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

IF OBJECT_ID('dbo.WalletLedger') IS NULL OR COL_LENGTH('dbo.Modules', 'RoutePath') IS NULL
BEGIN
    RAISERROR('Run 27_Wallet.sql in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

UPDATE dbo.Modules
SET RoutePath = N'/apps/wallet'
WHERE ModuleKey = N'WALLET' AND RoutePath = N'apps/wallet';

PRINT 'Wallet: the app route is /apps/wallet.';
GO
SET NOEXEC OFF;
GO
