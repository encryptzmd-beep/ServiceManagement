/* =============================================================================
   PersonalDB · 17 · Job Portal: the public job pages and their sitemap
   -----------------------------------------------------------------------------
   Run AFTER 16_Jobs_Verified_Badges.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no row.

   Anybody can search the open jobs and read one (www.../jobs), without an account.
   Those pages use jobs.sp_Posting_Search and jobs.sp_Posting_Get with @UserId = 0:
   no user has id 0, so nothing saved or applied is shown, and both answer open jobs
   only. Applying still needs a login and a profile.

     jobs.sp_Public_Posting_Sitemap  every job people can find now, for the sitemap
                                     search engines read: the id, the title and the
                                     city (for the address of the page) and the last
                                     change. Never a company id or a description.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR COL_LENGTH('jobs.Postings', 'VerifiedAt') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 16_Jobs_Verified_Badges.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Open jobs only (as the search shows them), the newest change first. A sitemap holds
   at most 50,000 addresses. */
CREATE OR ALTER PROCEDURE jobs.sp_Public_Posting_Sitemap
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT TOP (50000) p.PostingId, p.Title, p.City, p.UpdatedAt
    FROM jobs.Postings p
    WHERE p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)
    ORDER BY p.UpdatedAt DESC, p.PostingId DESC;
END
GO

PRINT 'Job Portal: the sitemap of the public job pages is in place.';
GO
SET NOEXEC OFF;
GO
