USE [master]
GO
/****** Object:  Database [MainDBEncryptz]    Script Date: 29-09-2026 20:21:45 ******/
CREATE DATABASE [MainDBEncryptz]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'MainDBEncryptz', FILENAME = N'/var/opt/mssql/data/MainDBEncryptz.mdf' , SIZE = 8192KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'MainDBEncryptz_log', FILENAME = N'/var/opt/mssql/data/MainDBEncryptz_log.ldf' , SIZE = 8192KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT, LEDGER = OFF
GO
ALTER DATABASE [MainDBEncryptz] SET COMPATIBILITY_LEVEL = 160
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [MainDBEncryptz].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [MainDBEncryptz] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET ARITHABORT OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET AUTO_CLOSE ON 
GO
ALTER DATABASE [MainDBEncryptz] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [MainDBEncryptz] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [MainDBEncryptz] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET  ENABLE_BROKER 
GO
ALTER DATABASE [MainDBEncryptz] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [MainDBEncryptz] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET RECOVERY FULL 
GO
ALTER DATABASE [MainDBEncryptz] SET  MULTI_USER 
GO
ALTER DATABASE [MainDBEncryptz] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [MainDBEncryptz] SET DB_CHAINING OFF 
GO
ALTER DATABASE [MainDBEncryptz] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [MainDBEncryptz] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [MainDBEncryptz] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [MainDBEncryptz] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [MainDBEncryptz] SET QUERY_STORE = ON
GO
ALTER DATABASE [MainDBEncryptz] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [MainDBEncryptz]
GO
/****** Object:  Table [dbo].[Companies]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Companies](
	[CompanyId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyName] [nvarchar](200) NOT NULL,
	[CompanyCode] [nvarchar](50) NOT NULL,
	[Address] [nvarchar](400) NULL,
	[City] [nvarchar](100) NULL,
	[PhoneNumber] [nvarchar](30) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Companies_Code] UNIQUE NONCLUSTERED 
(
	[CompanyCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanyUsers]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanyUsers](
	[CompanyUserId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[UserId] [int] NOT NULL,
	[RoleInCompany] [nvarchar](100) NOT NULL,
	[TechnicianId] [int] NULL,
	[AssignedBy] [int] NULL,
	[AssignedAt] [datetime] NOT NULL,
	[IsActive] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[CompanyUserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CU_Company_User] UNIQUE NONCLUSTERED 
(
	[CompanyId] ASC,
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CustomerPortal]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CustomerPortal](
	[CustomerPortalId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](256) NOT NULL,
	[MobileNumber] [nvarchar](20) NULL,
	[PasswordHash] [nvarchar](200) NOT NULL,
	[Address] [nvarchar](400) NULL,
	[City] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[CustomerPortalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CP_Email] UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Invitations]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Invitations](
	[InvitationId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[Email] [nvarchar](256) NOT NULL,
	[RoleInCompany] [nvarchar](100) NOT NULL,
	[Token] [uniqueidentifier] NOT NULL,
	[Status] [nvarchar](30) NOT NULL,
	[Remarks] [nvarchar](400) NULL,
	[InvitedBy] [int] NULL,
	[ExpiresAt] [datetime] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[ProjectId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InvitationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[JoinRequests]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[JoinRequests](
	[RequestId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[CompanyId] [int] NOT NULL,
	[RequestedRole] [nvarchar](100) NOT NULL,
	[Remarks] [nvarchar](400) NULL,
	[Status] [nvarchar](30) NOT NULL,
	[RejectionReason] [nvarchar](400) NULL,
	[ReviewedBy] [int] NULL,
	[RequestedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MenuItems]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MenuItems](
	[MenuId] [int] IDENTITY(1,1) NOT NULL,
	[MenuName] [nvarchar](150) NOT NULL,
	[MenuPath] [nvarchar](300) NULL,
	[Icon] [nvarchar](100) NULL,
	[ParentMenuId] [int] NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[MenuId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Otp]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Otp](
	[OtpId] [int] IDENTITY(1,1) NOT NULL,
	[MobileNumber] [nvarchar](20) NOT NULL,
	[OtpCode] [nvarchar](10) NOT NULL,
	[ExpiresAt] [datetime] NOT NULL,
	[IsUsed] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[OtpId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProjectConnections]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProjectConnections](
	[ProjectConnectionId] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ProjectKey] [nvarchar](50) NOT NULL,
	[ServerName] [nvarchar](200) NOT NULL,
	[DatabaseName] [nvarchar](200) NOT NULL,
	[DbUser] [nvarchar](100) NOT NULL,
	[DbPasswordEnc] [nvarchar](500) NOT NULL,
	[ExtraOptions] [nvarchar](400) NULL,
	[IsActive] [bit] NOT NULL,
	[UpdatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ProjectConnectionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_PC_ProjectKey] UNIQUE NONCLUSTERED 
(
	[ProjectKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Projects]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Projects](
	[ProjectId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[ProjectName] [nvarchar](200) NOT NULL,
	[ProjectKey] [nvarchar](50) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Projects_Key] UNIQUE NONCLUSTERED 
(
	[ProjectKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoleMenuAccess]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoleMenuAccess](
	[RoleMenuAccessId] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [int] NOT NULL,
	[MenuId] [int] NOT NULL,
	[CanView] [bit] NOT NULL,
	[CanCreate] [bit] NOT NULL,
	[CanEdit] [bit] NOT NULL,
	[CanDelete] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RoleMenuAccessId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_RMA_Role_Menu] UNIQUE NONCLUSTERED 
(
	[RoleId] ASC,
	[MenuId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[RoleId] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](300) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Roles_RoleName] UNIQUE NONCLUSTERED 
(
	[RoleName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserProjectAccess]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserProjectAccess](
	[UserProjectAccessId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[ProjectId] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[GrantedBy] [int] NULL,
	[GrantedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserProjectAccessId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_UPA_User_Project] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](256) NOT NULL,
	[MobileNumber] [nvarchar](20) NULL,
	[PasswordHash] [nvarchar](200) NULL,
	[RoleId] [int] NULL,
	[AadhaarNumber] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserSessions]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserSessions](
	[UserSessionId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[SelectedCompanyId] [int] NULL,
	[SelectedProjectId] [int] NULL,
	[SelectedLocationId] [int] NULL,
	[AuthToken] [nvarchar](max) NULL,
	[UpdatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserSessionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_US_User] UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Index [IX_CompanyUsers_User]    Script Date: 29-09-2026 20:21:46 ******/
