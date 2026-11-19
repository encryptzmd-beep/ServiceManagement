/* =============================================================================
   ProjectDB (company database) · Service Workflow settings: completion photos
   -----------------------------------------------------------------------------
   Adds two rows to dbo.SystemSettings in the group ServiceWorkflow (Settings >
   Service Workflow tab):

     Service.MinCompletionPhotos  1   photos a technician must upload before
                                      completing a job (0 = none)
     Service.PhotoCategories      Before,After,Part,Signature,Other
                                      photo types offered when uploading

   The defaults are what every company has today (at least one photo, these five
   types), so nothing changes until a company edits them in Settings.
   Rows are only added, never overwritten: an edited value survives a re-run.
   Runs AFTER 17_CRM_Product_Fixes.sql. Run in EACH company database (select it
   in SSMS first; no USE on purpose). New company databases created by the API
   get it automatically after 17.
   ADDITIVE and SAFE TO RE-RUN. Changes no table, procedure or existing row.
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
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.SchemaInfo') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the Personal DB. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.SystemSettings') IS NULL
    SET @problem = 'dbo.SystemSettings is missing in [' + DB_NAME() + ']. This is not a Service company database.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

MERGE dbo.SystemSettings AS t
USING (VALUES
    ('Service.MinCompletionPhotos', N'1', 'ServiceWorkflow', 'int',    N'Photos a technician must upload before completing a job (0 = none)', 1),
    ('Service.PhotoCategories', N'Before,After,Part,Signature,Other', 'ServiceWorkflow', 'string', N'Photo types offered when uploading, separated by commas', 1)
) AS s (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable)
    ON t.SettingKey = s.SettingKey
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable, ModifiedDate)
    VALUES (s.SettingKey, s.SettingValue, s.SettingGroup, s.DataType, s.Description, s.IsEditable, DATEADD(MINUTE, 330, GETUTCDATE()));
GO

PRINT 'Service workflow settings applied.';
GO
