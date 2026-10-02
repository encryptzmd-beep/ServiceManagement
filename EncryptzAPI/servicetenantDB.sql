USE [master]
GO
/****** Object:  Database [FelixServiceDB]    Script Date: 29-09-2026 20:26:56 ******/
CREATE DATABASE [FelixServiceDB]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'FelixServiceDB', FILENAME = N'/var/opt/mssql/data/FelixServiceDB.mdf' , SIZE = 139264KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'FelixServiceDB_log', FILENAME = N'/var/opt/mssql/data/FelixServiceDB_log.ldf' , SIZE = 270336KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT, LEDGER = OFF
GO
ALTER DATABASE [FelixServiceDB] SET COMPATIBILITY_LEVEL = 160
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [FelixServiceDB].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [FelixServiceDB] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [FelixServiceDB] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [FelixServiceDB] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [FelixServiceDB] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [FelixServiceDB] SET ARITHABORT OFF 
GO
ALTER DATABASE [FelixServiceDB] SET AUTO_CLOSE ON 
GO
ALTER DATABASE [FelixServiceDB] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [FelixServiceDB] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [FelixServiceDB] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [FelixServiceDB] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [FelixServiceDB] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [FelixServiceDB] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [FelixServiceDB] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [FelixServiceDB] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [FelixServiceDB] SET  ENABLE_BROKER 
GO
ALTER DATABASE [FelixServiceDB] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [FelixServiceDB] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [FelixServiceDB] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [FelixServiceDB] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [FelixServiceDB] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [FelixServiceDB] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [FelixServiceDB] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [FelixServiceDB] SET RECOVERY FULL 
GO
ALTER DATABASE [FelixServiceDB] SET  MULTI_USER 
GO
ALTER DATABASE [FelixServiceDB] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [FelixServiceDB] SET DB_CHAINING OFF 
GO
ALTER DATABASE [FelixServiceDB] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [FelixServiceDB] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [FelixServiceDB] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [FelixServiceDB] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [FelixServiceDB] SET QUERY_STORE = ON
GO
ALTER DATABASE [FelixServiceDB] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [FelixServiceDB]
GO
/****** Object:  Table [dbo].[AppConfigurations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppConfigurations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConfigKey] [varchar](100) NOT NULL,
	[ConfigValue] [nvarchar](max) NOT NULL,
	[Description] [nvarchar](255) NULL,
	[UpdatedAt] [datetime] NULL,
	[UpdatedBy] [int] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[ConfigKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AssignmentAuditLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssignmentAuditLog](
	[AuditId] [int] IDENTITY(1,1) NOT NULL,
	[AssignmentId] [int] NULL,
	[Action] [nvarchar](50) NOT NULL,
	[OldTechnicianId] [int] NULL,
	[NewTechnicianId] [int] NULL,
	[OldRole] [nvarchar](20) NULL,
	[NewRole] [nvarchar](20) NULL,
	[ChangedBy] [int] NULL,
	[ChangedAt] [datetime2](7) NULL,
	[Remarks] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[ComplaintId] [int] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AuditId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Companies]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Companies](
	[CompanyId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyName] [nvarchar](200) NOT NULL,
	[CompanyCode] [nvarchar](20) NOT NULL,
	[CompanyLogo] [nvarchar](500) NULL,
	[Address] [nvarchar](500) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](100) NULL,
	[PinCode] [nvarchar](10) NULL,
	[PhoneNumber] [nvarchar](15) NULL,
	[Email] [nvarchar](200) NULL,
	[GSTNumber] [nvarchar](50) NULL,
	[SubscriptionPlan] [nvarchar](50) NULL,
	[SubscriptionExpiry] [date] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_Companies] PRIMARY KEY CLUSTERED 
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Companies_CompanyCode] UNIQUE NONCLUSTERED 
(
	[CompanyCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyInvitations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyInvitations](
	[InvitationId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[Email] [nvarchar](200) NOT NULL,
	[RoleInCompany] [nvarchar](50) NOT NULL,
	[Token] [uniqueidentifier] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[Remarks] [nvarchar](500) NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_CompanyInvitations] PRIMARY KEY CLUSTERED 
(
	[InvitationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyJoinRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyJoinRequests](
	[RequestId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[CompanyId] [int] NOT NULL,
	[RequestedRole] [nvarchar](50) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Remarks] [nvarchar](500) NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[ReviewedBy] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[RejectionReason] [nvarchar](500) NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_CompanyJoinRequests] PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CompanyJoinRequests_UserCompany] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyUsers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyUsers](
	[CompanyUserId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[UserId] [int] NOT NULL,
	[RoleInCompany] [nvarchar](50) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[AssignedBy] [int] NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_CompanyUsers] PRIMARY KEY CLUSTERED 
(
	[CompanyUserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CompanyUsers_CompanyUser] UNIQUE NONCLUSTERED 
(
	[CompanyId] ASC,
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplaintImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplaintImages](
	[ImageId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[ImagePath] [nvarchar](500) NOT NULL,
	[UploadedBy] [int] NULL,
	[UploadedAt] [datetime2](7) NULL,
	[ImageType] [int] NULL,
	[ImageData] [nvarchar](max) NULL,
	[ImageName] [nvarchar](200) NULL,
	[ContentType] [nvarchar](100) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ImageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplaintPayments]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplaintPayments](
	[PaymentId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[PaymentType] [varchar](50) NOT NULL,
	[ServiceChargeAmount] [decimal](18, 2) NULL,
	[SparePartsAmount] [decimal](18, 2) NULL,
	[DiscountAmount] [decimal](18, 2) NULL,
	[TotalAmount] [decimal](18, 2) NOT NULL,
	[AmountPaid] [decimal](18, 2) NOT NULL,
	[PaymentMethod] [varchar](50) NOT NULL,
	[UpiIdUsed] [varchar](100) NULL,
	[TransactionReference] [varchar](200) NULL,
	[PaymentStatus] [varchar](50) NOT NULL,
	[Remarks] [nvarchar](max) NULL,
	[CreatedAt] [datetime] NULL,
	[CreatedBy] [int] NULL,
	[IsVerified] [bit] NOT NULL,
	[VerifiedBy] [int] NULL,
	[VerifiedAt] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[PaymentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Complaints]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Complaints](
	[ComplaintId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintNumber] [nvarchar](20) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[ProductId] [int] NULL,
	[Subject] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](2000) NULL,
	[Priority] [nvarchar](20) NULL,
	[StatusId] [int] NOT NULL,
	[SLADeadline] [datetime2](7) NULL,
	[IsCustomerConfirmed] [bit] NULL,
	[ClosedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[ContactNumber] [nvarchar](15) NULL,
	[PreferredDate] [date] NULL,
	[PreferredTimeSlot] [nvarchar](50) NULL,
	[ComplaintNo] [varchar](20) NULL,
	[PriorityId] [int] NULL,
	[CreatedDate] [datetime] NULL,
	[AssignedDate] [datetime] NULL,
	[ResolvedDate] [datetime] NULL,
	[ClosedDate] [datetime] NULL,
	[AssignedTechnicianId] [int] NULL,
	[IsWarranty] [bit] NULL,
	[IsActive] [bit] NULL,
	[CompanyId] [int] NULL,
	[Latitude] [decimal](10, 7) NULL,
	[Longitude] [decimal](10, 7) NULL,
	[LocationAddress] [nvarchar](500) NULL,
	[Category] [nvarchar](100) NULL,
	[BrandName] [nvarchar](100) NULL,
	[ModelNumber] [nvarchar](100) NULL,
	[LocationName] [nvarchar](200) NULL,
	[NatureOfJob] [nvarchar](50) NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ComplaintId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[ComplaintNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplaintStatuses]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplaintStatuses](
	[StatusId] [int] IDENTITY(1,1) NOT NULL,
	[StatusName] [nvarchar](50) NOT NULL,
	[StatusColor] [nvarchar](7) NULL,
	[SortOrder] [int] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[StatusId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[StatusName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplaintCategories] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplaintCategories](
    [ComplaintCategoryId] [int] IDENTITY(1,1) NOT NULL,
    [CategoryName] [nvarchar](100) NOT NULL,
    [SortOrder] [int] NOT NULL,
    [IsActive] [bit] NOT NULL,
    [CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_ComplaintCategories_CreatedAt] DEFAULT (SYSUTCDATETIME()),
PRIMARY KEY CLUSTERED
(
    [ComplaintCategoryId] ASC
),
UNIQUE NONCLUSTERED
(
    [CategoryName] ASC
)
) ON [PRIMARY]
GO
INSERT INTO [dbo].[ComplaintCategories] ([CategoryName], [SortOrder], [IsActive])
VALUES
    (N'Split AC', 1, 1),
    (N'Window AC', 2, 1),
    (N'Cassette AC', 3, 1)
GO
/****** Object:  Table [dbo].[ComplaintTimeline]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplaintTimeline](
	[TimelineId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[StatusId] [int] NOT NULL,
	[Remarks] [nvarchar](1000) NULL,
	[ActionBy] [int] NULL,
	[ActionAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TimelineId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Customers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[CustomerId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[CustomerName] [nvarchar](150) NOT NULL,
	[Address] [nvarchar](500) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](100) NULL,
	[PinCode] [nvarchar](10) NULL,
	[AlternatePhone] [nvarchar](15) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[MobileNumber] [nvarchar](20) NOT NULL,
	[Email] [nvarchar](150) NULL,
	[IsActive] [bit] NOT NULL,
	[Latitude] [decimal](9, 6) NULL,
	[Longitude] [decimal](9, 6) NULL,
	[Landmark] [nvarchar](200) NULL,
	[CompanyId] [int] NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CustomerServiceRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CustomerServiceRequests](
	[RequestId] [int] IDENTITY(1,1) NOT NULL,
	[RequestNo] [varchar](20) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[ProductId] [int] NULL,
	[RequestType] [int] NULL,
	[Subject] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[PreferredDate] [date] NULL,
	[PreferredTimeSlot] [varchar](20) NULL,
	[StatusId] [int] NULL,
	[LinkedComplaintId] [int] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
	[IsActive] [bit] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RequestNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmailOtpLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmailOtpLog](
	[OtpId] [int] IDENTITY(1,1) NOT NULL,
	[Email] [nvarchar](255) NOT NULL,
	[OtpCode] [nvarchar](10) NOT NULL,
	[Purpose] [nvarchar](50) NULL,
	[ExpiresAt] [datetime] NOT NULL,
	[CreatedAt] [datetime] NULL,
	[IsUsed] [bit] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[OtpId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Locations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Locations](
	[LocationId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationName] [nvarchar](200) NOT NULL,
	[LocationCode] [nvarchar](50) NULL,
	[Address] [nvarchar](400) NULL,
	[City] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MenuItems]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MenuItems](
	[MenuId] [int] IDENTITY(1,1) NOT NULL,
	[MenuName] [nvarchar](100) NOT NULL,
	[MenuPath] [nvarchar](200) NULL,
	[Icon] [nvarchar](100) NULL,
	[ParentMenuId] [int] NULL,
	[SortOrder] [int] NULL,
	[IsActive] [bit] NULL,
	[Module] [nvarchar](50) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[MenuId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OtpLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OtpLog](
	[OtpId] [int] IDENTITY(1,1) NOT NULL,
	[MobileNumber] [nvarchar](15) NOT NULL,
	[OtpCode] [nvarchar](6) NOT NULL,
	[Purpose] [nvarchar](50) NULL,
	[IsUsed] [bit] NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[CreatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[OtpId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProductImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductImages](
	[ImageId] [int] IDENTITY(1,1) NOT NULL,
	[ProductId] [int] NOT NULL,
	[ImageType] [nvarchar](50) NOT NULL,
	[ImagePath] [nvarchar](500) NOT NULL,
	[UploadedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ImageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProductMaster]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductMaster](
	[ProductMasterId] [int] IDENTITY(1,1) NOT NULL,
	[ProductCode] [varchar](50) NULL,
	[ProductName] [varchar](200) NULL,
	[Brand] [varchar](100) NULL,
	[Category] [varchar](100) NULL,
	[SubCategory] [varchar](100) NULL,
	[Model] [varchar](100) NULL,
	[Description] [varchar](500) NULL,
	[MRP] [decimal](18, 2) NULL,
	[Org] [varchar](10) NULL,
	[PriceChangeStatus] [varchar](50) NULL,
	[PriceEffectiveDate] [date] NULL,
	[WarrantyMonths] [int] NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime] NULL,
	[UpdatedDate] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ProductMasterId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Products]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Products](
	[ProductId] [int] IDENTITY(1,1) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[ProductName] [nvarchar](200) NOT NULL,
	[SerialNumber] [nvarchar](100) NOT NULL,
	[Brand] [nvarchar](100) NULL,
	[Model] [nvarchar](100) NULL,
	[PurchaseDate] [date] NULL,
	[WarrantyExpiryDate] [date] NULL,
	[CreatedAt] [datetime2](7) NULL,
	[ModelNumber] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[Category] [nvarchar](100) NULL,
	[CompanyId] [int] NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ProductId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RepairPartImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RepairPartImages](
	[ImageId] [int] IDENTITY(1,1) NOT NULL,
	[RepairRequestId] [int] NOT NULL,
	[ImagePath] [nvarchar](max) NULL,
	[ImageType] [nvarchar](50) NULL,
	[CreatedAt] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_RepairPartImages] PRIMARY KEY CLUSTERED 
(
	[ImageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RepairPartRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RepairPartRequests](
	[RepairRequestId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[AssignmentId] [int] NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[CustomerId] [int] NULL,
	[ProductId] [int] NULL,
	[PartName] [nvarchar](255) NULL,
	[PartSerialNumber] [nvarchar](255) NULL,
	[Notes] [nvarchar](max) NULL,
	[Status] [nvarchar](50) NULL,
	[CreatedAt] [datetime] NULL,
	[StatusNotes] [nvarchar](1000) NULL,
	[UpdatedAt] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_RepairPartRequests] PRIMARY KEY CLUSTERED 
(
	[RepairRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoleMenuAccess]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoleMenuAccess](
	[AccessId] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [int] NOT NULL,
	[MenuId] [int] NOT NULL,
	[CanView] [bit] NULL,
	[CanCreate] [bit] NULL,
	[CanEdit] [bit] NULL,
	[CanDelete] [bit] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AccessId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RoleId] ASC,
	[MenuId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[RoleId] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[Description] [nvarchar](200) NULL,
	[IsActive] [bit] NULL,
	[CreatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RoleName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Schedules]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Schedules](
	[ScheduleId] [int] IDENTITY(1,1) NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[ComplaintId] [int] NULL,
	[ScheduleDate] [date] NOT NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[TaskType] [int] NULL,
	[PriorityLevel] [int] NULL,
	[StatusId] [int] NULL,
	[CustomerAddress] [nvarchar](500) NULL,
	[CustomerLatitude] [decimal](10, 7) NULL,
	[CustomerLongitude] [decimal](10, 7) NULL,
	[EstimatedDuration] [int] NULL,
	[ActualDuration] [int] NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime] NULL,
	[IsActive] [bit] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ScheduleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServiceImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServiceImages](
	[ImageId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[ImageType] [nvarchar](50) NULL,
	[ImagePath] [nvarchar](max) NOT NULL,
	[UploadedAt] [datetime] NULL,
	[ImageData] [nvarchar](max) NULL,
	[ImageName] [nvarchar](255) NULL,
	[ContentType] [nvarchar](100) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_ServiceImages] PRIMARY KEY CLUSTERED 
(
	[ImageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SparePartRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SparePartRequests](
	[RequestId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[SparePartId] [int] NULL,
	[Quantity] [int] NOT NULL,
	[Status] [nvarchar](30) NULL,
	[RequestedAt] [datetime2](7) NULL,
	[ApprovedBy] [int] NULL,
	[ApprovedAt] [datetime2](7) NULL,
	[PartName] [nvarchar](200) NULL,
	[PartNumber] [nvarchar](100) NULL,
	[UrgencyLevel] [nvarchar](20) NULL,
	[Remarks] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SpareParts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SpareParts](
	[SparePartId] [int] IDENTITY(1,1) NOT NULL,
	[PartName] [nvarchar](200) NOT NULL,
	[PartNumber] [nvarchar](100) NULL,
	[StockQuantity] [int] NULL,
	[UnitPrice] [decimal](10, 2) NULL,
	[IsActive] [bit] NULL,
	[CompanyId] [int] NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SparePartId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SystemSettings]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemSettings](
	[SettingId] [int] IDENTITY(1,1) NOT NULL,
	[SettingKey] [varchar](100) NOT NULL,
	[SettingValue] [nvarchar](max) NULL,
	[SettingGroup] [varchar](50) NOT NULL,
	[DataType] [varchar](20) NULL,
	[Description] [nvarchar](200) NULL,
	[IsEditable] [bit] NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SettingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[SettingKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TechnicianAssignments]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TechnicianAssignments](
	[AssignmentId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[AssignmentRole] [nvarchar](20) NOT NULL,
	[AssignedBy] [int] NULL,
	[AssignedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[Status] [nvarchar](30) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[ScheduledDate] [date] NULL,
	[StartTime] [nvarchar](10) NULL,
	[EndTime] [nvarchar](10) NULL,
	[EstimatedDuration] [int] NULL,
	[TimeSlot] [nvarchar](20) NULL,
	[Notes] [nvarchar](500) NULL,
	[Priority] [nvarchar](20) NULL,
	[WorkDone] [nvarchar](1000) NULL,
	[PartsUsed] [nvarchar](500) NULL,
	[CustomerFeedback] [nvarchar](500) NULL,
	[CompletionRemarks] [nvarchar](500) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AssignmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TechnicianAttendance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TechnicianAttendance](
	[AttendanceId] [int] IDENTITY(1,1) NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[CheckInTime] [datetime2](7) NULL,
	[CheckInLatitude] [decimal](9, 6) NULL,
	[CheckInLongitude] [decimal](9, 6) NULL,
	[CheckInAddress] [nvarchar](500) NULL,
	[CheckOutTime] [datetime2](7) NULL,
	[CheckOutLatitude] [decimal](9, 6) NULL,
	[CheckOutLongitude] [decimal](9, 6) NULL,
	[CheckOutAddress] [nvarchar](500) NULL,
	[TotalWorkHours] [decimal](5, 2) NULL,
	[AttendanceDate] [date] NOT NULL,
	[CreatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AttendanceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TechnicianProfiles]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TechnicianProfiles](
	[ProfileId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[EmployeeCode] [varchar](20) NOT NULL,
	[Specialization] [nvarchar](100) NULL,
	[ExperienceYears] [int] NULL,
	[CertificationDetails] [nvarchar](500) NULL,
	[MaxDailyAssignments] [int] NULL,
	[CurrentLatitude] [decimal](10, 7) NULL,
	[CurrentLongitude] [decimal](10, 7) NULL,
	[LastLocationUpdate] [datetime] NULL,
	[AvailabilityStatus] [int] NULL,
	[Rating] [decimal](3, 2) NULL,
	[TotalCompletedJobs] [int] NULL,
	[JoinDate] [date] NOT NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedDate] [datetime] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ProfileId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[EmployeeCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Technicians]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Technicians](
	[TechnicianId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[Specialization] [nvarchar](200) NULL,
	[IsAvailable] [bit] NULL,
	[CreatedAt] [datetime2](7) NULL,
	[Zone] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[SkillLevel] [nvarchar](20) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[CompanyId] [int] NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TechnicianId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TechnicianSiteArrivals]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TechnicianSiteArrivals](
	[SiteArrivalId] [int] IDENTITY(1,1) NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[Latitude] [decimal](10, 7) NOT NULL,
	[Longitude] [decimal](10, 7) NOT NULL,
	[Address] [nvarchar](500) NULL,
	[ArrivalTime] [datetime] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SiteArrivalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TrackingLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TrackingLog](
	[LogId] [bigint] IDENTITY(1,1) NOT NULL,
	[TechnicianId] [int] NOT NULL,
	[Latitude] [decimal](10, 7) NOT NULL,
	[Longitude] [decimal](10, 7) NOT NULL,
	[Accuracy] [decimal](8, 2) NULL,
	[Speed] [decimal](8, 2) NULL,
	[BatteryLevel] [int] NULL,
	[SessionId] [uniqueidentifier] NULL,
	[LogTime] [datetime] NOT NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[LogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UPIConfigurations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UPIConfigurations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UpiId] [varchar](100) NOT NULL,
	[DisplayName] [nvarchar](100) NOT NULL,
	[IsDefault] [bit] NULL,
	[IsActive] [bit] NULL,
	[CreatedAt] [datetime] NULL,
	[CreatedBy] [int] NULL,
	[UpdatedAt] [datetime] NULL,
	[UpdatedBy] [int] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](150) NOT NULL,
	[Email] [nvarchar](200) NULL,
	[MobileNumber] [nvarchar](15) NOT NULL,
	[PasswordHash] [nvarchar](500) NULL,
	[RoleId] [int] NOT NULL,
	[IsActive] [bit] NULL,
	[CreatedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[LastLoginAt] [datetime2](7) NULL,
	[Phone] [varchar](20) NULL,
	[ProfileImage] [nvarchar](500) NULL,
	[UserType] [nvarchar](20) NOT NULL,
	[AadhaarNumber] [nvarchar](20) NULL,
	[CreatedByCompanyId] [int] NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[MobileNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserSessions]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserSessions](
	[SessionId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[SelectedCompanyId] [int] NULL,
	[AuthToken] [nvarchar](500) NOT NULL,
	[IpAddress] [nvarchar](45) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[LastActivity] [datetime2](7) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
 CONSTRAINT [PK_UserSessions] PRIMARY KEY CLUSTERED 
(
	[SessionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WarrantyReturns]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WarrantyReturns](
	[ReturnId] [int] IDENTITY(1,1) NOT NULL,
	[ComplaintId] [int] NOT NULL,
	[SparePartId] [int] NOT NULL,
	[OldPartSerialNumber] [nvarchar](100) NULL,
	[ReturnStatus] [nvarchar](30) NULL,
	[ReturnedBy] [int] NULL,
	[ReturnedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NULL,
	[ReturnNo] [varchar](30) NULL,
	[CustomerId] [int] NULL,
	[ProductId] [int] NULL,
	[ProductSerialNo] [varchar](50) NULL,
	[WarrantyStartDate] [date] NULL,
	[WarrantyEndDate] [date] NULL,
	[ReturnReason] [nvarchar](500) NULL,
	[ReturnType] [int] NULL,
	[StatusId] [int] NULL,
	[PickupAddress] [nvarchar](500) NULL,
	[CreatedBy] [int] NULL,
	[CreatedDate] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[ModifiedDate] [datetime] NULL,
	[IsActive] [bit] NULL,
	[ApprovedBy] [int] NULL,
	[ApprovedDate] [datetime] NULL,
	[ResolutionNotes] [nvarchar](max) NULL,
	[TrackingNumber] [varchar](50) NULL,
	[RefundAmount] [decimal](12, 2) NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[LocationId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ReturnId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Index [IX_AppConfigurations_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_AppConfigurations_Scope] ON [dbo].[AppConfigurations]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AssignmentAuditLog_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_AssignmentAuditLog_Scope] ON [dbo].[AssignmentAuditLog]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Companies_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Companies_Scope] ON [dbo].[Companies]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CompanyInvitations_Email]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyInvitations_Email] ON [dbo].[CompanyInvitations]
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyInvitations_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyInvitations_Scope] ON [dbo].[CompanyInvitations]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CompanyInvitations_Status]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyInvitations_Status] ON [dbo].[CompanyInvitations]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyInvitations_Token]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyInvitations_Token] ON [dbo].[CompanyInvitations]
(
	[Token] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyJoinRequests_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyJoinRequests_Scope] ON [dbo].[CompanyJoinRequests]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyUsers_CompanyId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyUsers_CompanyId] ON [dbo].[CompanyUsers]
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyUsers_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyUsers_Scope] ON [dbo].[CompanyUsers]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyUsers_UserId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyUsers_UserId] ON [dbo].[CompanyUsers]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplaintImages_ComplaintId_ImageType]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ComplaintImages_ComplaintId_ImageType] ON [dbo].[ComplaintImages]
(
	[ComplaintId] ASC,
	[ImageType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplaintImages_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ComplaintImages_Scope] ON [dbo].[ComplaintImages]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplaintPayments_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ComplaintPayments_Scope] ON [dbo].[ComplaintPayments]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Complaints_BrandName]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Complaints_BrandName] ON [dbo].[Complaints]
(
	[BrandName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Complaints_Category]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Complaints_Category] ON [dbo].[Complaints]
(
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Complaints_CompanyId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Complaints_CompanyId] ON [dbo].[Complaints]
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Complaints_CustomerId_Status]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Complaints_CustomerId_Status] ON [dbo].[Complaints]
(
	[CustomerId] ASC,
	[StatusId] ASC
)
INCLUDE([CreatedDate]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Complaints_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Complaints_Scope] ON [dbo].[Complaints]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplaintStatuses_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ComplaintStatuses_Scope] ON [dbo].[ComplaintStatuses]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplaintTimeline_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ComplaintTimeline_Scope] ON [dbo].[ComplaintTimeline]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Customers_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Customers_Scope] ON [dbo].[Customers]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CustomerServiceRequests_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_CustomerServiceRequests_Scope] ON [dbo].[CustomerServiceRequests]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailOtpLog_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_EmailOtpLog_Scope] ON [dbo].[EmailOtpLog]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Locations_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Locations_Scope] ON [dbo].[Locations]
(
	[CompanyId] ASC,
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MenuItems_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_MenuItems_Scope] ON [dbo].[MenuItems]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_OtpLog_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_OtpLog_Scope] ON [dbo].[OtpLog]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProductImages_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ProductImages_Scope] ON [dbo].[ProductImages]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProductMaster_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ProductMaster_Scope] ON [dbo].[ProductMaster]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Products_CompanyId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Products_CompanyId] ON [dbo].[Products]
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Products_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Products_Scope] ON [dbo].[Products]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepairPartImages_RepairRequestId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartImages_RepairRequestId] ON [dbo].[RepairPartImages]
(
	[RepairRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepairPartImages_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartImages_Scope] ON [dbo].[RepairPartImages]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepairPartRequests_ComplaintId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_ComplaintId] ON [dbo].[RepairPartRequests]
(
	[ComplaintId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepairPartRequests_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_Scope] ON [dbo].[RepairPartRequests]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RepairPartRequests_Status]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_Status] ON [dbo].[RepairPartRequests]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepairPartRequests_TechnicianId]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_TechnicianId] ON [dbo].[RepairPartRequests]
(
	[TechnicianId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RoleMenuAccess_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_RoleMenuAccess_Scope] ON [dbo].[RoleMenuAccess]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Roles_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Roles_Scope] ON [dbo].[Roles]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_Scope] ON [dbo].[Schedules]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServiceImages_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_ServiceImages_Scope] ON [dbo].[ServiceImages]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SparePartRequests_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_SparePartRequests_Scope] ON [dbo].[SparePartRequests]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SpareParts_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_SpareParts_Scope] ON [dbo].[SpareParts]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SystemSettings_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_SystemSettings_Scope] ON [dbo].[SystemSettings]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TechnicianAssignments_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TechnicianAssignments_Scope] ON [dbo].[TechnicianAssignments]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TechnicianAttendance_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TechnicianAttendance_Scope] ON [dbo].[TechnicianAttendance]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TechnicianProfiles_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TechnicianProfiles_Scope] ON [dbo].[TechnicianProfiles]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Technicians_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Technicians_Scope] ON [dbo].[Technicians]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SiteArrivals_Complaint]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_SiteArrivals_Complaint] ON [dbo].[TechnicianSiteArrivals]
(
	[ComplaintId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SiteArrivals_TechDate]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_SiteArrivals_TechDate] ON [dbo].[TechnicianSiteArrivals]
(
	[TechnicianId] ASC,
	[ArrivalTime] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TechnicianSiteArrivals_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TechnicianSiteArrivals_Scope] ON [dbo].[TechnicianSiteArrivals]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TrackingLog_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TrackingLog_Scope] ON [dbo].[TrackingLog]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TrackingLog_TechTime]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_TrackingLog_TechTime] ON [dbo].[TrackingLog]
(
	[TechnicianId] ASC,
	[LogTime] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UPIConfigurations_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_UPIConfigurations_Scope] ON [dbo].[UPIConfigurations]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Email]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Users_Email] ON [dbo].[Users]
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Mobile]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Users_Mobile] ON [dbo].[Users]
(
	[MobileNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_Users_Scope] ON [dbo].[Users]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserSessions_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_UserSessions_Scope] ON [dbo].[UserSessions]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_WarrantyReturns_Scope]    Script Date: 29-09-2026 20:26:58 ******/
CREATE NONCLUSTERED INDEX [IX_WarrantyReturns_Scope] ON [dbo].[WarrantyReturns]
(
	[CompanyId] ASC,
	[ProjectId] ASC,
	[LocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[AppConfigurations] ADD  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AppConfigurations] ADD  CONSTRAINT [DF_AppConfigurations_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[AppConfigurations] ADD  CONSTRAINT [DF_AppConfigurations_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[AppConfigurations] ADD  CONSTRAINT [DF_AppConfigurations_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[AssignmentAuditLog] ADD  DEFAULT (getutcdate()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[AssignmentAuditLog] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AssignmentAuditLog] ADD  CONSTRAINT [DF_AssignmentAuditLog_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[AssignmentAuditLog] ADD  CONSTRAINT [DF_AssignmentAuditLog_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[AssignmentAuditLog] ADD  CONSTRAINT [DF_AssignmentAuditLog_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Companies] ADD  DEFAULT ('Basic') FOR [SubscriptionPlan]
GO
ALTER TABLE [dbo].[Companies] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Companies] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Companies] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Companies] ADD  CONSTRAINT [DF_Companies_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Companies] ADD  CONSTRAINT [DF_Companies_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  DEFAULT (newid()) FOR [Token]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  CONSTRAINT [DF_CompanyInvitations_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[CompanyInvitations] ADD  CONSTRAINT [DF_CompanyInvitations_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[CompanyJoinRequests] ADD  DEFAULT ('Technician') FOR [RequestedRole]
GO
ALTER TABLE [dbo].[CompanyJoinRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[CompanyJoinRequests] ADD  DEFAULT (getutcdate()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[CompanyJoinRequests] ADD  CONSTRAINT [DF_CompanyJoinRequests_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[CompanyJoinRequests] ADD  CONSTRAINT [DF_CompanyJoinRequests_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  DEFAULT (getutcdate()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  CONSTRAINT [DF_CompanyUsers_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  CONSTRAINT [DF_CompanyUsers_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ComplaintImages] ADD  DEFAULT (getutcdate()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[ComplaintImages] ADD  CONSTRAINT [DF_ComplaintImages_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ComplaintImages] ADD  CONSTRAINT [DF_ComplaintImages_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ComplaintImages] ADD  CONSTRAINT [DF_ComplaintImages_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT ((0)) FOR [ServiceChargeAmount]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT ((0)) FOR [SparePartsAmount]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT ((0)) FOR [DiscountAmount]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT ('Pending') FOR [PaymentStatus]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  DEFAULT ((0)) FOR [IsVerified]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  CONSTRAINT [DF_ComplaintPayments_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  CONSTRAINT [DF_ComplaintPayments_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ComplaintPayments] ADD  CONSTRAINT [DF_ComplaintPayments_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT ((0)) FOR [IsCustomerConfirmed]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT ((2)) FOR [PriorityId]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT ((0)) FOR [IsWarranty]
GO
ALTER TABLE [dbo].[Complaints] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Complaints] ADD  CONSTRAINT [DF_Complaints_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Complaints] ADD  CONSTRAINT [DF_Complaints_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ComplaintStatuses] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ComplaintStatuses] ADD  CONSTRAINT [DF_ComplaintStatuses_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ComplaintStatuses] ADD  CONSTRAINT [DF_ComplaintStatuses_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ComplaintStatuses] ADD  CONSTRAINT [DF_ComplaintStatuses_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ComplaintTimeline] ADD  DEFAULT (getutcdate()) FOR [ActionAt]
GO
ALTER TABLE [dbo].[ComplaintTimeline] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ComplaintTimeline] ADD  CONSTRAINT [DF_ComplaintTimeline_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ComplaintTimeline] ADD  CONSTRAINT [DF_ComplaintTimeline_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ComplaintTimeline] ADD  CONSTRAINT [DF_ComplaintTimeline_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ('') FOR [MobileNumber]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Customers] ADD  CONSTRAINT [DF_Customers_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Customers] ADD  CONSTRAINT [DF_Customers_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  DEFAULT ((1)) FOR [RequestType]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  DEFAULT ((1)) FOR [StatusId]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  CONSTRAINT [DF_CustomerServiceRequests_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  CONSTRAINT [DF_CustomerServiceRequests_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[CustomerServiceRequests] ADD  CONSTRAINT [DF_CustomerServiceRequests_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  DEFAULT ('ForgotPassword') FOR [Purpose]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  DEFAULT ((0)) FOR [IsUsed]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  CONSTRAINT [DF_EmailOtpLog_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  CONSTRAINT [DF_EmailOtpLog_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[EmailOtpLog] ADD  CONSTRAINT [DF_EmailOtpLog_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Locations] ADD  CONSTRAINT [DF_Loc_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Locations] ADD  CONSTRAINT [DF_Loc_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MenuItems] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[MenuItems] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MenuItems] ADD  CONSTRAINT [DF_MenuItems_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[MenuItems] ADD  CONSTRAINT [DF_MenuItems_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[MenuItems] ADD  CONSTRAINT [DF_MenuItems_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[OtpLog] ADD  DEFAULT ('Login') FOR [Purpose]
GO
ALTER TABLE [dbo].[OtpLog] ADD  DEFAULT ((0)) FOR [IsUsed]
GO
ALTER TABLE [dbo].[OtpLog] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OtpLog] ADD  CONSTRAINT [DF_OtpLog_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[OtpLog] ADD  CONSTRAINT [DF_OtpLog_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[OtpLog] ADD  CONSTRAINT [DF_OtpLog_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ProductImages] ADD  DEFAULT (getutcdate()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ('AEROFIT') FOR [Brand]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((12)) FOR [WarrantyMonths]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT (getdate()) FOR [UpdatedDate]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  CONSTRAINT [DF_ProductMaster_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  CONSTRAINT [DF_ProductMaster_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  CONSTRAINT [DF_ProductMaster_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Products] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[RepairPartImages] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RepairPartImages] ADD  CONSTRAINT [DF_RepairPartImages_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[RepairPartImages] ADD  CONSTRAINT [DF_RepairPartImages_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[RepairPartImages] ADD  CONSTRAINT [DF_RepairPartImages_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[RepairPartRequests] ADD  DEFAULT ('Requested') FOR [Status]
GO
ALTER TABLE [dbo].[RepairPartRequests] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RepairPartRequests] ADD  CONSTRAINT [DF_RepairPartRequests_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[RepairPartRequests] ADD  CONSTRAINT [DF_RepairPartRequests_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[RepairPartRequests] ADD  CONSTRAINT [DF_RepairPartRequests_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  DEFAULT ((0)) FOR [CanView]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  DEFAULT ((0)) FOR [CanCreate]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  DEFAULT ((0)) FOR [CanEdit]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  DEFAULT ((0)) FOR [CanDelete]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RoleMenuAccess_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RoleMenuAccess_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RoleMenuAccess_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((1)) FOR [TaskType]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((2)) FOR [PriorityLevel]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((1)) FOR [StatusId]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((60)) FOR [EstimatedDuration]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[Schedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[ServiceImages] ADD  DEFAULT (getutcdate()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[ServiceImages] ADD  CONSTRAINT [DF_ServiceImages_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[ServiceImages] ADD  CONSTRAINT [DF_ServiceImages_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[ServiceImages] ADD  CONSTRAINT [DF_ServiceImages_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  DEFAULT ('Requested') FOR [Status]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  DEFAULT (getutcdate()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  DEFAULT ('Normal') FOR [UrgencyLevel]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  CONSTRAINT [DF_SparePartRequests_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  CONSTRAINT [DF_SparePartRequests_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[SparePartRequests] ADD  CONSTRAINT [DF_SparePartRequests_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[SpareParts] ADD  DEFAULT ((0)) FOR [StockQuantity]
GO
ALTER TABLE [dbo].[SpareParts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[SpareParts] ADD  CONSTRAINT [DF_SpareParts_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[SpareParts] ADD  CONSTRAINT [DF_SpareParts_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  DEFAULT ('string') FOR [DataType]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  DEFAULT ((1)) FOR [IsEditable]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  CONSTRAINT [DF_SystemSettings_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  CONSTRAINT [DF_SystemSettings_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[SystemSettings] ADD  CONSTRAINT [DF_SystemSettings_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  DEFAULT ('Primary') FOR [AssignmentRole]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  DEFAULT (getutcdate()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  DEFAULT ('Assigned') FOR [Status]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  CONSTRAINT [DF_TechnicianAssignments_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  CONSTRAINT [DF_TechnicianAssignments_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[TechnicianAssignments] ADD  CONSTRAINT [DF_TechnicianAssignments_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[TechnicianAttendance] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[TechnicianAttendance] ADD  CONSTRAINT [DF_TechnicianAttendance_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[TechnicianAttendance] ADD  CONSTRAINT [DF_TechnicianAttendance_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[TechnicianAttendance] ADD  CONSTRAINT [DF_TechnicianAttendance_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((0)) FOR [ExperienceYears]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((5)) FOR [MaxDailyAssignments]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((1)) FOR [AvailabilityStatus]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((0.00)) FOR [Rating]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((0)) FOR [TotalCompletedJobs]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  CONSTRAINT [DF_TechnicianProfiles_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  CONSTRAINT [DF_TechnicianProfiles_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[TechnicianProfiles] ADD  CONSTRAINT [DF_TechnicianProfiles_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Technicians] ADD  DEFAULT ((1)) FOR [IsAvailable]
GO
ALTER TABLE [dbo].[Technicians] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Technicians] ADD  CONSTRAINT [DF_Technicians_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Technicians] ADD  DEFAULT ('Junior') FOR [SkillLevel]
GO
ALTER TABLE [dbo].[Technicians] ADD  CONSTRAINT [DF_Technicians_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Technicians] ADD  CONSTRAINT [DF_Technicians_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[TechnicianSiteArrivals] ADD  DEFAULT (getdate()) FOR [ArrivalTime]
GO
ALTER TABLE [dbo].[TechnicianSiteArrivals] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[TechnicianSiteArrivals] ADD  CONSTRAINT [DF_TechnicianSiteArrivals_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[TechnicianSiteArrivals] ADD  CONSTRAINT [DF_TechnicianSiteArrivals_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[TechnicianSiteArrivals] ADD  CONSTRAINT [DF_TechnicianSiteArrivals_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[TrackingLog] ADD  DEFAULT (getdate()) FOR [LogTime]
GO
ALTER TABLE [dbo].[TrackingLog] ADD  CONSTRAINT [DF_TrackingLog_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[TrackingLog] ADD  CONSTRAINT [DF_TrackingLog_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[TrackingLog] ADD  CONSTRAINT [DF_TrackingLog_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  DEFAULT ((0)) FOR [IsDefault]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  CONSTRAINT [DF_UPIConfigurations_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  CONSTRAINT [DF_UPIConfigurations_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[UPIConfigurations] ADD  CONSTRAINT [DF_UPIConfigurations_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('SystemUser') FOR [UserType]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[UserSessions] ADD  CONSTRAINT [DF_UserSessions_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[UserSessions] ADD  CONSTRAINT [DF_UserSessions_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[UserSessions] ADD  CONSTRAINT [DF_UserSessions_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  DEFAULT ('Pending') FOR [ReturnStatus]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  DEFAULT ((1)) FOR [StatusId]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  CONSTRAINT [DF_WarrantyReturns_CompanyId]  DEFAULT ((0)) FOR [CompanyId]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  CONSTRAINT [DF_WarrantyReturns_ProjectId]  DEFAULT ((0)) FOR [ProjectId]
GO
ALTER TABLE [dbo].[WarrantyReturns] ADD  CONSTRAINT [DF_WarrantyReturns_LocationId]  DEFAULT ((0)) FOR [LocationId]
GO
ALTER TABLE [dbo].[AssignmentAuditLog]  WITH CHECK ADD FOREIGN KEY([AssignmentId])
REFERENCES [dbo].[TechnicianAssignments] ([AssignmentId])
GO
ALTER TABLE [dbo].[AssignmentAuditLog]  WITH CHECK ADD FOREIGN KEY([AssignmentId])
REFERENCES [dbo].[TechnicianAssignments] ([AssignmentId])
GO
ALTER TABLE [dbo].[AssignmentAuditLog]  WITH CHECK ADD FOREIGN KEY([ChangedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[AssignmentAuditLog]  WITH CHECK ADD FOREIGN KEY([ChangedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CompanyInvitations]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInvitations_Company] FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[CompanyInvitations] CHECK CONSTRAINT [FK_CompanyInvitations_Company]
GO
ALTER TABLE [dbo].[CompanyInvitations]  WITH CHECK ADD  CONSTRAINT [FK_CompanyInvitations_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CompanyInvitations] CHECK CONSTRAINT [FK_CompanyInvitations_CreatedBy]
GO
ALTER TABLE [dbo].[CompanyJoinRequests]  WITH CHECK ADD  CONSTRAINT [FK_CompanyJoinRequests_Company] FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[CompanyJoinRequests] CHECK CONSTRAINT [FK_CompanyJoinRequests_Company]
GO
ALTER TABLE [dbo].[CompanyJoinRequests]  WITH CHECK ADD  CONSTRAINT [FK_CompanyJoinRequests_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CompanyJoinRequests] CHECK CONSTRAINT [FK_CompanyJoinRequests_User]
GO
ALTER TABLE [dbo].[CompanyUsers]  WITH CHECK ADD  CONSTRAINT [FK_CompanyUsers_Company] FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[CompanyUsers] CHECK CONSTRAINT [FK_CompanyUsers_Company]
GO
ALTER TABLE [dbo].[CompanyUsers]  WITH CHECK ADD  CONSTRAINT [FK_CompanyUsers_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CompanyUsers] CHECK CONSTRAINT [FK_CompanyUsers_User]
GO
ALTER TABLE [dbo].[ComplaintImages]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[ComplaintImages]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[ComplaintImages]  WITH CHECK ADD FOREIGN KEY([UploadedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[ComplaintImages]  WITH CHECK ADD FOREIGN KEY([UploadedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[ComplaintImages]  WITH CHECK ADD  CONSTRAINT [FK_ComplaintImages_UploadedBy] FOREIGN KEY([UploadedBy])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[ComplaintImages] CHECK CONSTRAINT [FK_ComplaintImages_UploadedBy]
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([ProductId])
REFERENCES [dbo].[Products] ([ProductId])
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([ProductId])
REFERENCES [dbo].[Products] ([ProductId])
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([StatusId])
REFERENCES [dbo].[ComplaintStatuses] ([StatusId])
GO
ALTER TABLE [dbo].[Complaints]  WITH CHECK ADD FOREIGN KEY([StatusId])
REFERENCES [dbo].[ComplaintStatuses] ([StatusId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([ActionBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([ActionBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([StatusId])
REFERENCES [dbo].[ComplaintStatuses] ([StatusId])
GO
ALTER TABLE [dbo].[ComplaintTimeline]  WITH CHECK ADD FOREIGN KEY([StatusId])
REFERENCES [dbo].[ComplaintStatuses] ([StatusId])
GO
ALTER TABLE [dbo].[Customers]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Customers]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CustomerServiceRequests]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CustomerServiceRequests]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CustomerServiceRequests]  WITH CHECK ADD FOREIGN KEY([LinkedComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[CustomerServiceRequests]  WITH CHECK ADD FOREIGN KEY([LinkedComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[MenuItems]  WITH CHECK ADD FOREIGN KEY([ParentMenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[MenuItems]  WITH CHECK ADD FOREIGN KEY([ParentMenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[ProductImages]  WITH CHECK ADD FOREIGN KEY([ProductId])
REFERENCES [dbo].[Products] ([ProductId])
GO
ALTER TABLE [dbo].[ProductImages]  WITH CHECK ADD FOREIGN KEY([ProductId])
REFERENCES [dbo].[Products] ([ProductId])
GO
ALTER TABLE [dbo].[Products]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Products]  WITH CHECK ADD FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([MenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([MenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([SparePartId])
REFERENCES [dbo].[SpareParts] ([SparePartId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([SparePartId])
REFERENCES [dbo].[SpareParts] ([SparePartId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[SparePartRequests]  WITH CHECK ADD  CONSTRAINT [FK_SparePartRequests_SpareParts] FOREIGN KEY([SparePartId])
REFERENCES [dbo].[SpareParts] ([SparePartId])
GO
ALTER TABLE [dbo].[SparePartRequests] CHECK CONSTRAINT [FK_SparePartRequests_SpareParts]
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([AssignedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([AssignedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[TechnicianAssignments]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[TechnicianAttendance]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[TechnicianAttendance]  WITH CHECK ADD FOREIGN KEY([TechnicianId])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[TechnicianProfiles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[TechnicianProfiles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Technicians]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Technicians]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([ComplaintId])
REFERENCES [dbo].[Complaints] ([ComplaintId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([ReturnedBy])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([ReturnedBy])
REFERENCES [dbo].[Technicians] ([TechnicianId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([SparePartId])
REFERENCES [dbo].[SpareParts] ([SparePartId])
GO
ALTER TABLE [dbo].[WarrantyReturns]  WITH CHECK ADD FOREIGN KEY([SparePartId])
REFERENCES [dbo].[SpareParts] ([SparePartId])
GO
/****** Object:  StoredProcedure [dbo].[sp_AddComplaintAttachment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- COMPLAINT ATTACHMENTS
-- ============================================
CREATE PROCEDURE [dbo].[sp_AddComplaintAttachment]
    @ComplaintId INT,
    @FileName NVARCHAR(200),
    @FilePath NVARCHAR(500),
    @FileType NVARCHAR(50),
    @FileSize BIGINT = NULL,
    @UploadedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ComplaintAttachments (ComplaintId, [FileName], FilePath, FileType, FileSize, UploadedBy, CreatedAt)
    VALUES (@ComplaintId, @FileName, @FilePath, @FileType, @FileSize, @UploadedBy, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT SCOPE_IDENTITY() AS AttachmentId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_AddComplaintNote]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- COMPLAINT NOTES / COMMENTS
-- ============================================
CREATE PROCEDURE [dbo].[sp_AddComplaintNote]
    @ComplaintId INT,
    @NoteText NVARCHAR(2000),
    @NoteType NVARCHAR(20) = 'Internal',  -- Internal, Customer, System
    @CreatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ComplaintNotes (ComplaintId, NoteText, NoteType, CreatedBy, CreatedAt)
    VALUES (@ComplaintId, @NoteText, @NoteType, @CreatedBy, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT SCOPE_IDENTITY() AS NoteId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_AddUPIConfiguration]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_AddUPIConfiguration]
    @UpiId VARCHAR(100),
    @DisplayName NVARCHAR(100),
    @CreatedBy INT
AS
BEGIN
    DECLARE @IsDefault BIT = 0;
    -- If it's the first one, make it default
    IF NOT EXISTS (SELECT 1 FROM [dbo].[UPIConfigurations])
        SET @IsDefault = 1;

    INSERT INTO [dbo].[UPIConfigurations] (UpiId, DisplayName, IsDefault, CreatedBy)
    VALUES (@UpiId, @DisplayName, @IsDefault, @CreatedBy);

    SELECT 1 AS Success, 'UPI configuration added successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Assignment_GetActive]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 3: Get Active Assignments (with schedule info)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Assignment_GetActive]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ta.AssignmentId, ta.ComplaintId, c.ComplaintNumber,
        c.Subject AS ComplaintSubject, u.FullName AS TechnicianName,
        ta.AssignmentRole, ta.Status, ta.AssignedAt,
        cu.CustomerName, cu.MobileNumber AS CustomerPhone,
        ta.ScheduledDate, ta.StartTime, ta.EndTime, ta.Notes, ta.Priority
    FROM TechnicianAssignments ta
    INNER JOIN Complaints c ON ta.ComplaintId=c.ComplaintId
    INNER JOIN Technicians t ON ta.TechnicianId=t.TechnicianId
    INNER JOIN Users u ON t.UserId=u.UserId
    INNER JOIN Customers cu ON c.CustomerId=cu.CustomerId
    WHERE ta.Status IN ('Assigned','InProgress')
    ORDER BY
        CASE WHEN ta.ScheduledDate IS NOT NULL THEN 0 ELSE 1 END,
        ta.ScheduledDate, ta.AssignedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Assignment_UpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Assignment_UpdateStatus]
    @AssignmentId      INT,
    @Status            NVARCHAR(30),
    @UpdatedBy         INT,
    @Remarks           NVARCHAR(500)  = NULL,
    @WorkDone          NVARCHAR(1000) = NULL,
    @PartsUsed         NVARCHAR(500)  = NULL,
    @CustomerFeedback  NVARCHAR(500)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate assignment exists and is not closed
    IF NOT EXISTS (
        SELECT 1 FROM TechnicianAssignments
        WHERE AssignmentId = @AssignmentId
          AND Status NOT IN ('Removed', 'Completed')
    )
    BEGIN
        SELECT 0 AS Result, 'Assignment not found or already closed' AS [Message];
        RETURN;
    END

    DECLARE @ComplaintId  INT;
    DECLARE @TechnicianId INT;
    DECLARE @OldStatus    NVARCHAR(30);

    SELECT @ComplaintId  = ComplaintId,
           @TechnicianId = TechnicianId,
           @OldStatus    = Status
    FROM   TechnicianAssignments
    WHERE  AssignmentId = @AssignmentId;

    -- ── Update assignment status + completion details ────────
    UPDATE TechnicianAssignments
    SET Status             = @Status,
        CompletedAt        = CASE WHEN @Status = 'Completed' THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE CompletedAt END,
        WorkDone           = CASE WHEN @Status = 'Completed' THEN @WorkDone ELSE WorkDone END,
        PartsUsed          = CASE WHEN @Status = 'Completed' THEN @PartsUsed ELSE PartsUsed END,
        CustomerFeedback   = CASE WHEN @Status = 'Completed' THEN @CustomerFeedback ELSE CustomerFeedback END,
        CompletionRemarks  = CASE WHEN @Status = 'Completed' THEN @Remarks ELSE CompletionRemarks END,
        UpdatedAt          = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE AssignmentId = @AssignmentId;

    -- ── Audit log ────────────────────────────────────────────
    INSERT INTO AssignmentAuditLog
        (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
    SELECT
        @AssignmentId, @ComplaintId,
        CASE @Status 
            WHEN 'Completed'  THEN 'Completed' 
            WHEN 'InProgress' THEN 'InProgress'
            ELSE 'Modified' 
        END,
        @TechnicianId, AssignmentRole,
        @UpdatedBy,
        ISNULL(@Remarks, 'Status changed to ' + @Status)
    FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;

    -- ── InProgress: update complaint status from New → InProgress ─
    IF @Status = 'InProgress'
    BEGIN
        UPDATE Complaints
        SET StatusId     = 3,    -- InProgress
            AssignedDate = ISNULL(AssignedDate, DATEADD(MINUTE, 330, GETUTCDATE())),
            UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId = @ComplaintId
          AND StatusId IN (1, 2);  -- from New or Assigned
    END

    -- ── Completed: handle technician + complaint status ──────
    IF @Status = 'Completed'
    BEGIN
        -- Increment completed jobs
        UPDATE TechnicianProfiles
        SET TotalCompletedJobs = ISNULL(TotalCompletedJobs, 0) + 1
        WHERE UserId = (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId);

        -- Free technician if no other active assignments remain
        IF NOT EXISTS (
            SELECT 1 FROM TechnicianAssignments
            WHERE TechnicianId = @TechnicianId
              AND Status NOT IN ('Removed', 'Completed')
              AND AssignmentId <> @AssignmentId
        )
        BEGIN
            UPDATE TechnicianProfiles
            SET AvailabilityStatus = 1  -- Available
            WHERE UserId = (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId);
        END

        -- If ALL assignments for this complaint are done → resolve complaint
        IF NOT EXISTS (
            SELECT 1 FROM TechnicianAssignments
            WHERE ComplaintId = @ComplaintId
              AND Status NOT IN ('Removed', 'Completed')
        )
        BEGIN
            UPDATE Complaints
            SET StatusId     = 5,          -- Resolved
                ResolvedDate = DATEADD(MINUTE, 330, GETUTCDATE()),
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId
              AND StatusId IN (2, 3);      -- from Assigned or InProgress
        END
    END

    SELECT 1 AS Result, 'Status updated to ' + @Status AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_AssignTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- TECHNICIAN ASSIGNMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_AssignTechnician]
    @ComplaintId INT,
    @TechnicianId INT,
    @AssignmentRole NVARCHAR(20),
    @AssignedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @AssignmentId INT;
    
    INSERT INTO TechnicianAssignments (ComplaintId, TechnicianId, AssignmentRole, AssignedBy)
    VALUES (@ComplaintId, @TechnicianId, @AssignmentRole, @AssignedBy);
    
    SET @AssignmentId = SCOPE_IDENTITY();
    
    -- Log audit
    INSERT INTO AssignmentAuditLog (AssignmentId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
    VALUES (@AssignmentId, 'Created', @TechnicianId, @AssignmentRole, @AssignedBy, 'Initial assignment');
    
    -- Update complaint status
    IF NOT EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId = @ComplaintId AND StatusId > 1)
    BEGIN
        UPDATE Complaints SET StatusId = 2, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;
        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        VALUES (@ComplaintId, 2, 'Technician assigned', @AssignedBy);
    END
    
    SELECT @AssignmentId AS AssignmentId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_GenerateOtp]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Auth_GenerateOtp]
    @MobileNumber NVARCHAR(15),
    @Purpose NVARCHAR(50) = 'Login'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @OtpCode NVARCHAR(6) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS NVARCHAR(6)), 6);
    DECLARE @ResendCount INT;
    SELECT @ResendCount = COUNT(*) FROM OtpLog WHERE MobileNumber = @MobileNumber AND CreatedAt > DATEADD(HOUR, -1, DATEADD(MINUTE, 330, GETUTCDATE()));
    IF @ResendCount >= 5
    BEGIN
        SELECT 0 AS Success, 'Too many OTP requests. Try after 1 hour.' AS Message, NULL AS OtpCode;
        RETURN;
    END
    UPDATE OtpLog SET IsUsed = 1 WHERE MobileNumber = @MobileNumber AND IsUsed = 0;
    INSERT INTO OtpLog (MobileNumber, OtpCode, Purpose, ExpiresAt)
    VALUES (@MobileNumber, @OtpCode, @Purpose, DATEADD(MINUTE, 5, DATEADD(MINUTE, 330, GETUTCDATE())));
    SELECT 1 AS Success, 'OTP sent successfully.' AS Message, @OtpCode AS OtpCode;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_GetMenusByRole]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Auth_GetMenusByRole]
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MenuId, m.MenuName, m.MenuIcon, m.RouterLink, m.ParentMenuId, m.DisplayOrder, m.IsActive,
           pm.MenuName AS ParentMenuName
    FROM RoleMenuMapping rmm
    JOIN Menus m ON rmm.MenuId = m.MenuId
    LEFT JOIN Menus pm ON m.ParentMenuId = pm.MenuId
    WHERE rmm.RoleId = @RoleId AND m.IsActive = 1
    ORDER BY m.DisplayOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_GetUserProfile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Auth_GetUserProfile]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.MobileNumber, u.Email, u.RoleId, r.RoleName, u.IsActive, u.LastLoginAt, u.CreatedAt,
           c.CustomerId, c.Address, c.City, c.[State], c.PinCode,
           t.TechnicianId, t.Specialization, t.SkillLevel, t.Zone
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN Customers c ON u.UserId = c.UserId
    LEFT JOIN Technicians t ON u.UserId = t.UserId
    WHERE u.UserId = @UserId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_Login]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Auth_Login]
    @Email NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;

    -- RESULT SET 1: User + password hash + TechnicianId
    SELECT 
        u.UserId, u.FullName, u.Email,
        u.MobileNumber, u.PasswordHash,
        r.RoleName AS Role, r.RoleId,
        t.TechnicianId  -- NULL for non-technicians
    FROM Users u
    INNER JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN Technicians t ON t.UserId = u.UserId
    WHERE u.Email = @Email AND u.IsActive = 1;

    -- RESULT SET 2: Menus filtered by user's role + permissions
    SELECT 
        m.MenuId, m.MenuName, m.MenuPath,
        m.Icon, m.ParentMenuId, m.SortOrder,
        rma.CanView, rma.CanCreate,
        rma.CanEdit, rma.CanDelete
    FROM MenuItems m
    INNER JOIN Users u ON u.Email = @Email AND u.IsActive = 1
    INNER JOIN RoleMenuAccess rma 
        ON rma.MenuId = m.MenuId AND rma.RoleId = u.RoleId
    WHERE m.IsActive = 1 AND rma.CanView = 1 and m.module = 'Services'
    ORDER BY m.SortOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_Register]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Auth_Register]
    @FullName NVARCHAR(100),
    @MobileNumber NVARCHAR(15),
    @Email NVARCHAR(200) = NULL,
    @PasswordHash NVARCHAR(500) = NULL,
    @RoleId INT,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @UserId INT OUTPUT   -- 🔥 ADD THIS (VERY IMPORTANT)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Default output
        SET @UserId = 0;

        -- Check duplicate mobile
        IF EXISTS (SELECT 1 FROM Users WHERE MobileNumber = @MobileNumber)
        BEGIN
            ROLLBACK;
            RETURN;
        END

        -- Check duplicate email
        IF @Email IS NOT NULL 
           AND EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
        BEGIN
            ROLLBACK;
            RETURN;
        END

        -- Insert user
        INSERT INTO Users 
        (
            FullName,
            MobileNumber,
            Email,
            PasswordHash,
            RoleId,
            IsActive,
            CreatedAt
        )
        VALUES
        (
            @FullName,
            @MobileNumber,
            @Email,
            @PasswordHash,
            @RoleId,
            1,
            DATEADD(MINUTE, 330, GETUTCDATE())
        );

        SET @UserId = SCOPE_IDENTITY();  -- 🔥 Set OUTPUT value

        -- Create Customer
        IF EXISTS (SELECT 1 FROM Roles WHERE RoleId = @RoleId AND RoleName = 'Customer')
        BEGIN
            INSERT INTO Customers
            (UserId, CustomerName, MobileNumber, Email, Address, City, [State], PinCode, CreatedAt)
            VALUES
            (@UserId, @FullName, @MobileNumber, @Email, @Address, @City, @State, @PinCode, DATEADD(MINUTE, 330, GETUTCDATE()));
        END

        -- Create Technician
        IF EXISTS (SELECT 1 FROM Roles WHERE RoleId = @RoleId AND RoleName = 'Technician')
        BEGIN
            INSERT INTO Technicians (UserId, IsActive, CreatedAt)
            VALUES (@UserId, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
        END

        COMMIT;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SET @UserId = 0; -- important for API failure handling
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_UpdateProfile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Auth_UpdateProfile]
    @UserId INT,
    @FullName NVARCHAR(100) = NULL,
    @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users SET FullName = ISNULL(@FullName, FullName), Email = ISNULL(@Email, Email), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE UserId = @UserId;
    IF EXISTS (SELECT 1 FROM Customers WHERE UserId = @UserId)
    BEGIN
        UPDATE Customers SET CustomerName = ISNULL(@FullName, CustomerName), Email = ISNULL(@Email, Email),
            Address = ISNULL(@Address, Address), City = ISNULL(@City, City), [State] = ISNULL(@State, [State]),
            PinCode = ISNULL(@PinCode, PinCode), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE UserId = @UserId;
    END
    SELECT 1 AS Success, 'Profile updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_ValidateOtp]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE    PROCEDURE [dbo].[sp_Auth_ValidateOtp]
    @MobileNumber NVARCHAR(15),
    @OtpCode NVARCHAR(6)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IsValid BIT = 0, @UserId INT, @RoleId INT, @RoleName NVARCHAR(50), @FullName NVARCHAR(100), @IsActive BIT;

    IF EXISTS (
        SELECT 1 FROM OtpLog WHERE MobileNumber = @MobileNumber AND OtpCode = @OtpCode AND IsUsed = 0 AND ExpiresAt > GETUTCDATE()
    )
    BEGIN
        SET @IsValid = 1;
        UPDATE OtpLog SET IsUsed = 1 WHERE MobileNumber = @MobileNumber AND OtpCode = @OtpCode;
        SELECT @UserId = u.UserId, @RoleId = u.RoleId, @FullName = u.FullName, @IsActive = u.IsActive, @RoleName = r.RoleName
        FROM Users u JOIN Roles r ON u.RoleId = r.RoleId WHERE u.MobileNumber = @MobileNumber;
        IF @UserId IS NOT NULL
            UPDATE Users SET LastLoginAt = GETUTCDATE() WHERE UserId = @UserId;
    END
    SELECT @IsValid AS IsValid, @UserId AS UserId, @FullName AS FullName, @RoleId AS RoleId, @RoleName AS RoleName, @IsActive AS IsActive;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CancelSchedule]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_CancelSchedule]
    @ScheduleId INT,
    @CancelledBy INT,
    @Reason NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE TechnicianSchedule 
    SET Status = 'Cancelled', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ScheduleId = @ScheduleId;
    
    SELECT 1 AS Success, 'Schedule cancelled successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CloseComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_CloseComplaint]
    @ComplaintId INT,
    @Remarks NVARCHAR(500) = NULL,
    @ClosedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ClosedStatusId INT;
    SELECT @ClosedStatusId = StatusId FROM ComplaintStatuses WHERE StatusName = 'Closed';
    
    UPDATE Complaints 
    SET StatusId = @ClosedStatusId, 
        ClosedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;
    
    -- Complete all active assignments
    UPDATE TechnicianAssignments 
    SET Status = 'Completed', CompletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId AND Status NOT IN ('Completed', 'Cancelled');
    
    -- Timeline
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    VALUES (@ComplaintId, @ClosedStatusId, ISNULL(@Remarks, 'Complaint closed'), @ClosedBy);
    
    SELECT 1 AS Success, 'Complaint closed successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_AcceptInvitation]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Company_AcceptInvitation]
    @Token UNIQUEIDENTIFIER,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @InvitationId INT, @CompanyId INT, @RoleInCompany NVARCHAR(50);
    DECLARE @ExistingRecordId INT;
    
    -- Get invitation details
    SELECT 
        @InvitationId = InvitationId,
        @CompanyId = CompanyId,
        @RoleInCompany = RoleInCompany
    FROM [dbo].[CompanyInvitations]
    WHERE Token = @Token AND Status = 'Pending' AND ExpiresAt > DATEADD(MINUTE, 330, GETUTCDATE());
    
    IF @InvitationId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Invalid or expired invitation.' AS Message;
        RETURN;
    END
    
    -- Verify user email matches invitation
    DECLARE @UserEmail NVARCHAR(200);
    SELECT @UserEmail = Email FROM [dbo].[Users] WHERE UserId = @UserId;
    
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CompanyInvitations] WHERE InvitationId = @InvitationId AND Email = @UserEmail)
    BEGIN
        SELECT 0 AS Success, 'This invitation is not for your email address.' AS Message;
        RETURN;
    END
    
    -- Check if user already has a record in CompanyUsers for this company
    SELECT @ExistingRecordId = CompanyUserId
    FROM [dbo].[CompanyUsers]
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    
    IF @ExistingRecordId IS NOT NULL
    BEGIN
        -- Record exists - reactivate it and update role
        UPDATE [dbo].[CompanyUsers]
        SET IsActive = 1,
            RoleInCompany = @RoleInCompany,
            AssignedBy = @UserId,
            AssignedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE CompanyUserId = @ExistingRecordId;
    END
    ELSE
    BEGIN
        -- No record exists - create new
        INSERT INTO [dbo].[CompanyUsers] (CompanyId, UserId, RoleInCompany, AssignedBy, AssignedAt)
        VALUES (@CompanyId, @UserId, @RoleInCompany, @UserId, DATEADD(MINUTE, 330, GETUTCDATE()));
    END

    -- Handle Technician specific records if role is Technician
    IF @RoleInCompany = 'Technician'
    BEGIN
        -- 1. Ensure RoleId in Users table is Technician (3) if it's currently a lower role
        -- We only update if they are currently a basic User (7) or Speed user (9) 
        -- to avoid downgrading Admins/Managers.
        UPDATE [dbo].[Users] 
        SET RoleId = 3 
        WHERE UserId = @UserId AND RoleId IN (7, 9);

        -- 2. Create TechnicianProfile if missing (General Profile)
        IF NOT EXISTS (SELECT 1 FROM [dbo].[TechnicianProfiles] WHERE UserId = @UserId)
        BEGIN
            DECLARE @LastCode INT = 0;
            SELECT @LastCode = ISNULL(MAX(
                TRY_CAST(REPLACE(EmployeeCode, 'EMP-', '') AS INT)
            ), 0) FROM TechnicianProfiles WHERE EmployeeCode LIKE 'EMP-%';

            DECLARE @NewCode NVARCHAR(20) = 'EMP-' + RIGHT('000' + CAST(@LastCode + 1 AS VARCHAR), 3);

            INSERT INTO [dbo].[TechnicianProfiles] (
                UserId, EmployeeCode, Specialization, ExperienceYears,
                CertificationDetails, MaxDailyAssignments, JoinDate, IsActive, AvailabilityStatus
            )
            VALUES (
                @UserId, @NewCode, 'General', 0,
                NULL, 5, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE), 1, 1
            );
        END

        -- 3. Create Technicians record for this specific Company if missing
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Technicians] WHERE UserId = @UserId AND CompanyId = @CompanyId)
        BEGIN
             INSERT INTO [dbo].[Technicians] (UserId, CompanyId, Specialization, IsAvailable, IsActive, CreatedAt)
             VALUES (@UserId, @CompanyId, 'General', 1, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
        END
        ELSE
        BEGIN
            -- Reactivate if exists but inactive
            UPDATE [dbo].[Technicians] SET IsActive = 1 WHERE UserId = @UserId AND CompanyId = @CompanyId;
        END
    END
    
    -- Update invitation status to Accepted
    UPDATE [dbo].[CompanyInvitations] 
    SET Status = 'Accepted', 
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) 
    WHERE InvitationId = @InvitationId;

    SELECT 1 AS Success, 
           'You have been successfully linked to the company.' AS Message, 
           @CompanyId AS CompanyId, 
           @RoleInCompany AS RoleInCompany;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Company_ApproveRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Approve join request
CREATE PROCEDURE [dbo].[sp_Company_ApproveRequest]
    @RequestId INT,
    @CompanyId INT,
    @ReviewedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @UserId INT, @RequestedRole NVARCHAR(50);
    
    SELECT @UserId = UserId, @RequestedRole = RequestedRole
    FROM [dbo].[CompanyJoinRequests]
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId;
    
    IF @UserId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Request not found.' AS Message;
        RETURN;
    END
    
    -- Add user to company
    INSERT INTO [dbo].[CompanyUsers] (CompanyId, UserId, RoleInCompany, AssignedBy, AssignedAt)
    VALUES (@CompanyId, @UserId, @RequestedRole, @ReviewedBy, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    -- Update request status
    UPDATE [dbo].[CompanyJoinRequests]
    SET Status = 'Approved', ReviewedBy = @ReviewedBy, ReviewedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId = @RequestId;
    
    SELECT 1 AS Success, 'Request approved. User added to company.' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_CancelInvitation]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Cancel invitation
CREATE PROCEDURE [dbo].[sp_Company_CancelInvitation]
    @InvitationId INT,
    @CancelledBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[CompanyInvitations]
    SET Status = 'Cancelled',
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE InvitationId = @InvitationId;
    
    SELECT @@ROWCOUNT AS CancelledCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_Company_Create]
    @CompanyName NVARCHAR(200),
    @CompanyCode NVARCHAR(20),
    @CreatedBy INT,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @PhoneNumber NVARCHAR(20) = NULL,
    @Email NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Company creation is currently disabled
    SELECT 0 AS Success, 'Company creation is currently disabled. Please contact support.' AS Message, NULL AS CompanyId;
    RETURN;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_CreateJoinRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Create join request (User requests to join company)
CREATE PROCEDURE [dbo].[sp_Company_CreateJoinRequest]
    @UserId INT,
    @CompanyId INT,
    @RequestedRole NVARCHAR(50),
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if user already has a pending request
    IF EXISTS (SELECT 1 FROM [dbo].[CompanyJoinRequests] 
               WHERE UserId = @UserId AND CompanyId = @CompanyId AND Status = 'Pending')
    BEGIN
        SELECT 0 AS Success, 'You already have a pending request for this company.' AS Message, NULL AS RequestId;
        RETURN;
    END
    
    -- Check if user is already a member of this company
    IF EXISTS (SELECT 1 FROM [dbo].[CompanyUsers] 
               WHERE UserId = @UserId AND CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT 0 AS Success, 'You are already a member of this company.' AS Message, NULL AS RequestId;
        RETURN;
    END
    
    INSERT INTO [dbo].[CompanyJoinRequests] (UserId, CompanyId, RequestedRole, Remarks, RequestedAt)
    VALUES (@UserId, @CompanyId, @RequestedRole, @Remarks, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'Join request sent successfully.' AS Message, SCOPE_IDENTITY() AS RequestId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetAllCompanies]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Get all companies (for user to request join)
CREATE   PROCEDURE [dbo].[sp_Company_GetAllCompanies]
    @UserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        c.City,
        c.IsActive,
        CASE 
            WHEN cu.UserId IS NOT NULL THEN 'Member'
            WHEN jr.UserId IS NOT NULL AND jr.Status = 'Pending' THEN 'Requested'
            ELSE 'Available'
        END AS UserStatus
    FROM [dbo].[Companies] c
    LEFT JOIN [dbo].[CompanyUsers] cu ON c.CompanyId = cu.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    LEFT JOIN [dbo].[CompanyJoinRequests] jr ON c.CompanyId = jr.CompanyId AND jr.UserId = @UserId AND jr.Status = 'Pending'
    WHERE c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetPendingInvitations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Get pending invitations for a company
CREATE   PROCEDURE [dbo].[sp_Company_GetPendingInvitations]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        CI.InvitationId,
        CI.Email,
        CI.RoleInCompany,
        CI.Status,
        CI.ExpiresAt,
        CI.CreatedAt,
        ISNULL(u.FullName, 'System') AS CreatedByName
    FROM [dbo].[CompanyInvitations] CI
    LEFT JOIN [dbo].[Users] u ON CI.CreatedBy = u.UserId
    WHERE CompanyId = @CompanyId AND Status = 'Pending'
    ORDER BY CI.CreatedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetPendingRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Get pending join requests for a company (Admin view)
CREATE   PROCEDURE [dbo].[sp_Company_GetPendingRequests]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        r.RequestId,
        r.UserId,
        u.FullName AS UserName,
        u.Email AS UserEmail,
        u.MobileNumber,
        r.RequestedRole,
        r.Remarks,
        r.RequestedAt,
        r.Status
    FROM [dbo].[CompanyJoinRequests] r
    INNER JOIN [dbo].[Users] u ON r.UserId = u.UserId
    WHERE r.CompanyId = @CompanyId AND r.Status = 'Pending'
    ORDER BY r.RequestedAt ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetUsers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_Company_GetUsers]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        cu.RoleInCompany,
        cu.AssignedAt,
        assignedBy.FullName AS AssignedByName
    FROM [dbo].[CompanyUsers] cu
    INNER JOIN [dbo].[Users] u ON cu.UserId = u.UserId
    LEFT JOIN [dbo].[Users] assignedBy ON cu.AssignedBy = assignedBy.UserId
    WHERE cu.CompanyId = @CompanyId AND cu.IsActive = 1
    ORDER BY cu.AssignedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetUsersWithDetails]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- 1. COMPANY USERS MANAGEMENT
-- ============================================

-- Get all users in a company with details
CREATE   PROCEDURE [dbo].[sp_Company_GetUsersWithDetails]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cu.CompanyUserId,
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        cu.RoleInCompany,
        cu.AssignedAt,
        ISNULL(assignedBy.FullName, 'System') AS AssignedBy,
        cu.IsActive
    FROM [dbo].[CompanyUsers] cu
    INNER JOIN [dbo].[Users] u ON cu.UserId = u.UserId
    LEFT JOIN [dbo].[Users] assignedBy ON cu.AssignedBy = assignedBy.UserId
    WHERE cu.CompanyId = @CompanyId AND cu.IsActive = 1
    ORDER BY cu.AssignedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_InviteUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Company_InviteUser]
    @CompanyId INT,
    @Email NVARCHAR(200),
    @RoleInCompany NVARCHAR(50),
    @InvitedBy INT,
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if user exists with this email
    DECLARE @ExistingUserId INT;
    SELECT @ExistingUserId = UserId FROM [dbo].[Users] WHERE Email = @Email AND IsActive = 1;
    
    IF @ExistingUserId IS NULL
    BEGIN
        SELECT 0 AS Success, 'User with email ' + @Email + ' not found. User must self-register first.' AS Message, NULL AS InvitationId;
        RETURN;
    END
    
    -- Check if user already linked to this company
    IF EXISTS (SELECT 1 FROM [dbo].[CompanyUsers] WHERE CompanyId = @CompanyId AND UserId = @ExistingUserId AND IsActive = 1)
    BEGIN
        SELECT 0 AS Success, 'User is already linked to this company.' AS Message, NULL AS InvitationId;
        RETURN;
    END
    
    -- Check for pending invitation
    IF EXISTS (SELECT 1 FROM [dbo].[CompanyInvitations] WHERE CompanyId = @CompanyId AND Email = @Email AND Status = 'Pending')
    BEGIN
        SELECT 0 AS Success, 'Invitation already pending for this user.' AS Message, NULL AS InvitationId;
        RETURN;
    END
    
    -- Create invitation (expires in 7 days)
    INSERT INTO [dbo].[CompanyInvitations] (CompanyId, Email, RoleInCompany, ExpiresAt, CreatedBy, Remarks)
    VALUES (@CompanyId, @Email, @RoleInCompany, DATEADD(DAY, 7, DATEADD(MINUTE, 330, GETUTCDATE())), @InvitedBy, @Remarks);
    
    SELECT 1 AS Success, 'Invitation sent successfully.' AS Message, SCOPE_IDENTITY() AS InvitationId, @ExistingUserId AS UserId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RejectInvitation]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================
-- STORED PROCEDURE: sp_Company_RejectInvitation
-- Description: User rejects a company invitation
-- ============================================
CREATE PROCEDURE [dbo].[sp_Company_RejectInvitation]
    @InvitationId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if invitation exists and is pending
        IF NOT EXISTS (
            SELECT 1 FROM [dbo].[CompanyInvitations] 
            WHERE InvitationId = @InvitationId AND Status = 'Pending'
        )
        BEGIN
            SELECT 0 AS Success, 'Invitation not found or already processed.' AS Message;
            RETURN;
        END
        
        -- Verify the invitation belongs to this user
        DECLARE @InvitationEmail NVARCHAR(200);
        DECLARE @UserEmail NVARCHAR(200);
        
        SELECT @InvitationEmail = Email FROM [dbo].[CompanyInvitations] WHERE InvitationId = @InvitationId;
        SELECT @UserEmail = Email FROM [dbo].[Users] WHERE UserId = @UserId;
        
        IF @InvitationEmail != @UserEmail
        BEGIN
            SELECT 0 AS Success, 'This invitation is not for your email address.' AS Message;
            RETURN;
        END
        
        -- Update status to Rejected
        UPDATE [dbo].[CompanyInvitations]
        SET Status = 'Rejected',
            UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE InvitationId = @InvitationId;
        
        SELECT 1 AS Success, 'Invitation rejected successfully.' AS Message;
        
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RejectRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Reject join request
CREATE PROCEDURE [dbo].[sp_Company_RejectRequest]
    @RequestId INT,
    @CompanyId INT,
    @ReviewedBy INT,
    @RejectionReason NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[CompanyJoinRequests]
    SET Status = 'Rejected', 
        ReviewedBy = @ReviewedBy, 
        ReviewedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        RejectionReason = @RejectionReason
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId;
    
    SELECT 1 AS Success, 'Request rejected.' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RemoveUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Remove user from company
CREATE PROCEDURE [dbo].[sp_Company_RemoveUser]
    @CompanyId INT,
    @UserId INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[CompanyUsers]
    SET IsActive = 0,
        AssignedBy = @RemovedBy,
        AssignedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    
    SELECT @@ROWCOUNT AS RemovedCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_UpdateUserRole]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- sp_Company_UpdateUserRole (Simpler Version)
-- =============================================
CREATE PROCEDURE [dbo].[sp_Company_UpdateUserRole]
    @CompanyId INT,
    @UserId INT,
    @NewRole NVARCHAR(50),
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @GlobalRoleId INT;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update role in CompanyUsers table
        UPDATE [dbo].[CompanyUsers]
        SET RoleInCompany = @NewRole,
            AssignedBy = @UpdatedBy,
            AssignedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;
        
        -- Get RoleId for the new role
        SELECT @GlobalRoleId = RoleId 
        FROM [dbo].[Roles] 
        WHERE RoleName = @NewRole;
        
        -- Update global role if this is the user's only company
        IF @GlobalRoleId IS NOT NULL
        BEGIN
            DECLARE @CompanyCount INT;
            SELECT @CompanyCount = COUNT(*) 
            FROM [dbo].[CompanyUsers] 
            WHERE UserId = @UserId AND IsActive = 1;
            
            -- If user has only ONE company, update global role
            IF @CompanyCount = 1
            BEGIN
                UPDATE [dbo].[Users]
                SET RoleId = @GlobalRoleId,
                    UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE UserId = @UserId;
            END
        END
        
        COMMIT TRANSACTION;
        
        SELECT 1 AS Success, @@ROWCOUNT AS UpdatedCount;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        SELECT 0 AS Success, ERROR_MESSAGE() AS ErrorMessage;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_AddAttachment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_AddAttachment]
    @ComplaintId INT, @FileName NVARCHAR(200), @FilePath NVARCHAR(500), @FileType NVARCHAR(50), @FileSize BIGINT = NULL, @UploadedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO ComplaintAttachments (ComplaintId, [FileName], FilePath, FileType, FileSize, UploadedBy, CreatedAt)
    VALUES (@ComplaintId, @FileName, @FilePath, @FileType, @FileSize, @UploadedBy, DATEADD(MINUTE, 330, GETUTCDATE()));
    SELECT SCOPE_IDENTITY() AS AttachmentId, 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_AddNote]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_AddNote]
    @ComplaintId INT, @NoteText NVARCHAR(2000), @NoteType NVARCHAR(20) = 'Internal', @CreatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO ComplaintNotes (ComplaintId, NoteText, NoteType, CreatedBy, CreatedAt) VALUES (@ComplaintId, @NoteText, @NoteType, @CreatedBy, DATEADD(MINUTE, 330, GETUTCDATE()));
    SELECT SCOPE_IDENTITY() AS NoteId, 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_AssignTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 1: Assign Technician (with schedule + multi-assign)
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Complaint_AssignTechnician]
    @ComplaintId       INT,
    @TechnicianId      INT,
    @AssignmentRole    NVARCHAR(20),
    @AssignedBy        INT,
    @Priority          NVARCHAR(20) = NULL,
    @Notes             NVARCHAR(500) = NULL,
    @ScheduledDate     DATE = NULL,
    @StartTime         NVARCHAR(10) = NULL,
    @EndTime           NVARCHAR(10) = NULL,
    @EstimatedDuration INT = NULL,
    @TimeSlot          NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM TechnicianAssignments
        WHERE ComplaintId=@ComplaintId AND TechnicianId=@TechnicianId AND Status NOT IN ('Removed','Completed'))
    BEGIN
        SELECT -1 AS AssignmentId, 'This technician is already assigned to this complaint' AS [Message];
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId=@ComplaintId)
    BEGIN
        SELECT -2 AS AssignmentId, 'Complaint not found' AS [Message];
        RETURN;
    END

    INSERT INTO TechnicianAssignments (ComplaintId, TechnicianId, AssignmentRole, AssignedBy,
        ScheduledDate, StartTime, EndTime, EstimatedDuration, TimeSlot, Notes, Priority)
    VALUES (@ComplaintId, @TechnicianId, @AssignmentRole, @AssignedBy,
        @ScheduledDate, @StartTime, @EndTime, @EstimatedDuration, @TimeSlot, @Notes, @Priority);

    DECLARE @NewId INT = SCOPE_IDENTITY();

    DECLARE @Remark NVARCHAR(500) = 'Assigned as ' + @AssignmentRole;
    IF @ScheduledDate IS NOT NULL
        SET @Remark += ' | Scheduled: ' + CONVERT(NVARCHAR,@ScheduledDate,106) + ISNULL(' '+@StartTime+'-'+@EndTime,'');

    INSERT INTO AssignmentAuditLog (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
    VALUES (@NewId, @ComplaintId, 'Created', @TechnicianId, @AssignmentRole, @AssignedBy, @Remark);

    UPDATE TechnicianProfiles SET AvailabilityStatus=2
    WHERE UserId=(SELECT UserId FROM Technicians WHERE TechnicianId=@TechnicianId);

    IF EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId=@ComplaintId AND StatusId=1)
        UPDATE Complaints SET StatusId=2, UpdatedAt=DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId=@ComplaintId;

    IF @Priority IS NOT NULL
        UPDATE Complaints SET Priority=@Priority, UpdatedAt=DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId=@ComplaintId;

    SELECT @NewId AS AssignmentId, 'Technician assigned successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_CompleteAssignment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 2: Complete Assignment (free all techs when complaint done)
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Complaint_CompleteAssignment]
    @AssignmentId INT,
    @CompletedBy  INT,
    @Remarks      NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TechnicianId INT, @ComplaintId INT;
    SELECT @TechnicianId=TechnicianId, @ComplaintId=ComplaintId
    FROM TechnicianAssignments WHERE AssignmentId=@AssignmentId;

    IF @TechnicianId IS NULL
    BEGIN SELECT -1 AS Result, 'Assignment not found' AS [Message]; RETURN; END

    UPDATE TechnicianAssignments SET Status='Completed', CompletedAt=DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE AssignmentId=@AssignmentId;

    INSERT INTO AssignmentAuditLog (AssignmentId, ComplaintId, Action, NewTechnicianId, ChangedBy, Remarks)
    VALUES (@AssignmentId, @ComplaintId, 'Completed', @TechnicianId, @CompletedBy, ISNULL(@Remarks,'Work completed'));

    -- Free THIS tech if no other active work
    IF NOT EXISTS (SELECT 1 FROM TechnicianAssignments
        WHERE TechnicianId=@TechnicianId AND Status IN ('Assigned','InProgress') AND AssignmentId!=@AssignmentId)
    BEGIN
        UPDATE TechnicianProfiles SET AvailabilityStatus=1
        WHERE UserId=(SELECT UserId FROM Technicians WHERE TechnicianId=@TechnicianId);
    END

    -- If ALL assignments for this complaint are done, free ALL techs + resolve complaint
    IF NOT EXISTS (SELECT 1 FROM TechnicianAssignments
        WHERE ComplaintId=@ComplaintId AND Status IN ('Assigned','InProgress'))
    BEGIN
        UPDATE tp SET tp.AvailabilityStatus=1
        FROM TechnicianProfiles tp
        INNER JOIN Technicians t ON tp.UserId=t.UserId
        INNER JOIN TechnicianAssignments ta ON t.TechnicianId=ta.TechnicianId
        WHERE ta.ComplaintId=@ComplaintId AND ta.Status='Completed'
          AND NOT EXISTS (SELECT 1 FROM TechnicianAssignments ta2
              WHERE ta2.TechnicianId=t.TechnicianId AND ta2.Status IN ('Assigned','InProgress')
              AND ta2.ComplaintId!=@ComplaintId);

        UPDATE Complaints SET StatusId=3, UpdatedAt=DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId=@ComplaintId AND StatusId=2;
    END

    SELECT 1 AS Result, 'Assignment completed successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_ConfirmClosure]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_ConfirmClosure]
    @ComplaintId INT,
    @ConfirmedBy INT,
    @Rating INT = NULL,
    @FeedbackComments NVARCHAR(1000) = NULL,
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @ClosedStatusId INT;
        SELECT @ClosedStatusId = StatusId FROM ComplaintStatuses WHERE StatusName = 'Closed';

        UPDATE Complaints SET StatusId = @ClosedStatusId, ClosedAt = DATEADD(MINUTE, 330, GETUTCDATE()), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;
        UPDATE TechnicianAssignments SET Status = 'Completed', CompletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId = @ComplaintId AND Status NOT IN ('Completed','Cancelled');

        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        VALUES (@ComplaintId, @ClosedStatusId, ISNULL(@Remarks, 'Closure confirmed by customer'), @ConfirmedBy);

        IF @Rating IS NOT NULL
        BEGIN
            DECLARE @CustomerId INT;
            SELECT @CustomerId = CustomerId FROM Complaints WHERE ComplaintId = @ComplaintId;
            IF NOT EXISTS (SELECT 1 FROM CustomerFeedback WHERE ComplaintId = @ComplaintId)
                INSERT INTO CustomerFeedback (ComplaintId, CustomerId, Rating, Comments, CreatedAt)
                VALUES (@ComplaintId, @CustomerId, @Rating, @FeedbackComments, DATEADD(MINUTE, 330, GETUTCDATE()));
        END
        COMMIT;
        SELECT 1 AS Success, 'Complaint closed and feedback recorded.' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 7. SP: Create Complaint
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Complaint_Create]
    @CustomerId   INT,
    @ProductId    INT,
    @Subject      NVARCHAR(200),
    @Description  NVARCHAR(2000) = NULL,
    @Priority     NVARCHAR(20) = 'Medium',
    @Latitude DECIMAL(10,7) = NULL,
@Longitude DECIMAL(10,7) = NULL,
@LocationAddress NVARCHAR(500) = NULL,
@PickedLocation NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Auto generate complaint number
    DECLARE @Seq INT;
    SELECT @Seq = ISNULL(MAX(ComplaintId), 0) + 1 FROM Complaints;
    DECLARE @CmpNo NVARCHAR(30) = 'CMP-' + FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()), 'yyyyMMdd') + '-' + RIGHT('0000' + CAST(@Seq AS VARCHAR), 4);

    -- SLA based on priority
    DECLARE @SLAHours INT = CASE @Priority
        WHEN 'Critical' THEN 4 WHEN 'High' THEN 12
        WHEN 'Medium' THEN 24 ELSE 48 END;

INSERT INTO Complaints (
    ComplaintNumber, CustomerId, ProductId, Subject, Description,
    Priority, StatusId, SLADeadline, IsActive,
    CreatedAt, UpdatedAt,
    Latitude, Longitude, LocationAddress, LocationName
)
VALUES (
    @CmpNo, @CustomerId, @ProductId, @Subject, @Description,
    @Priority, 1,
    DATEADD(HOUR, @SLAHours, DATEADD(MINUTE, 330, GETUTCDATE())),
    1,
    DATEADD(MINUTE, 330, GETUTCDATE()),
    DATEADD(MINUTE, 330, GETUTCDATE()),
    @Latitude, @Longitude, @LocationAddress, @PickedLocation
);

    DECLARE @NewId INT = SCOPE_IDENTITY();

    SELECT @NewId AS ComplaintId, @CmpNo AS ComplaintNumber, 'Complaint registered' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_GetAll]
    @StatusId INT = NULL,
    @Priority NVARCHAR(20) = NULL,
    @TechnicianId INT = NULL,
    @SearchTerm NVARCHAR(200) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @SLAStatus NVARCHAR(20) = NULL,
    @SortBy NVARCHAR(50) = 'CreatedAt',
    @SortOrder NVARCHAR(4) = 'DESC',
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority,
           cs.StatusId, cs.StatusName, cs.StatusColor,
           cust.CustomerId, cust.CustomerName, cust.MobileNumber AS CustomerMobile, cust.City AS CustomerCity,
           p.ProductId, p.ProductName, p.SerialNumber, p.Brand,
           c.SLADeadline,
           CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 'Completed'
                WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) THEN 'Breached'
                WHEN c.SLADeadline < DATEADD(HOUR, 2, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 'AtRisk'
                ELSE 'OnTrack' END AS SLAStatus,
           DATEDIFF(MINUTE, c.CreatedAt, ISNULL(c.ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE()))) AS ElapsedMinutes,
           (SELECT STRING_AGG(u2.FullName, ', ') 
 FROM TechnicianAssignments ta2
 JOIN Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
 JOIN Users u2 ON t2.UserId = u2.UserId
 WHERE ta2.ComplaintId = c.ComplaintId 
   AND ta2.Status NOT IN ('Cancelled', 'Removed')
) AS AssignedTechnicians,
           c.ClosedAt, c.CreatedAt, c.UpdatedAt, COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
   LEFT JOIN Products p ON c.ProductId = p.ProductId
    LEFT JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId AND ta.Status != 'Cancelled'
    WHERE (@StatusId IS NULL OR c.StatusId = @StatusId)
    AND (@Priority IS NULL OR c.Priority = @Priority)
    AND (@TechnicianId IS NULL OR ta.TechnicianId = @TechnicianId)
    AND (@FromDate IS NULL OR CAST(c.CreatedAt AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(c.CreatedAt AS DATE) <= @ToDate)
    AND (@SearchTerm IS NULL OR c.ComplaintNumber LIKE '%' + @SearchTerm + '%' OR c.Subject LIKE '%' + @SearchTerm + '%'
         OR cust.CustomerName LIKE '%' + @SearchTerm + '%' OR p.SerialNumber LIKE '%' + @SearchTerm + '%')
    AND (@SLAStatus IS NULL
         OR (@SLAStatus = 'Breached' AND c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted'))
         OR (@SLAStatus = 'AtRisk' AND c.SLADeadline BETWEEN DATEADD(MINUTE, 330, GETUTCDATE()) AND DATEADD(HOUR, 2, DATEADD(MINUTE, 330, GETUTCDATE())) AND cs.StatusName NOT IN ('Closed','WorkCompleted'))
         OR (@SLAStatus = 'OnTrack' AND c.SLADeadline > DATEADD(HOUR, 2, DATEADD(MINUTE, 330, GETUTCDATE())) AND cs.StatusName NOT IN ('Closed','WorkCompleted')))
    GROUP BY c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority, cs.StatusId, cs.StatusName, cs.StatusColor,
             cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City, p.ProductId, p.ProductName, p.SerialNumber, p.Brand,
             c.SLADeadline, c.ClosedAt, c.CreatedAt, c.UpdatedAt
    ORDER BY CASE WHEN @SortBy='Priority' THEN CASE c.Priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END END ASC,
             c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;


--select * from Complaints

--select * from TechnicianAssignments
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetAuditLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ============================================================
-- SP 2: GET AUDIT LOG
-- GET /api/technician/audit-log/{complaintId}
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Complaint_GetAuditLog]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        al.AuditId,
        al.Action,
        oldU.FullName   AS OldTechnician,
        newU.FullName   AS NewTechnician,
        al.OldRole,
        al.NewRole,
        changedU.FullName AS ChangedByName,
        al.ChangedAt,
        al.Remarks
    FROM AssignmentAuditLog al
    LEFT JOIN Users oldU ON al.OldTechnicianId = oldU.UserId
    LEFT JOIN Users newU ON al.NewTechnicianId = newU.UserId
    LEFT JOIN Users changedU ON al.ChangedBy = changedU.UserId
    WHERE al.ComplaintId = @ComplaintId
    ORDER BY al.ChangedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_GetByCustomer]
    @CustomerId INT,
    @StatusId INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusId, cs.StatusName, cs.StatusColor, p.ProductName, p.SerialNumber, p.Brand,
           c.SLADeadline,
           CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 'Completed' WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) THEN 'Breached' ELSE 'OnTrack' END AS SLAStatus,
           (SELECT TOP 1 u2.FullName FROM TechnicianAssignments ta2 JOIN Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
            JOIN Users u2 ON t2.UserId = u2.UserId WHERE ta2.ComplaintId = c.ComplaintId AND ta2.Status != 'Cancelled'
            ORDER BY ta2.AssignedAt DESC) AS AssignedTechnicianName,
           c.CreatedAt, c.UpdatedAt, COUNT(*) OVER() AS TotalCount
    FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId JOIN Products p ON c.ProductId = p.ProductId
    WHERE c.CustomerId = @CustomerId AND (@StatusId IS NULL OR c.StatusId = @StatusId)
    ORDER BY c.CreatedAt DESC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_GetById]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Main details
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority,
           cs.StatusId, cs.StatusName, cs.StatusColor,
           cust.CustomerId, cust.CustomerName, cust.MobileNumber AS CustomerMobile, cust.Email AS CustomerEmail,
           cust.Address AS CustomerAddress, cust.City AS CustomerCity, cust.[State] AS CustomerState, cust.PinCode AS CustomerPinCode,
           cust.Latitude AS CustomerLatitude, cust.Longitude AS CustomerLongitude,
           p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.Category, p.PurchaseDate, p.WarrantyExpiryDate,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           c.SLADeadline,
           CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 'Completed' WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) THEN 'Breached'
                WHEN c.SLADeadline < DATEADD(HOUR, 2, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 'AtRisk' ELSE 'OnTrack' END AS SLAStatus,
           c.ContactNumber, c.PreferredDate, c.PreferredTimeSlot, c.ClosedAt, c.CreatedAt, c.UpdatedAt
    FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId JOIN Products p ON c.ProductId = p.ProductId
    WHERE c.ComplaintId = @ComplaintId;

    -- Assigned technicians
    SELECT ta.AssignmentId, ta.TechnicianId, u.FullName AS TechnicianName, u.MobileNumber AS TechMobile,
           t.Specialization, t.SkillLevel, ta.AssignmentRole, ta.Status AS AssignmentStatus, ta.AssignedAt, ta.CompletedAt, ab.FullName AS AssignedByName
    FROM TechnicianAssignments ta JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId LEFT JOIN Users ab ON ta.AssignedBy = ab.UserId
    WHERE ta.ComplaintId = @ComplaintId ORDER BY ta.AssignedAt DESC;

    -- Timeline
    SELECT ct.TimelineId, ct.StatusId, cs2.StatusName, cs2.StatusColor, ct.Remarks, ct.ActionBy, u2.FullName AS ActionByName, ct.CreatedAt
    FROM ComplaintTimeline ct JOIN ComplaintStatuses cs2 ON ct.StatusId = cs2.StatusId
    LEFT JOIN Users u2 ON ct.ActionBy = u2.UserId WHERE ct.ComplaintId = @ComplaintId ORDER BY ct.CreatedAt ASC;

    -- Notes
    SELECT cn.NoteId, cn.NoteText, cn.NoteType, cn.CreatedBy, u3.FullName AS CreatedByName, cn.CreatedAt
    FROM ComplaintNotes cn LEFT JOIN Users u3 ON cn.CreatedBy = u3.UserId WHERE cn.ComplaintId = @ComplaintId ORDER BY cn.CreatedAt DESC;

    -- Attachments
    SELECT ca.AttachmentId, ca.[FileName], ca.FilePath, ca.FileType, ca.FileSize, u4.FullName AS UploadedByName, ca.CreatedAt
    FROM ComplaintAttachments ca LEFT JOIN Users u4 ON ca.UploadedBy = u4.UserId WHERE ca.ComplaintId = @ComplaintId ORDER BY ca.CreatedAt DESC;

    -- Spare parts
    SELECT spr.RequestId, spr.PartName, spr.PartNumber, spr.Quantity, spr.Status, spr.Remarks, spr.CreatedAt,
           u5.FullName AS RequestedByName, ap.FullName AS ApprovedByName
    FROM SparePartRequests spr JOIN Technicians t2 ON spr.TechnicianId = t2.TechnicianId
    JOIN Users u5 ON t2.UserId = u5.UserId LEFT JOIN Users ap ON spr.ApprovedBy = ap.UserId
    WHERE spr.ComplaintId = @ComplaintId ORDER BY spr.CreatedAt DESC;

    -- Work completion
    SELECT wcr.ReportId, wcr.WorkDescription, wcr.ResolutionType, wcr.PartsUsed, wcr.Remarks, wcr.CompletedAt, u6.FullName AS TechnicianName
    FROM WorkCompletionReports wcr JOIN Technicians t3 ON wcr.TechnicianId = t3.TechnicianId
    JOIN Users u6 ON t3.UserId = u6.UserId WHERE wcr.ComplaintId = @ComplaintId;

    -- Feedback
    SELECT cf.FeedbackId, cf.Rating, cf.Comments, cf.CreatedAt, cust2.CustomerName
    FROM CustomerFeedback cf JOIN Customers cust2 ON cf.CustomerId = cust2.CustomerId WHERE cf.ComplaintId = @ComplaintId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetForAssignment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================================
-- SP 1: Complaints Autocomplete (for assignment dropdown)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Complaint_GetForAssignment]
    @SearchTerm NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 20
        c.ComplaintId,
        c.ComplaintNumber,
        c.Subject,
        cu.CustomerName,
        cu.MobileNumber AS CustomerPhone,
        cu.City AS CustomerPlace,
        c.Priority,
        c.StatusId
    FROM Complaints c
    INNER JOIN Customers cu ON c.CustomerId = cu.CustomerId
    WHERE c.StatusId IN (1, 2)  -- New, InProgress only
      AND c.IsActive = 1
      AND (@SearchTerm IS NULL
           OR c.ComplaintNumber LIKE '%' + @SearchTerm + '%'
           OR c.Subject LIKE '%' + @SearchTerm + '%'
           OR cu.CustomerName LIKE '%' + @SearchTerm + '%'
           OR cu.MobileNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY c.CreatedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_GetStatuses]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Complaint_GetStatuses]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StatusId, StatusName, StatusColor, SortOrder FROM ComplaintStatuses ORDER BY SortOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_Reopen]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Complaint_Reopen]
    @ComplaintId INT, @Remarks NVARCHAR(500), @ReopenedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Complaints SET StatusId = 1, ClosedAt = NULL, SLADeadline = DATEADD(HOUR, 24, DATEADD(MINUTE, 330, GETUTCDATE())), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy) VALUES (@ComplaintId, 1, 'Reopened: ' + @Remarks, @ReopenedBy);
    SELECT 1 AS Success, 'Complaint reopened.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_UnAssignTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP: Unassign Technician
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Complaint_UnAssignTechnician]
    @AssignmentId   INT,
    @UnAssignedBy   INT,
    @Reason         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate assignment exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM TechnicianAssignments
        WHERE AssignmentId = @AssignmentId
          AND Status NOT IN ('Removed', 'Completed')
    )
    BEGIN
        SELECT -1 AS Result, 'Assignment not found or already closed' AS [Message];
        RETURN;
    END

    DECLARE @ComplaintId    INT;
    DECLARE @TechnicianId   INT;
    DECLARE @AssignmentRole NVARCHAR(20);

    SELECT
        @ComplaintId    = ComplaintId,
        @TechnicianId   = TechnicianId,
        @AssignmentRole = AssignmentRole
    FROM TechnicianAssignments
    WHERE AssignmentId = @AssignmentId;

    -- Mark assignment as Removed
    UPDATE TechnicianAssignments
    SET Status      = 'Removed',
        UpdatedAt   = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE AssignmentId = @AssignmentId;

    -- Audit log
    INSERT INTO AssignmentAuditLog
        (AssignmentId, ComplaintId, Action, OldTechnicianId, OldRole, ChangedBy, Remarks)
    VALUES
        (@AssignmentId, @ComplaintId, 'Removed', @TechnicianId, @AssignmentRole,
         @UnAssignedBy, ISNULL(@Reason, 'Technician unassigned'));

    -- Free up technician availability IF no other active assignments
    IF NOT EXISTS (
        SELECT 1 FROM TechnicianAssignments
        WHERE TechnicianId = @TechnicianId
          AND Status NOT IN ('Removed', 'Completed')
          AND AssignmentId <> @AssignmentId
    )
    BEGIN
        UPDATE TechnicianProfiles
        SET AvailabilityStatus = 1          -- Available
        WHERE UserId = (
            SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId
        );
    END

    -- If complaint has NO remaining active assignments → revert status to New (1)
    IF NOT EXISTS (
        SELECT 1 FROM TechnicianAssignments
        WHERE ComplaintId = @ComplaintId
          AND Status NOT IN ('Removed', 'Completed')
    )
    BEGIN
        UPDATE Complaints
        SET StatusId  = 1,          -- New
            UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId = @ComplaintId
          AND StatusId = 2;         -- only revert if currently In Progress
    END

    SELECT 1 AS Result, 'Technician unassigned successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Complaint_UpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO



CREATE PROCEDURE [dbo].[sp_Complaint_UpdateStatus]
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
/****** Object:  StoredProcedure [dbo].[sp_Complaint_UploadImage]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Complaint_UploadImage]
    @ComplaintId INT,
    @ImagePath NVARCHAR(500) = NULL,
    @ImageType NVARCHAR(50) = 'complaint',
    @UploadedBy INT = NULL,
    @ImageData NVARCHAR(MAX) = NULL,
    @ImageName NVARCHAR(400) = NULL,
    @ContentType NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ImageTypeInt INT;

    -- Convert type to int
    SET @ImageTypeInt =
        CASE @ImageType
            WHEN 'complaint' THEN 1
            WHEN 'resolution' THEN 2
            ELSE 0
        END;

    INSERT INTO ComplaintImages
    (
        ComplaintId,
        ImagePath,
        ImageType,
        UploadedBy,
        UploadedAt,
        ImageData,
        ImageName,
        ContentType
    )
    VALUES
    (
        @ComplaintId,
        'From Customer',
        @ImageTypeInt,
        @UploadedBy,
        DATEADD(MINUTE, 330, GETUTCDATE()),
        @ImageData,
        @ImageName,
        @ContentType
    );

    SELECT 
        SCOPE_IDENTITY() AS ImageId,
        'Image uploaded successfully' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- COMPLAINTS - FULL CRUD + OPERATIONS
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateComplaint]
    @CustomerId INT,
    @ProductId INT,
    @Subject NVARCHAR(200),
    @Description NVARCHAR(2000),
    @Priority NVARCHAR(20) = 'Medium'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ComplaintNumber NVARCHAR(20);
    DECLARE @NewId INT;
    
    SET @ComplaintNumber = 'CMP-' + FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()), 'yyyyMMdd') + '-' + 
        RIGHT('0000' + CAST((SELECT ISNULL(MAX(ComplaintId), 0) + 1 FROM Complaints) AS NVARCHAR(4)), 4);
    
    INSERT INTO Complaints (ComplaintNumber, CustomerId, ProductId, Subject, Description, Priority, StatusId, SLADeadline)
    VALUES (@ComplaintNumber, @CustomerId, @ProductId, @Subject, @Description, @Priority, 1, 
        CASE @Priority
            WHEN 'Critical' THEN DATEADD(HOUR, 4, DATEADD(MINUTE, 330, GETUTCDATE()))
            WHEN 'High' THEN DATEADD(HOUR, 12, DATEADD(MINUTE, 330, GETUTCDATE()))
            WHEN 'Medium' THEN DATEADD(HOUR, 24, DATEADD(MINUTE, 330, GETUTCDATE()))
            ELSE DATEADD(HOUR, 48, DATEADD(MINUTE, 330, GETUTCDATE()))
        END);
    
    SET @NewId = SCOPE_IDENTITY();
    
    -- Add timeline entry
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    SELECT @NewId, 1, 'Complaint registered', u.UserId 
    FROM Users u JOIN Customers c ON u.UserId = c.UserId WHERE c.CustomerId = @CustomerId;
    
    SELECT @NewId AS ComplaintId, @ComplaintNumber AS ComplaintNumber;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- CUSTOMER MANAGEMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateCustomer]
    @CustomerName NVARCHAR(200),
    @MobileNumber NVARCHAR(15),
    @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @Latitude DECIMAL(9,6) = NULL,
    @Longitude DECIMAL(9,6) = NULL,
    @CreatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @UserId INT;
    DECLARE @CustomerId INT;
    
    -- Check if mobile already exists
    SELECT @UserId = UserId FROM Users WHERE MobileNumber = @MobileNumber;
    
    IF @UserId IS NULL
    BEGIN
        -- Create user first
        INSERT INTO Users (FullName, MobileNumber, Email, RoleId, IsActive, CreatedAt)
        VALUES (@CustomerName, @MobileNumber, @Email, 
                (SELECT RoleId FROM Roles WHERE RoleName = 'Customer'), 1, DATEADD(MINUTE, 330, GETUTCDATE()));
        SET @UserId = SCOPE_IDENTITY();
    END
    
    -- Check if customer already exists
    IF EXISTS (SELECT 1 FROM Customers WHERE UserId = @UserId)
    BEGIN
        SELECT 0 AS Success, 'Customer already exists.' AS Message, NULL AS CustomerId;
        RETURN;
    END
    
    INSERT INTO Customers (UserId, CustomerName, MobileNumber, Email, Address, City, [State], PinCode, 
                           Latitude, Longitude, CreatedAt)
    VALUES (@UserId, @CustomerName, @MobileNumber, @Email, @Address, @City, @State, @PinCode,
            @Latitude, @Longitude, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SET @CustomerId = SCOPE_IDENTITY();
    
    SELECT 1 AS Success, 'Customer created successfully.' AS Message, @CustomerId AS CustomerId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateNotification]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateNotification]
    @UserId INT,
    @Title NVARCHAR(200),
    @Message NVARCHAR(500),
    @NotificationType NVARCHAR(50) = 'General',
    @ReferenceId INT = NULL,
    @ReferenceType NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
    VALUES (@UserId, @Title, @Message, @NotificationType, @ReferenceId, @ReferenceType, 0, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT SCOPE_IDENTITY() AS NotificationId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateProduct]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- PRODUCT MANAGEMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateProduct]
    @CustomerId INT,
    @ProductName NVARCHAR(200),
    @SerialNumber NVARCHAR(100) = NULL,
    @ModelNumber NVARCHAR(100) = NULL,
    @Brand NVARCHAR(100) = NULL,
    @Category NVARCHAR(100) = NULL,
    @PurchaseDate DATE = NULL,
    @WarrantyExpiryDate DATE = NULL,
    @CreatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @SerialNumber IS NOT NULL AND EXISTS (SELECT 1 FROM Products WHERE SerialNumber = @SerialNumber)
    BEGIN
        SELECT 0 AS Success, 'Serial number already exists.' AS Message, NULL AS ProductId;
        RETURN;
    END
    
    INSERT INTO Products (CustomerId, ProductName, SerialNumber, ModelNumber, Brand, Category, 
                          PurchaseDate, WarrantyExpiryDate, IsActive, CreatedAt)
    VALUES (@CustomerId, @ProductName, @SerialNumber, @ModelNumber, @Brand, @Category,
            @PurchaseDate, @WarrantyExpiryDate, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'Product created successfully.' AS Message, SCOPE_IDENTITY() AS ProductId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateRole]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_CreateRole]
    @RoleName NVARCHAR(50),
    @Description NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM Roles WHERE RoleName = @RoleName)
    BEGIN
        SELECT 0 AS Success, 'Role already exists.' AS Message;
        RETURN;
    END
    
    INSERT INTO Roles (RoleName, Description, IsActive)
    VALUES (@RoleName, @Description, 1);
    
    SELECT 1 AS Success, 'Role created successfully.' AS Message, SCOPE_IDENTITY() AS RoleId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateSchedule]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- SCHEDULE MANAGEMENT
-- ============================================
CREATE   PROCEDURE [dbo].[sp_CreateSchedule]
    @TechnicianId INT,
    @ComplaintId INT,
    @ScheduledDate DATE,
    @TimeSlotStart TIME,
    @TimeSlotEnd TIME,
    @CreatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @HasConflict BIT = 0;
    
    IF EXISTS (
        SELECT 1 FROM TechnicianSchedule 
        WHERE TechnicianId = @TechnicianId
        AND ScheduledDate = @ScheduledDate
        AND Status NOT IN ('Cancelled')
        AND ((@TimeSlotStart BETWEEN TimeSlotStart AND TimeSlotEnd)
            OR (@TimeSlotEnd BETWEEN TimeSlotStart AND TimeSlotEnd)
            OR (TimeSlotStart BETWEEN @TimeSlotStart AND @TimeSlotEnd))
    )
    SET @HasConflict = 1;
    
    INSERT INTO TechnicianSchedule (TechnicianId, ComplaintId, ScheduledDate, TimeSlotStart, TimeSlotEnd, HasConflict, CreatedBy)
    VALUES (@TechnicianId, @ComplaintId, @ScheduledDate, @TimeSlotStart, @TimeSlotEnd, @HasConflict, @CreatedBy);
    
    SELECT SCOPE_IDENTITY() AS ScheduleId, @HasConflict AS HasConflict;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateSparePartRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- SPARE PARTS MANAGEMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateSparePartRequest]
    @TechnicianId INT,
    @ComplaintId INT,
    @PartName NVARCHAR(200),
    @PartNumber NVARCHAR(100) = NULL,
    @Quantity INT = 1,
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO SparePartRequests (TechnicianId, ComplaintId, PartName, PartNumber, Quantity, Status, Remarks, CreatedAt)
    VALUES (@TechnicianId, @ComplaintId, @PartName, @PartNumber, @Quantity, 'Requested', @Remarks, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT SCOPE_IDENTITY() AS RequestId, 'Spare part requested successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- TECHNICIAN MANAGEMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateTechnician]
    @FullName NVARCHAR(100),
    @MobileNumber NVARCHAR(15),
    @Email NVARCHAR(200) = NULL,
    @Specialization NVARCHAR(100) = NULL,
    @SkillLevel NVARCHAR(20) = 'Junior',
    @Zone NVARCHAR(100) = NULL,
    @CreatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @UserId INT;
    DECLARE @TechnicianId INT;
    
    -- Check existing
    SELECT @UserId = UserId FROM Users WHERE MobileNumber = @MobileNumber;
    
    IF @UserId IS NULL
    BEGIN
        INSERT INTO Users (FullName, MobileNumber, Email, RoleId, IsActive, CreatedAt)
        VALUES (@FullName, @MobileNumber, @Email, 
                (SELECT RoleId FROM Roles WHERE RoleName = 'Technician'), 1, DATEADD(MINUTE, 330, GETUTCDATE()));
        SET @UserId = SCOPE_IDENTITY();
    END
    
    IF EXISTS (SELECT 1 FROM Technicians WHERE UserId = @UserId)
    BEGIN
        SELECT 0 AS Success, 'Technician already exists.' AS Message, NULL AS TechnicianId;
        RETURN;
    END
    
    INSERT INTO Technicians (UserId, Specialization, SkillLevel, Zone, IsActive, CreatedAt)
    VALUES (@UserId, @Specialization, @SkillLevel, @Zone, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SET @TechnicianId = SCOPE_IDENTITY();
    
    SELECT 1 AS Success, 'Technician created successfully.' AS Message, @TechnicianId AS TechnicianId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_CreateUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- USER MANAGEMENT
-- ============================================
CREATE PROCEDURE [dbo].[sp_CreateUser]
    @FullName NVARCHAR(100),
    @MobileNumber NVARCHAR(15),
    @Email NVARCHAR(200) = NULL,
    @RoleId INT,
    @CreatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT 0 AS Success, 'Mobile number already registered.' AS Message, NULL AS UserId;
        RETURN;
    END
    
    IF @Email IS NOT NULL AND EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
    BEGIN
        SELECT 0 AS Success, 'Email already registered.' AS Message, NULL AS UserId;
        RETURN;
    END
    
    INSERT INTO Users (FullName, MobileNumber, Email, RoleId, IsActive, CreatedAt)
    VALUES (@FullName, @MobileNumber, @Email, @RoleId, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'User created successfully.' AS Message, SCOPE_IDENTITY() AS UserId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_CheckByMobile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Customer_CheckByMobile]
    @MobileNumber NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CustomerId, c.CustomerName, c.MobileNumber, c.City, c.Address,
           u.UserId, u.FullName, u.Email
    FROM Customers c
    INNER JOIN Users u ON c.UserId = u.UserId
    WHERE c.MobileNumber = @MobileNumber OR u.MobileNumber = @MobileNumber;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ████████████████████████████████████████████████████████████████
-- 9. CUSTOMER CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_Customer_Create]
    @CustomerName NVARCHAR(200), @MobileNumber NVARCHAR(15), @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL, @City NVARCHAR(100) = NULL, @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL, @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL, @CreatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @UserId INT, @CustomerId INT;
        SELECT @UserId = UserId FROM Users WHERE MobileNumber = @MobileNumber;
        IF @UserId IS NULL
        BEGIN
            INSERT INTO Users (FullName, MobileNumber, Email, RoleId, IsActive, CreatedAt)
            VALUES (@CustomerName, @MobileNumber, @Email, (SELECT RoleId FROM Roles WHERE RoleName = 'Customer'), 1, DATEADD(MINUTE, 330, GETUTCDATE()));
            SET @UserId = SCOPE_IDENTITY();
        END
        IF EXISTS (SELECT 1 FROM Customers WHERE UserId = @UserId)
        BEGIN SELECT 0 AS Success, 'Customer already exists.' AS Message, NULL AS CustomerId; ROLLBACK; RETURN; END

        INSERT INTO Customers (UserId, CustomerName, MobileNumber, Email, Address, City, [State], PinCode, Latitude, Longitude, CreatedAt)
        VALUES (@UserId, @CustomerName, @MobileNumber, @Email, @Address, @City, @State, @PinCode, @Latitude, @Longitude, DATEADD(MINUTE, 330, GETUTCDATE()));
        SET @CustomerId = SCOPE_IDENTITY();
        COMMIT;
        SELECT 1 AS Success, 'Customer created.' AS Message, @CustomerId AS CustomerId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS CustomerId;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Customer_GetAll]
    @SearchTerm NVARCHAR(100) = NULL, @City NVARCHAR(100) = NULL, @PageNumber INT = 1, @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CustomerId, c.CustomerName, c.MobileNumber, c.Email, c.Address, c.City, c.[State], c.PinCode,
           (SELECT COUNT(*) FROM Products p WHERE p.CustomerId = c.CustomerId) AS TotalProducts,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.CustomerId = c.CustomerId) AS TotalComplaints,
           c.CreatedAt, COUNT(*) OVER() AS TotalCount
    FROM Customers c
    WHERE (@SearchTerm IS NULL OR c.CustomerName LIKE '%' + @SearchTerm + '%' OR c.MobileNumber LIKE '%' + @SearchTerm + '%' OR c.Email LIKE '%' + @SearchTerm + '%')
    AND (@City IS NULL OR c.City = @City) ORDER BY c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Customer_GetById]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CustomerId, c.UserId, c.CustomerName, c.MobileNumber, c.Email,
           c.Address, c.City, c.[State], c.PinCode, c.Latitude, c.Longitude,
           (SELECT COUNT(*) FROM Products p WHERE p.CustomerId = c.CustomerId AND p.IsActive = 1) AS TotalProducts,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.CustomerId = c.CustomerId) AS TotalComplaints,
           (SELECT COUNT(*) FROM Complaints cmp JOIN ComplaintStatuses cs ON cmp.StatusId = cs.StatusId
            WHERE cmp.CustomerId = c.CustomerId AND cs.StatusName NOT IN ('Closed','WorkCompleted')) AS ActiveComplaints,
           c.CreatedAt, c.UpdatedAt
    FROM Customers c WHERE c.CustomerId = @CustomerId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetComplaintDetail]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 9. SP: Get Complaint Detail with Timeline + Assignments
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Customer_GetComplaintDetail]
    @ComplaintId INT,
    @CustomerId  INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Table 0: Complaint detail
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId, c.SLADeadline, c.CreatedAt, c.UpdatedAt,
        c.IsCustomerConfirmed,
        p.ProductName, p.SerialNumber, p.Brand,
        cu.CustomerName, cu.MobileNumber, cu.City
    FROM Complaints c
    INNER JOIN Products p ON c.ProductId = p.ProductId
    INNER JOIN Customers cu ON c.CustomerId = cu.CustomerId
    WHERE c.ComplaintId = @ComplaintId AND c.CustomerId = @CustomerId;

    -- Table 1: All assigned technicians
    SELECT ta.AssignmentId, ta.AssignmentRole, ta.Status, ta.AssignedAt, ta.CompletedAt,
        u.FullName AS TechnicianName, u.MobileNumber AS TechnicianPhone,
        tp.Specialization, tp.Rating
    FROM TechnicianAssignments ta
    INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    INNER JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
    WHERE ta.ComplaintId = @ComplaintId
    ORDER BY ta.AssignedAt DESC;

    -- Table 2: Timeline / status history
    SELECT al.AuditId, al.Action, al.Remarks, al.ChangedAt,
        cu.FullName AS ChangedByName,
        nu.FullName AS TechnicianName, al.NewRole
    FROM AssignmentAuditLog al
    LEFT JOIN Users cu ON al.ChangedBy = cu.UserId
    LEFT JOIN Users nu ON al.NewTechnicianId = nu.UserId
    WHERE al.ComplaintId = @ComplaintId
    ORDER BY al.ChangedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetList]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/* =============================================================================
   ProjectDB · Business stored-proc scoping pattern
   -----------------------------------------------------------------------------
   A service-app DB may be shared across companies/projects, so EVERY business
   proc filters/stamps by @CompanyId + @ProjectId + @LocationId. The API passes
   these from TenantContext (never from user input), so a user can only touch
   rows for the company/project/location they are scoped to.

   Example table: Customers. Apply the same shape to every business proc.
   ============================================================================= */

/* ---- READ (current company + project + location) ------------------------- */
CREATE   PROCEDURE [dbo].[sp_Customer_GetList]
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM dbo.Customers
    WHERE CompanyId  = @CompanyId
      AND ProjectId  = @ProjectId
      AND LocationId = @LocationId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetMyComplaints]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 8. SP: Get My Complaints (customer view with technician info)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Customer_GetMyComplaints]
    @CustomerId   INT,
    @StatusFilter INT = NULL,
    @PageNumber   INT = 1,
    @PageSize     INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId, c.SLADeadline, c.CreatedAt, c.UpdatedAt,
        p.ProductName, p.SerialNumber, p.Brand,
        -- Primary technician info
        tu.FullName AS TechnicianName,
        tu.MobileNumber AS TechnicianPhone,
        ta.AssignmentRole, ta.Status AS AssignmentStatus,
        ta.AssignedAt,
        COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    LEFT JOIN Products p ON c.ProductId = p.ProductId
    LEFT JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId
        AND ta.Status IN ('Assigned','InProgress') AND ta.AssignmentRole = 'Primary'
    LEFT JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    LEFT JOIN Users tu ON t.UserId = tu.UserId
    WHERE c.CustomerId = @CustomerId AND c.IsActive = 1
      AND (@StatusFilter IS NULL OR c.StatusId = @StatusFilter)
    ORDER BY c.CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetOrCreate]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================================
-- 3. SP: Get Customer by UserId (auto-create if not exists)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Customer_GetOrCreate]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustId INT;

    SELECT @CustId = CustomerId FROM Customers WHERE UserId = @UserId;

    IF @CustId IS NULL
    BEGIN
        DECLARE @Name NVARCHAR(300), @Mobile NVARCHAR(30), @Email NVARCHAR(400);
        SELECT @Name = FullName, @Mobile = MobileNumber, @Email = Email FROM Users WHERE UserId = @UserId;

        IF @Name IS NOT NULL
        BEGIN
            INSERT INTO Customers (UserId, CustomerName, MobileNumber, Email, IsActive)
            VALUES (@UserId, @Name, @Mobile, @Email, 1);
            SET @CustId = SCOPE_IDENTITY();
        END
    END

    SELECT c.*, u.FullName, u.MobileNumber AS UserMobile, u.Email AS UserEmail
    FROM Customers c
    INNER JOIN Users u ON c.UserId = u.UserId
    WHERE c.CustomerId = @CustId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetProducts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Customer_GetProducts]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.Category,
           p.PurchaseDate, p.WarrantyExpiryDate, p.IsActive,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.ProductId = p.ProductId) AS TotalComplaints
    FROM Products p WHERE p.CustomerId = @CustomerId ORDER BY p.IsActive DESC, p.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_GetProfile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE  PROCEDURE [dbo].[sp_Customer_GetProfile]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.UserId,
        c.CustomerId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        c.Address,
        c.City,
        c.State,
        c.PinCode,
        c.Latitude,
        c.Longitude,
        u.RoleId,
        r.RoleName,
        u.IsActive,
        c.CompanyId,
        u.CreatedAt,
        c.UpdatedAt,
        c.Landmark,
        c.AlternatePhone
    FROM [dbo].[Users] u
    INNER JOIN [dbo].[Roles] r ON u.RoleId = r.RoleId
    INNER JOIN [dbo].[Customers] c ON u.UserId = c.UserId
    WHERE u.UserId = @UserId 
      AND u.IsActive = 1 
      AND c.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Login]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO




--exec sp_Customer_Login 'jinu123@gmail.com'
CREATE PROCEDURE [dbo].[sp_Customer_Login]
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- RESULT SET 1: Customer Details (without password verification)
    SELECT 
        u.UserId,
        u.PasswordHash,  -- Include this for verification in C#
        c.CustomerId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        c.Address,
        c.City,
        c.State,
        c.PinCode,
        c.Latitude,
        c.Longitude,
        u.RoleId,
        r.RoleName,
        u.IsActive,
        c.CompanyId,
        u.CreatedAt
    FROM [dbo].[Users] u
    INNER JOIN [dbo].[Roles] r ON u.RoleId = r.RoleId
    INNER JOIN [dbo].[Customers] c ON u.UserId = c.UserId
    WHERE u.Email = @Email 
  --    AND u.RoleId = 4  -- Customer role
      AND u.IsActive = 1
      AND c.IsActive = 1;
    
    -- RESULT SET 2: Customer Menus (only if customer found)
    IF @@ROWCOUNT > 0
    BEGIN
        SELECT 
            m.MenuId, 
            m.MenuName, 
            m.MenuPath,
            m.Icon, 
            m.ParentMenuId, 
            m.SortOrder,
            ISNULL(rma.CanView, 0) AS CanView, 
            ISNULL(rma.CanCreate, 0) AS CanCreate,
            ISNULL(rma.CanEdit, 0) AS CanEdit, 
            ISNULL(rma.CanDelete, 0) AS CanDelete
        FROM [dbo].[MenuItems] m
        INNER JOIN [dbo].[RoleMenuAccess] rma 
            ON rma.MenuId = m.MenuId AND rma.RoleId = 4
        WHERE m.IsActive = 1 
            AND rma.CanView = 1
            AND m.MenuPath LIKE '/customer/%'
        ORDER BY m.SortOrder;
    END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Register]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Customer_Register]
(
    @FullName NVARCHAR(150),
    @Email NVARCHAR(200) = null,
    @MobileNumber NVARCHAR(15),
    @PasswordHash NVARCHAR(500),
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @CompanyId INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY

        IF ISNULL(LTRIM(RTRIM(@FullName)), '') = ''
        BEGIN
            SELECT 0 AS Success, 'Full name is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
            RETURN;
        END

       --IF ISNULL(LTRIM(RTRIM(@Email)), '') = ''
       -- BEGIN
       --     SELECT 0 AS Success, 'Email is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
       --     RETURN;
       -- END

        IF ISNULL(LTRIM(RTRIM(@MobileNumber)), '') = ''
        BEGIN
            SELECT 0 AS Success, 'Mobile number is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
            RETURN;
        END

        IF ISNULL(LTRIM(RTRIM(@PasswordHash)), '') = ''
        BEGIN
            SELECT 0 AS Success, 'Password is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
            RETURN;
        END

        DECLARE @ExistingUserId INT;

        SELECT TOP 1
            @ExistingUserId = UserId
        FROM dbo.Users
        WHERE Email = @Email
           OR MobileNumber = @MobileNumber;

        IF @ExistingUserId IS NOT NULL
        BEGIN
            SELECT
                1 AS Success,
                'UserAlreadyExists' AS Message,
                @ExistingUserId AS UserId,
                NULL AS CustomerId;

            RETURN;
        END

        BEGIN TRANSACTION;

        DECLARE @CustomerRoleId INT;
        SELECT TOP 1 @CustomerRoleId = RoleId
        FROM dbo.Roles
        WHERE RoleName = N'Customer' AND IsActive = 1
        ORDER BY RoleId;

        IF @CustomerRoleId IS NULL
        BEGIN
            SELECT 0 AS Success, 'Customer role is not configured in this tenant.' AS Message, NULL AS UserId, NULL AS CustomerId;
            RETURN;
        END

        IF @CompanyId IS NOT NULL
        BEGIN
            IF NOT EXISTS
            (
                SELECT 1
                FROM dbo.Companies
                WHERE CompanyId = @CompanyId
            )
            BEGIN
                ROLLBACK TRANSACTION;

                SELECT 0 AS Success, 'Invalid CompanyId.' AS Message, NULL AS UserId, NULL AS CustomerId;
                RETURN;
            END
        END

        INSERT INTO dbo.Users
        (
            FullName,
            Email,
            MobileNumber,
            PasswordHash,
            RoleId,
            IsActive,
            CreatedAt,
            UpdatedAt,
            UserType
        )
        VALUES
        (
            @FullName,
            @Email,
            @MobileNumber,
            @PasswordHash,
            @CustomerRoleId,
            1,
            DATEADD(MINUTE, 330, GETUTCDATE()),
            DATEADD(MINUTE, 330, GETUTCDATE()),
            'Customer'
        );

        DECLARE @UserId INT = SCOPE_IDENTITY();

        INSERT INTO dbo.Customers
        (
            UserId,
            CustomerName,
            MobileNumber,
            Email,
            Address,
            City,
            State,
            PinCode,
            CompanyId,
            IsActive,
            CreatedAt,
            UpdatedAt
        )
        VALUES
        (
            @UserId,
            @FullName,
            @MobileNumber,
            @Email,
            @Address,
            @City,
            @State,
            @PinCode,
            @CompanyId,
            1,
            DATEADD(MINUTE, 330, GETUTCDATE()),
            DATEADD(MINUTE, 330, GETUTCDATE())
        );

        DECLARE @CustomerId INT = SCOPE_IDENTITY();

        COMMIT TRANSACTION;

        SELECT
            1 AS Success,
            'Registration successful. Please login.' AS Message,
            @UserId AS UserId,
            @CustomerId AS CustomerId;

    END TRY
    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            0 AS Success,
            ERROR_MESSAGE() AS Message,
            NULL AS UserId,
            NULL AS CustomerId;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_ReplyComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================================
-- 10. SP: Customer Reply to Complaint
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Customer_ReplyComplaint]
    @ComplaintId INT,
    @CustomerId  INT,
    @Message     NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId = @ComplaintId AND CustomerId = @CustomerId)
    BEGIN
        SELECT 0 AS Result, 'Complaint not found' AS [Message];
        RETURN;
    END

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM Customers WHERE CustomerId = @CustomerId;

    -- Insert as audit log entry with action 'CustomerReply'
    INSERT INTO AssignmentAuditLog (ComplaintId, Action, ChangedBy, Remarks)
    VALUES (@ComplaintId, 'CustomerReply', @UserId, @Message);

    -- Update complaint timestamp
    UPDATE Complaints SET UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;

    SELECT 1 AS Result, 'Reply sent successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Save]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* ---- WRITE (stamps CompanyId + ProjectId + LocationId) ------------------- */
CREATE   PROCEDURE [dbo].[sp_Customer_Save]
    @CompanyId   INT,
    @ProjectId   INT,
    @LocationId  INT,
    @CustomerId  INT = 0,
    @FullName    NVARCHAR(200),
    @MobileNumber NVARCHAR(20) = NULL
    -- ... other columns ...
AS
BEGIN
    SET NOCOUNT ON;

    IF @CustomerId = 0
    BEGIN
        INSERT INTO dbo.Customers (CompanyId, ProjectId, LocationId, CustomerName, MobileNumber /*, ...*/)
        VALUES (@CompanyId, @ProjectId, @LocationId, @FullName, @MobileNumber /*, ...*/);
        SELECT SCOPE_IDENTITY() AS CustomerId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Customers
        SET CustomerName = @FullName, MobileNumber = @MobileNumber
        WHERE CustomerId = @CustomerId
          AND CompanyId  = @CompanyId     -- guard: never cross-company (shared DB safe)
          AND ProjectId  = @ProjectId     -- guard: never cross-project
          AND LocationId = @LocationId;   -- guard: never cross-location
        SELECT @CustomerId AS CustomerId, 'Updated' AS Status;
    END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Search]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Customer_Search]
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 10 c.CustomerId, c.CustomerName, c.MobileNumber, c.Email, c.City FROM Customers c
    WHERE c.CustomerName LIKE '%' + @SearchTerm + '%' OR c.MobileNumber LIKE '%' + @SearchTerm + '%' OR c.Email LIKE '%' + @SearchTerm + '%'
    ORDER BY c.CustomerName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_Update]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Customer_Update]
    @CustomerId INT, @CustomerName NVARCHAR(200) = NULL, @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL, @City NVARCHAR(100) = NULL, @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL, @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Customers SET CustomerName = ISNULL(@CustomerName, CustomerName), Email = ISNULL(@Email, Email),
        Address = ISNULL(@Address, Address), City = ISNULL(@City, City), [State] = ISNULL(@State, [State]),
        PinCode = ISNULL(@PinCode, PinCode), Latitude = ISNULL(@Latitude, Latitude), Longitude = ISNULL(@Longitude, Longitude),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE CustomerId = @CustomerId;
    UPDATE Users SET FullName = ISNULL(@CustomerName, FullName), Email = ISNULL(@Email, U.Email), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    FROM Users u JOIN Customers c ON u.UserId = c.UserId WHERE c.CustomerId = @CustomerId;
    SELECT 1 AS Success, 'Customer updated.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Customer_UpdateProfile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Customer_UpdateProfile]
    @UserId INT,
    @FullName NVARCHAR(150) = NULL,
    @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @Latitude DECIMAL(9,6) = NULL,
    @Longitude DECIMAL(9,6) = NULL,
    @alternatePhone NVARCHAR(50) = NULL,
    @landmark NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Check if customer exists
        IF NOT EXISTS (SELECT 1 FROM [dbo].[Customers] WHERE UserId = @UserId AND IsActive = 1)
        BEGIN
            SELECT 0 AS Success, 'Customer not found' AS Message;
            RETURN;
        END
        
        -- Update Users table
        UPDATE [dbo].[Users]
        SET 
            FullName = ISNULL(@FullName, FullName),
            Email = ISNULL(@Email, Email),
            UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE UserId = @UserId;
        
        -- Update Customers table
        UPDATE [dbo].[Customers]
        SET 
            CustomerName = ISNULL(@FullName, CustomerName),
            Email = ISNULL(@Email, Email),
            Address = ISNULL(@Address, Address),
            City = ISNULL(@City, City),
            [State] = ISNULL(@State, [State]),
            PinCode = ISNULL(@PinCode, PinCode),
            Latitude = ISNULL(@Latitude, Latitude),
            Longitude = ISNULL(@Longitude, Longitude),
            UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
            AlternatePhone = @alternatePhone,
            Landmark = @landmark
        WHERE UserId = @UserId;
        
        COMMIT TRANSACTION;
        
        -- Return the updated profile
        SELECT 
            1 AS Success,
            'Profile updated successfully' AS Message,
            u.UserId,
            c.CustomerId,
            u.FullName,
            u.Email,
            u.MobileNumber,
            c.AlternatePhone as alternatePhone ,
            c.Landmark as landmark,
            c.Address,
            c.City,
            c.State,
            c.PinCode,
            c.Latitude,
            c.Longitude,
            u.RoleId,
            r.RoleName,
            u.IsActive,
            c.CompanyId,
            u.CreatedAt,
            c.UpdatedAt
        FROM [dbo].[Users] u
        INNER JOIN [dbo].[Roles] r ON u.RoleId = r.RoleId
        INNER JOIN [dbo].[Customers] c ON u.UserId = c.UserId
        WHERE u.UserId = @UserId;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        SELECT 
            0 AS Success, 
            ERROR_MESSAGE() AS Message,
            NULL AS UserId,
            NULL AS CustomerId,
            NULL AS FullName,
            NULL AS Email,
            NULL AS MobileNumber,
            NULL AS Address,
            NULL AS City,
            NULL AS State,
            NULL AS PinCode,
            NULL AS Latitude,
            NULL AS Longitude,
            NULL AS RoleId,
            NULL AS RoleName,
            NULL AS IsActive,
            NULL AS CompanyId,
            NULL AS CreatedAt,
            NULL AS UpdatedAt;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_CreateRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_CustomerPortal_CreateRequest]
    @CustomerId INT,
    @ProductId INT = NULL,
    @RequestType INT,
    @Subject NVARCHAR(200),
    @Description NVARCHAR(MAX),
    @PreferredDate DATE = NULL,
    @PreferredTimeSlot VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RequestNo VARCHAR(20) = 'SR-' + FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()),'yyyyMMdd') + '-' + RIGHT('0000'+CAST((SELECT ISNULL(MAX(RequestId),0)+1 FROM CustomerServiceRequests) AS VARCHAR),4);
    
    INSERT INTO CustomerServiceRequests (RequestNo, CustomerId, ProductId, RequestType, Subject, Description, PreferredDate, PreferredTimeSlot)
    VALUES (@RequestNo, @CustomerId, @ProductId, @RequestType, @Subject, @Description, @PreferredDate, @PreferredTimeSlot);
    
    SELECT SCOPE_IDENTITY() AS RequestId, @RequestNo AS RequestNo, 'Service request submitted' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_GetDashboard]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_CustomerPortal_GetDashboard]
    @CustomerPortalId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get customer profile
    SELECT 
        CustomerPortalId,
        FullName,
        Email,
        MobileNumber,
        Address,
        City
    FROM [dbo].[CustomerPortalUsers]
    WHERE CustomerPortalId = @CustomerPortalId;
    
    -- Get customer-specific menu items
    SELECT 
        1 AS MenuId, 'My Requests' AS MenuName, '/customer-portal/requests' AS MenuPath, 'assignment' AS Icon, 1 AS SortOrder
    UNION ALL
    SELECT 2, 'New Service Request', '/customer-portal/new-request', 'add_circle', 2
    UNION ALL
    SELECT 3, 'Track Status', '/customer-portal/track', 'track_changes', 3
    UNION ALL
    SELECT 4, 'My Profile', '/customer-portal/profile', 'person', 4
    UNION ALL
    SELECT 5, 'Support', '/customer-portal/support', 'support_agent', 5
    ORDER BY SortOrder;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_GetMyComplaints]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_CustomerPortal_GetMyComplaints]
    @UserID INT,
    @StatusFilter INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CustomerId INT;

    -- ✅ FIX: Assign value properly
    SELECT @CustomerId = CustomerId 
    FROM Customers 
    WHERE USERID = @UserID;

    -- ✅ Safety check
    IF @CustomerId IS NULL
    BEGIN
        SELECT 
            CAST(0 AS INT) AS ComplaintId,
            '' AS ComplaintNo,
            '' AS Subject,
            '' AS Description,
            0 AS StatusId,
            0 AS PriorityId,
            NULL AS CreatedDate,
            NULL AS ResolvedDate,
            NULL AS ClosedDate,
            CAST(0 AS BIT) AS IsWarranty,
            '' AS TechnicianName,
            '' AS TechnicianPhone,
            0 AS TotalCount
        WHERE 1 = 0; -- return empty result
        RETURN;
    END

    -- ✅ MAIN QUERY
    SELECT 
        c.ComplaintId, 
        c.ComplaintNo, 
        c.Subject, 
        c.Description, 
        c.StatusId, 
        c.PriorityId,
        c.CreatedDate, 
        c.ResolvedDate, 
        c.ClosedDate, 
        c.IsWarranty,
        t.FullName AS TechnicianName, 
        t.Phone AS TechnicianPhone,
        COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    LEFT JOIN Users t ON c.AssignedTechnicianId = t.UserId
    WHERE 
        c.CustomerId = @CustomerId
        AND c.IsActive = 1
        AND (@StatusFilter IS NULL OR c.StatusId = @StatusFilter)
    ORDER BY c.CreatedDate DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS 
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_Login]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_CustomerPortal_Login]
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        CustomerPortalId,
        FullName,
        Email,
        MobileNumber,
        PasswordHash,
        IsActive,
        LastLoginAt
    FROM [dbo].[CustomerPortalUsers]
    WHERE Email = @Email AND IsActive = 1;
    
    -- Update last login
    UPDATE [dbo].[CustomerPortalUsers] SET LastLoginAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE Email = @Email;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_Register]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_CustomerPortal_Register]
    @FullName NVARCHAR(150),
    @Email NVARCHAR(200),
    @MobileNumber NVARCHAR(15),
    @PasswordHash NVARCHAR(500),
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check duplicate
    IF EXISTS (SELECT 1 FROM [dbo].[CustomerPortalUsers] WHERE Email = @Email OR MobileNumber = @MobileNumber)
    BEGIN
        SELECT 0 AS Success, 'Email or Mobile already registered.' AS Message, NULL AS CustomerPortalId;
        RETURN;
    END
    
    INSERT INTO [dbo].[CustomerPortalUsers] (FullName, Email, MobileNumber, PasswordHash, Address, City, IsActive, CreatedAt)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @Address, @City, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'Customer registration successful.' AS Message, SCOPE_IDENTITY() AS CustomerPortalId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_TrackComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_CustomerPortal_TrackComplaint]
    @ComplaintNo VARCHAR(50),
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- ✅ Get all matching complaints
    SELECT 
        c.*, 
        cu.FullName AS CustomerName, 
        t.FullName AS TechnicianName
    FROM Complaints c
    LEFT JOIN Users cu ON c.CustomerId = cu.UserId
    LEFT JOIN Users t ON c.AssignedTechnicianId = t.UserId
    WHERE 
        c.ComplaintNumber LIKE '%' + @ComplaintNo + '%'
        AND c.CustomerId = @CustomerId
        AND c.IsActive = 1
    ORDER BY c.CreatedDate DESC;

    -- ✅ Get status history for ALL matching complaints
    SELECT 
        csh.*, 
        u.FullName AS ChangedByName
    FROM ComplaintStatusHistory csh
    INNER JOIN Users u ON csh.ChangedBy = u.UserId
    WHERE 
        csh.ComplaintId IN (
            SELECT ComplaintId
            FROM Complaints
            WHERE 
                ComplaintNumber LIKE '%' + @ComplaintNo + '%'
                AND CustomerId = @CustomerId
                AND IsActive = 1
        )
    ORDER BY csh.ChangedDate DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Dashboard_GetAdminStats]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ████████████████████████████████████████████████████████████████
-- 12. DASHBOARD CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_Dashboard_GetAdminStats]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM Complaints) AS TotalComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId = 1) AS OpenComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId WHERE cs.StatusName NOT IN ('Closed','WorkCompleted')) AS ActiveComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId WHERE cs.StatusName IN ('Closed','WorkCompleted')) AS ClosedComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId WHERE c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted')) AS SLABreached,
        (SELECT COUNT(*) FROM Complaints WHERE Priority = 'Critical' AND StatusId NOT IN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName IN ('Closed','WorkCompleted'))) AS CriticalOpen,
        (SELECT COUNT(*) FROM Technicians WHERE IsActive = 1) AS ActiveTechnicians,
        (SELECT COUNT(*) FROM Customers) AS TotalCustomers,
        (SELECT COUNT(*) FROM Products WHERE IsActive = 1) AS TotalProducts,
        (SELECT COUNT(*) FROM SparePartRequests WHERE Status = 'Requested') AS PendingSpareRequests;

    -- By status
    SELECT cs.StatusName, cs.StatusColor, COUNT(c.ComplaintId) AS Count
    FROM ComplaintStatuses cs LEFT JOIN Complaints c ON cs.StatusId = c.StatusId
    GROUP BY cs.StatusName, cs.StatusColor, cs.SortOrder ORDER BY cs.SortOrder;

    -- By priority (active only)
    SELECT Priority, COUNT(*) AS Count FROM Complaints
    WHERE StatusId NOT IN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName IN ('Closed','WorkCompleted'))
    GROUP BY Priority;

    -- Recent 10
    SELECT TOP 10 c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName, cs.StatusColor, cust.CustomerName, c.CreatedAt
    FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId JOIN Customers cust ON c.CustomerId = cust.CustomerId
    ORDER BY c.CreatedAt DESC;

    -- Weekly trend (last 7 days)
    SELECT CAST(CreatedAt AS DATE) AS Day, COUNT(*) AS Created,
           SUM(CASE WHEN ClosedAt IS NOT NULL AND CAST(ClosedAt AS DATE) = CAST(CreatedAt AS DATE) THEN 1 ELSE 0 END) AS Closed
    FROM Complaints WHERE CreatedAt >= DATEADD(DAY, -7, DATEADD(MINUTE, 330, GETUTCDATE()))
    GROUP BY CAST(CreatedAt AS DATE) ORDER BY Day;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Dashboard_GetChartData]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
--/* Run once against the Service Management database. */
--IF NOT EXISTS (SELECT 1 FROM dbo.ComplaintStatuses WHERE StatusId = 10)
--BEGIN
--    SET IDENTITY_INSERT dbo.ComplaintStatuses ON;

--    INSERT INTO dbo.ComplaintStatuses
--    (
--        StatusId,
--        StatusName,
--        StatusColor
--    )
--    VALUES
--    (
--        10,
--        'Cancelled',
--        '#DC2626'
--    );

--    SET IDENTITY_INSERT dbo.ComplaintStatuses OFF;
--END;
--GO
CREATE   PROCEDURE [dbo].[sp_Dashboard_GetChartData]
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
/****** Object:  StoredProcedure [dbo].[sp_Dashboard_GetCustomerStats]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Dashboard_GetCustomerStats]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM Complaints WHERE CustomerId = @CustomerId) AS TotalComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
         WHERE c.CustomerId = @CustomerId AND cs.StatusName NOT IN ('Closed','WorkCompleted')) AS ActiveComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
         WHERE c.CustomerId = @CustomerId AND cs.StatusName IN ('Closed','WorkCompleted')) AS ClosedComplaints,
        (SELECT COUNT(*) FROM Products WHERE CustomerId = @CustomerId AND IsActive = 1) AS TotalProducts,
        (SELECT COUNT(*) FROM Products WHERE CustomerId = @CustomerId AND WarrantyExpiryDate < CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)) AS ExpiredWarranty;

    -- Recent complaints
    SELECT TOP 5 c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority, cs.StatusName, cs.StatusColor, c.CreatedAt
    FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    WHERE c.CustomerId = @CustomerId ORDER BY c.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Dashboard_GetStats]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


--exec sp_Dashboard_GetStats

-- ==========================================
-- COMPLAINT DASHBOARD SPs
-- ==========================================
CREATE PROCEDURE [dbo].[sp_Dashboard_GetStats]
    @RoleId INT = NULL,
    @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Overall stats
    SELECT 
        (SELECT COUNT(*) FROM Complaints WHERE IsActive=1) AS TotalComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId=1 AND IsActive=1) AS NewComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId=2 AND IsActive=1) AS InProgressComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId=3 AND IsActive=1) AS ResolvedComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId=4 AND IsActive=1) AS ClosedComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND StatusId NOT IN (3,4) AND IsActive=1) AS SLABreached,
        (SELECT COUNT(*) FROM Complaints WHERE IsWarranty=1 AND IsActive=1) AS WarrantyComplaints,
        (SELECT COUNT(*) FROM TechnicianProfiles WHERE AvailabilityStatus=1 AND IsActive=1) AS AvailableTechnicians,
        (SELECT COUNT(*) FROM Schedules WHERE ScheduleDate=CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND IsActive=1) AS TodaySchedules,
        (SELECT COUNT(*) FROM WarrantyReturns WHERE StatusId=1 AND IsActive=1) AS PendingReturns;

    -- Recent complaints
    SELECT  c.ComplaintId, c.ComplaintNumber AS ComplaintNo, c.Subject, c.CreatedDate,
        c.StatusId, c.PriorityId,
        cu.FullName AS CustomerName,
        t.FullName AS TechnicianName
    FROM Complaints c
    LEFT JOIN Users cu ON c.CustomerId = cu.UserId
    LEFT JOIN TechnicianAssignments TA ON c.ComplaintId = TA.ComplaintId
    LEFT JOIN Technicians TI ON TI.TechnicianId = TA.TechnicianId
    LEFT JOIN Users t ON TI.UserId = t.UserId
    WHERE c.IsActive = 1
    AND (@TechnicianId IS NULL OR TI.TechnicianId = @TechnicianId)
    ORDER BY c.CreatedDate DESC;

    -- SLA breach list
    SELECT  c.ComplaintNumber AS ComplaintNo, c.Subject, c.SLADeadline,
        DATEDIFF(HOUR, c.SLADeadline, DATEADD(MINUTE, 330, GETUTCDATE())) AS HoursOverdue,
        cu.FullName AS CustomerName
    FROM Complaints c
    LEFT JOIN Users cu ON c.CustomerId = cu.UserId
    WHERE c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND c.StatusId NOT IN (3,4) AND c.IsActive=1
    ORDER BY c.SLADeadline ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Dashboard_GetTechnicianStats]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Dashboard_GetTechnicianStats]
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM TechnicianAssignments WHERE TechnicianId = @TechnicianId AND Status = 'Active') AS ActiveJobs,
        (SELECT COUNT(*) FROM TechnicianAssignments WHERE TechnicianId = @TechnicianId AND Status = 'Completed') AS CompletedJobs,
        (SELECT COUNT(*) FROM TechnicianAssignments WHERE TechnicianId = @TechnicianId AND Status = 'Completed'
         AND CAST(CompletedAt AS DATE) = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)) AS CompletedToday,
        (SELECT COUNT(*) FROM TechnicianSchedule WHERE TechnicianId = @TechnicianId AND ScheduledDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND Status != 'Cancelled') AS ScheduledToday,
        (SELECT COUNT(*) FROM SparePartRequests WHERE TechnicianId = @TechnicianId AND Status = 'Requested') AS PendingParts,
        (SELECT AVG(CAST(cf.Rating AS DECIMAL(3,2))) FROM CustomerFeedback cf JOIN Complaints c ON cf.ComplaintId = c.ComplaintId
         JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId WHERE ta.TechnicianId = @TechnicianId) AS AvgRating;

    -- Today's schedule
    SELECT ts.ScheduleId, ts.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cust.CustomerName, cust.Address, ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status
    FROM TechnicianSchedule ts JOIN Complaints c ON ts.ComplaintId = c.ComplaintId JOIN Customers cust ON c.CustomerId = cust.CustomerId
    WHERE ts.TechnicianId = @TechnicianId AND ts.ScheduledDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND ts.Status != 'Cancelled'
    ORDER BY ts.TimeSlotStart;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_DeactivateUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_DeactivateUser]
    @UserId INT,
    @DeactivatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Users SET IsActive = 0, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE UserId = @UserId;
    
    SELECT 1 AS Success, 'User deactivated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_DeleteComplaintAttachment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_DeleteComplaintAttachment]
    @AttachmentId INT,
    @DeletedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @FilePath NVARCHAR(500);
    SELECT @FilePath = FilePath FROM ComplaintAttachments WHERE AttachmentId = @AttachmentId;
    
    DELETE FROM ComplaintAttachments WHERE AttachmentId = @AttachmentId;
    
    SELECT 1 AS Success, @FilePath AS FilePath, 'Attachment deleted.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_DeleteUPIConfiguration]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_DeleteUPIConfiguration]
    @Id INT
AS
BEGIN
    DELETE FROM [dbo].[UPIConfigurations] WHERE Id = @Id;

    SELECT 1 AS Success, 'UPI deleted successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Feedback_Submit]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ████████████████████████████████████████████████████████████████
-- 14. FEEDBACK CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_Feedback_Submit]
    @ComplaintId INT, @CustomerId INT, @Rating INT, @Comments NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM CustomerFeedback WHERE ComplaintId = @ComplaintId)
    BEGIN SELECT 0 AS Success, 'Feedback already submitted.' AS Message; RETURN; END

    INSERT INTO CustomerFeedback (ComplaintId, CustomerId, Rating, Comments, CreatedAt) VALUES (@ComplaintId, @CustomerId, @Rating, @Comments, DATEADD(MINUTE, 330, GETUTCDATE()));
    SELECT 1 AS Success, 'Feedback submitted.' AS Message, SCOPE_IDENTITY() AS FeedbackId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GenerateOTP]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- AUTH & OTP
-- ============================================
CREATE PROCEDURE [dbo].[sp_GenerateOTP]
    @MobileNumber NVARCHAR(15),
    @Purpose NVARCHAR(50) = 'Login'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @OtpCode NVARCHAR(6) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS NVARCHAR(6)), 6);
    
    -- Invalidate old OTPs
    UPDATE OtpLog SET IsUsed = 1 WHERE MobileNumber = @MobileNumber AND IsUsed = 0;
    
    INSERT INTO OtpLog (MobileNumber, OtpCode, Purpose, ExpiresAt)
    VALUES (@MobileNumber, @OtpCode, @Purpose, DATEADD(MINUTE, 5, DATEADD(MINUTE, 330, GETUTCDATE())));
    
    SELECT @OtpCode AS OtpCode;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllComplaintPayments]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO




create   PROCEDURE [dbo].[sp_GetAllComplaintPayments]
AS
BEGIN
    SELECT
        cp.PaymentId,
        cp.ComplaintId,
           c.ComplaintNumber,
           cu.CustomerName as CustomerName,
        cu.MobileNumber as MobileNo,
        cp.PaymentType,
        cp.ServiceChargeAmount,
        cp.SparePartsAmount,
        cp.DiscountAmount,
        cp.TotalAmount,
        cp.AmountPaid,
        cp.PaymentMethod,
        cp.UpiIdUsed,
        cp.TransactionReference,
        cp.PaymentStatus,
        cp.Remarks,
        cp.CreatedAt,
        u.FullName  AS CreatedByName,
        ISNULL(cp.IsVerified, 0) AS IsVerified,
        vu.FullName AS VerifiedByName,
        cp.VerifiedAt
    FROM [dbo].[ComplaintPayments] cp
    LEFT JOIN [dbo].[Complaints] c  ON cp.ComplaintId = c.ComplaintId
    LEFT JOIN [dbo].[Users]      u  ON cp.CreatedBy   = u.userid
    LEFT JOIN [dbo].[Customers] cu on cu.CustomerId = c.CustomerId
    LEFT JOIN [dbo].[Users]      vu ON cp.VerifiedBy  = vu.userid
    ORDER BY cp.CreatedAt DESC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllCustomers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAllCustomers]
    @SearchTerm NVARCHAR(100) = NULL,
    @City NVARCHAR(100) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT c.CustomerId, c.CustomerName, c.MobileNumber, c.Email,
           c.Address, c.City, c.[State], c.PinCode,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.CustomerId = c.CustomerId) AS TotalComplaints,
           c.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM Customers c
    WHERE (@SearchTerm IS NULL OR c.CustomerName LIKE '%' + @SearchTerm + '%' 
           OR c.MobileNumber LIKE '%' + @SearchTerm + '%')
    AND (@City IS NULL OR c.City = @City)
    ORDER BY c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllRoles]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- ROLE MANAGEMENT
-- ============================================
CREATE   PROCEDURE [dbo].[sp_GetAllRoles]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, RoleName, Description, IsActive FROM Roles WHERE IsActive = 1;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllTechnicians]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAllTechnicians]
    @IsActive BIT = NULL,
    @Specialization NVARCHAR(100) = NULL,
    @Zone NVARCHAR(100) = NULL,
    @SearchTerm NVARCHAR(100) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, u.FullName, u.MobileNumber, u.Email,
           t.Specialization, t.SkillLevel, t.Zone, t.IsActive,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId 
            AND ta.Status = 'Active') AS ActiveAssignments,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId 
            AND ta.Status = 'Completed') AS CompletedAssignments,
           t.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    WHERE (@IsActive IS NULL OR t.IsActive = @IsActive)
    AND (@Specialization IS NULL OR t.Specialization = @Specialization)
    AND (@Zone IS NULL OR t.Zone = @Zone)
    AND (@SearchTerm IS NULL OR u.FullName LIKE '%' + @SearchTerm + '%' 
         OR u.MobileNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY u.FullName
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllTechniciansLiveLocation]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAllTechniciansLiveLocation]
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, u.FullName AS TechnicianName, t.Specialization,
           g.Latitude, g.Longitude, g.Address, g.EventType, g.CreatedAt AS LastUpdated
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    CROSS APPLY (
        SELECT TOP 1 Latitude, Longitude, Address, EventType, CreatedAt
        FROM GeoTrackingLog 
        WHERE TechnicianId = t.TechnicianId
        ORDER BY CreatedAt DESC
    ) g
    WHERE t.IsActive = 1;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAllUsers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAllUsers]
    @RoleId INT = NULL,
    @IsActive BIT = NULL,
    @SearchTerm NVARCHAR(100) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT u.UserId, u.FullName, u.MobileNumber, u.Email, u.RoleId,
           r.RoleName, u.IsActive, u.LastLoginAt, u.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.RoleId
    WHERE (@RoleId IS NULL OR u.RoleId = @RoleId)
    AND (@IsActive IS NULL OR u.IsActive = @IsActive)
    AND (@SearchTerm IS NULL OR u.FullName LIKE '%' + @SearchTerm + '%' 
         OR u.MobileNumber LIKE '%' + @SearchTerm + '%'
         OR u.Email LIKE '%' + @SearchTerm + '%')
    ORDER BY u.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAssignmentAuditLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAssignmentAuditLog]
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT al.AuditId, al.Action, 
           oldU.FullName AS OldTechnicianName, newU.FullName AS NewTechnicianName,
           al.NewRole, al.ChangedBy, cb.FullName AS ChangedByName,
           al.Remarks, al.CreatedAt
    FROM AssignmentAuditLog al
    LEFT JOIN Technicians oldT ON al.OldTechnicianId = oldT.TechnicianId
    LEFT JOIN Users oldU ON oldT.UserId = oldU.UserId
    LEFT JOIN Technicians newT ON al.NewTechnicianId = newT.TechnicianId
    LEFT JOIN Users newU ON newT.UserId = newU.UserId
    LEFT JOIN Users cb ON al.ChangedBy = cb.UserId
    WHERE al.AssignmentId = @AssignmentId
    ORDER BY al.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAssignmentsByComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAssignmentsByComplaint]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ta.AssignmentId, ta.TechnicianId, u.FullName AS TechnicianName, u.MobileNumber,
           t.Specialization, t.SkillLevel, ta.AssignmentRole, ta.Status,
           ta.AssignedAt, ta.CompletedAt, ab.FullName AS AssignedByName
    FROM TechnicianAssignments ta
    JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN Users ab ON ta.AssignedBy = ab.UserId
    WHERE ta.ComplaintId = @ComplaintId
    ORDER BY ta.AssignedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetAvailableTechnicians]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetAvailableTechnicians]
    @ScheduledDate DATE,
    @TimeSlotStart TIME,
    @TimeSlotEnd TIME,
    @Specialization NVARCHAR(100) = NULL,
    @Zone NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, u.FullName, u.MobileNumber, t.Specialization, t.SkillLevel, t.Zone,
           (SELECT COUNT(*) FROM TechnicianSchedule ts 
            WHERE ts.TechnicianId = t.TechnicianId 
            AND ts.ScheduledDate = @ScheduledDate 
            AND ts.Status != 'Cancelled') AS ScheduledJobsForDay
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    WHERE t.IsActive = 1
    AND (@Specialization IS NULL OR t.Specialization = @Specialization)
    AND (@Zone IS NULL OR t.Zone = @Zone)
    AND t.TechnicianId NOT IN (
        SELECT ts.TechnicianId FROM TechnicianSchedule ts
        WHERE ts.ScheduledDate = @ScheduledDate
        AND ts.Status NOT IN ('Cancelled')
        AND ((@TimeSlotStart BETWEEN ts.TimeSlotStart AND ts.TimeSlotEnd)
            OR (@TimeSlotEnd BETWEEN ts.TimeSlotStart AND ts.TimeSlotEnd)
            OR (ts.TimeSlotStart BETWEEN @TimeSlotStart AND @TimeSlotEnd))
    )
    ORDER BY ScheduledJobsForDay ASC, u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintAllImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintAllImages]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Temp table to accumulate images from all sources
    CREATE TABLE #AllImages (
        ImageId         INT,
        ImagePath       NVARCHAR(MAX),
        ImageData       NVARCHAR(MAX),
        ImageName       NVARCHAR(255),
        ContentType     VARCHAR(100),
        ImageType       VARCHAR(50),
        UploadedAt      DATETIME,
        UploadedByName  NVARCHAR(100)
    );

    -- ── 1. Complaint images (uploaded by customer / admin) ──────────────────
    IF OBJECT_ID('dbo.ComplaintImages') IS NOT NULL
    BEGIN
        INSERT INTO #AllImages (ImageId, ImagePath, ImageData, ImageName, ContentType, ImageType, UploadedAt, UploadedByName)
        SELECT
            ci.ImageId,
            ci.ImagePath,
            ci.ImageData,
            ISNULL(ci.ImageName, ''),
            ISNULL(ci.ContentType, 'image/jpeg'),
            ISNULL(CAST(ci.ImageType AS VARCHAR(50)), 'Complaint'),
            ci.UploadedAt,
            ISNULL(u.FullName, 'Customer')
        FROM dbo.ComplaintImages ci
        LEFT JOIN dbo.Users u ON ci.UploadedBy = u.UserId
        WHERE ci.ComplaintId = @ComplaintId;
    END

    -- ── 2. Service images (uploaded by technician — Completion, Repair, etc.) ─
    IF OBJECT_ID('dbo.ServiceImages') IS NOT NULL
    BEGIN
        INSERT INTO #AllImages (ImageId, ImagePath, ImageData, ImageName, ContentType, ImageType, UploadedAt, UploadedByName)
        SELECT
            si.ImageId,
            si.ImagePath,
            si.ImageData,
            ISNULL(si.ImageName, ''),
            ISNULL(si.ContentType, 'image/jpeg'),
            ISNULL(CAST(si.ImageType AS VARCHAR(50)), 'Completion'),
            si.UploadedAt,
            ISNULL(u.FullName, 'Technician')
        FROM dbo.ServiceImages si
        LEFT JOIN dbo.Technicians t ON t.TechnicianId = si.TechnicianId
        LEFT JOIN dbo.Users u ON u.UserId = t.UserId
        WHERE si.ComplaintId = @ComplaintId;
    END

    -- ── 3. Repair part images (stored as base64 in ImagePath) ───────────────
    IF OBJECT_ID('dbo.RepairPartImages') IS NOT NULL
    BEGIN
        INSERT INTO #AllImages (ImageId, ImagePath, ImageData, ImageName, ContentType, ImageType, UploadedAt, UploadedByName)
        SELECT
            rpi.ImageId,
            rpi.ImagePath,         -- base64 data stored here
            NULL,
            'Repair Image',
            'image/jpeg',
            'RepairPart',
            rpi.CreatedAt,
             ISNULL(u.FullName, 'Technician')
        FROM dbo.RepairPartImages rpi
        INNER JOIN dbo.RepairPartRequests rpr ON rpi.RepairRequestId = rpr.RepairRequestId
        LEFT JOIN dbo.Technicians t ON t.TechnicianId = rpr.TechnicianId
        LEFT JOIN dbo.Users u ON u.UserId = t.UserId
        WHERE rpr.ComplaintId = @ComplaintId;
    END

    -- ── Return unified set ordered by upload time ────────────────────────────
    SELECT
        ImageId,
        ImagePath,
        ImageData,
        ImageName,
        ContentType,
        ImageType,
        UploadedAt,
        UploadedByName
    FROM #AllImages
    ORDER BY UploadedAt ASC;

    DROP TABLE #AllImages;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintAttachments]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetComplaintAttachments]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ca.AttachmentId, ca.[FileName], ca.FilePath, ca.FileType, ca.FileSize,
           ca.UploadedBy, u.FullName AS UploadedByName, ca.CreatedAt
    FROM ComplaintAttachments ca
    LEFT JOIN Users u ON ca.UploadedBy = u.UserId
    WHERE ca.ComplaintId = @ComplaintId
    ORDER BY ca.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintById]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Complaint details
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority,
           cs.StatusId, cs.StatusName, cs.StatusColor,
           cust.CustomerId, cust.CustomerName, cust.MobileNumber AS CustomerMobile,
           cust.Address AS CustomerAddress, cust.City AS CustomerCity,
           cust.Latitude AS CustomerLatitude, cust.Longitude AS CustomerLongitude,
           p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           c.SLADeadline,
           CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted') 
               THEN 1 ELSE 0 END AS IsSLABreached,
           c.ClosedAt, c.CreatedAt, c.UpdatedAt
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE c.ComplaintId = @ComplaintId;
    
    -- Assigned technicians
    SELECT ta.AssignmentId, ta.TechnicianId, u.FullName AS TechnicianName,
           t.Specialization, ta.AssignmentRole, ta.Status AS AssignmentStatus,
           ta.AssignedAt, ta.CompletedAt
    FROM TechnicianAssignments ta
    JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    WHERE ta.ComplaintId = @ComplaintId
    ORDER BY ta.AssignedAt DESC;
    
    -- Timeline
    SELECT ct.TimelineId, ct.StatusId, cs.StatusName, cs.StatusColor,
           ct.Remarks, ct.ActionBy, u.FullName AS ActionByName,
           ct.CreatedAt
    FROM ComplaintTimeline ct
    JOIN ComplaintStatuses cs ON ct.StatusId = cs.StatusId
    LEFT JOIN Users u ON ct.ActionBy = u.UserId
    WHERE ct.ComplaintId = @ComplaintId
    ORDER BY ct.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintDashboard]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintDashboard]
    @StatusId INT = NULL,
    @Priority NVARCHAR(20) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
        cs.StatusName, cs.StatusColor,
        cust.CustomerName, p.ProductName, p.SerialNumber,
        c.SLADeadline,
        CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted') 
            THEN 1 ELSE 0 END AS IsSLABreached,
        c.CreatedAt, c.UpdatedAt,
        COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE (@StatusId IS NULL OR c.StatusId = @StatusId)
    AND (@Priority IS NULL OR c.Priority = @Priority)
    AND (@FromDate IS NULL OR CAST(c.CreatedAt AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(c.CreatedAt AS DATE) <= @ToDate)
    ORDER BY c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintImageCount]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintImageCount]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Count INT = 0;

    IF OBJECT_ID('dbo.ComplaintImages') IS NOT NULL
        SELECT @Count = @Count + COUNT(*)
        FROM dbo.ComplaintImages
        WHERE ComplaintId = @ComplaintId;

    IF OBJECT_ID('dbo.ServiceImages') IS NOT NULL
        SELECT @Count = @Count + COUNT(*)
        FROM dbo.ServiceImages
        WHERE ComplaintId = @ComplaintId;

    IF OBJECT_ID('dbo.RepairPartImages') IS NOT NULL
        SELECT @Count = @Count + COUNT(*)
        FROM dbo.RepairPartImages rpi
        INNER JOIN dbo.RepairPartRequests rpr ON rpi.RepairRequestId = rpr.RepairRequestId
        WHERE rpr.ComplaintId = @ComplaintId;

    SELECT @Count AS ImageCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintNotes]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetComplaintNotes]
    @ComplaintId INT,
    @NoteType NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT cn.NoteId, cn.NoteText, cn.NoteType, cn.CreatedBy,
           u.FullName AS CreatedByName, cn.CreatedAt
    FROM ComplaintNotes cn
    LEFT JOIN Users u ON cn.CreatedBy = u.UserId
    WHERE cn.ComplaintId = @ComplaintId
    AND (@NoteType IS NULL OR cn.NoteType = @NoteType)
    ORDER BY cn.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintPayments]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_GetComplaintPayments]
    @ComplaintId INT
AS
BEGIN
    SELECT PaymentId, ComplaintId, PaymentType, ServiceChargeAmount, SparePartsAmount, 
           DiscountAmount, TotalAmount, AmountPaid, PaymentMethod, UpiIdUsed, 
           TransactionReference, PaymentStatus, Remarks, CreatedAt
    FROM [dbo].[ComplaintPayments]
    WHERE ComplaintId = @ComplaintId
    ORDER BY CreatedAt DESC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintsByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintsByCustomer]
    @CustomerId INT,
    @StatusId INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName, cs.StatusColor,
           p.ProductName, p.SerialNumber,
           c.SLADeadline,
           CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted') 
               THEN 1 ELSE 0 END AS IsSLABreached,
           c.CreatedAt, c.UpdatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE c.CustomerId = @CustomerId
    AND (@StatusId IS NULL OR c.StatusId = @StatusId)
    ORDER BY c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintsByTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintsByTechnician]
    @TechnicianId INT,
    @StatusId INT = NULL,
    @AssignmentStatus NVARCHAR(20) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName, cs.StatusColor,
           cust.CustomerName, cust.MobileNumber AS CustomerMobile,
           cust.Address, cust.Latitude, cust.Longitude,
           p.ProductName, p.SerialNumber,
           ta.AssignmentRole, ta.Status AS AssignmentStatus,
           c.SLADeadline,
           CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted') 
               THEN 1 ELSE 0 END AS IsSLABreached,
           c.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM TechnicianAssignments ta
    JOIN Complaints c ON ta.ComplaintId = c.ComplaintId
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE ta.TechnicianId = @TechnicianId
    AND (@StatusId IS NULL OR c.StatusId = @StatusId)
    AND (@AssignmentStatus IS NULL OR ta.Status = @AssignmentStatus)
    ORDER BY c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintStatuses]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetComplaintStatuses]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StatusId, StatusName, StatusColor, SortOrder FROM ComplaintStatuses ORDER BY SortOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintSummaryReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetComplaintSummaryReport]
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Overall summary
    SELECT 
        COUNT(*) AS TotalComplaints,
        SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) AS CriticalCount,
        SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) AS HighCount,
        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) AS MediumCount,
        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) AS LowCount,
        AVG(DATEDIFF(HOUR, CreatedAt, ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())))) AS AvgResolutionHours
    FROM Complaints
    WHERE CAST(CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate;
    
    -- By status
    SELECT cs.StatusName, cs.StatusColor, COUNT(c.ComplaintId) AS Count
    FROM ComplaintStatuses cs
    LEFT JOIN Complaints c ON cs.StatusId = c.StatusId 
        AND CAST(c.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY cs.StatusName, cs.StatusColor, cs.SortOrder
    ORDER BY cs.SortOrder;
    
    -- Daily trend
    SELECT CAST(CreatedAt AS DATE) AS ComplaintDate, COUNT(*) AS Count
    FROM Complaints
    WHERE CAST(CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY CAST(CreatedAt AS DATE)
    ORDER BY ComplaintDate;
    
    -- Top products with issues
    SELECT TOP 10 p.ProductName, p.Brand, COUNT(c.ComplaintId) AS ComplaintCount
    FROM Complaints c
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE CAST(c.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY p.ProductName, p.Brand
    ORDER BY ComplaintCount DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetComplaintTimeline]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetComplaintTimeline]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ct.TimelineId, ct.StatusId, cs.StatusName, cs.StatusColor,
           ct.Remarks, ct.ActionBy, u.FullName AS ActionByName,
           ct.CreatedAt
    FROM ComplaintTimeline ct
    JOIN ComplaintStatuses cs ON ct.StatusId = cs.StatusId
    LEFT JOIN Users u ON ct.ActionBy = u.UserId
    WHERE ct.ComplaintId = @ComplaintId
    ORDER BY ct.CreatedAt ASC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetCustomerById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetCustomerById]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT c.CustomerId, c.UserId, c.CustomerName, c.MobileNumber, c.Email,
           c.Address, c.City, c.[State], c.PinCode, c.Latitude, c.Longitude,
           c.CreatedAt, c.UpdatedAt
    FROM Customers c
    WHERE c.CustomerId = @CustomerId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetCustomerComplaintReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetCustomerComplaintReport]
    @FromDate DATE,
    @ToDate DATE,
    @TopN INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@TopN) 
        cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City,
        COUNT(c.ComplaintId) AS TotalComplaints,
        SUM(CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 1 ELSE 0 END) AS Resolved,
        SUM(CASE WHEN cs.StatusName NOT IN ('Closed','WorkCompleted') THEN 1 ELSE 0 END) AS Pending,
        AVG(cf.Rating) AS AvgRating
    FROM Customers cust
    JOIN Complaints c ON cust.CustomerId = c.CustomerId
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    LEFT JOIN CustomerFeedback cf ON c.ComplaintId = cf.ComplaintId
    WHERE CAST(c.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City
    ORDER BY TotalComplaints DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetCustomerDropdown]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetCustomerDropdown]
    @SearchTerm NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 20 c.CustomerId, c.CustomerName, c.MobileNumber, c.City
    FROM Customers c
    WHERE @SearchTerm IS NULL 
       OR c.CustomerName LIKE '%' + @SearchTerm + '%' 
       OR c.MobileNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY c.CustomerName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetCustomerIdByUserId]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_GetCustomerIdByUserId]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        CustomerId,
        CustomerName,
        MobileNumber
    FROM dbo.Customers
    WHERE UserId = @UserId
      AND IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetDashboardStats]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetDashboardStats]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Summary counts
    SELECT 
        (SELECT COUNT(*) FROM Complaints) AS TotalComplaints,
        (SELECT COUNT(*) FROM Complaints WHERE StatusId = 1) AS OpenComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId 
         WHERE cs.StatusName NOT IN ('Closed','WorkCompleted')) AS ActiveComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId 
         WHERE cs.StatusName IN ('Closed','WorkCompleted')) AS ClosedComplaints,
        (SELECT COUNT(*) FROM Complaints c JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId 
         WHERE c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND cs.StatusName NOT IN ('Closed','WorkCompleted')) AS SLABreached,
        (SELECT COUNT(*) FROM Complaints WHERE Priority = 'Critical' AND StatusId NOT IN 
         (SELECT StatusId FROM ComplaintStatuses WHERE StatusName IN ('Closed','WorkCompleted'))) AS CriticalOpen,
        (SELECT COUNT(*) FROM Technicians WHERE IsActive = 1) AS ActiveTechnicians,
        (SELECT COUNT(*) FROM Customers) AS TotalCustomers;
    
    -- Complaints by status
    SELECT cs.StatusName, cs.StatusColor, COUNT(c.ComplaintId) AS Count
    FROM ComplaintStatuses cs
    LEFT JOIN Complaints c ON cs.StatusId = c.StatusId
    GROUP BY cs.StatusName, cs.StatusColor, cs.SortOrder
    ORDER BY cs.SortOrder;
    
    -- Complaints by priority
    SELECT Priority, COUNT(*) AS Count
    FROM Complaints
    WHERE StatusId NOT IN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName IN ('Closed','WorkCompleted'))
    GROUP BY Priority;
    
    -- Recent complaints
    SELECT TOP 10 c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName, cust.CustomerName, c.CreatedAt
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    ORDER BY c.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetDefaultServiceCharge]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_GetDefaultServiceCharge]
AS
BEGIN
    SELECT ConfigValue 
    FROM [dbo].[AppConfigurations] 
    WHERE ConfigKey = 'DefaultServiceCharge';
END

GO
/****** Object:  StoredProcedure [dbo].[sp_GetExistingUserCompanies]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_GetExistingUserCompanies]
(
    @UserId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cu.CompanyUserId,
        cu.CompanyId,
        c.CompanyName,
        cu.RoleInCompany
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c
        ON c.CompanyId = cu.CompanyId
    WHERE cu.UserId = @UserId
      AND cu.IsActive = 1
      AND c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetFeedbackByComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetFeedbackByComplaint]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT cf.FeedbackId, cf.Rating, cf.Comments, cf.CreatedAt,
           c.CustomerName
    FROM CustomerFeedback cf
    JOIN Customers c ON cf.CustomerId = c.CustomerId
    WHERE cf.ComplaintId = @ComplaintId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetFeedbackByTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetFeedbackByTechnician]
    @TechnicianId INT,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT cf.FeedbackId, cf.ComplaintId, c.ComplaintNumber, cf.Rating, cf.Comments,
           cust.CustomerName, cf.CreatedAt
    FROM CustomerFeedback cf
    JOIN Complaints c ON cf.ComplaintId = c.ComplaintId
    JOIN Customers cust ON cf.CustomerId = cust.CustomerId
    JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId
    WHERE ta.TechnicianId = @TechnicianId
    AND (@FromDate IS NULL OR CAST(cf.CreatedAt AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(cf.CreatedAt AS DATE) <= @ToDate)
    ORDER BY cf.CreatedAt DESC;
    
    -- Average rating
    SELECT AVG(CAST(cf.Rating AS DECIMAL(3,2))) AS AverageRating, COUNT(*) AS TotalFeedbacks
    FROM CustomerFeedback cf
    JOIN Complaints c ON cf.ComplaintId = c.ComplaintId
    JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId
    WHERE ta.TechnicianId = @TechnicianId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetGeoTrackingHistory]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetGeoTrackingHistory]
    @TechnicianId INT,
    @Date DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT g.TrackingId, g.Latitude, g.Longitude, g.Address, g.EventType, g.CreatedAt
    FROM GeoTrackingLog g
    WHERE g.TechnicianId = @TechnicianId
    AND CAST(g.CreatedAt AS DATE) = @Date
    ORDER BY g.CreatedAt ASC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetNotifications]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetNotifications]
    @UserId INT,
    @IsRead BIT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT n.NotificationId, n.Title, n.[Message], n.NotificationType,
           n.ReferenceId, n.ReferenceType, n.IsRead, n.CreatedAt,
           COUNT(*) OVER() AS TotalCount,
           (SELECT COUNT(*) FROM Notifications WHERE UserId = @UserId AND IsRead = 0) AS UnreadCount
    FROM Notifications n
    WHERE n.UserId = @UserId
    AND (@IsRead IS NULL OR n.IsRead = @IsRead)
    ORDER BY n.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetPriorityList]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- LOOKUP / DROPDOWNS
-- ============================================
CREATE   PROCEDURE [dbo].[sp_GetPriorityList]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 'Critical' AS Priority, 4 AS SLAHours
    UNION ALL SELECT 'High', 12
    UNION ALL SELECT 'Medium', 24
    UNION ALL SELECT 'Low', 48;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetProductById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetProductById]
    @ProductId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT p.ProductId, p.CustomerId, p.ProductName, p.SerialNumber, p.ModelNumber,
           p.Brand, p.Category, p.PurchaseDate, p.WarrantyExpiryDate, p.IsActive,
           c.CustomerName,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           p.CreatedAt
    FROM Products p
    JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.ProductId = @ProductId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetProductDropdownByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetProductDropdownByCustomer]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.ModelNumber,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty
    FROM Products p
    WHERE p.CustomerId = @CustomerId AND p.IsActive = 1
    ORDER BY p.ProductName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetProductsByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetProductsByCustomer]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.Category,
           p.PurchaseDate, p.WarrantyExpiryDate, p.IsActive,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.ProductId = p.ProductId) AS TotalComplaints
    FROM Products p
    WHERE p.CustomerId = @CustomerId AND p.IsActive = 1
    ORDER BY p.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetScheduleByDate]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetScheduleByDate]
    @ScheduledDate DATE,
    @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ts.ScheduleId, ts.TechnicianId, u.FullName AS TechnicianName,
           ts.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cust.CustomerName, cust.Address,
           ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status, ts.HasConflict
    FROM TechnicianSchedule ts
    JOIN Technicians t ON ts.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    JOIN Complaints c ON ts.ComplaintId = c.ComplaintId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    WHERE ts.ScheduledDate = @ScheduledDate
    AND (@TechnicianId IS NULL OR ts.TechnicianId = @TechnicianId)
    AND ts.Status != 'Cancelled'
    ORDER BY ts.TimeSlotStart, u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetScheduleByTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetScheduleByTechnician]
    @TechnicianId INT,
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ts.ScheduleId, ts.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName AS ComplaintStatus,
           cust.CustomerName, cust.MobileNumber AS CustomerMobile, cust.Address,
           cust.Latitude, cust.Longitude,
           p.ProductName, p.SerialNumber,
           ts.ScheduledDate, ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status, ts.HasConflict,
           ts.CreatedAt
    FROM TechnicianSchedule ts
    JOIN Complaints c ON ts.ComplaintId = c.ComplaintId
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE ts.TechnicianId = @TechnicianId
    AND ts.ScheduledDate BETWEEN @FromDate AND @ToDate
    AND ts.Status != 'Cancelled'
    ORDER BY ts.ScheduledDate, ts.TimeSlotStart;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetSLAComplianceReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- REPORTS & ANALYTICS
-- ============================================
CREATE PROCEDURE [dbo].[sp_GetSLAComplianceReport]
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS TotalComplaints,
        SUM(CASE WHEN SLADeadline >= ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END) AS WithinSLA,
        SUM(CASE WHEN SLADeadline < ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END) AS SLABreached,
        CAST(SUM(CASE WHEN SLADeadline >= ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1.0 ELSE 0 END) / 
            NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS SLACompliancePercent
    FROM Complaints
    WHERE CAST(CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate;
    
    -- By Priority
    SELECT Priority,
        COUNT(*) AS Total,
        SUM(CASE WHEN SLADeadline >= ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END) AS WithinSLA,
        SUM(CASE WHEN SLADeadline < ISNULL(ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END) AS Breached
    FROM Complaints
    WHERE CAST(CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY Priority;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetSparePartRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetSparePartRequests]
    @ComplaintId INT = NULL,
    @TechnicianId INT = NULL,
    @Status NVARCHAR(20) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT spr.RequestId, spr.TechnicianId, u.FullName AS TechnicianName,
           spr.ComplaintId, c.ComplaintNumber,
           spr.PartName, spr.PartNumber, spr.Quantity, spr.Status, spr.Remarks,
           ab.FullName AS ApprovedByName,
           spr.CreatedAt, spr.UpdatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM SparePartRequests spr
    JOIN Technicians t ON spr.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN Complaints c ON spr.ComplaintId = c.ComplaintId
    LEFT JOIN Users ab ON spr.ApprovedBy = ab.UserId
    WHERE (@ComplaintId IS NULL OR spr.ComplaintId = @ComplaintId)
    AND (@TechnicianId IS NULL OR spr.TechnicianId = @TechnicianId)
    AND (@Status IS NULL OR spr.Status = @Status)
    ORDER BY spr.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianAttendance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianAttendance]
    @TechnicianId INT = NULL,
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT ta.AttendanceId, ta.TechnicianId, u.FullName AS TechnicianName,
           ta.AttendanceDate, ta.CheckInTime, ta.CheckOutTime,
           ta.CheckInAddress, ta.CheckOutAddress,
           ta.TotalWorkHours,
           ta.CheckInLatitude, ta.CheckInLongitude,
           ta.CheckOutLatitude, ta.CheckOutLongitude
    FROM TechnicianAttendance ta
    JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    WHERE (@TechnicianId IS NULL OR ta.TechnicianId = @TechnicianId)
    AND ta.AttendanceDate BETWEEN @FromDate AND @ToDate
    ORDER BY ta.AttendanceDate DESC, u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianAttendanceReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianAttendanceReport]
    @FromDate DATE,
    @ToDate DATE,
    @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, u.FullName AS TechnicianName,
           COUNT(DISTINCT ta.AttendanceDate) AS DaysPresent,
           DATEDIFF(DAY, @FromDate, @ToDate) + 1 AS TotalDays,
           CAST(COUNT(DISTINCT ta.AttendanceDate) * 100.0 / NULLIF(DATEDIFF(DAY, @FromDate, @ToDate) + 1, 0) AS DECIMAL(5,2)) AS AttendancePercent,
           ISNULL(SUM(ta.TotalWorkHours), 0) AS TotalWorkHours,
           ISNULL(AVG(ta.TotalWorkHours), 0) AS AvgDailyHours
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN TechnicianAttendance ta ON t.TechnicianId = ta.TechnicianId
        AND ta.AttendanceDate BETWEEN @FromDate AND @ToDate
    WHERE t.IsActive = 1
    AND (@TechnicianId IS NULL OR t.TechnicianId = @TechnicianId)
    GROUP BY t.TechnicianId, u.FullName
    ORDER BY AttendancePercent DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianById]
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, t.UserId, u.FullName, u.MobileNumber, u.Email,
           t.Specialization, t.SkillLevel, t.Zone, t.IsActive,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId 
            AND ta.Status = 'Active') AS ActiveAssignments,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId 
            AND ta.Status = 'Completed') AS CompletedAssignments,
           t.CreatedAt
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    WHERE t.TechnicianId = @TechnicianId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianDropdown]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianDropdown]
    @Specialization NVARCHAR(100) = NULL,
    @Zone NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TechnicianId, u.FullName, t.Specialization, t.Zone
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    WHERE t.IsActive = 1
    AND (@Specialization IS NULL OR t.Specialization = @Specialization)
    AND (@Zone IS NULL OR t.Zone = @Zone)
    ORDER BY u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianLiveLocation]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianLiveLocation]
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 1 g.Latitude, g.Longitude, g.Address, g.EventType, g.CreatedAt AS LastUpdated,
           u.FullName AS TechnicianName, t.TechnicianId
    FROM GeoTrackingLog g
    JOIN Technicians t ON g.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    WHERE g.TechnicianId = @TechnicianId
    ORDER BY g.CreatedAt DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetTechnicianProductivityReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetTechnicianProductivityReport]
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        t.TechnicianId,
        u.FullName AS TechnicianName,
        COUNT(DISTINCT ta.AssignmentId) AS TotalAssignments,
        COUNT(DISTINCT CASE WHEN ta.Status = 'Completed' THEN ta.AssignmentId END) AS Completed,
        ISNULL(SUM(att.TotalWorkHours), 0) AS TotalWorkHours,
        ISNULL(SUM(tdl.DistanceKm), 0) AS TotalDistanceKm,
        COUNT(DISTINCT spr.RequestId) AS SparePartsUsed
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN TechnicianAssignments ta ON t.TechnicianId = ta.TechnicianId 
        AND CAST(ta.AssignedAt AS DATE) BETWEEN @FromDate AND @ToDate
    LEFT JOIN TechnicianAttendance att ON t.TechnicianId = att.TechnicianId 
        AND att.AttendanceDate BETWEEN @FromDate AND @ToDate
    LEFT JOIN TravelDistanceLog tdl ON t.TechnicianId = tdl.TechnicianId 
        AND tdl.TravelDate BETWEEN @FromDate AND @ToDate
    LEFT JOIN SparePartRequests spr ON t.TechnicianId = spr.TechnicianId 
        AND spr.Status = 'Used'
    GROUP BY t.TechnicianId, u.FullName
    ORDER BY Completed DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetUnreadNotificationCount]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetUnreadNotificationCount]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS UnreadCount FROM Notifications WHERE UserId = @UserId AND IsRead = 0;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetUPIConfigurations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_GetUPIConfigurations]
AS
BEGIN
    SELECT Id, UpiId, DisplayName, IsDefault, IsActive, CreatedAt
    FROM [dbo].[UPIConfigurations]
    ORDER BY Id DESC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_GetUserById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- sp_GetUserById
CREATE   PROCEDURE [dbo].[sp_GetUserById]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        u.UserType,
        u.IsActive,
        r.RoleName,
        r.RoleId
    FROM [dbo].[Users] u
    LEFT JOIN [dbo].[Roles] r ON u.RoleId = r.RoleId
    WHERE u.UserId = @UserId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetUserByMobile]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetUserByMobile]
    @MobileNumber NVARCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT u.UserId, u.FullName, u.MobileNumber, u.Email, u.RoleId,
           r.RoleName, u.IsActive, u.LastLoginAt, u.CreatedAt
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.RoleId
    WHERE u.MobileNumber = @MobileNumber;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetWorkCompletionReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetWorkCompletionReport]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT wcr.ReportId, wcr.ComplaintId, wcr.TechnicianId, u.FullName AS TechnicianName,
           wcr.WorkDescription, wcr.ResolutionType, wcr.PartsUsed, wcr.Remarks,
           wcr.CompletedAt
    FROM WorkCompletionReports wcr
    JOIN Technicians t ON wcr.TechnicianId = t.TechnicianId
    JOIN Users u ON t.UserId = u.UserId
    WHERE wcr.ComplaintId = @ComplaintId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GetZoneWiseReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetZoneWiseReport]
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.Zone,
           COUNT(DISTINCT t.TechnicianId) AS TechniciansInZone,
           COUNT(DISTINCT ta.ComplaintId) AS TotalComplaints,
           COUNT(DISTINCT CASE WHEN ta.Status = 'Completed' THEN ta.ComplaintId END) AS CompletedComplaints,
           ISNULL(AVG(cf.Rating), 0) AS AvgCustomerRating
    FROM Technicians t
    LEFT JOIN TechnicianAssignments ta ON t.TechnicianId = ta.TechnicianId
        AND CAST(ta.AssignedAt AS DATE) BETWEEN @FromDate AND @ToDate
    LEFT JOIN CustomerFeedback cf ON ta.ComplaintId = cf.ComplaintId
    WHERE t.Zone IS NOT NULL
    GROUP BY t.Zone
    ORDER BY TotalComplaints DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_GlobalSearch]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- SEARCH / GLOBAL SEARCH
-- ============================================
CREATE   PROCEDURE [dbo].[sp_GlobalSearch]
    @SearchTerm NVARCHAR(200),
    @MaxResults INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Search complaints
    SELECT TOP (@MaxResults) 'Complaint' AS ResultType, 
           ComplaintId AS ReferenceId, ComplaintNumber AS ReferenceCode,
           Subject AS Title, Priority AS SubInfo
    FROM Complaints
    WHERE ComplaintNumber LIKE '%' + @SearchTerm + '%'
       OR Subject LIKE '%' + @SearchTerm + '%'
    
    UNION ALL
    
    -- Search customers
    SELECT TOP (@MaxResults) 'Customer' AS ResultType,
           CustomerId AS ReferenceId, MobileNumber AS ReferenceCode,
           CustomerName AS Title, City AS SubInfo
    FROM Customers
    WHERE CustomerName LIKE '%' + @SearchTerm + '%'
       OR MobileNumber LIKE '%' + @SearchTerm + '%'
    
    UNION ALL
    
    -- Search products
    SELECT TOP (@MaxResults) 'Product' AS ResultType,
           ProductId AS ReferenceId, SerialNumber AS ReferenceCode,
           ProductName AS Title, Brand AS SubInfo
    FROM Products
    WHERE ProductName LIKE '%' + @SearchTerm + '%'
       OR SerialNumber LIKE '%' + @SearchTerm + '%'
    
    UNION ALL
    
    -- Search technicians
    SELECT TOP (@MaxResults) 'Technician' AS ResultType,
           t.TechnicianId AS ReferenceId, u.MobileNumber AS ReferenceCode,
           u.FullName AS Title, t.Specialization AS SubInfo
    FROM Technicians t
    JOIN Users u ON t.UserId = u.UserId
    WHERE u.FullName LIKE '%' + @SearchTerm + '%'
       OR u.MobileNumber LIKE '%' + @SearchTerm + '%';
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_InsertCustomerForExistingUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_InsertCustomerForExistingUser]
(
    @UserId INT,
    @CompanyId INT = NULL,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.Users
            WHERE UserId = @UserId
        )
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                0 AS Success,
                'User not found.' AS Message;
            RETURN;
        END

        IF @CompanyId IS NOT NULL
        BEGIN
            IF NOT EXISTS
            (
                SELECT 1
                FROM dbo.CompanyUsers
                WHERE UserId = @UserId
                  AND CompanyId = @CompanyId
                  AND IsActive = 1
            )
            BEGIN
                ROLLBACK TRANSACTION;

                SELECT
                    0 AS Success,
                    'User is not mapped to selected company.' AS Message;
                RETURN;
            END
        END

        -- Prevent duplicate customer for same user + company
        IF EXISTS
        (
            SELECT 1
            FROM dbo.Customers
            WHERE UserId = @UserId
              AND
              (
                    (@CompanyId IS NULL AND CompanyId IS NULL)
                 OR (CompanyId = @CompanyId)
              )
        )
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                0 AS Success,
                'Customer already exists for selected company.' AS Message;
            RETURN;
        END

        INSERT INTO dbo.Customers
        (
            UserId,
            CustomerName,
            MobileNumber,
            Email,
            Address,
            City,
            State,
            PinCode,
            CompanyId,
            IsActive,
            CreatedAt,
            UpdatedAt
        )
        SELECT
            u.UserId,
            u.FullName,
            u.MobileNumber,
            u.Email,
            @Address,
            @City,
            @State,
            @PinCode,
            @CompanyId,
            1,
            DATEADD(MINUTE, 330, GETUTCDATE()),
            DATEADD(MINUTE, 330, GETUTCDATE())
        FROM dbo.Users u
        WHERE u.UserId = @UserId;

        DECLARE @CustomerId INT = SCOPE_IDENTITY();

        COMMIT TRANSACTION;

        SELECT
            1 AS Success,
            'Customer created successfully.' AS Message,
            @CustomerId AS CustomerId;

    END TRY
    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            0 AS Success,
            ERROR_MESSAGE() AS Message,
            NULL AS CustomerId;

    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Location_Validate]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Location_Validate]
    @CompanyId INT, @ProjectId INT, @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 l.LocationId, l.LocationName
    FROM dbo.Locations l
    WHERE l.LocationId = @LocationId AND l.CompanyId = @CompanyId
      AND l.ProjectId = @ProjectId AND l.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_LogGeoTracking]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_LogGeoTracking]
    @TechnicianId INT,
    @Latitude DECIMAL(9,6),
    @Longitude DECIMAL(9,6),
    @Address NVARCHAR(500) = NULL,
    @EventType NVARCHAR(50) = 'LocationUpdate',
    @ComplaintId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, Address, EventType, ComplaintId)
    VALUES (@TechnicianId, @Latitude, @Longitude, @Address, @EventType, @ComplaintId);
    
    SELECT SCOPE_IDENTITY() AS TrackingId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_LogTravelDistance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_LogTravelDistance]
    @TechnicianId INT,
    @TravelDate DATE,
    @DistanceKm DECIMAL(10,2),
    @StartLatitude DECIMAL(9,6) = NULL,
    @StartLongitude DECIMAL(9,6) = NULL,
    @EndLatitude DECIMAL(9,6) = NULL,
    @EndLongitude DECIMAL(9,6) = NULL,
    @ComplaintId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO TravelDistanceLog (TechnicianId, TravelDate, DistanceKm, 
                                    StartLatitude, StartLongitude, EndLatitude, EndLongitude, ComplaintId)
    VALUES (@TechnicianId, @TravelDate, @DistanceKm, 
            @StartLatitude, @StartLongitude, @EndLatitude, @EndLongitude, @ComplaintId);
    
    SELECT SCOPE_IDENTITY() AS TravelLogId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_CustomerDropdown]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Lookup_CustomerDropdown]
    @SearchTerm NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 20 c.CustomerId, c.CustomerName, c.MobileNumber, c.City FROM Customers c
    WHERE @SearchTerm IS NULL OR c.CustomerName LIKE '%' + @SearchTerm + '%' OR c.MobileNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY c.CustomerName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_GetPriorities]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Lookup_GetPriorities]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 'Critical' AS Priority, 4 AS SLAHours UNION ALL SELECT 'High', 12 UNION ALL SELECT 'Medium', 24 UNION ALL SELECT 'Low', 48;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_GetRoles]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ████████████████████████████████████████████████████████████████
-- 13. UTILITY / LOOKUP / DROPDOWN SPs
-- ████████████████████████████████████████████████████████████████

CREATE   PROCEDURE [dbo].[sp_Lookup_GetRoles]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, RoleName, Description FROM Roles WHERE IsActive = 1;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_GlobalSearch]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Lookup_GlobalSearch]
    @SearchTerm NVARCHAR(200), @MaxResults INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@MaxResults) 'Complaint' AS ResultType, ComplaintId AS Id, ComplaintNumber AS Code, Subject AS Title, Priority AS SubInfo
    FROM Complaints WHERE ComplaintNumber LIKE '%' + @SearchTerm + '%' OR Subject LIKE '%' + @SearchTerm + '%'
    UNION ALL
    SELECT TOP (@MaxResults) 'Customer', CustomerId, MobileNumber, CustomerName, City
    FROM Customers WHERE CustomerName LIKE '%' + @SearchTerm + '%' OR MobileNumber LIKE '%' + @SearchTerm + '%'
    UNION ALL
    SELECT TOP (@MaxResults) 'Product', ProductId, SerialNumber, ProductName, Brand
    FROM Products WHERE ProductName LIKE '%' + @SearchTerm + '%' OR SerialNumber LIKE '%' + @SearchTerm + '%'
    UNION ALL
    SELECT TOP (@MaxResults) 'Technician', t.TechnicianId, u.MobileNumber, u.FullName, t.Specialization
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    WHERE u.FullName LIKE '%' + @SearchTerm + '%' OR u.MobileNumber LIKE '%' + @SearchTerm + '%';
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_ProductDropdownByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Lookup_ProductDropdownByCustomer]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.ModelNumber,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty
    FROM Products p WHERE p.CustomerId = @CustomerId AND p.IsActive = 1 ORDER BY p.ProductName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Lookup_TechnicianDropdown]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Lookup_TechnicianDropdown]
    @Specialization NVARCHAR(100) = NULL, @Zone NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TechnicianId, u.FullName, t.Specialization, t.Zone
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    WHERE t.IsActive = 1 AND (@Specialization IS NULL OR t.Specialization = @Specialization) AND (@Zone IS NULL OR t.Zone = @Zone)
    ORDER BY u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_ManageComplaintDetails]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =========================================================================
-- sp_ManageComplaintDetails   (v6 — complete with ComplaintImages)
--
-- All previous fixes preserved:
--   • GET: uniform columns, Product fallback (LEFT JOIN + COALESCE + HasProductRecord)
--   • UPDATE_COMPLAINT / UPDATE_CUSTOMER (cascades to Users) / UPDATE_PRODUCT
--   • UPDATE_LOCATION
--   • ASSIGN_TECHNICIAN (moves New → In Progress)
--   • UPDATE_ASSIGNMENT (reassign + Mark Complete + auto-resolve)
--   • UNASSIGN_TECHNICIAN
--   • ADD_SPARE / UPDATE_SPARE / DELETE_SPARE
--   • ADD_COMMENT / UPDATE_COMMENT / DELETE_COMMENT
--   • CREATE_PRODUCT (INSERTs Products + links Complaints.ProductId)
--   • Uniform 5-column result shape on every non-GET branch
--
-- NEW in v6:
--   • GET returns ComplaintImages as result set #7 (between Comments and
--     Spare Parts Dropdown). Returns ImagePath, ImageData (base64),
--     ContentType, ImageName, ImageType, UploadedAt, UploadedBy +
--     resolver's name for display.
-- =========================================================================
CREATE PROCEDURE [dbo].[sp_ManageComplaintDetails]
    @OperationType NVARCHAR(30),

    -- Complaint Parameters
    @ComplaintId INT = NULL,
    @Subject NVARCHAR(200) = NULL,
    @Description NVARCHAR(2000) = NULL,
    @NatureOfJob NVARCHAR(50) = NULL,
    @Priority NVARCHAR(20) = NULL,
    @Category NVARCHAR(100) = NULL,
    @BrandName NVARCHAR(100) = NULL,
    @ModelNumber NVARCHAR(100) = NULL,
    @PreferredDate DATE = NULL,
    @PreferredTimeSlot NVARCHAR(50) = NULL,
    @Latitude DECIMAL(10,7) = NULL,
    @Longitude DECIMAL(10,7) = NULL,
    @LocationAddress NVARCHAR(500) = NULL,
    @LocationName NVARCHAR(200) = NULL,

    -- Customer Parameters
    @CustomerId INT = NULL,
    @CustomerName NVARCHAR(200) = NULL,
    @CustomerEmail NVARCHAR(200) = NULL,
    @CustomerMobile NVARCHAR(15) = NULL,
    @AlternatePhone NVARCHAR(15) = NULL,
    @CustomerAddress NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @Landmark NVARCHAR(200) = NULL,
    @CustomerLatitude DECIMAL(10,7) = NULL,
    @CustomerLongitude DECIMAL(10,7) = NULL,

    -- Product Parameters
    @ProductId INT = NULL,
    @ProductName NVARCHAR(200) = NULL,
    @SerialNumber NVARCHAR(100) = NULL,
    @ProductModelNumber NVARCHAR(100) = NULL,
    @ProductBrand NVARCHAR(100) = NULL,
    @ProductCategory NVARCHAR(100) = NULL,
    @PurchaseDate DATE = NULL,
    @WarrantyExpiryDate DATE = NULL,

    -- Assignment Parameters
    @AssignmentId INT = NULL,
    @TechnicianId INT = NULL,
    @AssignmentRole NVARCHAR(20) = NULL,
    @AssignmentNotes NVARCHAR(500) = NULL,
    @ScheduledDate DATE = NULL,
    @StartTime NVARCHAR(10) = NULL,
    @EndTime NVARCHAR(10) = NULL,
    @EstimatedDuration INT = NULL,
    @WorkDone NVARCHAR(1000) = NULL,
    @PartsUsed NVARCHAR(500) = NULL,
    @CompletionRemarks NVARCHAR(500) = NULL,
    @Status NVARCHAR(50) = NULL,

    -- Spare Part Parameters
    @SpareRequestId INT = NULL,
    @SparePartId INT = NULL,
    @SpareQuantity INT = NULL,
    @SpareUrgency NVARCHAR(20) = NULL,
    @SpareRemarks NVARCHAR(500) = NULL,
    @SpareStatus NVARCHAR(30) = NULL,

    -- Comment Parameters
    @CommentId INT = NULL,
    @CommentText NVARCHAR(MAX) = NULL,
    @IsInternal BIT = 0,

    -- Common Parameters
    @UserId INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        -- =====================================================
        -- GET : multi-result-set read
        -- =====================================================
        IF @OperationType = 'GET'
        BEGIN
            -- 1. Complaint Basic Info
            SELECT
                c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.NatureOfJob,
                c.CreatedAt, c.UpdatedAt, c.Priority, c.PriorityId,
                c.StatusId, cs.StatusName, cs.StatusColor,
                CASE WHEN c.SLADeadline < ISNULL(c.ClosedAt, DATEADD(MINUTE, 330, GETUTCDATE())) THEN 1 ELSE 0 END AS IsSLABreached,
                c.SLADeadline, c.ContactNumber,
                c.PreferredDate, c.PreferredTimeSlot,
                c.Category, c.BrandName, c.ModelNumber,
                c.LocationName, c.LocationAddress, c.Latitude, c.Longitude,
                c.ClosedAt
            FROM Complaints c
            INNER JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
            WHERE c.ComplaintId = @ComplaintId;

            -- 2. Customer Details
            SELECT
                cust.CustomerId, cust.CustomerName, cust.Email, cust.MobileNumber,
                cust.AlternatePhone, cust.Address, cust.City, cust.State,
                cust.PinCode, cust.Landmark, cust.Latitude, cust.Longitude,
                cust.CreatedAt, cust.UpdatedAt
            FROM Customers cust
            INNER JOIN Complaints c ON cust.CustomerId = c.CustomerId
            WHERE c.ComplaintId = @ComplaintId;

            -- 3. Product Details (LEFT JOIN + COALESCE + HasProductRecord)
            SELECT
                p.ProductId,
                p.ProductName,
                p.SerialNumber,
                COALESCE(p.ModelNumber, c.ModelNumber) AS ModelNumber,
                COALESCE(p.Brand,       c.BrandName)   AS Brand,
                COALESCE(p.Category,    c.Category)    AS ProductCategory,
                p.PurchaseDate,
                p.WarrantyExpiryDate,
                CASE
                    WHEN p.WarrantyExpiryDate IS NULL                       THEN 'No Warranty'
                    WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 'Active'
                    ELSE 'Expired'
                END AS WarrantyStatus,
                p.CreatedAt,
                p.UpdatedAt,
                CASE WHEN p.ProductId IS NULL THEN CAST(0 AS BIT)
                                              ELSE CAST(1 AS BIT)
                END AS HasProductRecord
            FROM Complaints c
            LEFT JOIN Products p ON p.ProductId = c.ProductId
            WHERE c.ComplaintId = @ComplaintId;

            -- 4. Technician Assignments (exclude Removed)
            SELECT
                ta.AssignmentId, ta.TechnicianId,
                u.FullName AS TechnicianName,
                u.MobileNumber AS TechnicianPhone,
                tp.Specialization, tp.EmployeeCode,
                ta.AssignmentRole AS [Role],
                ta.Status,
                ta.AssignedAt, ta.CompletedAt,
                ta.ScheduledDate, ta.StartTime, ta.EndTime,
                ta.EstimatedDuration,
                ta.Notes, ta.Priority,
                ta.WorkDone, ta.PartsUsed, ta.CompletionRemarks,
                assignedBy.FullName AS AssignedByName
            FROM TechnicianAssignments ta
            INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            LEFT JOIN Users assignedBy ON ta.AssignedBy = assignedBy.UserId
            WHERE ta.ComplaintId = @ComplaintId
              AND ISNULL(ta.Status, '') <> 'Removed'
            ORDER BY ta.AssignedAt DESC;

            -- 5. Spare Parts Requests
            SELECT
                spr.RequestId, spr.SparePartId,
                sp.PartName, sp.PartNumber, sp.UnitPrice,
                spr.Quantity, spr.Status, spr.UrgencyLevel,
                spr.RequestedAt, spr.ApprovedAt, spr.Remarks,
                u.FullName AS TechnicianName, spr.TechnicianId,
                appr.FullName AS ApprovedByName
            FROM SparePartRequests spr
            INNER JOIN SpareParts sp ON spr.SparePartId = sp.SparePartId
            INNER JOIN Technicians t ON spr.TechnicianId = t.TechnicianId
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN Users appr ON spr.ApprovedBy = appr.UserId
            WHERE spr.ComplaintId = @ComplaintId
            ORDER BY spr.RequestedAt DESC;

            -- 6. Comments (union of timeline + assignment notes + work-done + completion)
            SELECT CommentId, Comment, PostedByRole, PostedBy, PostedAt, IsInternal
            FROM (
                SELECT
                    ct.TimelineId AS CommentId,
                    ct.Remarks AS Comment,
                    ISNULL(r.RoleName, 'System') AS PostedByRole,
                    ISNULL(u.FullName, 'System') AS PostedBy,
                    ct.CreatedAt AS PostedAt,
                    CAST(0 AS BIT) AS IsInternal
                FROM ComplaintTimeline ct
                LEFT JOIN Users u ON ct.ActionBy = u.UserId
                LEFT JOIN Roles r ON u.RoleId = r.RoleId
                WHERE ct.ComplaintId = @ComplaintId
                  AND ct.Remarks IS NOT NULL

                UNION ALL

                SELECT
                    ta.AssignmentId + 100000 AS CommentId,
                    ta.Notes AS Comment,
                    'Technician' AS PostedByRole,
                    u.FullName AS PostedBy,
                    ta.AssignedAt AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
                INNER JOIN Users u ON t.UserId = u.UserId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.Notes IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'

                UNION ALL

                SELECT
                    ta.AssignmentId + 200000 AS CommentId,
                    ta.WorkDone AS Comment,
                    'Technician' AS PostedByRole,
                    u.FullName AS PostedBy,
                    ISNULL(ta.CompletedAt, ta.AssignedAt) AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
                INNER JOIN Users u ON t.UserId = u.UserId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.WorkDone IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'

                UNION ALL

                SELECT
                    ta.AssignmentId + 300000 AS CommentId,
                    ta.CompletionRemarks AS Comment,
                    'Technician' AS PostedByRole,
                    u.FullName AS PostedBy,
                    ISNULL(ta.CompletedAt, ta.AssignedAt) AS PostedAt,
                    CAST(1 AS BIT) AS IsInternal
                FROM TechnicianAssignments ta
                INNER JOIN Technicians t ON ta.TechnicianId = t.TechnicianId
                INNER JOIN Users u ON t.UserId = u.UserId
                WHERE ta.ComplaintId = @ComplaintId
                  AND ta.CompletionRemarks IS NOT NULL
                  AND ISNULL(ta.Status,'') <> 'Removed'
            ) AS Combined
            ORDER BY PostedAt DESC;

            -- 7. Complaint Images  (NEW in v6)
            --    Returns ImagePath (file URL) OR ImageData (base64) so the
            --    Angular popup can render either form. UploadedByName lets
            --    the UI say who uploaded each image.
            SELECT
                ci.ImageId,
                ci.ComplaintId,
                ci.ImagePath,
                ci.ImageData,
                ci.ImageName,
                ci.ContentType,
                ci.ImageType,
                ci.UploadedAt,
                ci.UploadedBy,
                u.FullName    AS UploadedByName,
                ISNULL(r.RoleName, 'Customer') AS UploadedByRole
            FROM ComplaintImages ci
            LEFT JOIN Users u ON ci.UploadedBy = u.UserId
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            WHERE ci.ComplaintId = @ComplaintId
            ORDER BY ci.UploadedAt DESC, ci.ImageId DESC;

            -- 8. Spare Parts Dropdown
            SELECT SparePartId, PartName, PartNumber, StockQuantity, UnitPrice
            FROM SpareParts
            WHERE IsActive = 1
            ORDER BY PartName;

            -- 9. Technicians Dropdown
            SELECT
                t.TechnicianId,
                u.FullName AS TechnicianName,
                tp.Specialization,
                tp.AvailabilityStatus,
                tp.EmployeeCode
            FROM Technicians t
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            WHERE t.IsActive = 1
            ORDER BY u.FullName;

            RETURN;
        END

        -- =====================================================
        -- UPDATE_COMPLAINT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_COMPLAINT'
        BEGIN
            UPDATE Complaints
            SET Subject           = ISNULL(@Subject, Subject),
                Description       = ISNULL(@Description, Description),
                NatureOfJob       = CASE WHEN @NatureOfJob IS NULL THEN NatureOfJob ELSE LEFT(@NatureOfJob, 50) END,
                Priority          = ISNULL(@Priority, Priority),
                Category          = ISNULL(@Category, Category),
                BrandName         = ISNULL(@BrandName, BrandName),
                ModelNumber       = ISNULL(@ModelNumber, ModelNumber),
                PreferredDate     = ISNULL(@PreferredDate, PreferredDate),
                PreferredTimeSlot = ISNULL(@PreferredTimeSlot, PreferredTimeSlot),
                UpdatedAt         = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            SELECT @ComplaintId, StatusId, 'Complaint details updated', @UserId, DATEADD(MINUTE, 330, GETUTCDATE())
            FROM Complaints WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Complaint updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_CUSTOMER (also syncs the Users record)
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_CUSTOMER'
        BEGIN
            UPDATE Customers
            SET CustomerName   = ISNULL(@CustomerName, CustomerName),
                Email          = ISNULL(@CustomerEmail, Email),
                MobileNumber   = ISNULL(@CustomerMobile, MobileNumber),
                AlternatePhone = ISNULL(@AlternatePhone, AlternatePhone),
                Address        = ISNULL(@CustomerAddress, Address),
                City           = ISNULL(@City, City),
                State          = ISNULL(@State, State),
                PinCode        = ISNULL(@PinCode, PinCode),
                Landmark       = ISNULL(@Landmark, Landmark),
                Latitude       = ISNULL(@CustomerLatitude, Latitude),
                Longitude      = ISNULL(@CustomerLongitude, Longitude),
                UpdatedAt      = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE CustomerId = @CustomerId;

            UPDATE Users
            SET FullName     = ISNULL(@CustomerName, FullName),
                Email        = ISNULL(@CustomerEmail, Email),
                MobileNumber = ISNULL(@CustomerMobile, MobileNumber),
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE UserId = (SELECT UserId FROM Customers WHERE CustomerId = @CustomerId);

            SELECT CAST(1 AS BIT) AS Success,
                   'Customer updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_PRODUCT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_PRODUCT'
        BEGIN
            UPDATE Products
            SET ProductName        = ISNULL(@ProductName, ProductName),
                SerialNumber       = ISNULL(@SerialNumber, SerialNumber),
                ModelNumber        = ISNULL(@ProductModelNumber, ModelNumber),
                Brand              = ISNULL(@ProductBrand, Brand),
                Category           = ISNULL(@ProductCategory, Category),
                PurchaseDate       = ISNULL(@PurchaseDate, PurchaseDate),
                WarrantyExpiryDate = ISNULL(@WarrantyExpiryDate, WarrantyExpiryDate),
                UpdatedAt          = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductId = @ProductId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Product updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- CREATE_PRODUCT  (insert new Products row + link to complaint)
        -- =====================================================
        ELSE IF @OperationType = 'CREATE_PRODUCT'
        BEGIN
            IF @ComplaintId IS NULL
            BEGIN
                SELECT CAST(0 AS BIT) AS Success,
                       'ComplaintId is required' AS Message,
                       CAST(NULL AS INT) AS AssignmentId,
                       CAST(NULL AS INT) AS CommentId,
                       CAST(NULL AS INT) AS RequestId;
                RETURN;
            END

            IF @ProductName IS NULL OR LTRIM(RTRIM(@ProductName)) = ''
            BEGIN
                SELECT CAST(0 AS BIT) AS Success,
                       'Product name is required' AS Message,
                       CAST(NULL AS INT) AS AssignmentId,
                       CAST(NULL AS INT) AS CommentId,
                       CAST(NULL AS INT) AS RequestId;
                RETURN;
            END

            DECLARE @NewCustomerId INT;
            SELECT @NewCustomerId = CustomerId FROM Complaints WHERE ComplaintId = @ComplaintId;

            -- Note: remove CustomerId column + value if your Products table
            -- doesn't have one.
            INSERT INTO Products (
                CustomerId,
                ProductName, SerialNumber, ModelNumber,
                Brand, Category, PurchaseDate, WarrantyExpiryDate,
                CreatedAt, IsActive
            )
            VALUES (
                @NewCustomerId,
                @ProductName, @SerialNumber, @ProductModelNumber,
                @ProductBrand, @ProductCategory, @PurchaseDate, @WarrantyExpiryDate,
                DATEADD(MINUTE, 330, GETUTCDATE()), 1
            );

            DECLARE @NewProductId INT = SCOPE_IDENTITY();

            UPDATE Complaints
            SET ProductId   = @NewProductId,
                Category    = ISNULL(@ProductCategory,    Category),
                BrandName   = ISNULL(@ProductBrand,       BrandName),
                ModelNumber = ISNULL(@ProductModelNumber, ModelNumber),
                UpdatedAt   = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            SELECT @ComplaintId, StatusId,
                   CONCAT('Product record created and linked: ', @ProductName),
                   @UserId, DATEADD(MINUTE, 330, GETUTCDATE())
            FROM Complaints WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Product created and linked successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @NewProductId AS RequestId;
        END

        -- =====================================================
        -- UPDATE_LOCATION
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_LOCATION'
        BEGIN
            UPDATE Complaints
            SET Latitude        = ISNULL(@Latitude, Latitude),
                Longitude       = ISNULL(@Longitude, Longitude),
                LocationAddress = ISNULL(@LocationAddress, LocationAddress),
                LocationName    = ISNULL(@LocationName, LocationName),
                UpdatedAt       = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ComplaintId = @ComplaintId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Location updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- ASSIGN_TECHNICIAN  (new assignment)
        -- =====================================================
        ELSE IF @OperationType = 'ASSIGN_TECHNICIAN'
        BEGIN
            INSERT INTO TechnicianAssignments (
                ComplaintId, TechnicianId, AssignmentRole, AssignedBy,
                Notes, ScheduledDate, StartTime, EndTime, EstimatedDuration,
                Priority, Status, AssignedAt
            )
            VALUES (
                @ComplaintId, @TechnicianId, ISNULL(@AssignmentRole,'Primary'), @UserId,
                @AssignmentNotes, @ScheduledDate, @StartTime, @EndTime, @EstimatedDuration,
                @Priority, 'Assigned', DATEADD(MINUTE, 330, GETUTCDATE())
            );

            SET @AssignmentId = SCOPE_IDENTITY();

            IF EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId = @ComplaintId AND StatusId = 1)
            BEGIN
                UPDATE Complaints SET StatusId = 2, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE ComplaintId = @ComplaintId;
            END

            INSERT INTO AssignmentAuditLog
                (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks, ChangedAt)
            VALUES
                (@AssignmentId, @ComplaintId, 'Created', @TechnicianId,
                 ISNULL(@AssignmentRole,'Primary'), @UserId, 'Technician assigned', DATEADD(MINUTE, 330, GETUTCDATE()));

            SELECT CAST(1 AS BIT) AS Success,
                   'Technician assigned successfully' AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_ASSIGNMENT  (handles reassign + mark complete)
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_ASSIGNMENT'
        BEGIN
            DECLARE @OldTechnicianId INT, @OldRole NVARCHAR(20),
                    @ExistingComplaintId INT, @OldStatus NVARCHAR(50);

            SELECT @OldTechnicianId     = TechnicianId,
                   @OldRole             = AssignmentRole,
                   @ExistingComplaintId = ComplaintId,
                   @OldStatus           = [Status]
            FROM TechnicianAssignments
            WHERE AssignmentId = @AssignmentId;

            UPDATE TechnicianAssignments
            SET TechnicianId       = ISNULL(@TechnicianId, TechnicianId),
                AssignmentRole     = ISNULL(@AssignmentRole, AssignmentRole),
                Notes              = ISNULL(@AssignmentNotes, Notes),
                ScheduledDate      = ISNULL(@ScheduledDate, ScheduledDate),
                StartTime          = ISNULL(@StartTime, StartTime),
                EndTime            = ISNULL(@EndTime, EndTime),
                EstimatedDuration  = ISNULL(@EstimatedDuration, EstimatedDuration),
                Priority           = ISNULL(@Priority, Priority),
                WorkDone           = ISNULL(@WorkDone, WorkDone),
                PartsUsed          = ISNULL(@PartsUsed, PartsUsed),
                CompletionRemarks  = ISNULL(@CompletionRemarks, CompletionRemarks),
                [Status]           = ISNULL(@Status, [Status]),
                CompletedAt        = CASE
                                        WHEN @Status = 'Completed' AND CompletedAt IS NULL
                                            THEN DATEADD(MINUTE, 330, GETUTCDATE())
                                        ELSE CompletedAt
                                     END,
                UpdatedAt          = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE AssignmentId = @AssignmentId;

            IF @TechnicianId IS NOT NULL AND @TechnicianId <> @OldTechnicianId
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, OldTechnicianId, NewTechnicianId,
                     OldRole, NewRole, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId, 'Reassigned',
                     @OldTechnicianId, @TechnicianId,
                     @OldRole, ISNULL(@AssignmentRole, @OldRole),
                     @UserId, 'Technician reassigned', DATEADD(MINUTE, 330, GETUTCDATE()));
            END

            IF @Status IS NOT NULL AND @Status <> ISNULL(@OldStatus, '')
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId,
                     CASE WHEN @Status = 'Completed' THEN 'Completed' ELSE 'StatusChanged' END,
                     @UserId,
                     CONCAT('Status → ', @Status), DATEADD(MINUTE, 330, GETUTCDATE()));

                IF @Status = 'Completed'
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM TechnicianAssignments
                         WHERE ComplaintId = @ExistingComplaintId
                           AND ISNULL([Status],'') NOT IN ('Completed', 'Removed')
                    )
                    BEGIN
                        UPDATE Complaints
                        SET StatusId     = 3,
                            ResolvedDate = DATEADD(MINUTE, 330, GETUTCDATE()),
                            UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
                        WHERE ComplaintId = @ExistingComplaintId
                          AND StatusId NOT IN (3, 4);

                        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
                        VALUES (@ExistingComplaintId, 3,
                                'Auto-resolved: all assignments completed',
                                @UserId, DATEADD(MINUTE, 330, GETUTCDATE()));
                    END
                END
            END
            ELSE IF @TechnicianId IS NULL OR @TechnicianId = @OldTechnicianId
            BEGIN
                INSERT INTO AssignmentAuditLog
                    (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
                VALUES
                    (@AssignmentId, @ExistingComplaintId, 'Updated', @UserId,
                     'Assignment details updated', DATEADD(MINUTE, 330, GETUTCDATE()));
            END

            SELECT CAST(1 AS BIT) AS Success,
                   CASE
                       WHEN @Status = 'Completed'                              THEN 'Assignment marked complete'
                       WHEN @TechnicianId IS NOT NULL AND @TechnicianId <> @OldTechnicianId THEN 'Technician reassigned successfully'
                       ELSE 'Assignment updated successfully'
                   END AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UNASSIGN_TECHNICIAN
        -- =====================================================
        ELSE IF @OperationType = 'UNASSIGN_TECHNICIAN'
        BEGIN
            DECLARE @UnassignComplaintId INT;
            SELECT @UnassignComplaintId = ComplaintId
            FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;

            UPDATE TechnicianAssignments
            SET Status    = 'Removed',
                UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE AssignmentId = @AssignmentId;

            INSERT INTO AssignmentAuditLog
                (AssignmentId, ComplaintId, Action, ChangedBy, Remarks, ChangedAt)
            VALUES
                (@AssignmentId, @UnassignComplaintId, 'Removed', @UserId,
                 'Technician unassigned', DATEADD(MINUTE, 330, GETUTCDATE()));

            SELECT CAST(1 AS BIT) AS Success,
                   'Technician unassigned successfully' AS Message,
                   @AssignmentId AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- ADD_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'ADD_SPARE'
        BEGIN
            DECLARE @PartName NVARCHAR(200), @PartNumber NVARCHAR(100);
            SELECT @PartName = PartName, @PartNumber = PartNumber
            FROM SpareParts WHERE SparePartId = @SparePartId;

            INSERT INTO SparePartRequests (
                ComplaintId, TechnicianId, SparePartId, Quantity,
                UrgencyLevel, Remarks, Status, RequestedAt, CreatedAt,
                PartName, PartNumber
            )
            VALUES (
                @ComplaintId, @TechnicianId, @SparePartId, ISNULL(@SpareQuantity, 1),
                ISNULL(@SpareUrgency, 'Normal'), @SpareRemarks, 'Requested',
                DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()),
                @PartName, @PartNumber
            );

            SET @SpareRequestId = SCOPE_IDENTITY();

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request added successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- UPDATE_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_SPARE'
        BEGIN
            UPDATE SparePartRequests
            SET Quantity     = ISNULL(@SpareQuantity, Quantity),
                UrgencyLevel = ISNULL(@SpareUrgency, UrgencyLevel),
                Remarks      = ISNULL(@SpareRemarks, Remarks),
                Status       = ISNULL(@SpareStatus, Status),
                ApprovedBy   = CASE WHEN @SpareStatus IN ('Approved','Rejected')
                                    THEN @UserId ELSE ApprovedBy END,
                ApprovedAt   = CASE WHEN @SpareStatus IN ('Approved','Rejected')
                                    THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE ApprovedAt END,
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE RequestId = @SpareRequestId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- DELETE_SPARE
        -- =====================================================
        ELSE IF @OperationType = 'DELETE_SPARE'
        BEGIN
            DELETE FROM SparePartRequests WHERE RequestId = @SpareRequestId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Spare part request deleted successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   @SpareRequestId AS RequestId;
        END

        -- =====================================================
        -- ADD_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'ADD_COMMENT'
        BEGIN
            DECLARE @CurrentStatusId INT;
            SELECT @CurrentStatusId = StatusId FROM Complaints WHERE ComplaintId = @ComplaintId;

            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, CreatedAt)
            VALUES (@ComplaintId, @CurrentStatusId, @CommentText, @UserId, DATEADD(MINUTE, 330, GETUTCDATE()));

            SET @CommentId = SCOPE_IDENTITY();

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment added successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- UPDATE_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'UPDATE_COMMENT'
        BEGIN
            UPDATE ComplaintTimeline
            SET Remarks = @CommentText
            WHERE TimelineId = @CommentId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment updated successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- DELETE_COMMENT
        -- =====================================================
        ELSE IF @OperationType = 'DELETE_COMMENT'
        BEGIN
            DELETE FROM ComplaintTimeline WHERE TimelineId = @CommentId;

            SELECT CAST(1 AS BIT) AS Success,
                   'Comment deleted successfully' AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   @CommentId AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

        -- =====================================================
        -- Dropdowns
        -- =====================================================
        ELSE IF @OperationType = 'GET_SPARE_PARTS_DROPDOWN'
        BEGIN
            SELECT SparePartId, PartName, PartNumber, StockQuantity, UnitPrice
            FROM SpareParts
            WHERE IsActive = 1
            ORDER BY PartName;
        END

        ELSE IF @OperationType = 'GET_TECHNICIANS_DROPDOWN'
        BEGIN
            SELECT
                t.TechnicianId,
                u.FullName AS TechnicianName,
                tp.Specialization,
                tp.AvailabilityStatus,
                tp.EmployeeCode
            FROM Technicians t
            INNER JOIN Users u ON t.UserId = u.UserId
            LEFT JOIN TechnicianProfiles tp ON t.UserId = tp.UserId
            WHERE t.IsActive = 1
            ORDER BY u.FullName;
        END

        -- =====================================================
        -- Unknown op
        -- =====================================================
        ELSE
        BEGIN
            SELECT CAST(0 AS BIT) AS Success,
                   'Unknown operation: ' + ISNULL(@OperationType,'<null>') AS Message,
                   CAST(NULL AS INT) AS AssignmentId,
                   CAST(NULL AS INT) AS CommentId,
                   CAST(NULL AS INT) AS RequestId;
        END

    END TRY
    BEGIN CATCH
        SELECT CAST(0 AS BIT) AS Success,
               ERROR_MESSAGE() AS Message,
               CAST(NULL AS INT) AS AssignmentId,
               CAST(NULL AS INT) AS CommentId,
               CAST(NULL AS INT) AS RequestId;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ManageSpareParts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================
-- STORED PROCEDURE FOR SPARE PARTS MASTER
-- ============================================
CREATE   PROCEDURE [dbo].[sp_ManageSpareParts]
    @OperationType NVARCHAR(20), -- 'GET', 'GETBYID', 'CREATE', 'UPDATE', 'DELETE', 'BULKDELETE', 'GETDROPDOWN'
    @SparePartId INT = NULL,
    @PartName NVARCHAR(200) = NULL,
    @PartNumber NVARCHAR(100) = NULL,
    @StockQuantity INT = NULL,
    @UnitPrice DECIMAL(10,2) = NULL,
    @IsActive BIT = 1,
    @CompanyId INT = NULL,
    @SearchTerm NVARCHAR(200) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20,
    @SortBy NVARCHAR(50) = 'SparePartId',
    @SortOrder NVARCHAR(4) = 'DESC'
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- ============================================
        -- GET ALL (with pagination and search)
        -- ============================================
        IF @OperationType = 'GET'
        BEGIN
            DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
            DECLARE @TotalCount INT;

            -- Get total count
            SELECT @TotalCount = COUNT(*)
            FROM SpareParts
            WHERE (@SearchTerm IS NULL OR 
                   PartName LIKE '%' + @SearchTerm + '%' OR
                   PartNumber LIKE '%' + @SearchTerm + '%')
              AND (@IsActive IS NULL OR IsActive = @IsActive);

            -- Get paginated data
            SELECT 
                SparePartId,
                PartName,
                PartNumber,
                ISNULL(StockQuantity, 0) AS StockQuantity,
                UnitPrice,
                IsActive,
                CompanyId,
                @TotalCount AS TotalCount,
                @PageNumber AS CurrentPage,
                CASE WHEN @TotalCount = 0 THEN 1 ELSE CEILING(CAST(@TotalCount AS FLOAT) / @PageSize) END AS TotalPages
            FROM SpareParts
            WHERE (@SearchTerm IS NULL OR 
                   PartName LIKE '%' + @SearchTerm + '%' OR
                   PartNumber LIKE '%' + @SearchTerm + '%')
              AND (@IsActive IS NULL OR IsActive = @IsActive)
            ORDER BY 
                CASE WHEN @SortBy = 'SparePartId' AND @SortOrder = 'ASC' THEN SparePartId END ASC,
                CASE WHEN @SortBy = 'SparePartId' AND @SortOrder = 'DESC' THEN SparePartId END DESC,
                CASE WHEN @SortBy = 'PartName' AND @SortOrder = 'ASC' THEN PartName END ASC,
                CASE WHEN @SortBy = 'PartName' AND @SortOrder = 'DESC' THEN PartName END DESC,
                CASE WHEN @SortBy = 'StockQuantity' AND @SortOrder = 'ASC' THEN StockQuantity END ASC,
                CASE WHEN @SortBy = 'StockQuantity' AND @SortOrder = 'DESC' THEN StockQuantity END DESC,
                CASE WHEN @SortBy = 'UnitPrice' AND @SortOrder = 'ASC' THEN UnitPrice END ASC,
                CASE WHEN @SortBy = 'UnitPrice' AND @SortOrder = 'DESC' THEN UnitPrice END DESC,
                SparePartId DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY;
        END
        
        -- ============================================
        -- GET BY ID
        -- ============================================
        ELSE IF @OperationType = 'GETBYID'
        BEGIN
            SELECT 
                SparePartId,
                PartName,
                PartNumber,
                ISNULL(StockQuantity, 0) AS StockQuantity,
                UnitPrice,
                IsActive,
                CompanyId
            FROM SpareParts
            WHERE SparePartId = @SparePartId;
        END
        
        -- ============================================
        -- CREATE
        -- ============================================
        ELSE IF @OperationType = 'CREATE'
        BEGIN
            -- Check for duplicate PartName
            IF EXISTS (SELECT 1 FROM SpareParts WHERE PartName = @PartName AND IsActive = 1)
            BEGIN
                SELECT 0 AS Success, 'Part name already exists' AS Message, NULL AS SparePartId;
                RETURN;
            END
            
            INSERT INTO SpareParts (PartName, PartNumber, StockQuantity, UnitPrice, IsActive, CompanyId)
            VALUES (@PartName, @PartNumber, ISNULL(@StockQuantity, 0), @UnitPrice, ISNULL(@IsActive, 1), @CompanyId);
            
            SELECT 1 AS Success, 'Spare part created successfully' AS Message, SCOPE_IDENTITY() AS SparePartId;
        END
        
        -- ============================================
        -- UPDATE
        -- ============================================
        ELSE IF @OperationType = 'UPDATE'
        BEGIN
            -- Check if exists
            IF NOT EXISTS (SELECT 1 FROM SpareParts WHERE SparePartId = @SparePartId)
            BEGIN
                SELECT 0 AS Success, 'Spare part not found' AS Message, NULL AS SparePartId;
                RETURN;
            END
            
            -- Check duplicate PartName (excluding current record)
            IF EXISTS (SELECT 1 FROM SpareParts WHERE PartName = @PartName AND SparePartId != @SparePartId AND IsActive = 1)
            BEGIN
                SELECT 0 AS Success, 'Part name already exists' AS Message, NULL AS SparePartId;
                RETURN;
            END
            
            UPDATE SpareParts 
            SET PartName = ISNULL(@PartName, PartName),
                PartNumber = @PartNumber,
                StockQuantity = ISNULL(@StockQuantity, StockQuantity),
                UnitPrice = @UnitPrice,
                IsActive = ISNULL(@IsActive, IsActive),
                CompanyId = @CompanyId
            WHERE SparePartId = @SparePartId;
            
            SELECT 1 AS Success, 'Spare part updated successfully' AS Message, @SparePartId AS SparePartId;
        END
        
        -- ============================================
        -- DELETE (Soft Delete)
        -- ============================================
        ELSE IF @OperationType = 'DELETE'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM SpareParts WHERE SparePartId = @SparePartId)
            BEGIN
                SELECT 0 AS Success, 'Spare part not found' AS Message;
                RETURN;
            END
            
            -- Check if part is used in any requests
            IF EXISTS (SELECT 1 FROM SparePartRequests WHERE SparePartId = @SparePartId)
            BEGIN
                -- Soft delete instead of hard delete
                UPDATE SpareParts SET IsActive = 0 WHERE SparePartId = @SparePartId;
                SELECT 1 AS Success, 'Spare part deactivated (has existing requests)' AS Message;
            END
            ELSE
            BEGIN
                DELETE FROM SpareParts WHERE SparePartId = @SparePartId;
                SELECT 1 AS Success, 'Spare part deleted successfully' AS Message;
            END
        END
        
        -- ============================================
        -- BULK DELETE
        -- ============================================
        ELSE IF @OperationType = 'BULKDELETE'
        BEGIN
            DECLARE @DeletedCount INT = 0;
            
            -- Create temp table for IDs
            DECLARE @Ids TABLE (Id INT);
            INSERT INTO @Ids SELECT value FROM STRING_SPLIT(@SearchTerm, ',');
            
            -- Soft delete (update IsActive = 0) for parts with existing requests
            UPDATE SpareParts 
            SET IsActive = 0 
            WHERE SparePartId IN (SELECT Id FROM @Ids)
              AND EXISTS (SELECT 1 FROM SparePartRequests WHERE SparePartId = SpareParts.SparePartId);
            
            SET @DeletedCount = @@ROWCOUNT;
            
            -- Hard delete for parts without requests
            DELETE FROM SpareParts 
            WHERE SparePartId IN (SELECT Id FROM @Ids)
              AND NOT EXISTS (SELECT 1 FROM SparePartRequests WHERE SparePartId = SpareParts.SparePartId);
            
            SET @DeletedCount = @DeletedCount + @@ROWCOUNT;
            
            SELECT 1 AS Success, CONCAT(@DeletedCount, ' spare part(s) processed') AS Message;
        END
        
        -- ============================================
        -- GET DROPDOWN
        -- ============================================
        ELSE IF @OperationType = 'GETDROPDOWN'
        BEGIN
            SELECT SparePartId, PartName, PartNumber, StockQuantity
            FROM SpareParts
            WHERE IsActive = 1
            ORDER BY PartName;
        END
        
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS SparePartId;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_MarkAllNotificationsAsRead]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_MarkAllNotificationsAsRead]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Notifications SET IsRead = 1, ReadAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE UserId = @UserId AND IsRead = 0;
    SELECT @@ROWCOUNT AS MarkedCount;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_MarkNotificationAsRead]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_MarkNotificationAsRead]
    @NotificationId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Notifications SET IsRead = 1, ReadAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE NotificationId = @NotificationId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetMenuAccess]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_Mgmt_GetMenuAccess]
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        m.MenuId, m.MenuName, m.MenuPath,
        m.ParentMenuId, m.SortOrder,
        ISNULL(rma.CanView,   0) AS CanView,
        ISNULL(rma.CanCreate, 0) AS CanCreate,
        ISNULL(rma.CanEdit,   0) AS CanEdit,
        ISNULL(rma.CanDelete, 0) AS CanDelete,
        CASE WHEN rma.AccessId IS NOT NULL THEN 1 ELSE 0 END AS HasAccess
    FROM MenuItems m
    LEFT JOIN RoleMenuAccess rma 
        ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId
    WHERE m.IsActive = 1 and m.module = 'Services'
    ORDER BY m.SortOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetMenuItems]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- sp_Mgmt_GetMenuItems
-- =============================================
CREATE   PROCEDURE [dbo].[sp_Mgmt_GetMenuItems]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MenuId, MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive
    FROM MenuItems ORDER BY SortOrder;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetRoles]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- sp_Mgmt_GetRoles
-- =============================================
CREATE   PROCEDURE [dbo].[sp_Mgmt_GetRoles]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, RoleName, Description, IsActive, CreatedAt FROM Roles ORDER BY RoleId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetUsers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_Mgmt_GetUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email,
           u.MobileNumber, u.IsActive,
           u.CreatedAt, r.RoleId, r.RoleName
    FROM Users u
    INNER JOIN CompanyUsers C ON C.UserId = U.UserId
    INNER JOIN Roles r ON r.RoleName = C.RoleInCompany
    ORDER BY u.CreatedAt DESC;
END;

GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveMenuAccess]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- sp_Mgmt_SaveMenuAccess  (upsert one row)
-- =============================================
CREATE   PROCEDURE [dbo].[sp_Mgmt_SaveMenuAccess]
    @RoleId    INT,
    @MenuId    INT,
    @CanView   BIT,
    @CanCreate BIT,
    @CanEdit   BIT,
    @CanDelete BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM RoleMenuAccess WHERE RoleId = @RoleId AND MenuId = @MenuId)
    BEGIN
        UPDATE RoleMenuAccess SET
            CanView   = @CanView,
            CanCreate = @CanCreate,
            CanEdit   = @CanEdit,
            CanDelete = @CanDelete
        WHERE RoleId = @RoleId AND MenuId = @MenuId;
    END
    ELSE
    BEGIN
        INSERT INTO RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        VALUES (@RoleId, @MenuId, @CanView, @CanCreate, @CanEdit, @CanDelete);
    END
    SELECT 'OK' AS Status;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveMenuAccessBulk]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- sp_Mgmt_SaveMenuAccessBulk  (full role save)
-- =============================================
CREATE   PROCEDURE [dbo].[sp_Mgmt_SaveMenuAccessBulk]
    @RoleId INT,
    @AccessJson NVARCHAR(MAX)   -- JSON array
AS
BEGIN
    SET NOCOUNT ON;
    -- Parse JSON: [{ menuId, canView, canCreate, canEdit, canDelete }]
    MERGE RoleMenuAccess AS target
    USING (
        SELECT 
            @RoleId AS RoleId,
            JSON_VALUE(value, '$.menuId')    AS MenuId,
            JSON_VALUE(value, '$.canView')   AS CanView,
            JSON_VALUE(value, '$.canCreate') AS CanCreate,
            JSON_VALUE(value, '$.canEdit')   AS CanEdit,
            JSON_VALUE(value, '$.canDelete') AS CanDelete
        FROM OPENJSON(@AccessJson)
    ) AS src ON target.RoleId = src.RoleId AND target.MenuId = src.MenuId
    WHEN MATCHED THEN UPDATE SET
        CanView   = src.CanView,
        CanCreate = src.CanCreate,
        CanEdit   = src.CanEdit,
        CanDelete = src.CanDelete
    WHEN NOT MATCHED THEN INSERT (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        VALUES (src.RoleId, src.MenuId, src.CanView, src.CanCreate, src.CanEdit, src.CanDelete);

    SELECT 'OK' AS Status;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveRole]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- sp_Mgmt_SaveRole
-- =============================================
CREATE PROCEDURE [dbo].[sp_Mgmt_SaveRole]
    @RoleId      INT = NULL,
    @RoleName    NVARCHAR(50),
    @Description NVARCHAR(200) = NULL,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @RoleId IS NULL OR @RoleId = 0
    BEGIN
        INSERT INTO Roles (RoleName, Description, IsActive, CreatedAt)
        VALUES (@RoleName, @Description, @IsActive, DATEADD(MINUTE, 330, GETUTCDATE()));
        SELECT SCOPE_IDENTITY() AS RoleId, 'Created' AS Status;
    END
    ELSE
    BEGIN
        UPDATE Roles SET
            RoleName    = @RoleName,
            Description = @Description,
            IsActive    = @IsActive
        WHERE RoleId = @RoleId;
        SELECT @RoleId AS RoleId, 'Updated' AS Status;
    END
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- sp_Mgmt_SaveUser  (Insert OR Update with Technician Handling)
-- WITH CompanyUsers Role Sync
-- =============================================
CREATE PROCEDURE [dbo].[sp_Mgmt_SaveUser]
    @UserId       INT = NULL,
    @FullName     NVARCHAR(150),
    @Email        NVARCHAR(200),
    @MobileNumber NVARCHAR(15),
    @RoleId       INT,
    @IsActive     BIT = 1,
    @PasswordHash NVARCHAR(500) = NULL,
    -- Technician specific fields (only used when RoleId = 3)
    @Specialization       NVARCHAR(100) = NULL,
    @SkillLevel           NVARCHAR(20) = 'Junior',
    @Zone                 NVARCHAR(100) = NULL,
    @ExperienceYears      INT = 0,
    @CertificationDetails NVARCHAR(500) = NULL,
    @MaxDailyAssignments  INT = 5,
    @JoinDate             DATE = NULL,
    @EmployeeCode         NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NewUserId INT;
    DECLARE @StatusMsg NVARCHAR(20);
    DECLARE @RoleName NVARCHAR(50);
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Get the role name for the given RoleId
        SELECT @RoleName = RoleName FROM Roles WHERE RoleId = @RoleId;
        
        -- =============================================
        -- USER TABLE OPERATION
        -- =============================================
        IF @UserId IS NULL OR @UserId = 0
        BEGIN
            -- INSERT NEW USER
            INSERT INTO Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash, CreatedAt, UpdatedAt)
            VALUES (@FullName, @Email, @MobileNumber, @RoleId, @IsActive, @PasswordHash, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()));
            
            SET @NewUserId = SCOPE_IDENTITY();
            SET @StatusMsg = 'Created';
        END
        ELSE
        BEGIN
            -- UPDATE EXISTING USER
            UPDATE Users SET
                FullName     = @FullName,
                Email        = @Email,
                MobileNumber = @MobileNumber,
                RoleId       = @RoleId,
                IsActive     = @IsActive,
                UpdatedAt    = DATEADD(MINUTE, 330, GETUTCDATE()),
                PasswordHash = CASE WHEN @PasswordHash IS NOT NULL THEN @PasswordHash ELSE PasswordHash END
            WHERE UserId = @UserId;
            
            SET @NewUserId = @UserId;
            SET @StatusMsg = 'Updated';
            
            -- =============================================
            -- UPDATE COMPANY USERS ROLE (SYNC with global role)
            -- =============================================
            -- Update RoleInCompany for all companies where this user is a member
            UPDATE CompanyUsers
            SET RoleInCompany = @RoleName,
                AssignedAt = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE UserId = @NewUserId 
              AND IsActive = 1
              AND RoleInCompany != @RoleName;  -- Only update if different
        END
        
        -- =============================================
        -- TECHNICIAN HANDLING (RoleId = 3)
        -- =============================================
        IF @RoleId = 3  -- Technician role
        BEGIN
            -- Auto generate Employee Code if not provided
            IF @EmployeeCode IS NULL OR @EmployeeCode = ''
            BEGIN
                DECLARE @LastCode INT = 0;
                SELECT @LastCode = ISNULL(MAX(
                    TRY_CAST(REPLACE(EmployeeCode, 'EMP-', '') AS INT)
                ), 0) FROM TechnicianProfiles WHERE EmployeeCode LIKE 'EMP-%';
                SET @EmployeeCode = 'EMP-' + RIGHT('000' + CAST(@LastCode + 1 AS VARCHAR), 3);
            END
            
            -- Set default JoinDate if not provided
            IF @JoinDate IS NULL
                SET @JoinDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
            
            -- Check if Technicians record exists
            IF NOT EXISTS (SELECT 1 FROM Technicians WHERE UserId = @NewUserId)
            BEGIN
                -- INSERT into Technicians table
                INSERT INTO Technicians (UserId, Specialization, SkillLevel, Zone, IsActive, CreatedAt, UpdatedAt)
                VALUES (@NewUserId, @Specialization, @SkillLevel, @Zone, @IsActive, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()));
            END
            ELSE
            BEGIN
                -- UPDATE existing Technicians record
                UPDATE Technicians SET
                    Specialization = ISNULL(@Specialization, Specialization),
                    SkillLevel = ISNULL(@SkillLevel, SkillLevel),
                    Zone = ISNULL(@Zone, Zone),
                    IsActive = @IsActive,
                    UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE UserId = @NewUserId;
            END
            
            -- Check if TechnicianProfiles record exists
            IF NOT EXISTS (SELECT 1 FROM TechnicianProfiles WHERE UserId = @NewUserId)
            BEGIN
                -- INSERT into TechnicianProfiles table
                INSERT INTO TechnicianProfiles (
                    UserId, EmployeeCode, Specialization, ExperienceYears,
                    CertificationDetails, MaxDailyAssignments, JoinDate, 
                    IsActive, AvailabilityStatus, CreatedDate, ModifiedDate
                )
                VALUES (
                    @NewUserId, @EmployeeCode, @Specialization, @ExperienceYears,
                    @CertificationDetails, @MaxDailyAssignments, @JoinDate,
                    @IsActive, 1, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE())
                );
            END
            ELSE
            BEGIN
                -- UPDATE existing TechnicianProfiles record
                UPDATE TechnicianProfiles SET
                    EmployeeCode = ISNULL(@EmployeeCode, EmployeeCode),
                    Specialization = ISNULL(@Specialization, Specialization),
                    ExperienceYears = ISNULL(@ExperienceYears, ExperienceYears),
                    CertificationDetails = ISNULL(@CertificationDetails, CertificationDetails),
                    MaxDailyAssignments = ISNULL(@MaxDailyAssignments, MaxDailyAssignments),
                    JoinDate = ISNULL(@JoinDate, JoinDate),
                    IsActive = @IsActive,
                    ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE UserId = @NewUserId;
            END
        END
        ELSE
        BEGIN
            -- If user is NOT a technician but was previously a technician,
            -- we should mark technician records as inactive (optional)
            IF EXISTS (SELECT 1 FROM Technicians WHERE UserId = @NewUserId AND IsActive = 1)
            BEGIN
                UPDATE Technicians SET IsActive = 0, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) 
                WHERE UserId = @NewUserId;
            END
            
            IF EXISTS (SELECT 1 FROM TechnicianProfiles WHERE UserId = @NewUserId AND IsActive = 1)
            BEGIN
                UPDATE TechnicianProfiles SET IsActive = 0, ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
                WHERE UserId = @NewUserId;
            END
        END
        
        COMMIT TRANSACTION;
        
        -- Return result with user info
        SELECT 
            @NewUserId AS UserId, 
            @StatusMsg AS Status,
            @RoleName AS RoleName;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        -- Return error information
        SELECT 
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_SEVERITY() AS ErrorSeverity,
            ERROR_STATE() AS ErrorState,
            ERROR_PROCEDURE() AS ErrorProcedure,
            ERROR_LINE() AS ErrorLine,
            ERROR_MESSAGE() AS ErrorMessage;
        
        -- Return error result
        SELECT 0 AS UserId, 'Error: ' + ERROR_MESSAGE() AS Status, NULL AS RoleName;
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Notification_Delete]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Notification_Delete]
    @NotificationId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM Notifications WHERE NotificationId = @NotificationId;
    SELECT 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Notification_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ████████████████████████████████████████████████████████████████
-- 11. NOTIFICATION CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE   PROCEDURE [dbo].[sp_Notification_GetAll]
    @UserId INT, @IsRead BIT = NULL, @PageNumber INT = 1, @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT n.NotificationId, n.Title, n.[Message], n.NotificationType, n.ReferenceId, n.ReferenceType, n.IsRead, n.CreatedAt,
           COUNT(*) OVER() AS TotalCount,
           (SELECT COUNT(*) FROM Notifications WHERE UserId = @UserId AND IsRead = 0) AS UnreadCount
    FROM Notifications n WHERE n.UserId = @UserId AND (@IsRead IS NULL OR n.IsRead = @IsRead)
    ORDER BY n.CreatedAt DESC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Notification_GetUnreadCount]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Notification_GetUnreadCount]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS UnreadCount FROM Notifications WHERE UserId = @UserId AND IsRead = 0;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Notification_MarkAllAsRead]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Notification_MarkAllAsRead]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Notifications SET IsRead = 1, ReadAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE UserId = @UserId AND IsRead = 0;
    SELECT @@ROWCOUNT AS MarkedCount, 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Notification_MarkAsRead]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Notification_MarkAsRead]
    @NotificationId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Notifications SET IsRead = 1, ReadAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE NotificationId = @NotificationId;
    SELECT 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 5. SP: Register Product (customer's own product)
-- ============================================================
CREATE PROCEDURE [dbo].[sp_Product_Create]
    @CustomerId        INT,
    @ProductName       NVARCHAR(400),
    @SerialNumber      NVARCHAR(200),
    @Brand             NVARCHAR(200) = NULL,
    @Model             NVARCHAR(200) = NULL,
    @PurchaseDate      DATE = NULL,
    @WarrantyExpiryDate DATE = NULL,
    @ProductMasterId   INT = NULL,
    @NewProductId      INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM Products WHERE SerialNumber = @SerialNumber AND CustomerId = @CustomerId)
    BEGIN
        SET @NewProductId = -1;
        SELECT -1 AS ProductId, 'Product with this serial number already registered' AS [Message];
        RETURN;
    END

    INSERT INTO Products (CustomerId, ProductName, SerialNumber, Brand, Model, PurchaseDate, WarrantyExpiryDate, IsActive, CreatedAt)
    VALUES (@CustomerId, @ProductName, @SerialNumber, @Brand, @Model, @PurchaseDate, @WarrantyExpiryDate, 1, DATEADD(MINUTE, 330, GETUTCDATE()));

    SET @NewProductId = SCOPE_IDENTITY();
    SELECT @NewProductId AS ProductId, 'Product registered successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Product_GetAll]
    @CustomerId INT = NULL, @Brand NVARCHAR(100) = NULL, @Category NVARCHAR(100) = NULL,
    @WarrantyStatus NVARCHAR(20) = NULL, @SearchTerm NVARCHAR(100) = NULL,
    @PageNumber INT = 1, @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.Category,
           p.PurchaseDate, p.WarrantyExpiryDate, p.IsActive,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           c.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.ProductId = p.ProductId) AS TotalComplaints,
           p.CreatedAt, COUNT(*) OVER() AS TotalCount
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.IsActive = 1 AND (@CustomerId IS NULL OR p.CustomerId = @CustomerId)
    AND (@Brand IS NULL OR p.Brand = @Brand) AND (@Category IS NULL OR p.Category = @Category)
    AND (@WarrantyStatus IS NULL
         OR (@WarrantyStatus = 'Active' AND p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE))
         OR (@WarrantyStatus = 'Expired' AND p.WarrantyExpiryDate < CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)))
    AND (@SearchTerm IS NULL OR p.ProductName LIKE '%' + @SearchTerm + '%' OR p.SerialNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY p.CreatedAt DESC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_GetByCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 6. SP: Get Products by Customer (with images)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_Product_GetByCustomer]
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Table 0: Products
    SELECT ProductId, ProductName, SerialNumber, Brand, Model,
           PurchaseDate, WarrantyExpiryDate, IsActive
    FROM Products WHERE CustomerId = @CustomerId AND IsActive = 1
    ORDER BY CreatedAt DESC;

    -- Table 1: Images
    SELECT pi.ImageId, pi.ProductId, pi.ImageType, pi.ImagePath, pi.UploadedAt
    FROM ProductImages pi
    INNER JOIN Products p ON pi.ProductId = p.ProductId
    WHERE p.CustomerId = @CustomerId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_GetById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Product_GetById]
    @ProductId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.CustomerId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.Category,
           p.PurchaseDate, p.WarrantyExpiryDate, p.IsActive,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           c.CustomerName, c.MobileNumber AS CustomerMobile,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.ProductId = p.ProductId) AS TotalComplaints, p.CreatedAt
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId WHERE p.ProductId = @ProductId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_Search]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Product_Search]
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 10 p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.ModelNumber, c.CustomerName, c.CustomerId
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.ProductName LIKE '%' + @SearchTerm + '%' OR p.SerialNumber LIKE '%' + @SearchTerm + '%' OR p.ModelNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY p.ProductName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Product_Update]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Product_Update]
    @ProductId INT, @ProductName NVARCHAR(200) = NULL, @SerialNumber NVARCHAR(100) = NULL,
    @ModelNumber NVARCHAR(100) = NULL, @Brand NVARCHAR(100) = NULL, @Category NVARCHAR(100) = NULL,
    @PurchaseDate DATE = NULL, @WarrantyExpiryDate DATE = NULL, @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Products SET ProductName = ISNULL(@ProductName, ProductName), SerialNumber = ISNULL(@SerialNumber, SerialNumber),
        ModelNumber = ISNULL(@ModelNumber, ModelNumber), Brand = ISNULL(@Brand, Brand), Category = ISNULL(@Category, Category),
        PurchaseDate = ISNULL(@PurchaseDate, PurchaseDate), WarrantyExpiryDate = ISNULL(@WarrantyExpiryDate, WarrantyExpiryDate),
        IsActive = ISNULL(@IsActive, IsActive), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ProductId = @ProductId;
    SELECT 1 AS Success, 'Product updated.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_ProductImage_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_ProductImage_Create]
    @ProductId  INT,
    @ImageType  NVARCHAR(50),
    @ImagePath  NVARCHAR(500),
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM Products WHERE ProductId = @ProductId AND CustomerId = @CustomerId)
    BEGIN
        RETURN;
    END
    INSERT INTO ProductImages (ProductId, ImageType, ImagePath)
    VALUES (@ProductId, @ImageType, @ImagePath);
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ProductMaster_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ============================================================
-- 2. SP: Get Product Master List (for autocomplete)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_ProductMaster_GetAll]
    @SearchTerm NVARCHAR(100) = NULL,
    @Category   NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ProductMasterId, ProductName, Brand, Category, Model, Description, WarrantyMonths
    FROM ProductMaster
    WHERE IsActive = 1
      AND (@SearchTerm IS NULL
           OR ProductName LIKE '%' + @SearchTerm + '%'
           OR Brand LIKE '%' + @SearchTerm + '%'
           OR Model LIKE '%' + @SearchTerm + '%')
      AND (@Category IS NULL OR Category = @Category)
    ORDER BY Category, ProductName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ProductMaster_Upsert]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_ProductMaster_Upsert]
    @OperationType VARCHAR(20), -- 'CREATE', 'UPDATE', 'DELETE', 'GET', 'GETBYID', 'GETDROPDOWNS', 'BULKDELETE', 'BULKUPDATE'
    @ProductMasterId INT = NULL,
    @ProductCode VARCHAR(50) = NULL,
    @ProductName VARCHAR(200) = NULL,
    @Brand VARCHAR(100) = 'AEROFIT',
    @Category VARCHAR(100) = NULL,
    @SubCategory VARCHAR(100) = NULL,
    @Model VARCHAR(100) = NULL,
    @Description VARCHAR(500) = NULL,
    @MRP DECIMAL(18,2) = NULL,
    @Org VARCHAR(10) = NULL,
    @PriceChangeStatus VARCHAR(50) = NULL,
    @PriceEffectiveDate DATE = NULL,
    @WarrantyMonths INT = 12,
    @IsActive BIT = 1,
    @UserId INT = NULL,
    @SearchTerm VARCHAR(200) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20,
    @SortColumn VARCHAR(50) = 'ProductMasterId',
    @SortDirection VARCHAR(4) = 'DESC',
    @ProductIds VARCHAR(MAX) = NULL  -- For bulk operations (comma-separated IDs)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- CREATE OPERATION
        IF @OperationType = 'CREATE'
        BEGIN
            INSERT INTO [dbo].[ProductMaster] (
                ProductCode, ProductName, Brand, Category, SubCategory, Model, 
                Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate, 
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate
            )
            VALUES (
                @ProductCode, @ProductName, @Brand, @Category, @SubCategory, @Model,
                @Description, @MRP, @Org, @PriceChangeStatus, @PriceEffectiveDate,
                @WarrantyMonths, @IsActive, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE())
            );

            SELECT @ProductMasterId = SCOPE_IDENTITY();

            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Product created successfully' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
        END

        -- UPDATE OPERATION
        ELSE IF @OperationType = 'UPDATE'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [dbo].[ProductMaster] WHERE ProductMasterId = @ProductMasterId)
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
                RETURN;
            END

            UPDATE [dbo].[ProductMaster] SET
                ProductCode = ISNULL(@ProductCode, ProductCode),
                ProductName = ISNULL(@ProductName, ProductName),
                Brand = ISNULL(@Brand, Brand),
                Category = ISNULL(@Category, Category),
                SubCategory = ISNULL(@SubCategory, SubCategory),
                Model = ISNULL(@Model, Model),
                Description = ISNULL(@Description, Description),
                MRP = ISNULL(@MRP, MRP),
                Org = ISNULL(@Org, Org),
                PriceChangeStatus = ISNULL(@PriceChangeStatus, PriceChangeStatus),
                PriceEffectiveDate = ISNULL(@PriceEffectiveDate, PriceEffectiveDate),
                WarrantyMonths = ISNULL(@WarrantyMonths, WarrantyMonths),
                IsActive = ISNULL(@IsActive, IsActive),
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId = @ProductMasterId;

            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Product updated successfully' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
        END

        -- DELETE OPERATION (Soft Delete)
        ELSE IF @OperationType = 'DELETE'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [dbo].[ProductMaster] WHERE ProductMasterId = @ProductMasterId)
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
                RETURN;
            END

            UPDATE [dbo].[ProductMaster] SET 
                IsActive = 0,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId = @ProductMasterId;

            SELECT 1 AS Result, 'Product deleted successfully' AS Message, @ProductMasterId AS ProductMasterId;
        END

        -- BULK DELETE OPERATION
        ELSE IF @OperationType = 'BULKDELETE'
        BEGIN
            IF @ProductIds IS NULL OR @ProductIds = ''
            BEGIN
                SELECT 0 AS Result, 'No product IDs provided' AS Message;
                RETURN;
            END

            -- Create temp table for IDs
            DECLARE @Ids TABLE (Id INT);
            INSERT INTO @Ids
            SELECT value FROM STRING_SPLIT(@ProductIds, ',');

            UPDATE [dbo].[ProductMaster] SET 
                IsActive = 0,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId IN (SELECT Id FROM @Ids);

            DECLARE @DeletedCount INT = @@ROWCOUNT;
            SELECT 1 AS Result, CONCAT(@DeletedCount, ' products deleted successfully') AS Message;
        END

        -- BULK UPDATE STATUS
        ELSE IF @OperationType = 'BULKUPDATE'
        BEGIN
            IF @ProductIds IS NULL OR @ProductIds = ''
            BEGIN
                SELECT 0 AS Result, 'No product IDs provided' AS Message;
                RETURN;
            END

            DECLARE @Ids2 TABLE (Id INT);
            INSERT INTO @Ids2
            SELECT value FROM STRING_SPLIT(@ProductIds, ',');

            UPDATE [dbo].[ProductMaster] SET 
                IsActive = @IsActive,
                UpdatedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE ProductMasterId IN (SELECT Id FROM @Ids2);

            DECLARE @UpdatedCount INT = @@ROWCOUNT;
            SELECT 1 AS Result, CONCAT(@UpdatedCount, ' products updated successfully') AS Message;
        END

        -- GET BY ID OPERATION
        ELSE IF @OperationType = 'GETBYID'
        BEGIN
            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                1 AS Result, 'Success' AS Message
            FROM [dbo].[ProductMaster] 
            WHERE ProductMasterId = @ProductMasterId;
            
            IF @@ROWCOUNT = 0
            BEGIN
                SELECT 0 AS Result, 'Product not found' AS Message;
            END
        END

        -- GET ALL WITH PAGINATION AND SEARCH
        ELSE IF @OperationType = 'GET'
        BEGIN
            DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
            DECLARE @TotalCount INT;

            -- Get total count
            SELECT @TotalCount = COUNT(*)
            FROM [dbo].[ProductMaster]
            WHERE (@SearchTerm IS NULL OR 
                   ProductCode LIKE '%' + @SearchTerm + '%' OR
                   ProductName LIKE '%' + @SearchTerm + '%' OR
                   Model LIKE '%' + @SearchTerm + '%' OR
                   Category LIKE '%' + @SearchTerm + '%' OR
                   Description LIKE '%' + @SearchTerm + '%')
                   AND IsActive = 1;

            -- Get paginated data
            SELECT 
                ProductMasterId, ProductCode, ProductName, Brand, Category, SubCategory,
                Model, Description, MRP, Org, PriceChangeStatus, PriceEffectiveDate,
                WarrantyMonths, IsActive, CreatedDate, UpdatedDate,
                @TotalCount AS TotalCount,
                @PageNumber AS CurrentPage,
                CASE WHEN @TotalCount = 0 THEN 1 ELSE CEILING(CAST(@TotalCount AS FLOAT) / @PageSize) END AS TotalPages,
                1 AS Result, 'Success' AS Message
            FROM [dbo].[ProductMaster]
            WHERE (@SearchTerm IS NULL OR 
                   ProductCode LIKE '%' + @SearchTerm + '%' OR
                   ProductName LIKE '%' + @SearchTerm + '%' OR
                   Model LIKE '%' + @SearchTerm + '%' OR
                   Category LIKE '%' + @SearchTerm + '%' OR
                   Description LIKE '%' + @SearchTerm + '%')
                   AND IsActive = 1
            ORDER BY 
                CASE WHEN @SortColumn = 'ProductMasterId' AND @SortDirection = 'ASC' THEN ProductMasterId END ASC,
                CASE WHEN @SortColumn = 'ProductMasterId' AND @SortDirection = 'DESC' THEN ProductMasterId END DESC,
                CASE WHEN @SortColumn = 'ProductCode' AND @SortDirection = 'ASC' THEN ProductCode END ASC,
                CASE WHEN @SortColumn = 'ProductCode' AND @SortDirection = 'DESC' THEN ProductCode END DESC,
                CASE WHEN @SortColumn = 'ProductName' AND @SortDirection = 'ASC' THEN ProductName END ASC,
                CASE WHEN @SortColumn = 'ProductName' AND @SortDirection = 'DESC' THEN ProductName END DESC,
                CASE WHEN @SortColumn = 'Model' AND @SortDirection = 'ASC' THEN Model END ASC,
                CASE WHEN @SortColumn = 'Model' AND @SortDirection = 'DESC' THEN Model END DESC,
                CASE WHEN @SortColumn = 'MRP' AND @SortDirection = 'ASC' THEN MRP END ASC,
                CASE WHEN @SortColumn = 'MRP' AND @SortDirection = 'DESC' THEN MRP END DESC,
                CASE WHEN @SortColumn = 'Category' AND @SortDirection = 'ASC' THEN Category END ASC,
                CASE WHEN @SortColumn = 'Category' AND @SortDirection = 'DESC' THEN Category END DESC,
                ProductMasterId DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY;
        END

        -- GET DROPDOWN DATA - Now returns single result set with Type column
        ELSE IF @OperationType = 'GETDROPDOWNS'
        BEGIN
            -- Categories
            SELECT 'Category' AS Type, Category AS Value, Category AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Category IS NOT NULL AND Category != ''
            GROUP BY Category
            
            UNION ALL
            
            -- Sub Categories
            SELECT 'SubCategory' AS Type, SubCategory AS Value, SubCategory AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND SubCategory IS NOT NULL AND SubCategory != ''
            GROUP BY SubCategory
            
            UNION ALL
            
            -- Brands
            SELECT 'Brand' AS Type, Brand AS Value, Brand AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Brand IS NOT NULL AND Brand != ''
            GROUP BY Brand
            
            UNION ALL
            
            -- Orgs
            SELECT 'Org' AS Type, Org AS Value, Org AS Label 
            FROM [dbo].[ProductMaster] 
            WHERE IsActive = 1 AND Org IS NOT NULL AND Org != ''
            GROUP BY Org
            
            ORDER BY Type, Label;
        END

    END TRY
    BEGIN CATCH
        SELECT 
            0 AS Result,
            ERROR_MESSAGE() AS Message,
            ERROR_NUMBER() AS ErrorNumber,
            ERROR_LINE() AS ErrorLine;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Project_GetLocations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   2. Location procs
   ============================================================================= */
CREATE   PROCEDURE [dbo].[sp_Project_GetLocations]
    @CompanyId INT, @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.LocationId, l.LocationName, l.LocationCode, l.City
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId AND l.IsActive = 1
    ORDER BY l.LocationName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_QuickComplaint_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_QuickComplaint_Create]
    @CustomerId   INT,
    @Subject      NVARCHAR(200),
    @Description  NVARCHAR(2000) = NULL,
    @Category     NVARCHAR(100) = NULL,
    @BrandName    NVARCHAR(100) = NULL,
    @ModelNumber  NVARCHAR(100) = NULL,
    @Latitude     DECIMAL(10,7) = NULL,
    @Longitude    DECIMAL(10,7) = NULL,
    @LocationName NVARCHAR(200) = NULL,
    @ImageBase64  NVARCHAR(MAX) = NULL,
    @ImageName    NVARCHAR(200) = NULL,
    @ContentType  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- ProductId is NULL for quick complaints
        DECLARE @ProductId INT = NULL;
        
        -- Auto generate complaint number
        DECLARE @Seq INT;
        SELECT @Seq = ISNULL(MAX(ComplaintId), 0) + 1 FROM Complaints;
        DECLARE @CmpNo NVARCHAR(30) = 'CMP-' + FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()), 'yyyyMMdd') + '-' + RIGHT('0000' + CAST(@Seq AS VARCHAR), 4);
        
        -- Insert into Complaints table with all new fields
        INSERT INTO Complaints (
            ComplaintNumber, 
            CustomerId, 
            ProductId, 
            Subject, 
            Description,
            Priority, 
            StatusId, 
            SLADeadline, 
            IsActive, 
            CreatedAt, 
            UpdatedAt,
            Latitude, 
            Longitude, 
            LocationAddress,
            Category,
            BrandName,
            ModelNumber,
            LocationName
        )
        VALUES (
            @CmpNo, 
            @CustomerId, 
            NULL, 
            @Subject, 
            @Description,
            'Medium', 
            1, 
            DATEADD(HOUR, 24, DATEADD(MINUTE, 330, GETUTCDATE())), 
            1, 
            DATEADD(MINUTE, 330, GETUTCDATE()), 
            DATEADD(MINUTE, 330, GETUTCDATE()),
            @Latitude, 
            @Longitude, 
            @LocationName,
            @Category,
            @BrandName,
            @ModelNumber,
            @LocationName
        );
        
        DECLARE @NewComplaintId INT = SCOPE_IDENTITY();
        
        -- Insert image as Base64 if provided with UploadedBy
        IF @ImageBase64 IS NOT NULL AND @ImageBase64 != ''
        BEGIN
            INSERT INTO ComplaintImages (
                ComplaintId, 
                ImagePath, 
                ImageType, 
                UploadedAt,
                ImageData, 
                ImageName, 
                ContentType,
                UploadedBy
            )
            VALUES (
                @NewComplaintId, 
                'Base64_Image', 
                1, 
                DATEADD(MINUTE, 330, GETUTCDATE()),
                @ImageBase64, 
                @ImageName, 
                @ContentType,
                @CustomerId  -- Using CustomerId as UploadedBy
            );
        END
        
        COMMIT TRANSACTION;
        
        -- Return success response
        SELECT 
            @NewComplaintId AS ComplaintId, 
            @CmpNo AS ComplaintNumber, 
            'Quick complaint registered successfully' AS [Message];
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 
            ROLLBACK TRANSACTION;
        
        -- Return error response
        SELECT 
            0 AS ComplaintId, 
            NULL AS ComplaintNumber, 
            ERROR_MESSAGE() AS [Message];
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ReassignTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_ReassignTechnician]
    @AssignmentId INT,
    @NewTechnicianId INT,
    @Remarks NVARCHAR(500) = NULL,
    @ReassignedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @OldTechnicianId INT;
    DECLARE @ComplaintId INT;
    DECLARE @AssignmentRole NVARCHAR(20);
    
    SELECT @OldTechnicianId = TechnicianId, @ComplaintId = ComplaintId, @AssignmentRole = AssignmentRole
    FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;
    
    -- Update assignment
    UPDATE TechnicianAssignments 
    SET TechnicianId = @NewTechnicianId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE AssignmentId = @AssignmentId;
    
    -- Log audit
    INSERT INTO AssignmentAuditLog (AssignmentId, Action, OldTechnicianId, NewTechnicianId, NewRole, ChangedBy, Remarks)
    VALUES (@AssignmentId, 'Reassigned', @OldTechnicianId, @NewTechnicianId, @AssignmentRole, @ReassignedBy, @Remarks);
    
    -- Timeline
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    SELECT @ComplaintId, StatusId, 'Technician reassigned: ' + ISNULL(@Remarks, ''), @ReassignedBy
    FROM Complaints WHERE ComplaintId = @ComplaintId;
    
    SELECT 1 AS Success, 'Technician reassigned successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_RecordComplaintPayment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_RecordComplaintPayment]
    @ComplaintId INT,
    @PaymentType VARCHAR(50),
    @ServiceChargeAmount DECIMAL(18,2),
    @SparePartsAmount DECIMAL(18,2),
    @DiscountAmount DECIMAL(18,2),
    @TotalAmount DECIMAL(18,2),
    @AmountPaid DECIMAL(18,2),
    @PaymentMethod VARCHAR(50),
    @UpiIdUsed VARCHAR(100) = NULL,
    @TransactionReference VARCHAR(200) = NULL,
    @Remarks NVARCHAR(MAX) = NULL,
    @CreatedBy INT = NULL
AS
BEGIN
    INSERT INTO [dbo].[ComplaintPayments] 
    (ComplaintId, PaymentType, ServiceChargeAmount, SparePartsAmount, DiscountAmount, TotalAmount, AmountPaid, PaymentMethod, UpiIdUsed, TransactionReference, PaymentStatus, Remarks, CreatedBy)
    VALUES
    (@ComplaintId, @PaymentType, @ServiceChargeAmount, @SparePartsAmount, @DiscountAmount, @TotalAmount, @AmountPaid, @PaymentMethod, @UpiIdUsed, @TransactionReference, 'Success', @Remarks, @CreatedBy);

    SELECT SCOPE_IDENTITY() AS PaymentId, 1 AS Success, 'Payment recorded successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_ReopenComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_ReopenComplaint]
    @ComplaintId INT,
    @Remarks NVARCHAR(500),
    @ReopenedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ReopenStatusId INT = 1; -- Open status
    
    UPDATE Complaints 
    SET StatusId = @ReopenStatusId,
        ClosedAt = NULL,
        SLADeadline = DATEADD(HOUR, 24, DATEADD(MINUTE, 330, GETUTCDATE())),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;
    
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    VALUES (@ComplaintId, @ReopenStatusId, 'Reopened: ' + @Remarks, @ReopenedBy);
    
    SELECT 1 AS Success, 'Complaint reopened successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPart_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.4  sp_RepairPart_GetAll
--       Paginated list for Admin / HQ management screen.
--       FullName comes from Users joined via Technicians.UserId.
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPart_GetAll]
    @Status       NVARCHAR(50) = NULL,
    @ComplaintId  INT          = NULL,
    @TechnicianId INT          = NULL,
    @PageNumber   INT          = 1,
    @PageSize     INT          = 30
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RepairRequestId,
        r.ComplaintId,
        c.ComplaintNumber,
        r.AssignmentId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.StatusNotes,
        u.FullName       AS TechnicianName,
        cu.CustomerName,
        p.ProductName,
        r.CreatedAt,
        r.UpdatedAt,
        (SELECT COUNT(*) FROM [dbo].[RepairPartImages] i
         WHERE i.RepairRequestId = r.RepairRequestId) AS ImageCount,
        COUNT(*) OVER ()                              AS TotalCount
    FROM [dbo].[RepairPartRequests] r
    LEFT JOIN [dbo].[Complaints]  c  ON c.ComplaintId  = r.ComplaintId
    LEFT JOIN [dbo].[Technicians] t  ON t.TechnicianId = r.TechnicianId
    LEFT JOIN [dbo].[Users]       u  ON u.UserId       = t.UserId
    LEFT JOIN [dbo].[Customers]   cu ON cu.CustomerId  = r.CustomerId
    LEFT JOIN [dbo].[Products]    p  ON p.ProductId    = r.ProductId
    WHERE
        (@Status       IS NULL OR r.Status       = @Status)
        AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
        AND (@TechnicianId IS NULL OR r.TechnicianId = @TechnicianId)
    ORDER BY r.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPart_GetByComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.5  sp_RepairPart_GetByComplaint
--       All repair requests for one complaint.
--       Used by: Complaint Detail Popup → Repairs tab
--                Work Order Detail      → Repairs tab
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPart_GetByComplaint]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RepairRequestId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.StatusNotes,
        u.FullName AS TechnicianName,
        r.CreatedAt,
        r.UpdatedAt,
        (SELECT COUNT(*) FROM [dbo].[RepairPartImages] i
         WHERE i.RepairRequestId = r.RepairRequestId) AS ImageCount
    FROM [dbo].[RepairPartRequests] r
    LEFT JOIN [dbo].[Technicians] t ON t.TechnicianId = r.TechnicianId
    LEFT JOIN [dbo].[Users]       u ON u.UserId       = t.UserId
    WHERE r.ComplaintId = @ComplaintId
    ORDER BY r.CreatedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPart_GetImageBase64]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.7  sp_RepairPart_GetImageBase64
--       Returns full base-64 string for a single image.
--       Called on demand when user clicks a thumbnail.
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPart_GetImageBase64]
    @ImageId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ImagePath
    FROM [dbo].[RepairPartImages]
    WHERE ImageId = @ImageId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPart_GetImages]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.6  sp_RepairPart_GetImages
--       Image metadata only (no blob) — for thumbnail grid.
--       Frontend lazy-loads each base64 on click via 3.7.
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPart_GetImages]
    @RepairRequestId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ImageId, ImageType, CreatedAt
    FROM [dbo].[RepairPartImages]
    WHERE RepairRequestId = @RepairRequestId
    ORDER BY CreatedAt ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPartImage_Save]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.2  sp_RepairPartImage_Save
--       Saves one base-64 image against a repair request.
--       Returns new ImageId.
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPartImage_Save]
    @RepairRequestId INT,
    @ImagePath       NVARCHAR(MAX),
    @ImageType       NVARCHAR(50) = 'Other'
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[RepairPartImages] (RepairRequestId, ImagePath, ImageType, CreatedAt)
    VALUES (@RepairRequestId, @ImagePath, @ImageType, GETDATE());

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ImageId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPartRequest_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
--  SECTION 3 : STORED PROCEDURES
-- ============================================================

-- ------------------------------------------------------------
--  3.1  sp_RepairPartRequest_Create
--       Technician submits a part to HQ for repair.
--       Returns new RepairRequestId (first column, first row).
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPartRequest_Create]
    @ComplaintId      INT,
    @AssignmentId     INT,
    @TechnicianId     INT,
    @CustomerId       INT            = NULL,
    @ProductId        INT            = NULL,
    @PartName         NVARCHAR(200)  = NULL,
    @PartSerialNumber NVARCHAR(100)  = NULL,
    @Notes            NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[RepairPartRequests]
        (ComplaintId, AssignmentId, TechnicianId, CustomerId, ProductId,
         PartName, PartSerialNumber, Notes, Status, CreatedAt)
    VALUES
        (@ComplaintId, @AssignmentId, @TechnicianId, @CustomerId, @ProductId,
         @PartName, @PartSerialNumber, @Notes, 'Requested', GETDATE());

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS RepairRequestId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_RepairPartRequest_UpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ------------------------------------------------------------
--  3.3  sp_RepairPartRequest_UpdateStatus
--       Drives all status transitions.
--       Valid chain: Requested → ReceivedAtHQ → UnderRepair
--                   → Repaired → Dispatched → Delivered → Resolved
--       Returns: Success INT (1/0), Message NVARCHAR
-- ------------------------------------------------------------
CREATE   PROCEDURE [dbo].[sp_RepairPartRequest_UpdateStatus]
    @RepairRequestId INT,
    @Status          NVARCHAR(50),
    @Notes           NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM [dbo].[RepairPartRequests]
        WHERE RepairRequestId = @RepairRequestId
    )
    BEGIN
        SELECT 0 AS Success, 'Repair request not found' AS Message;
        RETURN;
    END

    UPDATE [dbo].[RepairPartRequests]
    SET
        Status      = @Status,
        StatusNotes = @Notes,
        UpdatedAt   = GETDATE()
    WHERE RepairRequestId = @RepairRequestId;

    SELECT 1 AS Success, 'Status updated to ' + @Status AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_ComplaintSummary]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ==========================================
-- REPORTS SPs
-- ==========================================
CREATE PROCEDURE [dbo].[sp_Report_ComplaintSummary]
    @StartDate DATE,
    @EndDate DATE,
    @StatusId INT = NULL,
    @PriorityId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        CAST(c.CreatedDate AS DATE) AS ReportDate,
        c.StatusId, c.PriorityId,
        COUNT(*) AS ComplaintCount,
        SUM(CASE WHEN c.IsWarranty=1 THEN 1 ELSE 0 END) AS WarrantyCount,
        SUM(CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND c.StatusId NOT IN (3,4) THEN 1 ELSE 0 END) AS SLABreached,
        AVG(CASE WHEN c.ResolvedDate IS NOT NULL THEN DATEDIFF(HOUR, c.CreatedDate, c.ResolvedDate) END) AS AvgResolutionHours
    FROM Complaints c
    WHERE c.CreatedDate BETWEEN @StartDate AND @EndDate AND c.IsActive=1
    AND (@StatusId IS NULL OR c.StatusId=@StatusId)
    AND (@PriorityId IS NULL OR c.PriorityId=@PriorityId)
    GROUP BY CAST(c.CreatedDate AS DATE), c.StatusId, c.PriorityId
    ORDER BY ReportDate;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_CustomerComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Report_CustomerComplaint]
    @FromDate DATE, @ToDate DATE, @TopN INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@TopN) cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City,
        COUNT(c.ComplaintId) AS TotalComplaints,
        SUM(CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 1 ELSE 0 END) AS Resolved,
        SUM(CASE WHEN cs.StatusName NOT IN ('Closed','WorkCompleted') THEN 1 ELSE 0 END) AS Pending,
        AVG(CAST(cf.Rating AS DECIMAL(3,2))) AS AvgRating
    FROM Customers cust JOIN Complaints c ON cust.CustomerId = c.CustomerId
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId LEFT JOIN CustomerFeedback cf ON c.ComplaintId = cf.ComplaintId
    WHERE CAST(c.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City ORDER BY TotalComplaints DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_SLACompliance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ══════════════════════════════════════════════════════════════════════════════
-- sp_Report_SlaCompliance
-- ──────────────────────────────────────────────────────────────────────────────
-- Returns SLA compliance data grouped by priority for a date range.
-- Each row: Priority, Total, WithinSla, Breached, CompliancePercent,
--           AvgResolutionHours, SlaTargetHours
--
-- Used by: GET api/report/sla-compliance?startDate=&endDate=
-- Maps to: SlaComplianceDto / SlaData (Angular)
--
-- SLA target hours per priority (configurable via SystemSettings if needed):
--   Critical = 4h, High = 12h, Medium = 24h, Low = 48h
-- ══════════════════════════════════════════════════════════════════════════════

CREATE PROCEDURE [dbo].[sp_Report_SLACompliance]
    @StartDate  DATETIME,
    @EndDate    DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    -- SLA target hours per priority
    DECLARE @SlaTargets TABLE (
        Priority    NVARCHAR(20),
        TargetHours INT,
        SortOrder   INT
    );

    INSERT INTO @SlaTargets VALUES
        ('Critical', 4,  1),
        ('High',     12, 2),
        ('Medium',   24, 3),
        ('Low',      48, 4);

    -- Base complaint data with resolution time calculation
    ;WITH ComplaintSla AS
    (
        SELECT
            c.ComplaintId,
            c.Priority,
            c.CreatedAt,
            -- Resolution time = first time status moved to Resolved (statusId=3) or Closed (statusId=4)
            -- If still open, use DATEADD(MINUTE, 330, GETUTCDATE()) for SLA check
            CASE
                WHEN c.StatusId IN (3, 4) AND c.UpdatedAt IS NOT NULL
                    THEN DATEDIFF(HOUR, c.CreatedAt, c.UpdatedAt)
                ELSE DATEDIFF(HOUR, c.CreatedAt, DATEADD(MINUTE, 330, GETUTCDATE()))
            END AS ResolutionHours,
            c.StatusId,
            ISNULL(st.TargetHours, 24) AS SlaTargetHours
        FROM dbo.Complaints c
        LEFT JOIN @SlaTargets st ON st.Priority = c.Priority
        WHERE c.CreatedAt >= @StartDate
          AND c.CreatedAt <= @EndDate
    )
    SELECT
        st.Priority,
        ISNULL(COUNT(cs.ComplaintId), 0)                               AS Total,
        ISNULL(SUM(CASE
            WHEN cs.ResolutionHours <= st.TargetHours THEN 1 ELSE 0
        END), 0)                                                        AS WithinSla,
        ISNULL(SUM(CASE
            WHEN cs.ResolutionHours > st.TargetHours THEN 1 ELSE 0
        END), 0)                                                        AS Breached,
        CASE
            WHEN COUNT(cs.ComplaintId) = 0 THEN 0
            ELSE CAST(
                SUM(CASE WHEN cs.ResolutionHours <= st.TargetHours THEN 1 ELSE 0 END)
                * 100.0 / COUNT(cs.ComplaintId) AS DECIMAL(5,1))
        END                                                             AS CompliancePercent,
        ISNULL(CAST(AVG(CAST(cs.ResolutionHours AS DECIMAL(10,1)))
            AS DECIMAL(10,1)), 0)                                       AS AvgResolutionHours,
        st.TargetHours                                                  AS SlaTargetHours
    FROM @SlaTargets st
    LEFT JOIN ComplaintSla cs ON cs.Priority = st.Priority
    GROUP BY st.Priority, st.TargetHours, st.SortOrder
    ORDER BY st.SortOrder;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_TechnicianAttendance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Report_TechnicianAttendance]
    @FromDate DATE, @ToDate DATE, @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TechnicianId, u.FullName AS TechnicianName, t.Zone,
           COUNT(DISTINCT ta.AttendanceDate) AS DaysPresent,
           DATEDIFF(DAY, @FromDate, @ToDate) + 1 AS TotalDays,
           CAST(COUNT(DISTINCT ta.AttendanceDate) * 100.0 / NULLIF(DATEDIFF(DAY, @FromDate, @ToDate) + 1, 0) AS DECIMAL(5,2)) AS AttendancePercent,
           ISNULL(SUM(ta.TotalWorkHours), 0) AS TotalWorkHours,
           ISNULL(AVG(ta.TotalWorkHours), 0) AS AvgDailyHours,
           MIN(ta.CheckInTime) AS EarliestCheckIn, MAX(ta.CheckOutTime) AS LatestCheckOut
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN TechnicianAttendance ta ON t.TechnicianId = ta.TechnicianId AND ta.AttendanceDate BETWEEN @FromDate AND @ToDate
    WHERE t.IsActive = 1 AND (@TechnicianId IS NULL OR t.TechnicianId = @TechnicianId)
    GROUP BY t.TechnicianId, u.FullName, t.Zone ORDER BY AttendancePercent DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_TechnicianPerformance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Report_TechnicianPerformance]
    @StartDate DATE,
    @EndDate DATE,
    @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT tp.UserId, u.FullName, tp.EmployeeCode, tp.Specialization,
        COUNT(c.ComplaintId) AS TotalAssigned,
        SUM(CASE WHEN c.StatusId=3 THEN 1 ELSE 0 END) AS Resolved,
        SUM(CASE WHEN c.StatusId=4 THEN 1 ELSE 0 END) AS Closed,
        SUM(CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND c.StatusId NOT IN (3,4) THEN 1 ELSE 0 END) AS SLABreached,
        AVG(CASE WHEN c.ResolvedDate IS NOT NULL THEN DATEDIFF(HOUR, c.AssignedDate, c.ResolvedDate) END) AS AvgResolutionHours,
        tp.Rating
    FROM TechnicianProfiles tp
    INNER JOIN Users u ON tp.UserId = u.UserId
    LEFT JOIN Complaints c ON c.AssignedTechnicianId=tp.UserId AND c.CreatedDate BETWEEN @StartDate AND @EndDate
    WHERE tp.IsActive=1
    AND (@TechnicianId IS NULL OR tp.UserId=@TechnicianId)
    GROUP BY tp.UserId, u.FullName, tp.EmployeeCode, tp.Specialization, tp.Rating
    ORDER BY Resolved DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_TechnicianProductivity]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE  PROCEDURE [dbo].[sp_Report_TechnicianProductivity]
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        T.TechnicianId,

        ISNULL(U.FullName, CONCAT('Technician ', T.TechnicianId)) AS TechnicianName,

        COALESCE(TP.Specialization, T.Specialization, 'General') AS Specialization,

        COUNT(TA.AssignmentId) AS TotalAssignments,

        SUM(
            CASE
                WHEN TA.Status = 'Completed' THEN 1
                ELSE 0
            END
        ) AS CompletedAssignments,

        SUM(
            CASE
                WHEN TA.AssignmentId IS NOT NULL
                     AND ISNULL(TA.Status, '') <> 'Completed'
                THEN 1
                ELSE 0
            END
        ) AS PendingAssignments,

        CAST(
            CASE
                WHEN COUNT(TA.AssignmentId) = 0 THEN 0
                ELSE
                    (
                        SUM(
                            CASE
                                WHEN TA.Status = 'Completed' THEN 1
                                ELSE 0
                            END
                        ) * 100.0
                    ) / COUNT(TA.AssignmentId)
            END
        AS DECIMAL(5,2)) AS CompletionRate,

        CAST(
            ISNULL(
                SUM(
                    CASE
                        WHEN TA.AssignedAt IS NOT NULL
                             AND TA.CompletedAt IS NOT NULL
                        THEN DATEDIFF(MINUTE, TA.AssignedAt, TA.CompletedAt) / 60.0
                        ELSE 0
                    END
                ),
                0
            )
        AS DECIMAL(10,2)) AS TotalWorkHours,

        CAST(
            ISNULL(
                AVG(
                    CASE
                        WHEN TA.AssignedAt IS NOT NULL
                             AND TA.CompletedAt IS NOT NULL
                        THEN DATEDIFF(MINUTE, TA.AssignedAt, TA.CompletedAt) / 60.0
                    END
                ),
                0
            )
        AS DECIMAL(10,2)) AS AvgResolutionHours,

        CAST(
            ISNULL(
                SUM(
                    CASE
                        WHEN TLPrev.Latitude IS NOT NULL
                             AND TLSite.Latitude IS NOT NULL
                        THEN
                            SQRT(
                                POWER(
                                    (CAST(TLSite.Latitude AS FLOAT) - CAST(TLPrev.Latitude AS FLOAT)) * 111.0,
                                    2
                                )
                                +
                                POWER(
                                    (CAST(TLSite.Longitude AS FLOAT) - CAST(TLPrev.Longitude AS FLOAT)) * 111.0,
                                    2
                                )
                            )
                        ELSE 0
                    END
                ),
                0
            )
        AS DECIMAL(10,2)) AS TotalDistanceKm,

        SUM(
            CASE
                WHEN TA.PartsUsed IS NOT NULL
                     AND LTRIM(RTRIM(TA.PartsUsed)) <> ''
                THEN 1
                ELSE 0
            END
        ) AS SparePartsUsed,

        CAST(
            ISNULL(
                AVG(
                    CASE
                        WHEN TA.CustomerFeedback IS NOT NULL
                             AND TRY_CAST(TA.CustomerFeedback AS DECIMAL(3,2)) IS NOT NULL
                        THEN TRY_CAST(TA.CustomerFeedback AS DECIMAL(3,2))
                    END
                ),
                0
            )
        AS DECIMAL(3,2)) AS CustomerRating

    FROM Technicians T
    LEFT JOIN Users U
        ON U.UserId = T.UserId

    LEFT JOIN TechnicianProfiles TP
        ON TP.UserId = T.UserId

    LEFT JOIN TechnicianAssignments TA
        ON TA.TechnicianId = T.TechnicianId
        AND CAST(
            ISNULL(
                CAST(TA.ScheduledDate AS DATETIME),
                CAST(TA.AssignedAt AS DATETIME)
            ) AS DATE
        ) BETWEEN @StartDate AND @EndDate

    LEFT JOIN TechnicianSiteArrivals TLSite
        ON TLSite.TechnicianId = T.TechnicianId
        AND TLSite.ComplaintId = TA.ComplaintId

    OUTER APPLY
    (
        SELECT TOP 1
            TL.Latitude,
            TL.Longitude
        FROM TrackingLog TL
        WHERE TL.TechnicianId = T.TechnicianId
          AND TL.LogTime <= ISNULL(TLSite.ArrivalTime, TA.AssignedAt)
        ORDER BY TL.LogTime DESC
    ) TLPrev

    WHERE T.IsActive = 1

    GROUP BY
        T.TechnicianId,
        U.FullName,
        TP.Specialization,
        T.Specialization

    ORDER BY
        CompletionRate DESC,
        CompletedAssignments DESC,
        TechnicianName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Report_ZoneWise]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Report_ZoneWise]
    @FromDate DATE, @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.Zone, COUNT(DISTINCT t.TechnicianId) AS TechniciansInZone,
           COUNT(DISTINCT ta.ComplaintId) AS TotalComplaints,
           COUNT(DISTINCT CASE WHEN ta.Status = 'Completed' THEN ta.ComplaintId END) AS Completed,
           ISNULL(AVG(CAST(cf.Rating AS DECIMAL(3,2))), 0) AS AvgRating,
           ISNULL(SUM(tdl.DistanceKm), 0) AS TotalDistanceKm
    FROM Technicians t
    LEFT JOIN TechnicianAssignments ta ON t.TechnicianId = ta.TechnicianId AND CAST(ta.AssignedAt AS DATE) BETWEEN @FromDate AND @ToDate
    LEFT JOIN CustomerFeedback cf ON ta.ComplaintId = cf.ComplaintId
    LEFT JOIN TravelDistanceLog tdl ON t.TechnicianId = tdl.TechnicianId AND tdl.TravelDate BETWEEN @FromDate AND @ToDate
    WHERE t.Zone IS NOT NULL GROUP BY t.Zone ORDER BY TotalComplaints DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_ResendOTP]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_ResendOTP]
    @MobileNumber NVARCHAR(15),
    @Purpose NVARCHAR(50) = 'Login'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LastSentAt DATETIME;
    DECLARE @ResendCount INT;
    
    -- Rate limiting: check last OTP sent time
    SELECT TOP 1 @LastSentAt = CreatedAt, 
           @ResendCount = (SELECT COUNT(*) FROM OtpLog 
                           WHERE MobileNumber = @MobileNumber 
                           AND CreatedAt > DATEADD(HOUR, -1, DATEADD(MINUTE, 330, GETUTCDATE())))
    FROM OtpLog 
    WHERE MobileNumber = @MobileNumber 
    ORDER BY CreatedAt DESC;
    
    IF @ResendCount >= 5
    BEGIN
        SELECT 0 AS Success, 'Too many OTP requests. Please try after 1 hour.' AS Message;
        RETURN;
    END
    
    IF @LastSentAt IS NOT NULL AND DATEDIFF(SECOND, @LastSentAt, DATEADD(MINUTE, 330, GETUTCDATE())) < 30
    BEGIN
        SELECT 0 AS Success, 'Please wait 30 seconds before requesting a new OTP.' AS Message;
        RETURN;
    END
    
    -- Invalidate old OTPs and generate new
    UPDATE OtpLog SET IsUsed = 1 WHERE MobileNumber = @MobileNumber AND IsUsed = 0;
    
    DECLARE @OtpCode NVARCHAR(6) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS NVARCHAR(6)), 6);
    
    INSERT INTO OtpLog (MobileNumber, OtpCode, Purpose, ExpiresAt)
    VALUES (@MobileNumber, @OtpCode, @Purpose, DATEADD(MINUTE, 5, DATEADD(MINUTE, 330, GETUTCDATE())));
    
    SELECT 1 AS Success, @OtpCode AS OtpCode, 'OTP sent successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_Cancel]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Schedule_Cancel]
    @ScheduleId INT, @Reason NVARCHAR(500) = NULL, @CancelledBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE TechnicianSchedule SET Status = 'Cancelled', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ScheduleId = @ScheduleId;
    SELECT 1 AS Success, 'Schedule cancelled.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP: sp_Schedule_Create
-- │     Creates a new schedule entry after checking for conflicts + max limits
-- │     Returns: ScheduleId (positive = success, -1 = conflict, -2 = max reached)
-- └─────────────────────────────────────────────────────────────────────────────
CREATE   PROCEDURE [dbo].[sp_Schedule_Create]
    @TechnicianId      INT,
    @ComplaintId       INT           = NULL,
    @ScheduleDate      DATE,
    @StartTime         TIME,
    @EndTime           TIME,
    @TaskType          INT           = 1,
    @PriorityLevel     INT           = 2,
    @CustomerAddress   NVARCHAR(500) = NULL,
    @CustomerLatitude  DECIMAL(10,7) = NULL,
    @CustomerLongitude DECIMAL(10,7) = NULL,
    @EstimatedDuration INT           = 60,
    @Notes             NVARCHAR(1000)= NULL,
    @CreatedBy         INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ScheduleId INT;
    DECLARE @Message NVARCHAR(200);

    -- Check for time overlap with existing schedules
    IF EXISTS (
        SELECT 1 FROM dbo.TechnicianSchedules
        WHERE TechnicianId = @TechnicianId
          AND ScheduleDate = @ScheduleDate
          AND StatusId NOT IN (4) -- ignore cancelled
          AND (
              (@StartTime >= StartTime AND @StartTime < EndTime)
              OR (@EndTime > StartTime AND @EndTime <= EndTime)
              OR (@StartTime <= StartTime AND @EndTime >= EndTime)
          )
    )
    BEGIN
        SET @ScheduleId = -1;
        SET @Message = 'Time conflict: This technician already has a schedule during this time slot.';
        SELECT @ScheduleId AS ScheduleId, @Message AS [Message];
        RETURN;
    END

    -- Check max daily assignments
    DECLARE @MaxDaily INT = ISNULL(
        (SELECT MaxDailyAssignments FROM dbo.TechnicianProfiles WHERE UserId = @TechnicianId),
        10
    );
    DECLARE @TodayCount INT = (
        SELECT COUNT(*) FROM dbo.TechnicianSchedules
        WHERE TechnicianId = @TechnicianId
          AND ScheduleDate = @ScheduleDate
          AND StatusId NOT IN (4)
    );

    IF @TodayCount >= @MaxDaily
    BEGIN
        SET @ScheduleId = -2;
        SET @Message = 'Max daily assignments (' + CAST(@MaxDaily AS VARCHAR) + ') reached for this technician.';
        SELECT @ScheduleId AS ScheduleId, @Message AS [Message];
        RETURN;
    END

    -- Insert
    INSERT INTO dbo.TechnicianSchedules
        (TechnicianId, ComplaintId, ScheduleDate, StartTime, EndTime,
         TaskType, PriorityLevel, CustomerAddress, CustomerLatitude, CustomerLongitude,
         EstimatedDuration, Notes, CreatedBy)
    VALUES
        (@TechnicianId, @ComplaintId, @ScheduleDate, @StartTime, @EndTime,
         @TaskType, @PriorityLevel, @CustomerAddress, @CustomerLatitude, @CustomerLongitude,
         @EstimatedDuration, @Notes, @CreatedBy);

    SET @ScheduleId = SCOPE_IDENTITY();
    SET @Message = 'Schedule created successfully';

    SELECT @ScheduleId AS ScheduleId, @Message AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetBoardReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Schedule_GetBoardReport]
   @ScheduleDate DATE
AS
BEGIN
 SET NOCOUNT ON;

    SELECT
        t.TechnicianId,
        u.FullName AS TechnicianName,
        ta.AssignmentId AS ScheduleId,
        c.ComplaintNumber,
        cu.CustomerName,
        cu.City,
        cu.Address,
        cu.Latitude,
        cu.Longitude,
        cu.Landmark,

        p.ProductName,

        ISNULL(CONVERT(VARCHAR(5), ta.StartTime, 108), '') AS StartTime,
        ISNULL(CONVERT(VARCHAR(5), ta.EndTime, 108), '') AS EndTime,

        CASE ta.Status
            WHEN 'Assigned' THEN 1
            WHEN 'InProgress' THEN 2
            WHEN 'Completed' THEN 3
            ELSE 0
        END AS StatusId,

        ISNULL(ta.Status, 'Free') AS StatusName,

        CASE
            WHEN ta.TimeSlot IS NOT NULL THEN LOWER(ta.TimeSlot)
            WHEN ta.StartTime IS NULL THEN 'morning'
            WHEN CAST(ta.StartTime AS TIME) < '12:00:00' THEN 'morning'
            WHEN CAST(ta.StartTime AS TIME) < '17:00:00' THEN 'afternoon'
            ELSE 'evening'
        END AS TimeSlot,

        CASE
            WHEN ta.AssignmentId IS NULL THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS IsFree,

        CASE
            WHEN ISNULL(ta.ScheduledDate, CAST(ta.AssignedAt AS DATE)) > CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)
                THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS IsFuture

    FROM Technicians t
    INNER JOIN Users u
        ON u.UserId = t.UserId

    LEFT JOIN TechnicianAssignments ta
        ON ta.TechnicianId = t.TechnicianId
        AND ta.Status <> 'Removed'
        AND (
            ta.ScheduledDate = @ScheduleDate
            OR (
                ta.ScheduledDate IS NULL
                AND CAST(ta.AssignedAt AS DATE) = @ScheduleDate
            )
        )

    LEFT JOIN Complaints c
        ON c.ComplaintId = ta.ComplaintId

    LEFT JOIN Customers cu
        ON cu.CustomerId = c.CustomerId

    LEFT JOIN Products p
        ON p.ProductId = c.ProductId

    ORDER BY
        u.FullName,
        ta.StartTime;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetByDate]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Schedule_GetByDate]
    @ScheduledDate DATE, @TechnicianId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ts.ScheduleId, ts.TechnicianId, u.FullName AS TechnicianName, t.Specialization,
           ts.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cust.CustomerName, cust.Address, cust.City,
           ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status, ts.HasConflict
    FROM TechnicianSchedule ts JOIN Technicians t ON ts.TechnicianId = t.TechnicianId JOIN Users u ON t.UserId = u.UserId
    JOIN Complaints c ON ts.ComplaintId = c.ComplaintId JOIN Customers cust ON c.CustomerId = cust.CustomerId
    WHERE ts.ScheduledDate = @ScheduledDate AND (@TechnicianId IS NULL OR ts.TechnicianId = @TechnicianId) AND ts.Status != 'Cancelled'
    ORDER BY u.FullName, ts.TimeSlotStart;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetByTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Schedule_GetByTechnician]
    @TechnicianId INT, @FromDate DATE, @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ts.ScheduleId, ts.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority,
           cs.StatusName AS ComplaintStatus, cs.StatusColor,
           cust.CustomerName, cust.MobileNumber AS CustomerMobile, cust.Address, cust.City,
           cust.Latitude, cust.Longitude, p.ProductName, p.SerialNumber,
           ts.ScheduledDate, ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status, ts.HasConflict
    FROM TechnicianSchedule ts JOIN Complaints c ON ts.ComplaintId = c.ComplaintId
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId JOIN Customers cust ON c.CustomerId = cust.CustomerId
    JOIN Products p ON c.ProductId = p.ProductId
    WHERE ts.TechnicianId = @TechnicianId AND ts.ScheduledDate BETWEEN @FromDate AND @ToDate AND ts.Status != 'Cancelled'
    ORDER BY ts.ScheduledDate, ts.TimeSlotStart;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetConflicts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Schedule_GetConflicts]
    @FromDate DATE = NULL, @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ts.ScheduleId, ts.TechnicianId, u.FullName AS TechnicianName,
           ts.ComplaintId, c.ComplaintNumber, ts.ScheduledDate, ts.TimeSlotStart, ts.TimeSlotEnd, ts.Status
    FROM TechnicianSchedule ts JOIN Technicians t ON ts.TechnicianId = t.TechnicianId JOIN Users u ON t.UserId = u.UserId
    JOIN Complaints c ON ts.ComplaintId = c.ComplaintId
    WHERE ts.HasConflict = 1 AND ts.Status != 'Cancelled'
    AND (@FromDate IS NULL OR ts.ScheduledDate >= @FromDate) AND (@ToDate IS NULL OR ts.ScheduledDate <= @ToDate)
    ORDER BY ts.ScheduledDate, ts.TechnicianId, ts.TimeSlotStart;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetDaily]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP: sp_Schedule_GetDaily
-- │     Returns all schedules for a date, optionally filtered by technician
-- │     Maps to ScheduleListItem DTO
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Schedule_GetDaily]
    @ScheduleDate  DATE = NULL,
    @TechnicianId  INT  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @ScheduleDate IS NULL
        SET @ScheduleDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT
        s.ScheduleId,
        s.TechnicianId,
        u.FullName                         AS TechnicianName,
        ISNULL(tp.EmployeeCode, '')        AS EmployeeCode,
        ISNULL(tp.Specialization, '')      AS Specialization,
        s.ComplaintId,
        ISNULL(c.ComplaintNumber, '')      AS ComplaintNo,
        ISNULL(c.Subject, '')              AS ComplaintSubject,
        c.Priority                         AS PriorityId,
        s.ScheduleDate,
        CONVERT(VARCHAR(5), s.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), s.EndTime, 108)   AS EndTime,
        s.TaskType,
        s.PriorityLevel,
        s.StatusId,
        ISNULL(s.CustomerAddress, '')      AS CustomerAddress,
        ISNULL(cust.CustomerName, '')      AS CustomerName,
        ISNULL(cust.MobileNumber, '')      AS CustomerPhone,
        s.EstimatedDuration,
        s.ActualDuration,
        ISNULL(s.Notes, '')               AS Notes
    FROM dbo.TechnicianSchedules s
    INNER JOIN dbo.Users u ON u.UserId = s.TechnicianId
    LEFT JOIN dbo.TechnicianProfiles tp ON tp.UserId = s.TechnicianId
    LEFT JOIN dbo.Complaints c ON c.ComplaintId = s.ComplaintId
    LEFT JOIN dbo.Products p ON p.ProductId = c.ProductId
    LEFT JOIN dbo.Customers cust ON cust.CustomerId = c.CustomerId
    WHERE s.ScheduleDate = @ScheduleDate
      AND (@TechnicianId IS NULL OR s.TechnicianId = @TechnicianId)
    ORDER BY s.StartTime ASC, s.PriorityLevel ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_GetDailySummary]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Schedule_GetDailySummary]
    @ScheduledDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Per technician summary
    SELECT t.TechnicianId, u.FullName AS TechnicianName, t.Zone,
           COUNT(*) AS TotalSlots,
           SUM(CASE WHEN ts.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedSlots,
           SUM(CASE WHEN ts.Status = 'Pending' THEN 1 ELSE 0 END) AS PendingSlots,
           SUM(CASE WHEN ts.HasConflict = 1 THEN 1 ELSE 0 END) AS Conflicts,
           MIN(ts.TimeSlotStart) AS FirstSlot, MAX(ts.TimeSlotEnd) AS LastSlot
    FROM TechnicianSchedule ts JOIN Technicians t ON ts.TechnicianId = t.TechnicianId JOIN Users u ON t.UserId = u.UserId
    WHERE ts.ScheduledDate = @ScheduledDate AND ts.Status != 'Cancelled'
    GROUP BY t.TechnicianId, u.FullName, t.Zone ORDER BY u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Schedule_Update]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP: sp_Schedule_Update
-- │     Updates an existing schedule
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Schedule_Update]
    @ScheduleId    INT,
    @ScheduleDate  DATE,
    @StartTime     TIME,
    @EndTime       TIME,
    @TaskType      INT,
    @PriorityLevel INT,
    @StatusId      INT,
    @Notes         NVARCHAR(1000) = NULL,
    @ModifiedBy    INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Message NVARCHAR(200);

    IF NOT EXISTS (SELECT 1 FROM dbo.TechnicianSchedules WHERE ScheduleId = @ScheduleId)
    BEGIN
        SELECT 0 AS ScheduleId, 'Schedule not found' AS [Message];
        RETURN;
    END

    UPDATE dbo.TechnicianSchedules
    SET ScheduleDate  = @ScheduleDate,
        StartTime     = @StartTime,
        EndTime       = @EndTime,
        TaskType      = @TaskType,
        PriorityLevel = @PriorityLevel,
        StatusId      = @StatusId,
        Notes         = @Notes,
        ModifiedBy    = @ModifiedBy,
        ModifiedAt    = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ScheduleId = @ScheduleId;

    SET @Message = 'Schedule updated successfully';
    SELECT @ScheduleId AS ScheduleId, @Message AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ScheduleConflict_Detect]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP: sp_ScheduleConflict_Detect
-- │     Detects time overlaps between schedules on a given date
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_ScheduleConflict_Detect]
    @ScheduleDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @ScheduleDate IS NULL
        SET @ScheduleDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    -- Find overlapping pairs
    ;WITH Overlaps AS (
        SELECT
            s1.ScheduleId AS Schedule1Id,
            s2.ScheduleId AS Schedule2Id,
            s1.TechnicianId
        FROM dbo.TechnicianSchedules s1
        INNER JOIN dbo.TechnicianSchedules s2
            ON  s1.TechnicianId = s2.TechnicianId
            AND s1.ScheduleDate = s2.ScheduleDate
            AND s1.ScheduleId < s2.ScheduleId  -- avoid duplicates
            AND s1.StatusId NOT IN (4) AND s2.StatusId NOT IN (4)
            AND (
                (s1.StartTime < s2.EndTime AND s1.EndTime > s2.StartTime)
            )
        WHERE s1.ScheduleDate = @ScheduleDate
    )
    -- Auto-insert new conflicts (ignore already-detected ones)
    INSERT INTO dbo.ScheduleConflicts
        (Schedule1Id, Schedule2Id, TechnicianId, ConflictDate, ConflictType, Severity)
    SELECT
        o.Schedule1Id, o.Schedule2Id, o.TechnicianId, @ScheduleDate, 1, 2
    FROM Overlaps o
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ScheduleConflicts sc
        WHERE sc.Schedule1Id = o.Schedule1Id
          AND sc.Schedule2Id = o.Schedule2Id
    );

    -- Return all conflicts for the date
    SELECT
        sc.ConflictId,
        sc.Schedule1Id,
        sc.Schedule2Id,
        sc.TechnicianId,
        u.FullName                                AS TechnicianName,
        ISNULL(tp.EmployeeCode, '')               AS EmployeeCode,
        sc.ConflictDate,
        sc.ConflictType,
        sc.Severity,
        CONVERT(VARCHAR(5), s1.StartTime, 108)    AS Schedule1Start,
        CONVERT(VARCHAR(5), s1.EndTime, 108)      AS Schedule1End,
        s1.TaskType                               AS Schedule1Type,
        CONVERT(VARCHAR(5), s2.StartTime, 108)    AS Schedule2Start,
        CONVERT(VARCHAR(5), s2.EndTime, 108)      AS Schedule2End,
        s2.TaskType                               AS Schedule2Type,
        ISNULL(c1.ComplaintNumber, '')             AS Complaint1No,
        ISNULL(c2.ComplaintNumber, '')             AS Complaint2No,
        sc.IsResolved
    FROM dbo.ScheduleConflicts sc
    INNER JOIN dbo.TechnicianSchedules s1 ON s1.ScheduleId = sc.Schedule1Id
    INNER JOIN dbo.TechnicianSchedules s2 ON s2.ScheduleId = sc.Schedule2Id
    INNER JOIN dbo.Users u ON u.UserId = sc.TechnicianId
    LEFT JOIN dbo.TechnicianProfiles tp ON tp.UserId = sc.TechnicianId
    LEFT JOIN dbo.Complaints c1 ON c1.ComplaintId = s1.ComplaintId
    LEFT JOIN dbo.Complaints c2 ON c2.ComplaintId = s2.ComplaintId
    WHERE sc.ConflictDate = @ScheduleDate
    ORDER BY sc.IsResolved ASC, sc.Severity ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ScheduleConflict_Resolve]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP: sp_ScheduleConflict_Resolve
-- │     Marks a conflict as resolved with notes
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_ScheduleConflict_Resolve]
    @ConflictId  INT,
    @Resolution  NVARCHAR(500),
    @ResolvedBy  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ScheduleConflicts WHERE ConflictId = @ConflictId)
    BEGIN
        SELECT 0 AS ConflictId, 'Conflict not found' AS [Message];
        RETURN;
    END

    UPDATE dbo.ScheduleConflicts
    SET IsResolved = 1,
        Resolution = @Resolution,
        ResolvedBy = @ResolvedBy,
        ResolvedDate = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ConflictId = @ConflictId;

    SELECT @ConflictId AS ConflictId, 'Conflict resolved' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SearchCustomers]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_SearchCustomers]
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 10 c.CustomerId, c.CustomerName, c.MobileNumber, c.Email, c.City
    FROM Customers c
    WHERE c.CustomerName LIKE '%' + @SearchTerm + '%' 
       OR c.MobileNumber LIKE '%' + @SearchTerm + '%'
       OR c.Email LIKE '%' + @SearchTerm + '%'
    ORDER BY c.CustomerName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_SearchProducts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_SearchProducts]
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 10 p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.ModelNumber,
           c.CustomerName, c.CustomerId
    FROM Products p
    JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.ProductName LIKE '%' + @SearchTerm + '%'
       OR p.SerialNumber LIKE '%' + @SearchTerm + '%'
       OR p.ModelNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY p.ProductName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_ServiceImage_Save]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO



CREATE   PROCEDURE [dbo].[sp_ServiceImage_Save]
    @ComplaintId   INT,
    @TechnicianId  INT,
    @ImageType     NVARCHAR(50)   = 'Other',
    @ImagePath     NVARCHAR(500)  = NULL,
    @ImageData     NVARCHAR(MAX)  = NULL,   -- base64 data URI
    @ImageName     NVARCHAR(255)  = NULL,
    @ContentType   NVARCHAR(100)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IST_NOW DATETIME = DATEADD(MINUTE, 330, GETUTCDATE());

    INSERT INTO ServiceImages
    (
        ComplaintId,
        TechnicianId,
        ImageType,
        ImagePath,
        ImageData,
        ImageName,
        ContentType,
        UploadedAt
    )
    VALUES
    (
        @ComplaintId,
        @TechnicianId,
        @ImageType,
        'Work Ordr Complted',
        @ImageData,
        @ImageName,
        @ContentType,
        @IST_NOW
    );

    SELECT
        SCOPE_IDENTITY() AS ImageId,
        'Image saved successfully' AS [Message];
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_SetDefaultUPI]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_SetDefaultUPI]
    @Id INT,
    @UpdatedBy INT
AS
BEGIN
    -- Unset all defaults
    UPDATE [dbo].[UPIConfigurations]
    SET IsDefault = 0, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy;
    
    -- Set the specified one as default
    UPDATE [dbo].[UPIConfigurations]
    SET IsDefault = 1, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
    WHERE Id = @Id;

    SELECT 1 AS Success, 'Default UPI updated successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Settings_BulkUpdate]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Settings_BulkUpdate]
    @SettingsJson NVARCHAR(MAX),
    @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE ss SET
        ss.SettingValue = j.value,
        ss.ModifiedBy = @ModifiedBy,
        ss.ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
    FROM SystemSettings ss
    INNER JOIN OPENJSON(@SettingsJson) WITH (id INT '$.id', value NVARCHAR(MAX) '$.value') j ON ss.SettingId = j.id
    WHERE ss.IsEditable = 1;
    
    SELECT 'Settings updated successfully' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Settings_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ==========================================
-- SETTINGS SPs
-- ==========================================
CREATE   PROCEDURE [dbo].[sp_Settings_GetAll]
    @SettingGroup VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM SystemSettings
    WHERE (@SettingGroup IS NULL OR SettingGroup=@SettingGroup)
    ORDER BY SettingGroup, SettingKey;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Settings_Update]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Settings_Update]
    @SettingId INT,
    @SettingValue NVARCHAR(MAX),
    @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE SystemSettings SET SettingValue=@SettingValue, ModifiedBy=@ModifiedBy, ModifiedDate=DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE SettingId=@SettingId AND IsEditable=1;
    SELECT @SettingId AS SettingId, 'Setting updated' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_Approve]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_SparePart_Approve]
    @RequestId INT, @Action NVARCHAR(20), @Remarks NVARCHAR(500) = NULL, @ApprovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TechnicianId INT, @ComplaintId INT, @PartName NVARCHAR(200);
    SELECT @TechnicianId = TechnicianId, @ComplaintId = ComplaintId, @PartName = PartName FROM SparePartRequests WHERE RequestId = @RequestId;

    UPDATE SparePartRequests SET Status = @Action, Remarks = ISNULL(@Remarks, Remarks),
        ApprovedBy = CASE WHEN @Action IN ('Approved','Rejected') THEN @ApprovedBy ELSE ApprovedBy END,
        ApprovedAt = CASE WHEN @Action IN ('Approved','Rejected') THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE ApprovedAt END, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId = @RequestId;

    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    SELECT @ComplaintId, StatusId, 'Spare part ' + @PartName + ': ' + @Action + ISNULL('. ' + @Remarks, ''), @ApprovedBy
    FROM Complaints WHERE ComplaintId = @ComplaintId;

    INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
    SELECT t.UserId, 'Spare Part ' + @Action, 'Your request for ' + @PartName + ' has been ' + @Action,
           'SparePart', @RequestId, 'SparePart', 0, DATEADD(MINUTE, 330, GETUTCDATE())
    FROM Technicians t WHERE t.TechnicianId = @TechnicianId;

    SELECT 1 AS Success, 'Spare part ' + @Action + '.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_BulkUpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 4: Bulk Approve / Reject (admin, multiple request IDs)
-- ============================================================
CREATE PROCEDURE [dbo].[sp_SparePart_BulkUpdateStatus]
    @RequestIds  NVARCHAR(MAX),   -- comma-separated: '1,2,3'
    @Status      NVARCHAR(30),
    @ApprovedBy  INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE SparePartRequests
    SET Status     = @Status,
        ApprovedBy = CASE WHEN @Status IN ('Approved','Rejected') THEN @ApprovedBy ELSE ApprovedBy END,
        ApprovedAt = CASE WHEN @Status IN ('Approved','Rejected') THEN DATEADD(MINUTE, 330, GETUTCDATE())   ELSE ApprovedAt END,
        UpdatedAt  = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId IN (
        SELECT CAST(value AS INT)
        FROM STRING_SPLIT(@RequestIds, ',')
        WHERE ISNUMERIC(value) = 1
    );

    SELECT @@ROWCOUNT AS UpdatedCount,
           @Status + ' applied to ' + CAST(@@ROWCOUNT AS NVARCHAR) + ' request(s)' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_CreateRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_SparePart_CreateRequest]
    @ComplaintId       INT,
    @TechnicianId      INT,
    @SparePartId       INT = NULL,
    @Quantity          INT,
    @UrgencyLevel      NVARCHAR(20) = 'Normal',
    @Remarks           NVARCHAR(500) = NULL,
    @CustomPartName    NVARCHAR(200) = NULL,
    @CustomPartNumber  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PartName   NVARCHAR(200);
    DECLARE @PartNumber NVARCHAR(100);

    IF @SparePartId IS NOT NULL
    BEGIN
        SELECT
            @PartName = PartName,
            @PartNumber = PartNumber
        FROM dbo.SpareParts
        WHERE SparePartId = @SparePartId;
    END

    IF @PartName IS NULL
    BEGIN
        SET @SparePartId = NULL;
        SET @PartName = NULLIF(LTRIM(RTRIM(@CustomPartName)), '');
        SET @PartNumber = NULLIF(LTRIM(RTRIM(@CustomPartNumber)), '');
    END

    IF @PartName IS NULL
    BEGIN
        SELECT
            CAST(-1 AS INT) AS RequestId,
            N'Part name is required' AS [Message];
        RETURN;
    END

    INSERT INTO dbo.SparePartRequests
    (
        ComplaintId,
        TechnicianId,
        SparePartId,
        Quantity,
        Status,
        PartName,
        PartNumber,
        UrgencyLevel,
        Remarks,
        RequestedAt,
        CreatedAt,
        UpdatedAt
    )
    VALUES
    (
        @ComplaintId,
        @TechnicianId,
        @SparePartId,
        @Quantity,
        N'Requested',
        @PartName,
        @PartNumber,
        @UrgencyLevel,
        @Remarks,
        DATEADD(MINUTE, 330, GETUTCDATE()),
        DATEADD(MINUTE, 330, GETUTCDATE()),
        DATEADD(MINUTE, 330, GETUTCDATE())
    );

    SELECT
        CAST(SCOPE_IDENTITY() AS INT) AS RequestId,
        N'Spare part request submitted successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_GetAdminRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 2: Get Spare Requests for Admin Panel (filterable)
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_SparePart_GetAdminRequests]
    @Status       NVARCHAR(30)  = NULL,   -- NULL = all
    @UrgencyLevel NVARCHAR(20)  = NULL,
    @ComplaintId  INT           = NULL,
    @PageNumber   INT           = 1,
    @PageSize     INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        r.RequestId,
        r.ComplaintId,
        c.ComplaintNumber,
        c.Subject             AS ComplaintSubject,
        r.SparePartId,
        ISNULL(r.PartName, sp.PartName)     AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber) AS PartNumber,
        sp.StockQuantity,
        r.Quantity,
        r.Status,
        r.UrgencyLevel,
        r.Remarks,
        r.RequestedAt,
        r.ApprovedBy,
        r.ApprovedAt,
        appr.FullName         AS ApprovedByName,
        tech_user.FullName    AS TechnicianName,
        r.TechnicianId,
        cu.CustomerName,
        cu.MobileNumber       AS CustomerPhone,
        COUNT(*) OVER()       AS TotalCount
    FROM  SparePartRequests     r
    LEFT JOIN SpareParts        sp   ON sp.SparePartId    = r.SparePartId
    INNER JOIN Complaints        c    ON c.ComplaintId     = r.ComplaintId
    INNER JOIN Customers         cu   ON cu.CustomerId     = c.CustomerId
    INNER JOIN Technicians       tech ON tech.TechnicianId = r.TechnicianId
    INNER JOIN Users             tech_user ON tech_user.UserId = tech.UserId
    LEFT  JOIN Users             appr ON appr.UserId       = r.ApprovedBy
    WHERE (@Status       IS NULL OR r.Status       = @Status)
      AND (@UrgencyLevel IS NULL OR r.UrgencyLevel = @UrgencyLevel)
      AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
    ORDER BY
        CASE r.UrgencyLevel
            WHEN 'Critical' THEN 1
            WHEN 'Urgent'   THEN 2
            ELSE 3
        END,
        r.RequestedAt DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 1: Get All / Search Spare Parts
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_SparePart_GetAll]
    @SearchTerm  NVARCHAR(200) = NULL,
    @PageNumber  INT = 1,
    @PageSize    INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        sp.SparePartId,
        sp.PartName,
        sp.PartNumber,
        sp.StockQuantity,
        sp.UnitPrice,
        COUNT(*) OVER() AS TotalCount
    FROM SpareParts sp
    WHERE sp.IsActive = 1
      AND (@SearchTerm IS NULL
           OR sp.PartName   LIKE '%' + @SearchTerm + '%'
           OR sp.PartNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY
        CASE WHEN @SearchTerm IS NOT NULL
             THEN CASE WHEN sp.PartName LIKE @SearchTerm + '%' THEN 0 ELSE 1 END
             ELSE 0
        END,
        sp.PartName
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_GetByComplaint]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_SparePart_GetByComplaint]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RequestId,
        r.SparePartId,
        ISNULL(r.PartName,   sp.PartName)   AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber) AS PartNumber,
        sp.UnitPrice,
        r.Quantity,
        r.Status,
        r.UrgencyLevel,
        r.Remarks,
        r.RequestedAt,
        r.ApprovedAt,
        tech_user.FullName  AS TechnicianName,
        appr.FullName       AS ApprovedByName
    FROM  SparePartRequests r
    LEFT JOIN SpareParts   sp        ON sp.SparePartId    = r.SparePartId
    INNER JOIN Technicians  tech      ON tech.TechnicianId = r.TechnicianId
    INNER JOIN Users        tech_user ON tech_user.UserId  = tech.UserId
    LEFT  JOIN Users        appr      ON appr.UserId       = r.ApprovedBy
    WHERE r.ComplaintId = @ComplaintId
    ORDER BY r.RequestedAt DESC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_GetDashboardSummary]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 1: Get Spare Request Summary for Dashboard Tile
-- ============================================================
CREATE   PROCEDURE [dbo].[sp_SparePart_GetDashboardSummary]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*)                                             AS TotalRequests,
        SUM(CASE WHEN Status = 'Requested'  THEN 1 ELSE 0 END) AS PendingCount,
        SUM(CASE WHEN Status = 'Approved'   THEN 1 ELSE 0 END) AS ApprovedCount,
        SUM(CASE WHEN Status = 'Dispatched' THEN 1 ELSE 0 END) AS DispatchedCount,
        SUM(CASE WHEN Status = 'Rejected'   THEN 1 ELSE 0 END) AS RejectedCount,
        SUM(CASE WHEN Status = 'Used'       THEN 1 ELSE 0 END) AS UsedCount,
        SUM(CASE WHEN UrgencyLevel = 'Critical' AND Status = 'Requested' THEN 1 ELSE 0 END) AS CriticalPending
    FROM SparePartRequests;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_GetRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_SparePart_GetRequests]
    @TechnicianId INT = NULL,
    @ComplaintId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RequestId,
        r.ComplaintId,
        r.SparePartId,
        ISNULL(r.PartName, sp.PartName)       AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber)   AS PartNumber,
        r.Quantity,
        r.Status,
        r.RequestedAt,
        r.Remarks,
        r.UrgencyLevel,
        u.FullName  AS ApprovedByName,
        r.ApprovedAt
    FROM  SparePartRequests r
    LEFT JOIN SpareParts   sp ON sp.SparePartId = r.SparePartId
    LEFT JOIN Users        u  ON u.UserId       = r.ApprovedBy
    WHERE (@TechnicianId IS NULL OR r.TechnicianId = @TechnicianId)
      AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
    ORDER BY r.RequestedAt DESC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_Request]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ████████████████████████████████████████████████████████████████
-- 4. SPARE PART CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_SparePart_Request]
    @TechnicianId INT, @ComplaintId INT, @PartName NVARCHAR(200), @PartNumber NVARCHAR(100) = NULL,
    @Quantity INT = 1, @UrgencyLevel NVARCHAR(20) = 'Normal', @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO SparePartRequests (TechnicianId, ComplaintId, PartName, PartNumber, Quantity, UrgencyLevel, Status, Remarks, CreatedAt)
    VALUES (@TechnicianId, @ComplaintId, @PartName, @PartNumber, @Quantity, @UrgencyLevel, 'Requested', @Remarks, DATEADD(MINUTE, 330, GETUTCDATE()));
    DECLARE @RequestId INT = SCOPE_IDENTITY();

    INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
    SELECT u.UserId, 'Spare Part Request', 'Part: ' + @PartName + ' (Qty: ' + CAST(@Quantity AS NVARCHAR) + ') - ' + @UrgencyLevel,
           'SparePart', @RequestId, 'SparePart', 0, DATEADD(MINUTE, 330, GETUTCDATE())
    FROM Users u JOIN Roles r ON u.RoleId = r.RoleId WHERE r.RoleName IN ('Admin','Manager');

    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    SELECT @ComplaintId, StatusId, 'Spare part requested: ' + @PartName + ' x' + CAST(@Quantity AS NVARCHAR),
           (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId)
    FROM Complaints WHERE ComplaintId = @ComplaintId;

    SELECT 1 AS Success, @RequestId AS RequestId, 'Spare part requested.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePart_UpdateRequestStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- SP 4: Approve / Reject Spare Part Request (admin)
-- ============================================================
CREATE PROCEDURE [dbo].[sp_SparePart_UpdateRequestStatus]
    @RequestId  INT,
    @Status     NVARCHAR(30),   -- Approved | Rejected | Dispatched | Used
    @ApprovedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM SparePartRequests WHERE RequestId = @RequestId)
    BEGIN
        SELECT 0 AS Result, 'Request not found' AS [Message];
        RETURN;
    END

    UPDATE SparePartRequests
    SET Status     = @Status,
        ApprovedBy = CASE WHEN @Status IN ('Approved','Rejected') THEN @ApprovedBy ELSE ApprovedBy END,
        ApprovedAt = CASE WHEN @Status IN ('Approved','Rejected') THEN DATEADD(MINUTE, 330, GETUTCDATE())   ELSE ApprovedAt END,
        UpdatedAt  = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId = @RequestId;

    SELECT 1 AS Result, 'Request ' + @Status AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SparePartRequest_UpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_SparePartRequest_UpdateStatus]
    @RequestId INT,
    @Status NVARCHAR(50),
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[SparePartRequests]
    SET [Status] = @Status,
        [Remarks] = ISNULL(@Remarks, [Remarks]),
        [UpdatedAt] = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE [RequestId] = @RequestId;

    SELECT 1 AS Success, 'Status updated successfully' AS [Message];
END

GO
/****** Object:  StoredProcedure [dbo].[sp_SubmitFeedback]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- FEEDBACK / RATINGS
-- ============================================
CREATE PROCEDURE [dbo].[sp_SubmitFeedback]
    @ComplaintId INT,
    @CustomerId INT,
    @Rating INT,
    @Comments NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM CustomerFeedback WHERE ComplaintId = @ComplaintId)
    BEGIN
        SELECT 0 AS Success, 'Feedback already submitted for this complaint.' AS Message;
        RETURN;
    END
    
    INSERT INTO CustomerFeedback (ComplaintId, CustomerId, Rating, Comments, CreatedAt)
    VALUES (@ComplaintId, @CustomerId, @Rating, @Comments, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'Feedback submitted successfully.' AS Message, SCOPE_IDENTITY() AS FeedbackId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_SubmitWorkCompletion]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- WORK COMPLETION / SERVICE REPORT
-- ============================================
CREATE PROCEDURE [dbo].[sp_SubmitWorkCompletion]
    @ComplaintId INT,
    @TechnicianId INT,
    @WorkDescription NVARCHAR(2000),
    @ResolutionType NVARCHAR(50),  -- Repaired, Replaced, Pending Parts, Unresolved
    @PartsUsed NVARCHAR(1000) = NULL,
    @CustomerSignature NVARCHAR(MAX) = NULL,
    @Remarks NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO WorkCompletionReports (ComplaintId, TechnicianId, WorkDescription, ResolutionType,
                                        PartsUsed, CustomerSignature, Remarks, CompletedAt)
    VALUES (@ComplaintId, @TechnicianId, @WorkDescription, @ResolutionType,
            @PartsUsed, @CustomerSignature, @Remarks, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    DECLARE @ReportId INT = SCOPE_IDENTITY();
    
    -- Update complaint status to WorkCompleted
    DECLARE @WorkCompletedStatusId INT;
    SELECT @WorkCompletedStatusId = StatusId FROM ComplaintStatuses WHERE StatusName = 'WorkCompleted';
    
    IF @WorkCompletedStatusId IS NOT NULL
    BEGIN
        UPDATE Complaints SET StatusId = @WorkCompletedStatusId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) 
        WHERE ComplaintId = @ComplaintId;
        
        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        VALUES (@ComplaintId, @WorkCompletedStatusId, 'Work completed: ' + @ResolutionType, 
                (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId));
    END
    
    -- Update assignment status
    UPDATE TechnicianAssignments SET Status = 'Completed', CompletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId AND TechnicianId = @TechnicianId AND Status = 'Active';
    
    SELECT @ReportId AS ReportId, 1 AS Success, 'Work completion submitted.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_Assign]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Technician_Assign]
    @ComplaintId INT, @TechnicianId INT, @AssignmentRole NVARCHAR(20) = 'Primary', @AssignedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @AssignmentId INT, @TechName NVARCHAR(100);
        SELECT @TechName = u.FullName FROM Technicians t JOIN Users u ON t.UserId = u.UserId WHERE t.TechnicianId = @TechnicianId;

        IF EXISTS (SELECT 1 FROM TechnicianAssignments WHERE ComplaintId = @ComplaintId AND TechnicianId = @TechnicianId AND Status NOT IN ('Cancelled','Completed'))
        BEGIN
            SELECT 0 AS Success, 'Technician already assigned.' AS Message, NULL AS AssignmentId;
            ROLLBACK; RETURN;
        END

        INSERT INTO TechnicianAssignments (ComplaintId, TechnicianId, AssignmentRole, AssignedBy, Status)
        VALUES (@ComplaintId, @TechnicianId, @AssignmentRole, @AssignedBy, 'Active');
        SET @AssignmentId = SCOPE_IDENTITY();

        INSERT INTO AssignmentAuditLog (AssignmentId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
        VALUES (@AssignmentId, 'Created', @TechnicianId, @AssignmentRole, @AssignedBy, 'Initial assignment');

        IF EXISTS (SELECT 1 FROM Complaints WHERE ComplaintId = @ComplaintId AND StatusId = 1)
        BEGIN
            DECLARE @AssignedStatusId INT;
            SELECT @AssignedStatusId = StatusId FROM ComplaintStatuses WHERE StatusName = 'Assigned';
            UPDATE Complaints SET StatusId = ISNULL(@AssignedStatusId, 2), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;
            INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy) VALUES (@ComplaintId, ISNULL(@AssignedStatusId, 2), 'Assigned to ' + @TechName, @AssignedBy);
        END

        INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
        SELECT t.UserId, 'New Assignment', 'Assigned to complaint ' + c.ComplaintNumber, 'Assignment', @ComplaintId, 'Complaint', 0, DATEADD(MINUTE, 330, GETUTCDATE())
        FROM Technicians t JOIN Complaints c ON c.ComplaintId = @ComplaintId WHERE t.TechnicianId = @TechnicianId;

        COMMIT;
        SELECT 1 AS Success, 'Technician assigned.' AS Message, @AssignmentId AS AssignmentId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS AssignmentId;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_CheckIn]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Technician_CheckIn]
    @TechnicianId  INT,
    @Latitude      DECIMAL(10,7),
    @Longitude     DECIMAL(10,7),
    @Address       NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Current India time
    DECLARE @CurrentDateTime DATETIME = DATEADD(MINUTE, 330, GETUTCDATE());

    DECLARE @Today DATE = CAST(@CurrentDateTime AS DATE);
    DECLARE @AttendanceId INT = 0;
    DECLARE @Message NVARCHAR(200);

    -- Check if already checked in today
    IF EXISTS (
        SELECT 1
        FROM dbo.TechnicianAttendance
        WHERE TechnicianId = @TechnicianId
          AND AttendanceDate = @Today
          AND CheckOutTime IS NULL
    )
    BEGIN
        SET @Message = 'Already checked in today';

        SELECT @AttendanceId AS AttendanceId,
               @Message AS [Message];
        RETURN;
    END

    -- Insert new attendance record
    INSERT INTO dbo.TechnicianAttendance
    (
        TechnicianId,
        AttendanceDate,
        CheckInTime,
        CheckInLatitude,
        CheckInLongitude,
        CheckInAddress
    )
    VALUES
    (
        @TechnicianId,
        @Today,
        @CurrentDateTime,
        @Latitude,
        @Longitude,
        @Address
    );

    SET @AttendanceId = SCOPE_IDENTITY();
    SET @Message = 'Checked in successfully';

    SELECT @AttendanceId AS AttendanceId,
           @Message AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_CheckOut]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Technician_CheckOut]
    @TechnicianId  INT,
    @Latitude      DECIMAL(10,7),
    @Longitude     DECIMAL(10,7),
    @Address       NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Current India time (IST)
    DECLARE @CurrentDateTime DATETIME = DATEADD(MINUTE, 330, GETUTCDATE());

    DECLARE @Today DATE = CAST(@CurrentDateTime AS DATE);
    DECLARE @Result INT = 0;
    DECLARE @Message NVARCHAR(200);

    -- Find today's active check-in
    DECLARE @AttId INT;

    SELECT TOP 1 @AttId = AttendanceId
    FROM dbo.TechnicianAttendance
    WHERE TechnicianId = @TechnicianId
      AND AttendanceDate = @Today
      AND CheckInTime IS NOT NULL
      AND CheckOutTime IS NULL
    ORDER BY CheckInTime DESC;

    IF @AttId IS NULL
    BEGIN
        SET @Message = 'No active check-in found for today';

        SELECT @Result AS Result,
               @Message AS [Message];
        RETURN;
    END

    -- Update checkout details using IST time
    UPDATE dbo.TechnicianAttendance
    SET CheckOutTime      = @CurrentDateTime,
        CheckOutLatitude  = @Latitude,
        CheckOutLongitude = @Longitude,
        CheckOutAddress   = @Address,
        TotalWorkHours    = CAST(
                                DATEDIFF(MINUTE, CheckInTime, @CurrentDateTime)
                                AS DECIMAL(10,2)
                             ) / 60.0
    WHERE AttendanceId = @AttId;

    SET @Result = 1;
    SET @Message = 'Checked out successfully';

    SELECT @Result AS Result,
           @Message AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Technician_Create]
    @FullName         NVARCHAR(300),
    @Email            NVARCHAR(400) = NULL,
    @MobileNumber     NVARCHAR(30),
    @Specialization   NVARCHAR(100),
    @ExperienceYears  INT = 0,
    @CertificationDetails NVARCHAR(500) = NULL,
    @MaxDailyAssignments INT = 5,
    @JoinDate         DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Check duplicate mobile
    IF EXISTS (SELECT 1 FROM Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT -1 AS ProfileId, 'Mobile number already exists' AS [Message];
        RETURN;
    END

    -- Auto generate Employee Code: EMP-XXX (last+1)
    DECLARE @LastCode INT = 0;
    SELECT @LastCode = ISNULL(MAX(
        TRY_CAST(REPLACE(EmployeeCode, 'EMP-', '') AS INT)
    ), 0) FROM TechnicianProfiles WHERE EmployeeCode LIKE 'EMP-%';

    DECLARE @NewCode NVARCHAR(20) = 'EMP-' + RIGHT('000' + CAST(@LastCode + 1 AS VARCHAR), 3);

    -- Step 1: Create User with temp password (RoleId=3 for Technician)
    INSERT INTO Users (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive, CreatedAt)
    VALUES (@FullName, @Email, @MobileNumber, NULL, 3, 1, DATEADD(MINUTE, 330, GETUTCDATE()));

    DECLARE @NewUserId INT = SCOPE_IDENTITY();

    -- Step 2: Create TechnicianProfile
    INSERT INTO TechnicianProfiles (
        UserId, EmployeeCode, Specialization, ExperienceYears,
        CertificationDetails, MaxDailyAssignments, JoinDate, IsActive, AvailabilityStatus
    )
    VALUES (
        @NewUserId, @NewCode, @Specialization, @ExperienceYears,
        @CertificationDetails, @MaxDailyAssignments, ISNULL(@JoinDate, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)), 1, 1
    );

    DECLARE @NewProfileId INT = SCOPE_IDENTITY();

    -- Step 3: Create Technicians record (for FK references)
    INSERT INTO Technicians (UserId, Specialization, IsAvailable)
    VALUES (@NewUserId, @Specialization, 1);

    SELECT @NewProfileId AS ProfileId, @NewCode AS EmployeeCode,
           @NewUserId AS UserId, 'Technician created successfully' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_Delete]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Technician_Delete]
    @ProfileId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE TechnicianProfiles SET IsActive=0, ModifiedDate=DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ProfileId=@ProfileId;
    SELECT @ProfileId AS ProfileId, 'Technician profile deactivated' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO



CREATE PROCEDURE [dbo].[sp_Technician_GetAll]
    @SearchTerm    NVARCHAR(100) = NULL,
    @StatusFilter  INT = NULL,
    @PageNumber    INT = 1,
    @PageSize      INT = 10,
    @SortBy        NVARCHAR(50) = 'FullName',
    @SortDir       NVARCHAR(4) = 'ASC'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT 
        t.TechnicianId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        tp.Specialization,
        tp.AvailabilityStatus,
        tp.IsActive,
        tp.ProfileId,
        tp.EmployeeCode,
        tp.ExperienceYears,
        tp.Rating,
        tp.TotalCompletedJobs,
        tp.MaxDailyAssignments,
        tp.JoinDate,
        tp.CurrentLatitude,
        tp.CurrentLongitude,
        tp.LastLocationUpdate,
        0 AS TodayAssignments,
        0 AS ActiveComplaints,
        COUNT(*) OVER() AS TotalCount

    FROM TechnicianProfiles tp
    INNER JOIN Users u ON tp.UserId = u.UserId
    INNER JOIN Technicians t ON t.UserId = u.UserId

    WHERE
        (
            @SearchTerm IS NULL 
            OR u.FullName LIKE '%' + @SearchTerm + '%'
            OR tp.EmployeeCode LIKE '%' + @SearchTerm + '%'
            OR tp.Specialization LIKE '%' + @SearchTerm + '%'
        )
  AND (
    @StatusFilter IS NULL

    OR (@StatusFilter = 1 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 1) -- Available
    OR (@StatusFilter = 2 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 2) -- On Job
    OR (@StatusFilter = 3 AND tp.IsActive = 1 AND tp.AvailabilityStatus = 3) -- On Leave
    OR (@StatusFilter = 4 AND tp.IsActive = 0)                               -- Inactive
)

    ORDER BY
        CASE WHEN @SortBy='FullName' AND @SortDir='ASC' THEN u.FullName END ASC,
        CASE WHEN @SortBy='FullName' AND @SortDir='DESC' THEN u.FullName END DESC

    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END





GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetAttendance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 6: sp_Technician_GetAttendance
-- │       Returns attendance records with optional filters
-- └─────────────────────────────────────────────────────────────────────────────
CREATE   PROCEDURE [dbo].[sp_Technician_GetAttendance]
    @TechnicianId  INT  = NULL,
    @FromDate      DATE = NULL,
    @ToDate        DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        a.AttendanceId,
        u.FullName           AS TechnicianName,
        a.CheckInTime,
        a.CheckInAddress,
        a.CheckOutTime,
        a.CheckOutAddress,
        a.TotalWorkHours,
        a.AttendanceDate
    FROM dbo.TechnicianAttendance a
    INNER JOIN dbo.Technicians t ON t.TechnicianId = a.TechnicianId
    INNER JOIN dbo.Users u ON u.UserId = t.UserId
    WHERE (@TechnicianId IS NULL OR a.TechnicianId = @TechnicianId)
      AND (@FromDate      IS NULL OR a.AttendanceDate >= @FromDate)
      AND (@ToDate        IS NULL OR a.AttendanceDate <= @ToDate)
    ORDER BY a.AttendanceDate DESC, a.CheckInTime DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetAuditLog]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Technician_GetAuditLog]
    @ComplaintId INT = NULL, @TechnicianId INT = NULL, @FromDate DATE = NULL, @ToDate DATE = NULL,
    @PageNumber INT = 1, @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SELECT al.AuditId, al.AssignmentId, al.Action, ta.ComplaintId, c.ComplaintNumber,
           oldU.FullName AS OldTechnicianName, newU.FullName AS NewTechnicianName,
           al.NewRole, al.ChangedBy, cb.FullName AS ChangedByName, al.Remarks, al.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM AssignmentAuditLog al
    JOIN TechnicianAssignments ta ON al.AssignmentId = ta.AssignmentId
    JOIN Complaints c ON ta.ComplaintId = c.ComplaintId
    LEFT JOIN Technicians oldT ON al.OldTechnicianId = oldT.TechnicianId LEFT JOIN Users oldU ON oldT.UserId = oldU.UserId
    LEFT JOIN Technicians newT ON al.NewTechnicianId = newT.TechnicianId LEFT JOIN Users newU ON newT.UserId = newU.UserId
    LEFT JOIN Users cb ON al.ChangedBy = cb.UserId
    WHERE (@ComplaintId IS NULL OR ta.ComplaintId = @ComplaintId)
    AND (@TechnicianId IS NULL OR ta.TechnicianId = @TechnicianId OR al.OldTechnicianId = @TechnicianId OR al.NewTechnicianId = @TechnicianId)
    AND (@FromDate IS NULL OR CAST(al.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(al.CreatedAt AS DATE) <= @ToDate)
    ORDER BY al.CreatedAt DESC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetAvailable]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Technician_GetAvailable]
    @ScheduledDate DATE = NULL, @TimeSlotStart TIME = NULL, @TimeSlotEnd TIME = NULL,
    @Specialization NVARCHAR(100) = NULL, @Zone NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TechnicianId, u.FullName, u.MobileNumber, t.Specialization, t.SkillLevel, t.Zone,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId AND ta.Status = 'Active') AS ActiveJobs,
           (SELECT AVG(CAST(cf.Rating AS DECIMAL(3,2))) FROM CustomerFeedback cf JOIN Complaints c ON cf.ComplaintId = c.ComplaintId
            JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId WHERE ta.TechnicianId = t.TechnicianId) AS AvgRating
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    WHERE t.IsActive = 1 AND (@Specialization IS NULL OR t.Specialization = @Specialization) AND (@Zone IS NULL OR t.Zone = @Zone)
    AND (@ScheduledDate IS NULL OR t.TechnicianId NOT IN (
        SELECT ts.TechnicianId FROM TechnicianSchedule ts WHERE ts.ScheduledDate = @ScheduledDate AND ts.Status != 'Cancelled'
        AND ((@TimeSlotStart BETWEEN ts.TimeSlotStart AND ts.TimeSlotEnd) OR (@TimeSlotEnd BETWEEN ts.TimeSlotStart AND ts.TimeSlotEnd)
            OR (ts.TimeSlotStart BETWEEN @TimeSlotStart AND @TimeSlotEnd))))
    ORDER BY ActiveJobs ASC, u.FullName;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Technician_GetById]
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT tp.*, u.FullName, u.Email, u.Phone, u.ProfileImage,
        (SELECT COUNT(*) FROM Complaints WHERE AssignedTechnicianId=tp.UserId AND IsActive=1) AS TotalAssigned,
        (SELECT COUNT(*) FROM Complaints WHERE AssignedTechnicianId=tp.UserId AND StatusId=3 AND IsActive=1) AS TotalResolved,
        (SELECT AVG(CAST(DATEDIFF(HOUR, AssignedDate, ResolvedDate) AS FLOAT)) FROM Complaints WHERE AssignedTechnicianId=tp.UserId AND ResolvedDate IS NOT NULL) AS AvgResolutionHours
    FROM TechnicianProfiles tp
    INNER JOIN Users u ON tp.UserId = u.UserId
    WHERE tp.ProfileId = @TechnicianId;

    -- Skills
    SELECT * FROM TechnicianSkills WHERE TechnicianProfileId = @TechnicianId;

    -- Recent schedules
    SELECT TOP 10 s.*, c.ComplaintNo, c.Subject
    FROM Schedules s
    LEFT JOIN Complaints c ON s.ComplaintId = c.ComplaintId
    WHERE s.TechnicianId = (SELECT UserId FROM TechnicianProfiles WHERE ProfileId=@TechnicianId)
    AND s.IsActive=1
    ORDER BY s.ScheduleDate DESC, s.StartTime DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_GetWorkOrders]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Technician_GetWorkOrders]
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ta.AssignmentId,
        ta.ComplaintId,
        c.ComplaintNumber,
        c.Subject,
        c.NatureOfJob,
        cu.CustomerName,
        cu.Address           AS CustomerAddress,
        cu.MobileNumber      AS CustomerPhone,
        ISNULL(pm.ProductName, p.ProductName) AS ProductName,
        ta.AssignmentRole,
        ta.Status,
        ta.AssignedAt,
        ta.CompletedAt,
        ta.ScheduledDate,
        ta.StartTime,
        c.Latitude as latitude,
        c.Longitude as longitude,
        ta.EndTime,
        ta.EstimatedDuration,
        ta.TimeSlot,
        ta.Notes,
        ta.Priority
    FROM TechnicianAssignments ta
    INNER JOIN Complaints      c  ON c.ComplaintId  = ta.ComplaintId
    INNER JOIN Customers       cu ON cu.CustomerId  = c.CustomerId
    LEFT JOIN Products        p  ON   c.ProductId = p.ProductId 
    LEFT  JOIN ProductMaster   pm ON c.ProductId  = pm.ProductMasterId
    WHERE ta.TechnicianId = @TechnicianId
      AND ta.Status NOT IN ('Removed')
    ORDER BY
        CASE ta.Status
            WHEN 'InProgress' THEN 1
            WHEN 'Assigned'   THEN 2
            WHEN 'Completed'  THEN 3
            ELSE 4
        END,
        ta.AssignedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_Reassign]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Technician_Reassign]
    @AssignmentId INT, @NewTechnicianId INT, @Remarks NVARCHAR(500) = NULL, @ReassignedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @OldTechId INT, @ComplaintId INT, @Role NVARCHAR(20), @OldName NVARCHAR(100), @NewName NVARCHAR(100);
        SELECT @OldTechId = TechnicianId, @ComplaintId = ComplaintId, @Role = AssignmentRole FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;
        SELECT @OldName = u.FullName FROM Technicians t JOIN Users u ON t.UserId = u.UserId WHERE t.TechnicianId = @OldTechId;
        SELECT @NewName = u.FullName FROM Technicians t JOIN Users u ON t.UserId = u.UserId WHERE t.TechnicianId = @NewTechnicianId;

        UPDATE TechnicianAssignments SET Status = 'Cancelled', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE AssignmentId = @AssignmentId;
        INSERT INTO TechnicianAssignments (ComplaintId, TechnicianId, AssignmentRole, AssignedBy, Status)
        VALUES (@ComplaintId, @NewTechnicianId, @Role, @ReassignedBy, 'Active');
        DECLARE @NewAssignmentId INT = SCOPE_IDENTITY();

        INSERT INTO AssignmentAuditLog (AssignmentId, Action, OldTechnicianId, NewTechnicianId, NewRole, ChangedBy, Remarks)
        VALUES (@NewAssignmentId, 'Reassigned', @OldTechId, @NewTechnicianId, @Role, @ReassignedBy, @Remarks);

        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        SELECT @ComplaintId, StatusId, 'Reassigned: ' + @OldName + ' -> ' + @NewName + ISNULL('. ' + @Remarks, ''), @ReassignedBy
        FROM Complaints WHERE ComplaintId = @ComplaintId;

        INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
        SELECT t.UserId, 'New Assignment (Reassigned)', 'Reassigned from ' + @OldName, 'Assignment', @ComplaintId, 'Complaint', 0, DATEADD(MINUTE, 330, GETUTCDATE())
        FROM Technicians t WHERE t.TechnicianId = @NewTechnicianId;

        COMMIT;
        SELECT 1 AS Success, 'Reassigned successfully.' AS Message, @NewAssignmentId AS AssignmentId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS AssignmentId;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_RecordSiteArrival]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ══════════════════════════════════════════════════════════════════════════════
-- STORED PROCEDURES
-- ══════════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 1: sp_Technician_RecordSiteArrival
-- │       Inserts into TechnicianSiteArrivals
-- │       Called by: TrackingService.RecordSiteArrival()
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Technician_RecordSiteArrival]
    @TechnicianId  INT,
    @ComplaintId   INT,
    @Latitude      DECIMAL(10,7),
    @Longitude     DECIMAL(10,7),
    @Address       NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.TechnicianSiteArrivals
        (TechnicianId, ComplaintId, Latitude, Longitude, [Address], ArrivalTime)
    VALUES
        (@TechnicianId, @ComplaintId, @Latitude, @Longitude, @Address, DATEADD(MINUTE, 330, GETUTCDATE()));

    SELECT 'Site arrival recorded' AS [Message];
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_SubmitWorkCompletion]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Technician_SubmitWorkCompletion]
    @ComplaintId INT, @TechnicianId INT, @WorkDescription NVARCHAR(2000), @ResolutionType NVARCHAR(50),
    @PartsUsed NVARCHAR(1000) = NULL, @CustomerSignature NVARCHAR(MAX) = NULL, @Remarks NVARCHAR(500) = NULL,
    @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT INTO WorkCompletionReports (ComplaintId, TechnicianId, WorkDescription, ResolutionType, PartsUsed, CustomerSignature, Remarks, CompletedAt)
        VALUES (@ComplaintId, @TechnicianId, @WorkDescription, @ResolutionType, @PartsUsed, @CustomerSignature, @Remarks, DATEADD(MINUTE, 330, GETUTCDATE()));
        DECLARE @ReportId INT = SCOPE_IDENTITY();

        DECLARE @WCStatusId INT;
        SELECT @WCStatusId = StatusId FROM ComplaintStatuses WHERE StatusName = 'WorkCompleted';
        UPDATE Complaints SET StatusId = @WCStatusId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;
        UPDATE TechnicianAssignments SET Status = 'Completed', CompletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId = @ComplaintId AND TechnicianId = @TechnicianId AND Status IN ('Active','InProgress');

        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        SELECT @ComplaintId, @WCStatusId, 'Work completed: ' + @ResolutionType, (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId);

        IF @Latitude IS NOT NULL
            INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, EventType, ComplaintId) VALUES (@TechnicianId, @Latitude, @Longitude, 'WorkCompleted', @ComplaintId);

        UPDATE SparePartRequests SET Status = 'Used', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE ComplaintId = @ComplaintId AND TechnicianId = @TechnicianId AND Status = 'Approved';

        INSERT INTO Notifications (UserId, Title, [Message], NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt)
        SELECT cu.UserId, 'Service Completed', 'Work completed for ' + comp.ComplaintNumber + '. Please confirm closure.',
               'WorkCompleted', @ComplaintId, 'Complaint', 0, DATEADD(MINUTE, 330, GETUTCDATE())
        FROM Complaints comp JOIN Customers cst ON comp.CustomerId = cst.CustomerId JOIN Users cu ON cst.UserId = cu.UserId
        WHERE comp.ComplaintId = @ComplaintId;

        COMMIT;
        SELECT 1 AS Success, @ReportId AS ReportId, 'Work completion submitted.' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, NULL AS ReportId, ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_TravelReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 2: sp_Technician_TravelReport  (MISSING — this caused the error)
-- │       Calculates daily travel summary per technician
-- │       Called by: TrackingService.GetTravelReport()
-- │       Returns:   TechnicianName, TravelDate, TotalDistanceKm, ServiceVisits
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Technician_TravelReport]
    @TechnicianId  INT  = NULL,
    @FromDate      DATE = NULL,
    @ToDate        DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @FromDate IS NULL SET @FromDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    IF @ToDate   IS NULL SET @ToDate   = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    -- ── Calculate distance from sequential TrackingLog positions ─────────
    -- Uses the Haversine approximation between consecutive GPS points.
    -- ServiceVisits = count of site arrivals per day.

    ;WITH DailyLogs AS
    (
        SELECT
            tl.TechnicianId,
            CAST(tl.LogTime AS DATE)  AS TravelDate,
            tl.Latitude,
            tl.Longitude,
            tl.LogTime,
            ROW_NUMBER() OVER (
                PARTITION BY tl.TechnicianId, CAST(tl.LogTime AS DATE)
                ORDER BY tl.LogTime
            ) AS RowNum
        FROM dbo.TrackingLog tl
        WHERE (@TechnicianId IS NULL OR tl.TechnicianId = @TechnicianId)
          AND CAST(tl.LogTime AS DATE) BETWEEN @FromDate AND @ToDate
    ),
    Distances AS
    (
        SELECT
            a.TechnicianId,
            a.TravelDate,
            -- Haversine formula (simplified, result in km)
            6371.0 * 2 * ATN2(
                SQRT(
                    SIN(RADIANS(b.Latitude - a.Latitude) / 2)
                  * SIN(RADIANS(b.Latitude - a.Latitude) / 2)
                  + COS(RADIANS(a.Latitude))
                  * COS(RADIANS(b.Latitude))
                  * SIN(RADIANS(b.Longitude - a.Longitude) / 2)
                  * SIN(RADIANS(b.Longitude - a.Longitude) / 2)
                ),
                SQRT(1 - (
                    SIN(RADIANS(b.Latitude - a.Latitude) / 2)
                  * SIN(RADIANS(b.Latitude - a.Latitude) / 2)
                  + COS(RADIANS(a.Latitude))
                  * COS(RADIANS(b.Latitude))
                  * SIN(RADIANS(b.Longitude - a.Longitude) / 2)
                  * SIN(RADIANS(b.Longitude - a.Longitude) / 2)
                ))
            ) AS SegmentKm
        FROM DailyLogs a
        INNER JOIN DailyLogs b
            ON  a.TechnicianId = b.TechnicianId
            AND a.TravelDate   = b.TravelDate
            AND b.RowNum       = a.RowNum + 1
    ),
    DailyDistance AS
    (
        SELECT
            TechnicianId,
            TravelDate,
            ISNULL(SUM(SegmentKm), 0) AS TotalDistanceKm
        FROM Distances
        GROUP BY TechnicianId, TravelDate
    ),
    DailySiteVisits AS
    (
        SELECT
            sa.TechnicianId,
            CAST(sa.ArrivalTime AS DATE) AS TravelDate,
            COUNT(*)                     AS ServiceVisits
        FROM dbo.TechnicianSiteArrivals sa
        WHERE (@TechnicianId IS NULL OR sa.TechnicianId = @TechnicianId)
          AND CAST(sa.ArrivalTime AS DATE) BETWEEN @FromDate AND @ToDate
        GROUP BY sa.TechnicianId, CAST(sa.ArrivalTime AS DATE)
    )
    SELECT
        u.FullName                          AS TechnicianName,
        ISNULL(dd.TravelDate, sv.TravelDate) AS TravelDate,
        ISNULL(dd.TotalDistanceKm, 0)       AS TotalDistanceKm,
        ISNULL(sv.ServiceVisits, 0)          AS ServiceVisits
    FROM
    (
        -- Get all tech+date combos from both sources
        SELECT TechnicianId, TravelDate FROM DailyDistance
        UNION
        SELECT TechnicianId, TravelDate FROM DailySiteVisits
    ) AS combined
    LEFT JOIN DailyDistance dd
        ON  dd.TechnicianId = combined.TechnicianId
        AND dd.TravelDate   = combined.TravelDate
    LEFT JOIN DailySiteVisits sv
        ON  sv.TechnicianId = combined.TechnicianId
        AND sv.TravelDate   = combined.TravelDate
    INNER JOIN dbo.Users u
        ON u.UserId = combined.TechnicianId
    ORDER BY TravelDate DESC, TechnicianName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_Update]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Technician_Update]
    @ProfileId INT,
    @Specialization NVARCHAR(100),
    @ExperienceYears INT,
    @CertificationDetails NVARCHAR(500),
    @MaxDailyAssignments INT,
    @AvailabilityStatus INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @IsActive BIT;

    -- 4 = Inactive, everything else is active
    SET @IsActive = CASE
        WHEN @AvailabilityStatus = 4 THEN 0
        ELSE 1
    END;

    -- Get linked user
    SELECT @UserId = UserId
    FROM TechnicianProfiles
    WHERE ProfileId = @ProfileId;

    -- Update technician profile
    UPDATE TechnicianProfiles
    SET
        Specialization = @Specialization,
        ExperienceYears = @ExperienceYears,
        CertificationDetails = @CertificationDetails,
        MaxDailyAssignments = @MaxDailyAssignments,

        -- Internally store only active statuses
        AvailabilityStatus = CASE
            WHEN @AvailabilityStatus = 4 THEN 1
            ELSE @AvailabilityStatus
        END,

        IsActive = @IsActive,
        ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ProfileId = @ProfileId;

    -- Keep company-user assignment in sync
    UPDATE CompanyUsers
    SET
        IsActive = @IsActive
    WHERE UserId = @UserId
      AND RoleInCompany = 'Technician';

    SELECT
        @ProfileId AS ProfileId,
        @UserId AS UserId,
        @IsActive AS IsActive,
        CASE
            WHEN @AvailabilityStatus = 4
                THEN 'Technician marked as inactive successfully'
            ELSE 'Technician profile updated and activated successfully'
        END AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Technician_UpdateServiceStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Technician_UpdateServiceStatus]
    @AssignmentId INT, @Status NVARCHAR(20), @Remarks NVARCHAR(500) = NULL,
    @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL, @ActionBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @ComplaintId INT, @TechnicianId INT, @OldStatus NVARCHAR(20);
        SELECT @ComplaintId = ComplaintId, @TechnicianId = TechnicianId, @OldStatus = Status FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;

        UPDATE TechnicianAssignments SET Status = @Status,
            CompletedAt = CASE WHEN @Status = 'Completed' THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE CompletedAt END, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE AssignmentId = @AssignmentId;

        DECLARE @ComplaintStatusId INT;
        SET @ComplaintStatusId = CASE @Status
            WHEN 'InProgress' THEN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName = 'InProgress')
            WHEN 'OnHold' THEN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName = 'OnHold')
            WHEN 'Completed' THEN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName = 'WorkCompleted')
            ELSE NULL END;
        IF @ComplaintStatusId IS NOT NULL
            UPDATE Complaints SET StatusId = @ComplaintStatusId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ComplaintId = @ComplaintId;

        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        SELECT @ComplaintId, ISNULL(@ComplaintStatusId, c.StatusId),
               'Service: ' + @OldStatus + ' -> ' + @Status + ISNULL('. ' + @Remarks, ''), @ActionBy
        FROM Complaints c WHERE c.ComplaintId = @ComplaintId;

        IF @Latitude IS NOT NULL
            INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, EventType, ComplaintId)
            VALUES (@TechnicianId, @Latitude, @Longitude, 'ServiceUpdate:' + @Status, @ComplaintId);

        INSERT INTO AssignmentAuditLog (AssignmentId, Action, ChangedBy, Remarks)
        VALUES (@AssignmentId, 'StatusChange:' + @OldStatus + '->' + @Status, @ActionBy, @Remarks);

        COMMIT;
        SELECT 1 AS Success, 'Service status updated to ' + @Status AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_TechnicianCheckIn]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- TRACKING & ATTENDANCE
-- ============================================
CREATE PROCEDURE [dbo].[sp_TechnicianCheckIn]
    @TechnicianId INT,
    @Latitude DECIMAL(9,6),
    @Longitude DECIMAL(9,6),
    @Address NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO TechnicianAttendance (TechnicianId, CheckInTime, CheckInLatitude, CheckInLongitude, CheckInAddress, AttendanceDate)
    VALUES (@TechnicianId, DATEADD(MINUTE, 330, GETUTCDATE()), @Latitude, @Longitude, @Address, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));
    
    INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, Address, EventType)
    VALUES (@TechnicianId, @Latitude, @Longitude, @Address, 'CheckIn');
    
    SELECT SCOPE_IDENTITY() AS AttendanceId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_TechnicianCheckOut]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_TechnicianCheckOut]
    @TechnicianId INT,
    @Latitude DECIMAL(9,6),
    @Longitude DECIMAL(9,6),
    @Address NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE TechnicianAttendance 
    SET CheckOutTime = DATEADD(MINUTE, 330, GETUTCDATE()),
        CheckOutLatitude = @Latitude,
        CheckOutLongitude = @Longitude,
        CheckOutAddress = @Address,
        TotalWorkHours = DATEDIFF(MINUTE, CheckInTime, DATEADD(MINUTE, 330, GETUTCDATE())) / 60.0
    WHERE TechnicianId = @TechnicianId 
    AND AttendanceDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)
    AND CheckOutTime IS NULL;
    
    INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, Address, EventType)
    VALUES (@TechnicianId, @Latitude, @Longitude, @Address, 'CheckOut');
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_ToggleUPIStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_ToggleUPIStatus]
    @Id INT,
    @UpdatedBy INT
AS
BEGIN
    UPDATE [dbo].[UPIConfigurations]
    SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END,
        UpdatedAt = GETDATE(),
        UpdatedBy = @UpdatedBy
    WHERE Id = @Id;

    SELECT 1 AS Success, 'UPI status updated successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetAttendance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Tracking_GetAttendance]
    @TechnicianId INT = NULL, @FromDate DATE, @ToDate DATE, @PageNumber INT = 1, @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ta.AttendanceId, ta.TechnicianId, u.FullName AS TechnicianName,
           ta.AttendanceDate, ta.CheckInTime, ta.CheckOutTime, ta.CheckInAddress, ta.CheckOutAddress,
           ta.CheckInLatitude, ta.CheckInLongitude, ta.CheckOutLatitude, ta.CheckOutLongitude, ta.TotalWorkHours,
           CASE WHEN ta.CheckOutTime IS NULL AND ta.AttendanceDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 'Active'
                WHEN ta.CheckOutTime IS NOT NULL THEN 'Completed' ELSE 'Absent' END AS AttendanceStatus,
           COUNT(*) OVER() AS TotalCount
    FROM TechnicianAttendance ta JOIN Technicians t ON ta.TechnicianId = t.TechnicianId JOIN Users u ON t.UserId = u.UserId
    WHERE (@TechnicianId IS NULL OR ta.TechnicianId = @TechnicianId) AND ta.AttendanceDate BETWEEN @FromDate AND @ToDate
    ORDER BY ta.AttendanceDate DESC, u.FullName
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetGeoTrail]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create    PROCEDURE [dbo].[sp_Tracking_GetGeoTrail]
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
            NULL                            AS CustomerName
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
            NULL, NULL, NULL, NULL
        FROM dbo.TechnicianAttendance a
        WHERE a.TechnicianId  = @TechnicianId
          AND a.AttendanceDate = @Date
          AND a.CheckOutTime IS NOT NULL
          AND a.CheckOutLatitude IS NOT NULL

        UNION ALL

        -- 3. Site Arrival  ← joined to Complaints for badge data
        SELECT
            CAST(sa.SiteArrivalId AS BIGINT) + 2000000,
            sa.Latitude,
            sa.Longitude,
            sa.[Address],
            'SiteArrival',
            sa.ArrivalTime,
            sa.ComplaintId,
            c.ComplaintNumber,
            c.Subject,           -- maps to ComplaintSubject in DTO/UI
            CU.CustomerName as customerName
        FROM dbo.TechnicianSiteArrivals sa
        LEFT JOIN dbo.Complaints c ON c.ComplaintId = sa.ComplaintId
        left join dbo.customers CU ON CU.CustomerId = c.CustomerId
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
            NULL, NULL, NULL, NULL
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
        customerName
    FROM AllEvents
    ORDER BY RecordedAt ASC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetHistory]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 9: sp_Tracking_GetHistory
-- │       Returns raw position log entries for a technician on a date
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Tracking_GetHistory]
    @TechnicianId INT,
    @Date         DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Date IS NULL
        SET @Date = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT
        LogId,
        Latitude,
        Longitude,
        Accuracy,
        Speed,
        BatteryLevel,
        LogTime
    FROM dbo.TrackingLog
    WHERE TechnicianId = @TechnicianId
      AND CAST(LogTime AS DATE) = @Date
    ORDER BY LogTime ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetLiveLocations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Tracking_GetLiveLocations]
    @Zone NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TechnicianId, u.FullName AS TechnicianName, t.Specialization, t.Zone,
           g.Latitude, g.Longitude, g.Address, g.EventType, g.CreatedAt AS LastUpdated,
           (SELECT COUNT(*) FROM TechnicianAssignments ta WHERE ta.TechnicianId = t.TechnicianId AND ta.Status = 'Active') AS ActiveJobs,
           CASE WHEN DATEDIFF(MINUTE, g.CreatedAt, DATEADD(MINUTE, 330, GETUTCDATE())) <= 5 THEN 'Online'
                WHEN DATEDIFF(MINUTE, g.CreatedAt, DATEADD(MINUTE, 330, GETUTCDATE())) <= 30 THEN 'Idle' ELSE 'Offline' END AS OnlineStatus
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    CROSS APPLY (SELECT TOP 1 Latitude, Longitude, Address, EventType, CreatedAt FROM GeoTrackingLog WHERE TechnicianId = t.TechnicianId ORDER BY CreatedAt DESC) g
    WHERE t.IsActive = 1 AND (@Zone IS NULL OR t.Zone = @Zone);
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetLivePositions]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 8: sp_Tracking_GetLivePositions
-- │       Returns latest position for each active technician
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Tracking_GetLivePositions]
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH LatestLog AS
    (
        SELECT
            TechnicianId,
            Latitude,
            Longitude,
            LogTime,
            ROW_NUMBER() OVER (PARTITION BY TechnicianId ORDER BY LogTime DESC) AS rn
        FROM dbo.TrackingLog
        WHERE LogTime >= DATEADD(HOUR, -12, DATEADD(MINUTE, 330, GETUTCDATE()))  -- only recent 12h
    )
    SELECT
        u.UserId             AS TechnicianId,
        u.FullName,
        ISNULL(tp.EmployeeCode, '')  AS EmployeeCode,
        ISNULL(tp.Specialization, '') AS Specialization,
        ll.Latitude          AS CurrentLatitude,
        ll.Longitude         AS CurrentLongitude,
        ll.LogTime           AS LastLocationUpdate,
        ISNULL(tp.AvailabilityStatus, 1) AS AvailabilityStatus,
        -- Current active complaint (if any)
        (
            SELECT TOP 1 c.ComplaintNumber
            FROM dbo.TechnicianAssignments ta
            INNER JOIN dbo.Complaints c ON c.ComplaintId = ta.ComplaintId
            WHERE ta.TechnicianId = u.UserId
              AND ta.Status IN ('InProgress', 'Assigned')
            ORDER BY ta.AssignedAt DESC
        ) AS CurrentComplaint
    FROM LatestLog ll
    INNER JOIN dbo.Users u ON u.UserId = ll.TechnicianId
    LEFT JOIN dbo.TechnicianProfiles tp ON tp.UserId = u.UserId
    WHERE ll.rn = 1
    ORDER BY u.FullName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_GetTravelReport]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Tracking_GetTravelReport]
    @TechnicianId INT = NULL, @FromDate DATE, @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TechnicianId, u.FullName AS TechnicianName, t.Zone,
           COUNT(DISTINCT tdl.TravelDate) AS DaysTraveled,
           ISNULL(SUM(tdl.DistanceKm), 0) AS TotalDistanceKm,
           ISNULL(AVG(tdl.DistanceKm), 0) AS AvgDailyDistanceKm,
           ISNULL(MAX(tdl.DistanceKm), 0) AS MaxDailyDistanceKm,
           COUNT(DISTINCT tdl.ComplaintId) AS SitesVisited
    FROM Technicians t JOIN Users u ON t.UserId = u.UserId
    LEFT JOIN TravelDistanceLog tdl ON t.TechnicianId = tdl.TechnicianId AND tdl.TravelDate BETWEEN @FromDate AND @ToDate
    WHERE (@TechnicianId IS NULL OR t.TechnicianId = @TechnicianId) AND t.IsActive = 1
    GROUP BY t.TechnicianId, u.FullName, t.Zone ORDER BY TotalDistanceKm DESC;

    IF @TechnicianId IS NOT NULL
    BEGIN
        SELECT tdl.TravelDate, SUM(tdl.DistanceKm) AS DistanceKm, COUNT(*) AS Trips,
               MIN(tdl.StartLatitude) AS StartLat, MIN(tdl.StartLongitude) AS StartLng,
               MAX(tdl.EndLatitude) AS EndLat, MAX(tdl.EndLongitude) AS EndLng
        FROM TravelDistanceLog tdl WHERE tdl.TechnicianId = @TechnicianId AND tdl.TravelDate BETWEEN @FromDate AND @ToDate
        GROUP BY tdl.TravelDate ORDER BY tdl.TravelDate;
    END
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_LogPosition]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- ┌─────────────────────────────────────────────────────────────────────────────
-- │ SP 7: sp_Tracking_LogPosition
-- │       Inserts a GPS position into TrackingLog
-- └─────────────────────────────────────────────────────────────────────────────
CREATE PROCEDURE [dbo].[sp_Tracking_LogPosition]
    @TechnicianId  INT,
    @Latitude      DECIMAL(10,7),
    @Longitude     DECIMAL(10,7),
    @Accuracy      DECIMAL(8,2)       = NULL,
    @Speed         DECIMAL(8,2)       = NULL,
    @BatteryLevel  INT                = NULL,
    @SessionId     UNIQUEIDENTIFIER   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.TrackingLog
        (TechnicianId, Latitude, Longitude, Accuracy, Speed, BatteryLevel, SessionId, LogTime)
    VALUES
        (@TechnicianId, @Latitude, @Longitude, @Accuracy, @Speed, @BatteryLevel, @SessionId, DATEADD(MINUTE, 330, GETUTCDATE()));

    SELECT SCOPE_IDENTITY() AS LogId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_LogTravelDistance]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Tracking_LogTravelDistance]
    @TechnicianId INT, @TravelDate DATE, @DistanceKm DECIMAL(10,2),
    @StartLatitude DECIMAL(9,6) = NULL, @StartLongitude DECIMAL(9,6) = NULL,
    @EndLatitude DECIMAL(9,6) = NULL, @EndLongitude DECIMAL(9,6) = NULL, @ComplaintId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO TravelDistanceLog (TechnicianId, TravelDate, DistanceKm, StartLatitude, StartLongitude, EndLatitude, EndLongitude, ComplaintId)
    VALUES (@TechnicianId, @TravelDate, @DistanceKm, @StartLatitude, @StartLongitude, @EndLatitude, @EndLongitude, @ComplaintId);
    SELECT SCOPE_IDENTITY() AS TravelLogId, 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Tracking_SiteArrival]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ████████████████████████████████████████████████████████████████
-- 5. TRACKING CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_Tracking_SiteArrival]
    @TechnicianId INT, @EventType NVARCHAR(50), @Latitude DECIMAL(9,6), @Longitude DECIMAL(9,6),
    @Address NVARCHAR(500) = NULL, @ComplaintId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO GeoTrackingLog (TechnicianId, Latitude, Longitude, Address, EventType, ComplaintId)
    VALUES (@TechnicianId, @Latitude, @Longitude, @Address, @EventType, @ComplaintId);

    IF @EventType = 'CheckIn'
        INSERT INTO TechnicianAttendance (TechnicianId, CheckInTime, CheckInLatitude, CheckInLongitude, CheckInAddress, AttendanceDate)
        VALUES (@TechnicianId, DATEADD(MINUTE, 330, GETUTCDATE()), @Latitude, @Longitude, @Address, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));
    ELSE IF @EventType = 'CheckOut'
        UPDATE TechnicianAttendance SET CheckOutTime = DATEADD(MINUTE, 330, GETUTCDATE()), CheckOutLatitude = @Latitude, CheckOutLongitude = @Longitude,
            CheckOutAddress = @Address, TotalWorkHours = DATEDIFF(MINUTE, CheckInTime, DATEADD(MINUTE, 330, GETUTCDATE())) / 60.0
        WHERE TechnicianId = @TechnicianId AND AttendanceDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND CheckOutTime IS NULL;

    IF @ComplaintId IS NOT NULL AND @EventType IN ('SiteArrival','SiteDeparture')
        INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
        SELECT @ComplaintId, StatusId,
               CASE @EventType WHEN 'SiteArrival' THEN 'Technician arrived at site' ELSE 'Technician departed from site' END,
               (SELECT UserId FROM Technicians WHERE TechnicianId = @TechnicianId)
        FROM Complaints WHERE ComplaintId = @ComplaintId;

    SELECT SCOPE_IDENTITY() AS TrackingId, 1 AS Success;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateAssignmentStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateAssignmentStatus]
    @AssignmentId INT,
    @Status NVARCHAR(20),
    @Remarks NVARCHAR(500) = NULL,
    @ActionBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ComplaintId INT;
    SELECT @ComplaintId = ComplaintId FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId;
    
    UPDATE TechnicianAssignments 
    SET Status = @Status, 
        CompletedAt = CASE WHEN @Status = 'Completed' THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE CompletedAt END,
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE AssignmentId = @AssignmentId;
    
    -- Log audit
    INSERT INTO AssignmentAuditLog (AssignmentId, Action, ChangedBy, Remarks)
    VALUES (@AssignmentId, 'StatusChange:' + @Status, @ActionBy, @Remarks);
    
    SELECT 1 AS Success, 'Assignment status updated.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateComplaintPayment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_UpdateComplaintPayment]
    @PaymentId INT,
    @ServiceChargeAmount DECIMAL(18,2),
    @SparePartsAmount DECIMAL(18,2),
    @DiscountAmount DECIMAL(18,2),
    @AmountPaid DECIMAL(18,2),
    @PaymentMethod VARCHAR(50),
    @PaymentStatus VARCHAR(50),
    @TransactionReference VARCHAR(200) = NULL,
    @Remarks NVARCHAR(MAX) = NULL,
    @UpdatedBy INT
AS
BEGIN
    DECLARE @TotalAmount DECIMAL(18,2) = (@ServiceChargeAmount + @SparePartsAmount) - @DiscountAmount;

    UPDATE [dbo].[ComplaintPayments]
    SET 
        ServiceChargeAmount = @ServiceChargeAmount,
        SparePartsAmount = @SparePartsAmount,
        DiscountAmount = @DiscountAmount,
        TotalAmount = @TotalAmount,
        AmountPaid = @AmountPaid,
        PaymentMethod = @PaymentMethod,
        PaymentStatus = @PaymentStatus,
        TransactionReference = @TransactionReference,
        Remarks = @Remarks
    WHERE PaymentId = @PaymentId;

    SELECT 1 AS Success, 'Payment updated successfully' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateComplaintPriority]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateComplaintPriority]
    @ComplaintId INT,
    @Priority NVARCHAR(20),
    @Remarks NVARCHAR(500) = NULL,
    @ActionBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @OldPriority NVARCHAR(20);
    SELECT @OldPriority = Priority FROM Complaints WHERE ComplaintId = @ComplaintId;
    
    UPDATE Complaints 
    SET Priority = @Priority,
        SLADeadline = CASE @Priority
            WHEN 'Critical' THEN DATEADD(HOUR, 4, DATEADD(MINUTE, 330, GETUTCDATE()))
            WHEN 'High' THEN DATEADD(HOUR, 12, DATEADD(MINUTE, 330, GETUTCDATE()))
            WHEN 'Medium' THEN DATEADD(HOUR, 24, DATEADD(MINUTE, 330, GETUTCDATE()))
            ELSE DATEADD(HOUR, 48, DATEADD(MINUTE, 330, GETUTCDATE()))
        END,
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;
    
    -- Add timeline
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    SELECT @ComplaintId, StatusId, 
           ISNULL(@Remarks, 'Priority changed from ' + @OldPriority + ' to ' + @Priority), 
           @ActionBy
    FROM Complaints WHERE ComplaintId = @ComplaintId;
    
    SELECT 1 AS Success, 'Priority updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateComplaintStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateComplaintStatus]
    @ComplaintId INT,
    @StatusId INT,
    @Remarks NVARCHAR(500) = NULL,
    @ActionBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @OldStatusId INT;
    SELECT @OldStatusId = StatusId FROM Complaints WHERE ComplaintId = @ComplaintId;
    
    UPDATE Complaints 
    SET StatusId = @StatusId, 
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        ClosedAt = CASE WHEN @StatusId IN (SELECT StatusId FROM ComplaintStatuses WHERE StatusName IN ('Closed','WorkCompleted'))
                        THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE ClosedAt END
    WHERE ComplaintId = @ComplaintId;
    
    -- Add timeline entry
    INSERT INTO ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy)
    VALUES (@ComplaintId, @StatusId, @Remarks, @ActionBy);
    
    SELECT 1 AS Success, 'Status updated successfully.' AS Message, @OldStatusId AS OldStatusId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateCustomer]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateCustomer]
    @CustomerId INT,
    @CustomerName NVARCHAR(200) = NULL,
    @Email NVARCHAR(200) = NULL,
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @Latitude DECIMAL(9,6) = NULL,
    @Longitude DECIMAL(9,6) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Customers
    SET CustomerName = ISNULL(@CustomerName, CustomerName),
        Email = ISNULL(@Email, Email),
        Address = ISNULL(@Address, Address),
        City = ISNULL(@City, City),
        [State] = ISNULL(@State, [State]),
        PinCode = ISNULL(@PinCode, PinCode),
        Latitude = ISNULL(@Latitude, Latitude),
        Longitude = ISNULL(@Longitude, Longitude),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE CustomerId = @CustomerId;
    
    SELECT 1 AS Success, 'Customer updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateDefaultServiceCharge]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_UpdateDefaultServiceCharge]
    @ConfigValue NVARCHAR(MAX),
    @UpdatedBy INT
AS
BEGIN
    UPDATE [dbo].[AppConfigurations]
    SET ConfigValue = @ConfigValue, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
    WHERE ConfigKey = 'DefaultServiceCharge';
    
    SELECT 1 AS Success, 'Service charge updated successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateProduct]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateProduct]
    @ProductId INT,
    @ProductName NVARCHAR(200) = NULL,
    @SerialNumber NVARCHAR(100) = NULL,
    @ModelNumber NVARCHAR(100) = NULL,
    @Brand NVARCHAR(100) = NULL,
    @Category NVARCHAR(100) = NULL,
    @PurchaseDate DATE = NULL,
    @WarrantyExpiryDate DATE = NULL,
    @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Products
    SET ProductName = ISNULL(@ProductName, ProductName),
        SerialNumber = ISNULL(@SerialNumber, SerialNumber),
        ModelNumber = ISNULL(@ModelNumber, ModelNumber),
        Brand = ISNULL(@Brand, Brand),
        Category = ISNULL(@Category, Category),
        PurchaseDate = ISNULL(@PurchaseDate, PurchaseDate),
        WarrantyExpiryDate = ISNULL(@WarrantyExpiryDate, WarrantyExpiryDate),
        IsActive = ISNULL(@IsActive, IsActive),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ProductId = @ProductId;
    
    SELECT 1 AS Success, 'Product updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateSchedule]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateSchedule]
    @ScheduleId INT,
    @ScheduledDate DATE = NULL,
    @TimeSlotStart TIME = NULL,
    @TimeSlotEnd TIME = NULL,
    @Status NVARCHAR(20) = NULL,
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE TechnicianSchedule
    SET ScheduledDate = ISNULL(@ScheduledDate, ScheduledDate),
        TimeSlotStart = ISNULL(@TimeSlotStart, TimeSlotStart),
        TimeSlotEnd = ISNULL(@TimeSlotEnd, TimeSlotEnd),
        Status = ISNULL(@Status, Status),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ScheduleId = @ScheduleId;
    
    SELECT 1 AS Success, 'Schedule updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateSparePartRequestStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateSparePartRequestStatus]
    @RequestId INT,
    @Status NVARCHAR(20),
    @Remarks NVARCHAR(500) = NULL,
    @ApprovedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE SparePartRequests
    SET Status = @Status,
        Remarks = ISNULL(@Remarks, Remarks),
        ApprovedBy = ISNULL(@ApprovedBy, ApprovedBy),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId = @RequestId;
    
    SELECT 1 AS Success, 'Spare part request status updated.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateTechnician]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateTechnician]
    @TechnicianId INT,
    @Specialization NVARCHAR(100) = NULL,
    @SkillLevel NVARCHAR(20) = NULL,
    @Zone NVARCHAR(100) = NULL,
    @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Technicians
    SET Specialization = ISNULL(@Specialization, Specialization),
        SkillLevel = ISNULL(@SkillLevel, SkillLevel),
        Zone = ISNULL(@Zone, Zone),
        IsActive = ISNULL(@IsActive, IsActive),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE TechnicianId = @TechnicianId;
    
    SELECT 1 AS Success, 'Technician updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_UpdateUser]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UpdateUser]
    @UserId INT,
    @FullName NVARCHAR(100) = NULL,
    @Email NVARCHAR(200) = NULL,
    @IsActive BIT = NULL,
    @UpdatedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF NOT EXISTS (SELECT 1 FROM Users WHERE UserId = @UserId)
    BEGIN
        SELECT 0 AS Success, 'User not found.' AS Message;
        RETURN;
    END
    
    UPDATE Users
    SET FullName = ISNULL(@FullName, FullName),
        Email = ISNULL(@Email, Email),
        IsActive = ISNULL(@IsActive, IsActive),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE UserId = @UserId;
    
    SELECT 1 AS Success, 'User updated successfully.' AS Message;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_User_CancelJoinRequest]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- 2. Cancel User's Own Join Request
-- ============================================
CREATE PROCEDURE [dbo].[sp_User_CancelJoinRequest]
    @RequestId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if request exists and belongs to user
    IF NOT EXISTS (SELECT 1 FROM [dbo].[CompanyJoinRequests] 
                   WHERE RequestId = @RequestId AND UserId = @UserId AND Status = 'Pending')
    BEGIN
        SELECT 0 AS Success, 'Request not found or already processed.' AS Message;
        RETURN;
    END
    
    -- Update status to Cancelled
    UPDATE [dbo].[CompanyJoinRequests]
    SET Status = 'Cancelled',
        ReviewedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE RequestId = @RequestId;
    
    SELECT 1 AS Success, 'Join request cancelled successfully.' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ChangePassword]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE PROCEDURE [dbo].[sp_User_ChangePassword]
    @UserId INT,
    @NewPasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Users SET PasswordHash = @NewPasswordHash WHERE UserId = @UserId;

    SELECT 1 AS Success, 'Password changed successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_User_CheckExists]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_User_CheckExists]
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        UserId,
        FullName,
        Email,
        MobileNumber,
        IsActive
    FROM [dbo].[Users]
    WHERE Email = @Email;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ForgotPassword]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_ForgotPassword]
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    IF NOT EXISTS(SELECT 1 FROM Users WHERE Email = @Email)
    BEGIN
        SELECT 0 AS Success, 'Email not found' AS Message, NULL AS OtpCode;
        RETURN;
    END

    DECLARE @OtpCode NVARCHAR(6) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS NVARCHAR(6)), 6);
    
    UPDATE EmailOtpLog SET IsUsed = 1 WHERE Email = @Email AND IsUsed = 0;
    
    INSERT INTO EmailOtpLog (Email, OtpCode, Purpose, ExpiresAt)
    VALUES (@Email, @OtpCode, 'ForgotPassword', DATEADD(MINUTE, 5, DATEADD(MINUTE, 330, GETUTCDATE())));

    SELECT 1 AS Success, 'OTP generated successfully.' AS Message, @OtpCode AS OtpCode;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetCompanies]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[sp_User_GetCompanies]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        c.Address,
        c.City,
        c.PhoneNumber,
        cu.RoleInCompany,
        cu.IsActive AS IsLinked
    FROM [dbo].[CompanyUsers] cu
    INNER JOIN [dbo].[Companies] c ON cu.CompanyId = c.CompanyId
    WHERE cu.UserId = @UserId AND cu.IsActive = 1 AND c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetCurrentSessionCompany]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- 3. Get Current Company from User Session
-- ============================================
CREATE   PROCEDURE [dbo].[sp_User_GetCurrentSessionCompany]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 1 SelectedCompanyId
    FROM [dbo].[UserSessions]
    WHERE UserId = @UserId AND IsActive = 1
    ORDER BY LastActivity DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetMenusForCompany]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_GetMenusForCompany]
    @UserId INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

 ;WITH UserMenus AS
(
    SELECT
        m.MenuId,
        m.MenuName,
        m.MenuPath,
        m.Icon,
        m.ParentMenuId,
        m.SortOrder,
        ISNULL(rm.CanView, 0)   AS CanView,
        ISNULL(rm.CanCreate, 0) AS CanCreate,
        ISNULL(rm.CanEdit, 0)   AS CanEdit,
        ISNULL(rm.CanDelete, 0) AS CanDelete
    FROM CompanyUsers cu
    INNER JOIN Roles r
        ON r.RoleName = cu.RoleInCompany
    INNER JOIN RoleMenuAccess rm
        ON rm.RoleId = r.RoleId
    INNER JOIN MenuItems m
        ON m.MenuId = rm.MenuId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND rm.CanView = 1
      AND m.IsActive = 1
),
ParentMenus AS
(
    SELECT
        p.MenuId,
        p.MenuName,
        p.MenuPath,
        p.Icon,
        p.ParentMenuId,
        p.SortOrder,
        1 AS CanView,
        0 AS CanCreate,
        0 AS CanEdit,
        0 AS CanDelete
    FROM MenuItems p
    WHERE p.MenuId IN
    (
        SELECT DISTINCT ParentMenuId
        FROM UserMenus
        WHERE ParentMenuId IS NOT NULL
    )
),
AllMenus AS
(
    SELECT * FROM UserMenus
    UNION ALL
    SELECT * FROM ParentMenus
)

SELECT
    MenuId,
    MenuName,
    MenuPath,
    Icon,
    ParentMenuId,
    SortOrder,
    MAX(CanView)   AS CanView,
    MAX(CanCreate) AS CanCreate,
    MAX(CanEdit)   AS CanEdit,
    MAX(CanDelete) AS CanDelete,
    ISNULL(ParentMenuId, MenuId) AS ParentSort
FROM AllMenus
GROUP BY
    MenuId,
    MenuName,
    MenuPath,
    Icon,
    ParentMenuId,
    SortOrder
ORDER BY
    ISNULL(ParentMenuId, MenuId),
    SortOrder,
    MenuId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetMyJoinRequests]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================
-- 1. Get User's Own Pending Join Requests
-- ============================================
CREATE   PROCEDURE [dbo].[sp_User_GetMyJoinRequests]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        r.RequestId,
        r.CompanyId,
        c.CompanyName,
        r.RequestedRole,
        r.Remarks,
        r.RequestedAt,
        r.Status
    FROM [dbo].[CompanyJoinRequests] r
    INNER JOIN [dbo].[Companies] c ON r.CompanyId = c.CompanyId
    WHERE r.UserId = @UserId AND r.Status = 'Pending'
    ORDER BY r.RequestedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetPendingInvitations]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_GetPendingInvitations]
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        i.InvitationId,
        i.CompanyId,
        c.CompanyName,
        i.RoleInCompany,
        i.Token,
        i.ExpiresAt,
        i.CreatedAt,
        u.FullName AS InvitedByName
    FROM [dbo].[CompanyInvitations] i
    INNER JOIN [dbo].[Companies] c ON i.CompanyId = c.CompanyId
    LEFT JOIN [dbo].[Users] u ON i.CreatedBy = u.UserId
    WHERE i.Email = @Email AND i.Status = 'Pending' AND i.ExpiresAt > DATEADD(MINUTE, 330, GETUTCDATE())
    ORDER BY i.CreatedAt DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ResetPassword]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_ResetPassword]
    @Email NVARCHAR(255),
    @OtpCode NVARCHAR(10),
    @NewPasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS(SELECT 1 FROM EmailOtpLog WHERE Email = @Email AND OtpCode = @OtpCode AND IsUsed = 0 AND ExpiresAt > DATEADD(MINUTE, 330, GETUTCDATE()))
    BEGIN
        SELECT 0 AS Success, 'Invalid or expired OTP' AS Message;
        RETURN;
    END

    UPDATE Users SET PasswordHash = @NewPasswordHash WHERE Email = @Email;
    UPDATE EmailOtpLog SET IsUsed = 1 WHERE Email = @Email AND OtpCode = @OtpCode;

    SELECT 1 AS Success, 'Password reset successfully' AS Message;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_User_SelectCompany]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_SelectCompany]
    @UserId INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cu.RoleInCompany,
        c.CompanyName,
        c.CompanyCode,
        c.CompanyId,

        -- Email from Users table
        u.Email AS EmailId,

        -- TechnicianId only if role is Technician
        CASE 
            WHEN cu.RoleInCompany = 'Technician' THEN t.TechnicianId
            ELSE NULL
        END AS TechnicianId

    FROM [dbo].[CompanyUsers] cu
    INNER JOIN [dbo].[Companies] c 
        ON cu.CompanyId = c.CompanyId

    LEFT JOIN [dbo].[Users] u 
        ON cu.UserId = u.UserId

    LEFT JOIN [dbo].[Technicians] t 
        ON cu.UserId = t.UserId 
        AND t.IsActive = 1

    WHERE cu.UserId = @UserId 
        AND cu.CompanyId = @CompanyId 
        AND cu.IsActive = 1 
        AND c.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_SelfRegister]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_User_SelfRegister]
    @FullName NVARCHAR(150),
    @Email NVARCHAR(200),
    @MobileNumber NVARCHAR(15),
    @PasswordHash NVARCHAR(500),
    @AadhaarNumber NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check duplicate email
    IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE Email = @Email)
    BEGIN
        SELECT 0 AS Success, 'Email already registered.' AS Message, NULL AS UserId;
        RETURN;
    END
    
    -- Check duplicate mobile
    IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT 0 AS Success, 'Mobile number already registered.' AS Message, NULL AS UserId;
        RETURN;
    END
    
    -- Check duplicate Aadhaar if provided
    --IF @AadhaarNumber IS NOT NULL AND EXISTS (SELECT 1 FROM [dbo].[Users] WHERE AadhaarNumber = @AadhaarNumber)
    --BEGIN
    --    SELECT 0 AS Success, 'Aadhaar number already registered.' AS Message, NULL AS UserId;
    --    RETURN;
    --END
    
    -- Insert user with default role
    DECLARE @DefaultRoleId INT = (SELECT TOP 1 RoleId FROM [dbo].[Roles] WHERE RoleName = 'User');
    IF @DefaultRoleId IS NULL SET @DefaultRoleId = (SELECT MIN(RoleId) FROM [dbo].[Roles]);
    
    INSERT INTO [dbo].[Users] (FullName, Email, MobileNumber, PasswordHash, RoleId, UserType, AadhaarNumber, IsActive, CreatedAt)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @DefaultRoleId, 'SystemUser', @AadhaarNumber, 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    
    SELECT 1 AS Success, 'Registration successful. Please wait for company admin to add you.' AS Message, SCOPE_IDENTITY() AS UserId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_UpdateSession]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- sp_User_UpdateSession
CREATE PROCEDURE [dbo].[sp_User_UpdateSession]
    @UserId INT,
    @CompanyId INT,
    @AuthToken NVARCHAR(500),
    @IpAddress NVARCHAR(45) = NULL,
    @UserAgent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Deactivate old sessions
    UPDATE [dbo].[UserSessions]
    SET IsActive = 0
    WHERE UserId = @UserId AND IsActive = 1;
    
    -- Insert new session
    INSERT INTO [dbo].[UserSessions] (
        UserId, SelectedCompanyId, AuthToken, IpAddress, UserAgent,
        IsActive, LastActivity, CreatedAt
    )
    VALUES (
        @UserId, @CompanyId, @AuthToken, @IpAddress, @UserAgent,
        1, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE())
    );
    
    SELECT SCOPE_IDENTITY() AS SessionId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Users_Search]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_Users_Search]
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SET @SearchTerm = LTRIM(RTRIM(@SearchTerm));

    IF @SearchTerm IS NULL OR LEN(@SearchTerm) = 0
    BEGIN
        SELECT
            NULL AS UserId,
            NULL AS FullName,
            NULL AS Email,
            NULL AS MobileNumber,
            NULL AS RoleId,
            NULL AS RoleName,
            NULL AS IsActive,
            NULL AS CreatedAt,
            NULL AS UserType,
            'Please enter a search term' AS Message;
        RETURN;
    END

    DECLARE @UserId INT = TRY_CAST(@SearchTerm AS INT);

    SELECT TOP 1
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        u.RoleId,
        r.RoleName,
        u.IsActive,
        u.CreatedAt,
        u.UserType,
        NULL AS Message
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r
        ON r.RoleId = u.RoleId
    WHERE u.UserType = 'SystemUser'
      AND u.IsActive = 1
      AND
      (
            (@UserId IS NOT NULL AND u.UserId = @UserId)
         OR u.Email = @SearchTerm
         OR u.FullName = @SearchTerm
         OR u.MobileNumber = @SearchTerm
      );

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT
            NULL AS UserId,
            NULL AS FullName,
            NULL AS Email,
            NULL AS MobileNumber,
            NULL AS RoleId,
            NULL AS RoleName,
            NULL AS IsActive,
            NULL AS CreatedAt,
            NULL AS UserType,
            'No user found matching exact value "' + @SearchTerm + '"' AS Message;
    END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ValidateOTP]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_ValidateOTP]
    @MobileNumber NVARCHAR(15),
    @OtpCode NVARCHAR(6)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IsValid BIT = 0;
    DECLARE @UserId INT;
    
    IF EXISTS (
        SELECT 1 FROM OtpLog 
        WHERE MobileNumber = @MobileNumber 
        AND OtpCode = @OtpCode 
        AND IsUsed = 0 
        AND ExpiresAt > DATEADD(MINUTE, 330, GETUTCDATE())
    )
    BEGIN
        SET @IsValid = 1;
        UPDATE OtpLog SET IsUsed = 1 
        WHERE MobileNumber = @MobileNumber AND OtpCode = @OtpCode;
        
        SELECT @UserId = UserId FROM Users WHERE MobileNumber = @MobileNumber;
        
        IF @UserId IS NOT NULL
            UPDATE Users SET LastLoginAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE UserId = @UserId;
    END
    
    SELECT @IsValid AS IsValid, @UserId AS UserId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_VerifyComplaintPayment]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_VerifyComplaintPayment]
    @PaymentId  INT,
    @IsVerified BIT,
    @VerifiedBy INT
AS
BEGIN
    UPDATE [dbo].[ComplaintPayments]
    SET
        IsVerified = @IsVerified,
        VerifiedBy = CASE WHEN @IsVerified = 1 THEN @VerifiedBy ELSE NULL END,
        VerifiedAt = CASE WHEN @IsVerified = 1 THEN GETDATE()   ELSE NULL END
    WHERE PaymentId = @PaymentId;

    SELECT 1 AS Success, 'Verification updated' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_CheckByProduct]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ████████████████████████████████████████████████████████████████
-- 6. WARRANTY CONTROLLER SPs
-- ████████████████████████████████████████████████████████████████

CREATE PROCEDURE [dbo].[sp_Warranty_CheckByProduct]
    @ProductId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.PurchaseDate, p.WarrantyExpiryDate,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           CASE WHEN p.WarrantyExpiryDate IS NULL THEN 'No warranty info'
                WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 'Active - ' + CAST(DATEDIFF(DAY, DATEADD(MINUTE, 330, GETUTCDATE()), p.WarrantyExpiryDate) AS NVARCHAR) + ' days remaining'
                ELSE 'Expired - ' + CAST(DATEDIFF(DAY, p.WarrantyExpiryDate, DATEADD(MINUTE, 330, GETUTCDATE())) AS NVARCHAR) + ' days ago' END AS WarrantyStatus,
           c.CustomerName, c.MobileNumber AS CustomerMobile
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId WHERE p.ProductId = @ProductId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_CheckBySerial]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Warranty_CheckBySerial]
    @SerialNumber NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.ModelNumber, p.Brand, p.PurchaseDate, p.WarrantyExpiryDate,
           CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END AS IsUnderWarranty,
           CASE WHEN p.WarrantyExpiryDate IS NULL THEN 'No warranty info'
                WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 'Active - ' + CAST(DATEDIFF(DAY, DATEADD(MINUTE, 330, GETUTCDATE()), p.WarrantyExpiryDate) AS NVARCHAR) + ' days remaining'
                ELSE 'Expired' END AS WarrantyStatus,
           c.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile,
           (SELECT COUNT(*) FROM Complaints cmp WHERE cmp.ProductId = p.ProductId) AS TotalComplaints
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId WHERE p.SerialNumber = @SerialNumber;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_ExtendWarranty]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Warranty_ExtendWarranty]
    @ProductId INT, @NewExpiryDate DATE, @Reason NVARCHAR(500) = NULL, @ExtendedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @OldExpiry DATE;
    SELECT @OldExpiry = WarrantyExpiryDate FROM Products WHERE ProductId = @ProductId;

    UPDATE Products SET WarrantyExpiryDate = @NewExpiryDate, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()) WHERE ProductId = @ProductId;

    SELECT 1 AS Success, 'Warranty extended.' AS Message,
           @OldExpiry AS OldExpiryDate, @NewExpiryDate AS NewExpiryDate;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_GetDashboard]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Warranty_GetDashboard]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT (SELECT COUNT(*) FROM Products WHERE IsActive = 1) AS TotalProducts,
           (SELECT COUNT(*) FROM Products WHERE WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND IsActive = 1) AS ActiveWarranty,
           (SELECT COUNT(*) FROM Products WHERE WarrantyExpiryDate < CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND IsActive = 1) AS ExpiredWarranty,
           (SELECT COUNT(*) FROM Products WHERE WarrantyExpiryDate BETWEEN CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND DATEADD(DAY, 30, DATEADD(MINUTE, 330, GETUTCDATE())) AND IsActive = 1) AS ExpiringIn30Days,
           (SELECT COUNT(*) FROM Products WHERE WarrantyExpiryDate BETWEEN CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND DATEADD(DAY, 7, DATEADD(MINUTE, 330, GETUTCDATE())) AND IsActive = 1) AS ExpiringIn7Days;

    SELECT p.Brand, COUNT(*) AS Total,
           SUM(CASE WHEN p.WarrantyExpiryDate >= CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END) AS Active,
           SUM(CASE WHEN p.WarrantyExpiryDate < CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) THEN 1 ELSE 0 END) AS Expired
    FROM Products p WHERE p.IsActive = 1 AND p.Brand IS NOT NULL GROUP BY p.Brand ORDER BY Total DESC;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_GetExpiredProducts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Warranty_GetExpiredProducts]
    @PageNumber INT = 1, @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.WarrantyExpiryDate,
           DATEDIFF(DAY, p.WarrantyExpiryDate, DATEADD(MINUTE, 330, GETUTCDATE())) AS DaysExpired,
           c.CustomerId, c.CustomerName, c.MobileNumber, COUNT(*) OVER() AS TotalCount
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.WarrantyExpiryDate < CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND p.IsActive = 1
    ORDER BY p.WarrantyExpiryDate DESC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Warranty_GetExpiringProducts]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Warranty_GetExpiringProducts]
    @DaysAhead INT = 30, @PageNumber INT = 1, @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.Brand, p.ModelNumber, p.PurchaseDate, p.WarrantyExpiryDate,
           DATEDIFF(DAY, DATEADD(MINUTE, 330, GETUTCDATE()), p.WarrantyExpiryDate) AS DaysRemaining,
           c.CustomerId, c.CustomerName, c.MobileNumber, c.City, COUNT(*) OVER() AS TotalCount
    FROM Products p JOIN Customers c ON p.CustomerId = c.CustomerId
    WHERE p.WarrantyExpiryDate BETWEEN CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND DATEADD(DAY, @DaysAhead, DATEADD(MINUTE, 330, GETUTCDATE())) AND p.IsActive = 1
    ORDER BY p.WarrantyExpiryDate ASC OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_WarrantyReturn_Create]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_WarrantyReturn_Create]
    @ComplaintId INT,
    @CustomerId INT,
    @ProductId INT,
    @ProductSerialNo VARCHAR(50),
    @WarrantyStartDate DATE,
    @WarrantyEndDate DATE,
    @ReturnReason NVARCHAR(500),
    @ReturnType INT,
    @PickupAddress NVARCHAR(500),
    @CreatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ReturnNo VARCHAR(20) = 'WR-' + FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()),'yyyyMMdd') + '-' + RIGHT('0000'+CAST((SELECT ISNULL(MAX(ReturnId),0)+1 FROM WarrantyReturns) AS VARCHAR),4);

    INSERT INTO WarrantyReturns (ReturnNo, ComplaintId, CustomerId, ProductId, ProductSerialNo, WarrantyStartDate, WarrantyEndDate, ReturnReason, ReturnType, PickupAddress, CreatedBy)
    VALUES (@ReturnNo, @ComplaintId, @CustomerId, @ProductId, @ProductSerialNo, @WarrantyStartDate, @WarrantyEndDate, @ReturnReason, @ReturnType, @PickupAddress, @CreatedBy);

    SELECT SCOPE_IDENTITY() AS ReturnId, @ReturnNo AS ReturnNo, 'Warranty return created' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_WarrantyReturn_GetAll]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ==========================================
-- WARRANTY RETURNS SPs
-- ==========================================
CREATE   PROCEDURE [dbo].[sp_WarrantyReturn_GetAll]
    @SearchTerm NVARCHAR(100) = NULL,
    @StatusFilter INT = NULL,
    @ReturnTypeFilter INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT wr.*, 
        c.ComplaintNo, c.Subject AS ComplaintSubject,
        cu.FullName AS CustomerName, cu.Phone AS CustomerPhone,
        COUNT(*) OVER() AS TotalCount
    FROM WarrantyReturns wr
    INNER JOIN Complaints c ON wr.ComplaintId = c.ComplaintId
    INNER JOIN Users cu ON wr.CustomerId = cu.UserId
    WHERE wr.IsActive = 1
    AND (@SearchTerm IS NULL OR wr.ReturnNo LIKE '%'+@SearchTerm+'%' OR cu.FullName LIKE '%'+@SearchTerm+'%' OR wr.ProductSerialNo LIKE '%'+@SearchTerm+'%')
    AND (@StatusFilter IS NULL OR wr.StatusId = @StatusFilter)
    AND (@ReturnTypeFilter IS NULL OR wr.ReturnType = @ReturnTypeFilter)
    ORDER BY wr.CreatedDate DESC
    OFFSET (@PageNumber-1)*@PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_WarrantyReturn_GetById]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_WarrantyReturn_GetById]
    @ReturnId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT wr.*, c.ComplaintNo, c.Subject, c.Description AS ComplaintDescription,
        cu.FullName AS CustomerName, cu.Email AS CustomerEmail, cu.Phone AS CustomerPhone
    FROM WarrantyReturns wr
    INNER JOIN Complaints c ON wr.ComplaintId = c.ComplaintId
    INNER JOIN Users cu ON wr.CustomerId = cu.UserId
    WHERE wr.ReturnId = @ReturnId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_WarrantyReturn_UpdateStatus]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_WarrantyReturn_UpdateStatus]
    @ReturnId INT,
    @StatusId INT,
    @ApprovedBy INT = NULL,
    @ResolutionNotes NVARCHAR(MAX) = NULL,
    @TrackingNumber VARCHAR(50) = NULL,
    @RefundAmount DECIMAL(12,2) = NULL,
    @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE WarrantyReturns SET
        StatusId = @StatusId,
        ApprovedBy = CASE WHEN @StatusId IN (2,3) THEN @ApprovedBy ELSE ApprovedBy END,
        ApprovedDate = CASE WHEN @StatusId IN (2,3) THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE ApprovedDate END,
        ResolutionNotes = ISNULL(@ResolutionNotes, ResolutionNotes),
        TrackingNumber = ISNULL(@TrackingNumber, TrackingNumber),
        RefundAmount = ISNULL(@RefundAmount, RefundAmount),
        ModifiedBy = @ModifiedBy,
        ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ReturnId = @ReturnId;

    SELECT @ReturnId AS ReturnId, 'Status updated successfully' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_WorkOrder_GetDetails]    Script Date: 29-09-2026 20:26:58 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_WorkOrder_GetDetails]
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Main Detail
    SELECT 
        a.AssignmentId,
        a.ComplaintId,
        c.ComplaintNo as ComplaintNumber,
        c.Subject,
        c.Description,
        c.NatureOfJob,
        a.Priority,
        c.SLADeadline,
        c.CreatedAt as ComplaintCreatedAt,
        a.AssignmentRole,
        a.Status,
        st.StatusName,
        st.StatusColor,
        DATEADD(MINUTE, 330, a.AssignedAt) AS AssignedAt,
        a.CompletedAt,
        a.ScheduledDate,
        a.StartTime,
        a.EndTime,
        a.EstimatedDuration,
        a.TimeSlot,
        a.Notes,
        cust.CustomerName,
        cust.Address as CustomerAddress,
        cust.MobileNumber as CustomerPhone,
        cust.City,
        p.ProductName,
        p.SerialNumber,
        p.Brand,
        p.WarrantyExpiryDate,
        CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND a.Status <> 'Completed' THEN 1 ELSE 0 END as IsSLABreached
    FROM TechnicianAssignments a
    INNER JOIN Complaints c ON c.ComplaintId = a.ComplaintId
    LEFT JOIN Customers cust ON cust.CustomerId = c.CustomerId
    LEFT JOIN Products p ON p.ProductId = c.ProductId
    LEFT JOIN ComplaintStatuses st ON st.StatusId = c.StatusId
    WHERE a.AssignmentId = @AssignmentId;

    -- 2. Timeline (Audit Log)
    SELECT 
        al.AuditId,
        al.Action,
        al.Remarks,
        al.ChangedAt,
        u.FullName AS ChangedByName,
        t_old.FullName AS OldTechnicianName,
        t_new.FullName AS NewTechnicianName,
        al.OldRole,
        al.NewRole
    FROM AssignmentAuditLog al
    LEFT JOIN Users u ON u.UserId = al.ChangedBy
    LEFT JOIN Technicians tech_old ON tech_old.TechnicianId = al.OldTechnicianId
    LEFT JOIN Users t_old ON t_old.UserId = tech_old.UserId
    LEFT JOIN Technicians tech_new ON tech_new.TechnicianId = al.NewTechnicianId
    LEFT JOIN Users t_new ON t_new.UserId = tech_new.UserId
    WHERE al.AssignmentId = @AssignmentId
    ORDER BY al.ChangedAt ASC;

    -- 3. Service images
    SELECT 
        si.ImageId,
        si.ImageType,
        si.ImagePath,
        si.ImageData,
        si.UploadedAt
    FROM ServiceImages si
    WHERE si.ComplaintId = (SELECT ComplaintId FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId)
    ORDER BY si.UploadedAt DESC;

    -- 4. Repair Details
    SELECT 
        r.RepairRequestId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.CreatedAt,
        (SELECT COUNT(*) FROM RepairPartImages img WHERE img.RepairRequestId = r.RepairRequestId) as ImageCount
    FROM RepairPartRequests r
    WHERE r.AssignmentId = @AssignmentId
    ORDER BY r.CreatedAt DESC;
END
GO
USE [master]
GO
ALTER DATABASE [FelixServiceDB] SET  READ_WRITE 
GO