CREATE NONCLUSTERED INDEX [IX_CompanyUsers_User] ON [dbo].[CompanyUsers]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Projects_Company]    Script Date: 29-09-2026 20:21:46 ******/
CREATE NONCLUSTERED INDEX [IX_Projects_Company] ON [dbo].[Projects]
(
	[CompanyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UPA_User]    Script Date: 29-09-2026 20:21:46 ******/
CREATE NONCLUSTERED INDEX [IX_UPA_User] ON [dbo].[UserProjectAccess]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Mobile]    Script Date: 29-09-2026 20:21:46 ******/
CREATE NONCLUSTERED INDEX [IX_Users_Mobile] ON [dbo].[Users]
(
	[MobileNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Companies] ADD  CONSTRAINT [DF_Companies_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Companies] ADD  CONSTRAINT [DF_Companies_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  CONSTRAINT [DF_CU_AssignedAt]  DEFAULT (getdate()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[CompanyUsers] ADD  CONSTRAINT [DF_CU_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[CustomerPortal] ADD  CONSTRAINT [DF_CP_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[CustomerPortal] ADD  CONSTRAINT [DF_CP_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Invitations] ADD  CONSTRAINT [DF_Inv_Token]  DEFAULT (newid()) FOR [Token]
GO
ALTER TABLE [dbo].[Invitations] ADD  CONSTRAINT [DF_Inv_Status]  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[Invitations] ADD  CONSTRAINT [DF_Inv_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[JoinRequests] ADD  CONSTRAINT [DF_JR_Status]  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[JoinRequests] ADD  CONSTRAINT [DF_JR_RequestedAt]  DEFAULT (getdate()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[MenuItems] ADD  CONSTRAINT [DF_MenuItems_Sort]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[MenuItems] ADD  CONSTRAINT [DF_MenuItems_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Otp] ADD  CONSTRAINT [DF_Otp_IsUsed]  DEFAULT ((0)) FOR [IsUsed]
GO
ALTER TABLE [dbo].[Otp] ADD  CONSTRAINT [DF_Otp_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ProjectConnections] ADD  CONSTRAINT [DF_PC_Extra]  DEFAULT ('TrustServerCertificate=True;MultipleActiveResultSets=True') FOR [ExtraOptions]
GO
ALTER TABLE [dbo].[ProjectConnections] ADD  CONSTRAINT [DF_PC_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ProjectConnections] ADD  CONSTRAINT [DF_PC_UpdatedAt]  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Projects] ADD  CONSTRAINT [DF_Projects_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Projects] ADD  CONSTRAINT [DF_Projects_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RMA_View]  DEFAULT ((0)) FOR [CanView]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RMA_Create]  DEFAULT ((0)) FOR [CanCreate]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RMA_Edit]  DEFAULT ((0)) FOR [CanEdit]
GO
ALTER TABLE [dbo].[RoleMenuAccess] ADD  CONSTRAINT [DF_RMA_Delete]  DEFAULT ((0)) FOR [CanDelete]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserProjectAccess] ADD  CONSTRAINT [DF_UPA_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UserProjectAccess] ADD  CONSTRAINT [DF_UPA_GrantedAt]  DEFAULT (getdate()) FOR [GrantedAt]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserSessions] ADD  CONSTRAINT [DF_US_UpdatedAt]  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CompanyUsers]  WITH CHECK ADD FOREIGN KEY([AssignedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[CompanyUsers]  WITH CHECK ADD FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[CompanyUsers]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Invitations]  WITH CHECK ADD FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[Invitations]  WITH CHECK ADD FOREIGN KEY([InvitedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[JoinRequests]  WITH CHECK ADD FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[JoinRequests]  WITH CHECK ADD FOREIGN KEY([ReviewedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[JoinRequests]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[MenuItems]  WITH CHECK ADD FOREIGN KEY([ParentMenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[ProjectConnections]  WITH CHECK ADD FOREIGN KEY([ProjectId])
REFERENCES [dbo].[Projects] ([ProjectId])
GO
ALTER TABLE [dbo].[Projects]  WITH CHECK ADD FOREIGN KEY([CompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([MenuId])
REFERENCES [dbo].[MenuItems] ([MenuId])
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[UserProjectAccess]  WITH CHECK ADD FOREIGN KEY([GrantedBy])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[UserProjectAccess]  WITH CHECK ADD FOREIGN KEY([ProjectId])
REFERENCES [dbo].[Projects] ([ProjectId])
GO
ALTER TABLE [dbo].[UserProjectAccess]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[UserSessions]  WITH CHECK ADD FOREIGN KEY([SelectedCompanyId])
REFERENCES [dbo].[Companies] ([CompanyId])
GO
ALTER TABLE [dbo].[UserSessions]  WITH CHECK ADD FOREIGN KEY([SelectedProjectId])
REFERENCES [dbo].[Projects] ([ProjectId])
GO
ALTER TABLE [dbo].[UserSessions]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_GenerateOtp]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   AUTH / OTP / REGISTER
   ============================================================================= */

CREATE   PROCEDURE [dbo].[sp_Auth_GenerateOtp]
    @MobileNumber NVARCHAR(20),
    @OtpCode      NVARCHAR(10),
    @ExpiresAt    DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Otp (MobileNumber, OtpCode, ExpiresAt, IsUsed)
    VALUES (@MobileNumber, @OtpCode, @ExpiresAt, 0);
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_GetMenusByRole]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   MENUS (by role) + MANAGEMENT (users / roles / menu access)
   ============================================================================= */

CREATE   PROCEDURE [dbo].[sp_Auth_GetMenusByRole]
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
           rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_Login]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_Auth_Login  (global login against MainDB)
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_Auth_Login]
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        u.PasswordHash,
        ISNULL(r.RoleName, '')      AS Role,
        CAST(NULL AS INT)           AS technicianId
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.Email = @Email
      AND u.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_Register]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Auth_Register]
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @PasswordHash NVARCHAR(200),
    @RoleId       INT,
    @UserId       INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber OR Email = @Email)
    BEGIN
        SET @UserId = 0;
        RETURN;
    END

    INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @RoleId, 1);

    SET @UserId = SCOPE_IDENTITY();
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Auth_ValidateOtp]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Auth_ValidateOtp]
    @MobileNumber NVARCHAR(20),
    @OtpCode      NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OtpId INT, @UserId INT, @RoleId INT;

    SELECT TOP 1 @OtpId = OtpId
    FROM dbo.Otp
    WHERE MobileNumber = @MobileNumber AND OtpCode = @OtpCode
      AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;

    IF @OtpId IS NULL
        RETURN;   -- no rows -> C# treats as invalid/expired

    UPDATE dbo.Otp SET IsUsed = 1 WHERE OtpId = @OtpId;

    SELECT TOP 1 @UserId = u.UserId, @RoleId = u.RoleId
    FROM dbo.Users u
    WHERE u.MobileNumber = @MobileNumber AND u.IsActive = 1;

    -- Table[0]: user
    SELECT
        u.UserId,
        u.FullName,
        ISNULL(r.RoleName, '') AS Role,
        u.Email,
        u.MobileNumber
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;

    -- Table[1]: menus for the user's role
    SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
           rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_AcceptInvitation]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Company_AcceptInvitation]
    @Token      UNIQUEIDENTIFIER,
    @UserId     INT,
    @projectId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT;
    DECLARE @Role NVARCHAR(100);
    DECLARE @InvitationProjectId INT;

    BEGIN TRY

        BEGIN TRANSACTION;

        /* ============================================================
           1. Get invitation details
           ============================================================ */

        SELECT TOP 1
            @CompanyId = CompanyId,
            @Role = RoleInCompany,
            @InvitationProjectId = ProjectId
        FROM dbo.Invitations
        WHERE Token = @Token
          AND Status = 'Pending'
          AND ExpiresAt > GETDATE();


        /* ============================================================
           2. Validate invitation
           ============================================================ */

        IF @CompanyId IS NULL
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                CAST(0 AS INT) AS Success,
                'Invitation invalid or expired' AS Message,
                CAST(0 AS INT) AS CompanyId,
                CAST('' AS NVARCHAR(100)) AS RoleInCompany;

            RETURN;
        END;


        /* ============================================================
           3. Validate project
           ============================================================ */

        IF @InvitationProjectId IS NULL
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                CAST(0 AS INT) AS Success,
                'Invitation does not have a project assigned' AS Message,
                @CompanyId AS CompanyId,
                @Role AS RoleInCompany;

            RETURN;
        END;


        /* ============================================================
           4. Make sure API projectId matches invitation project
           ============================================================ */

        IF @projectId <> @InvitationProjectId
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                CAST(0 AS INT) AS Success,
                'Project does not match the invitation' AS Message,
                @CompanyId AS CompanyId,
                @Role AS RoleInCompany;

            RETURN;
        END;


        /* ============================================================
           5. Add / activate Company User
           ============================================================ */

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.CompanyUsers
            WHERE CompanyId = @CompanyId
              AND UserId = @UserId
        )
        BEGIN
            INSERT INTO dbo.CompanyUsers
            (
                CompanyId,
                UserId,
                RoleInCompany,
                IsActive
            )
            VALUES
            (
                @CompanyId,
                @UserId,
                @Role,
                1
            );
        END
        ELSE
        BEGIN
            UPDATE dbo.CompanyUsers
            SET
                RoleInCompany = @Role,
                IsActive = 1
            WHERE CompanyId = @CompanyId
              AND UserId = @UserId;
        END;


        /* ============================================================
           6. Add / activate User Project Access
           ============================================================ */

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.UserProjectAccess
            WHERE UserId = @UserId
              AND ProjectId = @InvitationProjectId
        )
        BEGIN
            INSERT INTO dbo.UserProjectAccess
            (
                UserId,
                ProjectId,
                IsActive,
                GrantedBy,
                GrantedAt
            )
            VALUES
            (
                @UserId,
                @InvitationProjectId,
                1,
                @UserId,
                GETDATE()
            );
        END
        ELSE
        BEGIN
            UPDATE dbo.UserProjectAccess
            SET
                IsActive = 1,
                GrantedBy = @UserId,
                GrantedAt = GETDATE()
            WHERE UserId = @UserId
              AND ProjectId = @InvitationProjectId;
        END;


        /* ============================================================
           7. Mark invitation as accepted
           ============================================================ */

        UPDATE dbo.Invitations
        SET Status = 'Accepted'
        WHERE Token = @Token
          AND Status = 'Pending';


        /* ============================================================
           8. Commit transaction
           ============================================================ */

        COMMIT TRANSACTION;


        /* ============================================================
           9. Return success
           ============================================================ */

        SELECT
            CAST(1 AS INT) AS Success,
            'Invitation accepted' AS Message,
            @CompanyId AS CompanyId,
            @Role AS RoleInCompany;

    END TRY

    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            CAST(0 AS INT) AS Success,
            ERROR_MESSAGE() AS Message,
            CAST(0 AS INT) AS CompanyId,
            CAST('' AS NVARCHAR(100)) AS RoleInCompany;

    END CATCH

