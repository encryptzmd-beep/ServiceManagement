/* =============================================================================
   PersonalDB · 22 · Job Portal: switch "Employers can find me" on for every profile
   -----------------------------------------------------------------------------
   Run in the Personal DB, after 21_Jobs_Candidate_Search.sql. A ONE-TIME change of
   data: run it once. Running it again changes only profiles that were switched off
   (or completed) since.

   Every profile with a name and a headline becomes findable in the candidate search of
   Job Consultancy (jobs.Profiles.IsVisible = 1). A profile without a name or a headline
   stays private: the search never shows those (as sp_Profile_SetVisible refuses them).
   Each person can switch it off again on their Job Portal profile at any time.

   Every profile it switches on is written down in jobs.VisibilityChanges, so that the
   change can be taken back: see UNDO at the end.

   Tell the people about it (an e-mail or a notice): until now their profile was private
   unless they switched it on.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Profiles') IS NULL
BEGIN
    RAISERROR('Select the Personal DB before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* which profiles this script switched on, and when */
IF OBJECT_ID('jobs.VisibilityChanges') IS NULL
CREATE TABLE jobs.VisibilityChanges
(
    UserId    INT          NOT NULL,
    ChangedAt DATETIME     NOT NULL CONSTRAINT DF_jobs_VisibilityChanges_ChangedAt DEFAULT (GETDATE()),
    ByScript  NVARCHAR(60) NOT NULL,
    CONSTRAINT PK_jobs_VisibilityChanges PRIMARY KEY (UserId, ChangedAt)
);
GO

/* before: how many there are, how many are findable, how many cannot be */
SELECT COUNT(*)                                                                      AS Profiles,
       SUM(CASE WHEN IsVisible = 1 THEN 1 ELSE 0 END)                                AS FindableBefore,
       SUM(CASE WHEN IsVisible = 0 AND FullName <> '' AND Headline <> '' THEN 1 ELSE 0 END) AS WillBeSwitchedOn,
       SUM(CASE WHEN FullName = '' OR Headline = '' THEN 1 ELSE 0 END)               AS StayPrivate_NoNameOrHeadline
FROM jobs.Profiles;
GO

BEGIN TRANSACTION;

    /* UpdatedAt stays: it is the person's last change, and orders the candidates */
    UPDATE jobs.Profiles
    SET IsVisible = 1
    OUTPUT inserted.UserId, GETDATE(), N'22_Jobs_Make_Profiles_Findable'
      INTO jobs.VisibilityChanges (UserId, ChangedAt, ByScript)
    WHERE IsVisible = 0 AND FullName <> '' AND Headline <> '';

    PRINT CONCAT('Profiles switched on: ', @@ROWCOUNT);

COMMIT TRANSACTION;
GO

/* after */
SELECT COUNT(*)                                                 AS Profiles,
       SUM(CASE WHEN IsVisible = 1 THEN 1 ELSE 0 END)           AS FindableNow,
       SUM(CASE WHEN IsVisible = 1 AND FullName <> '' AND Headline <> '' THEN 1 ELSE 0 END) AS ShownInSearch
FROM jobs.Profiles;
GO

/* =============================================================================
   UNDO (run by hand, only if the change must be taken back): switches off again every
   profile this script switched on that is still on (a person who switched it off and on
   again since is switched off too).

   UPDATE p SET p.IsVisible = 0
   FROM jobs.Profiles p
   INNER JOIN jobs.VisibilityChanges v ON v.UserId = p.UserId AND v.ByScript = N'22_Jobs_Make_Profiles_Findable'
   WHERE p.IsVisible = 1;
   ============================================================================= */

SET NOEXEC OFF;
GO
