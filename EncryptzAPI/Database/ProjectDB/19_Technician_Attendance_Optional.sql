/* =============================================================================
   ProjectDB (company database) · Attendance check-in required per technician
   -----------------------------------------------------------------------------
   Adds the column dbo.Technicians.AttendanceRequired (BIT, default 1 = required,
   so every existing technician keeps checking in as today) and two procedures:

     dbo.sp_Technician_AttendanceRequired_List   UserId, TechnicianId, AttendanceRequired
     dbo.sp_Technician_AttendanceRequired_Set    @UserId, @Required -> Success, Message

   A technician with AttendanceRequired = 0 may start / complete jobs, request
   spares and record payments without checking in (Technicians > detail).
   The technician create / update / list procedures are not changed.
   Runs AFTER 18_Service_Workflow_Settings.sql. Run in EACH company database
   (select it in SSMS first; no USE on purpose). New company databases created by
   the API get it automatically after 18.
   ADDITIVE and SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('dbo.Technicians') IS NULL
    SET @problem = 'dbo.Technicians is missing in [' + DB_NAME() + ']. This is not a Service company database.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.Technicians', 'AttendanceRequired') IS NULL
    ALTER TABLE dbo.Technicians
        ADD AttendanceRequired BIT NOT NULL
            CONSTRAINT DF_Technicians_AttendanceRequired DEFAULT (1);
GO

CREATE OR ALTER PROCEDURE dbo.sp_Technician_AttendanceRequired_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.UserId, t.TechnicianId, t.AttendanceRequired
    FROM dbo.Technicians t
    ORDER BY t.TechnicianId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Technician_AttendanceRequired_Set
    @UserId INT,
    @Required BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @UserId IS NULL OR @Required IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.Technicians WHERE UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Technician not found' AS Message;
        RETURN;
    END

    UPDATE dbo.Technicians SET AttendanceRequired = @Required WHERE UserId = @UserId;

    SELECT CAST(1 AS BIT) AS Success,
           CASE WHEN @Required = 1 THEN 'Attendance check-in is now required' ELSE 'Attendance check-in is no longer required' END AS Message;
END
GO

PRINT 'Technician attendance setting applied.';
GO
SET NOEXEC OFF;
GO