END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_ApproveRequest]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_ApproveRequest]
    @RequestId  INT,
    @CompanyId  INT,
    @ReviewedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @Role NVARCHAR(100);
    SELECT @UserId = UserId, @Role = RequestedRole
    FROM dbo.JoinRequests
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @Role, @ReviewedBy, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE dbo.JoinRequests SET Status = 'Approved', ReviewedBy = @ReviewedBy WHERE RequestId = @RequestId;

    SELECT CAST(1 AS INT) AS Success, 'Request approved' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_CancelInvitation]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_CancelInvitation]
    @InvitationId INT,
    @CancelledBy  INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Invitations SET Status = 'Cancelled' WHERE InvitationId = @InvitationId AND Status = 'Pending';
    SELECT @@ROWCOUNT AS CancelledCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_CreateJoinRequest]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_CreateJoinRequest]
    @UserId        INT,
    @CompanyId     INT,
    @RequestedRole NVARCHAR(100),
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.JoinRequests WHERE UserId = @UserId AND CompanyId = @CompanyId AND Status = 'Pending')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You already have a pending request for this company' AS Message,
               CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    DECLARE @NewId INT;
    INSERT INTO dbo.JoinRequests (UserId, CompanyId, RequestedRole, Remarks, Status)
    VALUES (@UserId, @CompanyId, @RequestedRole, @Remarks, 'Pending');
    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Join request submitted' AS Message, @NewId AS RequestId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetAllCompanies]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_GetAllCompanies]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.City,
        CASE
            WHEN EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1) THEN 'Member'
            WHEN EXISTS (SELECT 1 FROM dbo.JoinRequests jr WHERE jr.CompanyId = c.CompanyId AND jr.UserId = @UserId AND jr.Status = 'Pending') THEN 'Pending'
            ELSE 'Available'
        END AS UserStatus
    FROM dbo.Companies c
    WHERE c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetPendingInvitations]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_GetPendingInvitations]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.Email, i.RoleInCompany, i.Status, i.ExpiresAt, i.CreatedAt,
           ISNULL(u.FullName, 'System') AS CreatedByName
    FROM dbo.Invitations i
    LEFT JOIN dbo.Users u ON u.UserId = i.InvitedBy
    WHERE i.CompanyId = @CompanyId AND i.Status = 'Pending';
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetPendingRequests]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_GetPendingRequests]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT jr.RequestId, jr.UserId, u.FullName AS UserName, u.Email AS UserEmail, u.MobileNumber,
           jr.RequestedRole, jr.Remarks, jr.RequestedAt, jr.Status
    FROM dbo.JoinRequests jr
    INNER JOIN dbo.Users u ON u.UserId = jr.UserId
    WHERE jr.CompanyId = @CompanyId AND jr.Status = 'Pending';
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetUsers]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_GetUsers]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, cu.RoleInCompany,
           cu.AssignedAt, ISNULL(ab.FullName, 'System') AS AssignedByName
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Users ab ON ab.UserId = cu.AssignedBy
    WHERE cu.CompanyId = @CompanyId AND cu.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_GetUsersWithDetails]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_GetUsersWithDetails]
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cu.CompanyUserId, u.UserId, u.FullName, u.Email, u.MobileNumber, cu.RoleInCompany,
           cu.AssignedAt, ISNULL(ab.FullName, 'System') AS AssignedBy, cu.IsActive
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Users ab ON ab.UserId = cu.AssignedBy
    WHERE cu.CompanyId = @CompanyId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_InviteUser]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_Company_InviteUser]
    @CompanyId     INT,
    @Email         NVARCHAR(256),
    @RoleInCompany NVARCHAR(100),
    @InvitedBy     INT,
    @projectID     INT,
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT;
    DECLARE @UserId INT;

    -- 1. Check whether invitation is already pending
    IF EXISTS
    (
        SELECT 1
        FROM dbo.Invitations
        WHERE CompanyId = @CompanyId
          AND Email = @Email
          AND Status = 'Pending'
    )
    BEGIN
        SELECT
            CAST(0 AS INT) AS Success,
            'An invitation is already pending for this email' AS Message,
            CAST(0 AS INT) AS InvitationId;

        RETURN;
    END;

    -- 2. Get existing user
    SELECT @UserId = UserId
    FROM dbo.Users
    WHERE Email = @Email;

    -- 3. Create invitation
    INSERT INTO dbo.Invitations
    (
        CompanyId,
        ProjectId,
        Email,
        RoleInCompany,
        Status,
        Remarks,
        InvitedBy,
        ExpiresAt
    )
    VALUES
    (
        @CompanyId,
        @projectID, 
        @Email,
        @RoleInCompany,
        'Pending',
        @Remarks,
        @InvitedBy,
        DATEADD(DAY, 7, GETDATE())
    );

    SET @NewId = SCOPE_IDENTITY();

    -- 4. Grant project access only if user already exists
    --IF @UserId IS NOT NULL
    --BEGIN
    --    IF NOT EXISTS
    --    (
    --        SELECT 1
    --        FROM dbo.UserProjectAccess
    --        WHERE 
    --           UserId = @UserId
    --          AND ProjectId = @projectID
    --          AND IsActive = 1
    --    )
    --    BEGIN
    --        INSERT INTO dbo.UserProjectAccess
    --        (
               
    --            UserId,
    --            ProjectId,
    --            IsActive
    --        )
    --        VALUES
    --        (
               
    --            @UserId,
    --            @projectID,
    --            1
    --        );
    --    END;
  --  END;

    -- 5. Return result
    SELECT
        CAST(1 AS INT) AS Success,
        'Invitation sent' AS Message,
        @NewId AS InvitationId;
