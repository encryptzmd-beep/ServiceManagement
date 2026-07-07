/* Run once against the Service Management database. */

IF NOT EXISTS (SELECT 1 FROM dbo.ComplaintStatuses WHERE StatusId = 10)
BEGIN
    INSERT dbo.ComplaintStatuses (StatusId, StatusName, StatusColor)
    VALUES (10, 'Cancelled', '#DC2626');
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetChartData
    @Days INT = 30,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @ToDate = COALESCE(@ToDate, CONVERT(date, GETDATE()));
    SET @FromDate = COALESCE(@FromDate, DATEADD(day, -(@Days - 1), @ToDate));

    ;WITH Dates AS
    (
        SELECT @FromDate AS [Date]
        UNION ALL
        SELECT DATEADD(day, 1, [Date]) FROM Dates WHERE [Date] < @ToDate
    )
    SELECT d.[Date], COUNT(c.ComplaintId) AS [Count]
    FROM Dates d
    LEFT JOIN dbo.Complaints c
      ON c.CreatedAt >= d.[Date] AND c.CreatedAt < DATEADD(day, 1, d.[Date])
    GROUP BY d.[Date]
    ORDER BY d.[Date]
    OPTION (MAXRECURSION 3660);

    SELECT s.StatusName AS [Name], COUNT(c.ComplaintId) AS [Count]
    FROM dbo.ComplaintStatuses s
    LEFT JOIN dbo.Complaints c ON c.StatusId = s.StatusId
      AND c.CreatedAt >= @FromDate AND c.CreatedAt < DATEADD(day, 1, @ToDate)
    GROUP BY s.StatusName
    ORDER BY s.StatusName;

    SELECT c.Priority AS [Name], COUNT(*) AS [Count]
    FROM dbo.Complaints c
    WHERE c.CreatedAt >= @FromDate AND c.CreatedAt < DATEADD(day, 1, @ToDate)
    GROUP BY c.Priority
    ORDER BY c.Priority;
END;
GO
