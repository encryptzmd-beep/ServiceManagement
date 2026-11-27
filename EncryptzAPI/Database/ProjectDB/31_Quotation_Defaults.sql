/* =============================================================================
   ProjectDB (company database) · Quotation defaults
   -----------------------------------------------------------------------------
   Two company settings on Settings > Print Settings > Quotation defaults, set by
   the Company Admin and loaded into each NEW quotation (the user can still change
   them on that quotation before saving):

     Print.QuotationValidity   none / 7d / 14d / 15d / 30d / 1m / 2m / 3m
                               Valid Until = quotation date + this period
     Print.QuotationPrices     exclusive / inclusive
                               whether the rates are entered with GST included

   Saved quotations keep what they were saved with. Existing values are never
   changed. Runs AFTER 30_Sales_Order_Workflow.sql. Run in EACH company database
   (select it in SSMS first; no USE on purpose). New company databases created by
   the API get it automatically. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);
IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.SystemSettings') IS NULL OR COL_LENGTH('crm.Quotations', 'PricesIncludeGst') IS NULL
    SET @problem = 'Run 29_Document_Print.sql first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

MERGE dbo.SystemSettings AS t
USING (VALUES
    ('Print.QuotationValidity', N'none', 'Print', 'select:none,7d,14d,15d,30d,1m,2m,3m',
     N'Validity of a new quotation: its Valid Until date is the quotation date plus this period', 1),
    ('Print.QuotationPrices', N'exclusive', 'Print', 'select:exclusive,inclusive',
     N'Whether a new quotation''s rates include GST (inclusive) or have GST added (exclusive)', 1)
) AS s (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable)
    ON t.SettingKey = s.SettingKey
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable, ModifiedDate)
    VALUES (s.SettingKey, s.SettingValue, s.SettingGroup, s.DataType, s.Description, s.IsEditable, DATEADD(MINUTE, 330, GETUTCDATE()));
GO

PRINT 'Quotation defaults are in place.';
GO
SET NOEXEC OFF;
GO