END;
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RejectInvitation]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_RejectInvitation]
    @InvitationId INT,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Invitations SET Status = 'Rejected' WHERE InvitationId = @InvitationId AND Status = 'Pending';
    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Invitation not found or already handled' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Invitation rejected' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RejectRequest]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_RejectRequest]
    @RequestId       INT,
    @CompanyId       INT,
    @ReviewedBy      INT,
    @RejectionReason NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.JoinRequests
    SET Status = 'Rejected', RejectionReason = @RejectionReason, ReviewedBy = @ReviewedBy
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';
    SELECT @@ROWCOUNT AS RejectedCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_RemoveUser]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_RemoveUser]
    @CompanyId INT,
    @UserId    INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.CompanyUsers SET IsActive = 0
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    SELECT @@ROWCOUNT AS RemovedCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Company_UpdateUserRole]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Company_UpdateUserRole]
    @CompanyId INT,
    @UserId    INT,
    @NewRole   NVARCHAR(100),
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.CompanyUsers SET RoleInCompany = @NewRole
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    SELECT @@ROWCOUNT AS UpdatedCount;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_GetDashboard]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_CustomerPortal_GetDashboard]
    @CustomerPortalId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Table[0]: profile
    SELECT CustomerPortalId, FullName, Email, MobileNumber, Address, City
    FROM dbo.CustomerPortal
    WHERE CustomerPortalId = @CustomerPortalId;

    -- Table[1]: menus (none by default)
    SELECT CAST(0 AS INT) AS MenuId, CAST('' AS NVARCHAR(150)) AS MenuName,
           CAST('' AS NVARCHAR(300)) AS MenuPath, CAST('' AS NVARCHAR(100)) AS Icon
    WHERE 1 = 0;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_Login]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_CustomerPortal_Login]
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 CustomerPortalId, FullName, Email, PasswordHash
    FROM dbo.CustomerPortal
    WHERE Email = @Email AND IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_CustomerPortal_Register]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   CUSTOMER PORTAL (end-customer self-service)
   ============================================================================= */

