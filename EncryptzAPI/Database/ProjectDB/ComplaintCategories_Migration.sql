SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.ComplaintCategories', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ComplaintCategories](
        [ComplaintCategoryId] [int] IDENTITY(1,1) NOT NULL,
        [CategoryName] [nvarchar](100) NOT NULL,
        [SortOrder] [int] NOT NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_ComplaintCategories_IsActive] DEFAULT (1),
        [CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_ComplaintCategories_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_ComplaintCategories] PRIMARY KEY CLUSTERED ([ComplaintCategoryId] ASC),
        CONSTRAINT [UQ_ComplaintCategories_CategoryName] UNIQUE NONCLUSTERED ([CategoryName] ASC)
    );
END;
GO

INSERT INTO [dbo].[ComplaintCategories] ([CategoryName], [SortOrder], [IsActive])
SELECT seed.[CategoryName], seed.[SortOrder], 1
FROM (VALUES
    (N'Treadmill', 1),
    (N'Elliptical', 2),
    (N'Exercise Bike', 3),
    (N'Rowing Machine', 4),
    (N'Weight Bench', 5),
    (N'Dumbbells', 6),
    (N'Barbell', 7),
    (N'Pull Up Bar', 8),
    (N'Cable Machine', 9),
    (N'Leg Press', 10),
    (N'Smith Machine', 11),
    (N'Cross Trainer', 12),
    (N'Yoga Mat', 13),
    (N'Kettlebell', 14),
    (N'Other Gym Equipment', 15)
) AS seed([CategoryName], [SortOrder])
WHERE NOT EXISTS (
    SELECT 1
    FROM [dbo].[ComplaintCategories] existing
    WHERE existing.[CategoryName] = seed.[CategoryName]
);
GO