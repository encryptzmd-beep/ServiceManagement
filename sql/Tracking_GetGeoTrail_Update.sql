USE [FelixServiceDB]
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetGeoTrail]    Script Date: 03-06-2026 07:14:09 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[sp_Tracking_GetGeoTrail]
    @TechnicianId INT,
    @Date         DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Date IS NULL
        SET @Date = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    ;WITH AllEvents AS
    (
        -- 1. Check-In
        SELECT
            CAST(a.AttendanceId AS BIGINT)  AS TrackingId,
            a.CheckInLatitude               AS Latitude,
            a.CheckInLongitude              AS Longitude,
            a.CheckInAddress                AS [Address],
            'CheckIn'                       AS EventType,
            a.CheckInTime                   AS RecordedAt,
            NULL                            AS ComplaintId,
            NULL                            AS ComplaintNumber,
            NULL                            AS ComplaintSubject,
            NULL                            AS CustomerName,
            NULL                            AS CustomerPhone
        FROM dbo.TechnicianAttendance a
        WHERE a.TechnicianId  = @TechnicianId
          AND a.AttendanceDate = @Date
          AND a.CheckInTime IS NOT NULL
          AND a.CheckInLatitude IS NOT NULL

        UNION ALL

        -- 2. Check-Out
        SELECT
            CAST(a.AttendanceId AS BIGINT) + 1000000,
            a.CheckOutLatitude,
            a.CheckOutLongitude,
            a.CheckOutAddress,
            'CheckOut',
            a.CheckOutTime,
            NULL, NULL, NULL,
            NULL,
            NULL
        FROM dbo.TechnicianAttendance a
        WHERE a.TechnicianId  = @TechnicianId
          AND a.AttendanceDate = @Date
          AND a.CheckOutTime IS NOT NULL
          AND a.CheckOutLatitude IS NOT NULL

        UNION ALL

        -- 3. Site Arrival  ← joined to Complaints and Customers for badge + customer data
        SELECT
            CAST(sa.SiteArrivalId AS BIGINT) + 2000000,
            sa.Latitude,
            sa.Longitude,
            sa.[Address],
            'SiteArrival',
            sa.ArrivalTime,
            sa.ComplaintId,
            c.ComplaintNumber,
            c.Subject,
            cu.CustomerName,
            cu.MobileNumber AS CustomerPhone
        FROM dbo.TechnicianSiteArrivals sa
        LEFT JOIN dbo.Complaints c ON c.ComplaintId = sa.ComplaintId
        LEFT JOIN dbo.Customers cu ON cu.CustomerId = c.CustomerId
        WHERE sa.TechnicianId = @TechnicianId
          AND CAST(sa.ArrivalTime AS DATE) = @Date

        UNION ALL

        -- 4. Transit (periodic GPS pings)
        SELECT
            tl.LogId,
            tl.Latitude,
            tl.Longitude,
            NULL,
            'Transit',
            tl.LogTime,
            NULL, NULL, NULL,
            NULL,
            NULL
        FROM dbo.TrackingLog tl
        WHERE tl.TechnicianId = @TechnicianId
          AND CAST(tl.LogTime AS DATE) = @Date
    )
    SELECT
        TrackingId,
        Latitude,
        Longitude,
        [Address],
        EventType,
        RecordedAt,
        ComplaintId,
        ComplaintNumber,
        ComplaintSubject,
        CustomerName,
        CustomerPhone
    FROM AllEvents
    ORDER BY RecordedAt ASC;
END