CREATE   PROCEDURE [dbo].[sp_CustomerPortal_Register]
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @PasswordHash NVARCHAR(200),
    @Address      NVARCHAR(400) = NULL,
    @City         NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.CustomerPortal WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message; RETURN;
    END
    INSERT INTO dbo.CustomerPortal (FullName, Email, MobileNumber, PasswordHash, Address, City)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @Address, @City);
    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_GetUserById]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_GetUserById]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, ISNULL(r.RoleName, '') AS RoleName
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetMenuAccess]    Script Date: 29-09-2026 20:21:46 ******/
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
        m.MenuId, m.MenuName, m.MenuPath, m.ParentMenuId, m.SortOrder,
        ISNULL(rma.CanView, 0)   AS CanView,
        ISNULL(rma.CanCreate, 0) AS CanCreate,
        ISNULL(rma.CanEdit, 0)   AS CanEdit,
        ISNULL(rma.CanDelete, 0) AS CanDelete,
        CAST(CASE WHEN rma.RoleMenuAccessId IS NULL THEN 0 ELSE 1 END AS BIT) AS HasAccess
    FROM dbo.MenuItems m
    LEFT JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetRoles]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Mgmt_GetRoles]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, RoleName, Description, IsActive, CreatedAt
    FROM dbo.Roles
    ORDER BY RoleName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_GetUsers]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Mgmt_GetUsers]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber,
           ISNULL(u.RoleId, 0) AS RoleId, ISNULL(r.RoleName, '') AS RoleName,
           u.IsActive, u.CreatedAt
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    ORDER BY u.FullName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveMenuAccessBulk]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Mgmt_SaveMenuAccessBulk]
    @RoleId     INT,
    @AccessJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH j AS (
        SELECT menuId, canView, canCreate, canEdit, canDelete
        FROM OPENJSON(@AccessJson)
        WITH (menuId INT '$.menuId', canView INT '$.canView', canCreate INT '$.canCreate',
              canEdit INT '$.canEdit', canDelete INT '$.canDelete')
    )
    MERGE dbo.RoleMenuAccess AS tgt
    USING j ON tgt.RoleId = @RoleId AND tgt.MenuId = j.menuId
    WHEN MATCHED THEN
        UPDATE SET CanView = j.canView, CanCreate = j.canCreate, CanEdit = j.canEdit, CanDelete = j.canDelete
    WHEN NOT MATCHED THEN
        INSERT (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        VALUES (@RoleId, j.menuId, j.canView, j.canCreate, j.canEdit, j.canDelete);
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveRole]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Mgmt_SaveRole]
    @RoleId      INT,
    @RoleName    NVARCHAR(100),
    @Description NVARCHAR(300) = NULL,
    @IsActive    BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @RoleId IS NULL OR @RoleId = 0
    BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, IsActive)
        VALUES (@RoleName, @Description, @IsActive);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS RoleId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Roles SET RoleName = @RoleName, Description = @Description, IsActive = @IsActive
        WHERE RoleId = @RoleId;
        SELECT @RoleId AS RoleId, 'Updated' AS Status;
    END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Mgmt_SaveUser]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_Mgmt_SaveUser]
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @RoleId       INT,
    @IsActive     BIT,
    @PasswordHash NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash)
        VALUES (@FullName, @Email, @MobileNumber, @RoleId, @IsActive, @PasswordHash);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS UserId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET FullName = @FullName, Email = @Email, MobileNumber = @MobileNumber,
            RoleId = @RoleId, IsActive = @IsActive,
            PasswordHash = CASE WHEN @PasswordHash IS NULL THEN PasswordHash ELSE @PasswordHash END
        WHERE UserId = @UserId;
        SELECT @UserId AS UserId, 'Updated' AS Status;
    END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Project_GetConnection]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/* =============================================================================
   MainDB  ·  Routing + auth stored procedures  (per-project routing)
   -----------------------------------------------------------------------------
   Location procs are NOT here — locations live in each project's DB.
   ============================================================================= */


