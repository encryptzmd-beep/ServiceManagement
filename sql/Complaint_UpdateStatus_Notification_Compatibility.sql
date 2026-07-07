USE [FelixServiceDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

ALTER PROCEDURE [dbo].[sp_Complaint_UpdateStatus]
    @ComplaintId INT,
    @StatusId INT,
    @Remarks NVARCHAR(500) = NULL,
    @ActionBy INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OldStatusId INT,
            @NewStatusName NVARCHAR(50);

    SELECT @OldStatusId = StatusId
    FROM dbo.Complaints
    WHERE ComplaintId = @ComplaintId;

    SELECT @NewStatusName = StatusName
    FROM dbo.ComplaintStatuses
    WHERE StatusId = @StatusId;

    UPDATE dbo.Complaints
    SET StatusId = @StatusId,
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        ClosedAt = CASE
            WHEN @NewStatusName IN ('Closed', 'WorkCompleted')
                THEN DATEADD(MINUTE, 330, GETUTCDATE())
            ELSE ClosedAt
        END
    WHERE ComplaintId = @ComplaintId;

    INSERT INTO dbo.ComplaintTimeline
        (ComplaintId, StatusId, Remarks, ActionBy)
    VALUES
        (@ComplaintId, @StatusId, @Remarks, @ActionBy);

    SELECT 1 AS Success,
           'Status updated to ' + @NewStatusName AS Message,
           @OldStatusId AS OldStatusId,
           @StatusId AS NewStatusId;
END;
GO
