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

UPDATE [dbo].[ComplaintCategories]
SET [IsActive] = 0
WHERE [CategoryName] NOT IN (N'Split AC', N'Window AC', N'Cassette AC');
GO

INSERT INTO [dbo].[ComplaintCategories] ([CategoryName], [SortOrder], [IsActive])
SELECT seed.[CategoryName], seed.[SortOrder], 1
FROM (VALUES
    (N'Split AC', 1),
    (N'Window AC', 2),
    (N'Cassette AC', 3)
) AS seed([CategoryName], [SortOrder])
WHERE NOT EXISTS (
    SELECT 1
    FROM [dbo].[ComplaintCategories] existing
    WHERE existing.[CategoryName] = seed.[CategoryName]
);
GO