/* -----------------------------------------------------------------------------
   sp_Project_GetConnection
   Used by IConnectionResolver to build a ProjectDB connection string.
   Returns the encrypted registry row for a given ProjectKey.
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_Project_GetConnection]
    @ProjectKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        pc.ProjectId,
        pc.ProjectKey,
        pc.ServerName,
        pc.DatabaseName,
        pc.DbUser,
        pc.DbPasswordEnc,
        pc.ExtraOptions
    FROM dbo.ProjectConnections pc
    INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId
    WHERE pc.ProjectKey = @ProjectKey
      AND pc.IsActive = 1
      AND p.IsActive  = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_CancelJoinRequest]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_CancelJoinRequest]
    @RequestId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.JoinRequests SET Status = 'Cancelled'
    WHERE RequestId = @RequestId AND UserId = @UserId AND Status = 'Pending';
    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Request cancelled' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ChangePassword]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_ChangePassword]
    @UserId          INT,
    @NewPasswordHash NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET PasswordHash = @NewPasswordHash WHERE UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Password changed successfully' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_CheckExists]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_CheckExists]
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 UserId, FullName
    FROM dbo.Users
    WHERE Email = @Email AND IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ForgotPassword]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   PASSWORD (forgot / reset / change)
   ============================================================================= */

CREATE   PROCEDURE [dbo].[sp_User_ForgotPassword]
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Mobile NVARCHAR(20);
    SELECT TOP 1 @Mobile = MobileNumber FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @Mobile IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message, CAST(NULL AS NVARCHAR(10)) AS OtpCode;
        RETURN;
    END

    DECLARE @Otp NVARCHAR(10) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6);

    INSERT INTO dbo.Otp (MobileNumber, OtpCode, ExpiresAt, IsUsed)
    VALUES (@Mobile, @Otp, DATEADD(MINUTE, 10, GETDATE()), 0);

    SELECT CAST(1 AS INT) AS Success, 'OTP generated' AS Message, @Otp AS OtpCode;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetCompanies]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_GetCompanies
   Companies the user can reach — i.e. ONLY companies that contain at least one
   PROJECT the user has access to (UserProjectAccess). A company with no accessible
   project is not listed. Role comes from CompanyUsers when present.
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_GetCompanies]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        c.Address,
        c.City,
        c.PhoneNumber,
        ISNULL(cu.RoleInCompany, '') AS RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects  p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId   AND c.IsActive = 1
    LEFT  JOIN dbo.CompanyUsers cu ON cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = upa.UserId
    WHERE upa.UserId = @UserId
      AND upa.IsActive = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetCurrentSessionCompany]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_GetCurrentSessionCompany
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_GetCurrentSessionCompany]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SelectedCompanyId, SelectedProjectId, SelectedLocationId
    FROM dbo.UserSessions
    WHERE UserId = @UserId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetMenusForCompany]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_GetMenusForCompany  (global menu tree filtered by role in company)
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_GetMenusForCompany]
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT;

    SELECT @RoleId = r.RoleId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;

    SELECT
        m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
        rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma
            ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetMyJoinRequests]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_GetMyJoinRequests]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT jr.RequestId, jr.CompanyId, c.CompanyName, jr.RequestedRole, jr.Remarks, jr.RequestedAt, jr.Status
    FROM dbo.JoinRequests jr
    INNER JOIN dbo.Companies c ON c.CompanyId = jr.CompanyId
    WHERE jr.UserId = @UserId AND jr.Status = 'Pending';
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetPendingInvitations]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_User_GetPendingInvitations]
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.InvitationId,
        i.CompanyId,
        i.ProjectId,
        c.CompanyName,
        i.RoleInCompany,
        i.Token,
        i.ExpiresAt,
        ISNULL(u.FullName, 'System') AS InvitedByName
    FROM dbo.Invitations AS i
    INNER JOIN dbo.Companies AS c
        ON c.CompanyId = i.CompanyId
    LEFT JOIN dbo.Users AS u
        ON u.UserId = i.InvitedBy
    WHERE i.Email = @Email
      AND i.Status = 'Pending'
      AND i.ExpiresAt > GETDATE()
    ORDER BY i.ExpiresAt ASC;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_GetProjects]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_GetProjects
   PROJECTS THE USER CAN ACCESS within a company (per-user access from MainDB).
   Includes ProjectKey so the API can resolve that project's DB.
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_GetProjects]
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProjectId,
        p.CompanyId,
        p.ProjectName,
        p.ProjectKey
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId
    WHERE upa.UserId = @UserId
      AND p.CompanyId = @CompanyId
      AND upa.IsActive = 1
      AND p.IsActive  = 1
    ORDER BY p.ProjectName;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ResetPassword]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_ResetPassword]
    @Email           NVARCHAR(256),
    @OtpCode         NVARCHAR(10),
    @NewPasswordHash NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @Mobile NVARCHAR(20), @OtpId INT;
    SELECT TOP 1 @UserId = UserId, @Mobile = MobileNumber FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message; RETURN;
    END

    SELECT TOP 1 @OtpId = OtpId FROM dbo.Otp
    WHERE MobileNumber = @Mobile AND OtpCode = @OtpCode AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;

    IF @OtpId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Invalid or expired OTP' AS Message; RETURN;
    END

    UPDATE dbo.Otp SET IsUsed = 1 WHERE OtpId = @OtpId;
    UPDATE dbo.Users SET PasswordHash = @NewPasswordHash WHERE UserId = @UserId;

    SELECT CAST(1 AS INT) AS Success, 'Password reset successful' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_SelectCompany]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_SelectCompany
   Returns the user's role for the chosen company (projects are fetched separately).
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_SelectCompany]
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        cu.RoleInCompany,
        ISNULL(cu.TechnicianId, 0) AS TechnicianId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c ON c.CompanyId = cu.CompanyId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND c.IsActive  = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_SelfRegister]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[sp_User_SelfRegister]
    @FullName      NVARCHAR(200),
    @Email         NVARCHAR(256),
    @MobileNumber  NVARCHAR(20),
    @PasswordHash  NVARCHAR(200),
    @AadhaarNumber NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message;
        RETURN;
    END
    IF @MobileNumber IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Mobile number already registered' AS Message;
        RETURN;
    END

    INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, AadhaarNumber, IsActive)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @AadhaarNumber, 1);

    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_UpdateSession]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_UpdateSession  (persist current company/project/location + token)
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_UpdateSession]
    @UserId     INT,
    @CompanyId  INT,
    @AuthToken  NVARCHAR(MAX),
    @ProjectId  INT = NULL,
    @LocationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.UserSessions AS tgt
    USING (SELECT @UserId AS UserId) AS src
        ON tgt.UserId = src.UserId
    WHEN MATCHED THEN
        UPDATE SET SelectedCompanyId = @CompanyId,
                   SelectedProjectId = @ProjectId,
                   SelectedLocationId = @LocationId,
                   AuthToken = @AuthToken,
                   UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, SelectedCompanyId, SelectedProjectId, SelectedLocationId, AuthToken)
        VALUES (@UserId, @CompanyId, @ProjectId, @LocationId, @AuthToken);
END
GO
/****** Object:  StoredProcedure [dbo].[sp_User_ValidateProject]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* -----------------------------------------------------------------------------
   sp_User_ValidateProject
   Confirms a user may access a project and returns its ProjectKey (routing key).
   Location access is validated separately inside the project's own DB.
   ----------------------------------------------------------------------------- */
CREATE   PROCEDURE [dbo].[sp_User_ValidateProject]
    @UserId    INT,
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        p.ProjectId,
        p.ProjectKey,
        cu.RoleInCompany
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p    ON p.ProjectId = upa.ProjectId
    INNER JOIN dbo.CompanyUsers cu ON cu.UserId = upa.UserId AND cu.CompanyId = p.CompanyId AND cu.IsActive = 1
    WHERE upa.UserId = @UserId
      AND upa.ProjectId = @ProjectId
      AND p.CompanyId = @CompanyId
      AND upa.IsActive = 1
      AND p.IsActive  = 1;
END
GO
/****** Object:  StoredProcedure [dbo].[sp_Users_Search]    Script Date: 29-09-2026 20:21:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE  PROCEDURE [dbo].[sp_Users_Search]
    @SearchTerm NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber,
           ISNULL(u.RoleId, 0) AS RoleId, ISNULL(r.RoleName, '') AS RoleName, u.IsActive, u.CreatedAt
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE @SearchTerm IS NULL OR @SearchTerm = ''
       OR u.FullName LIKE '%' + @SearchTerm + '%'
       OR u.Email LIKE '%' + @SearchTerm + '%'
       OR u.MobileNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY u.FullName;
END
GO
USE [master]
GO
ALTER DATABASE [MainDBEncryptz] SET  READ_WRITE 
GO
