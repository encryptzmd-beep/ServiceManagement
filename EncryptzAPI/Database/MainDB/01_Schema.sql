/* =============================================================================
   MainDB  ·  Central control-plane database (ONE shared instance)
   -----------------------------------------------------------------------------
   Model (confirmed): Client(Company) -> many Projects -> each Project has ONE DB.
      - DB routing key is the PROJECT (ProjectKey), not the client.
      - MainDB stores only WHICH PROJECTS a user can access (UserProjectAccess).
      - Locations live inside each PROJECT's own DB (not here).

   MainDB holds:
      - Global login + menu:  Users, Roles, MenuItems, RoleMenuAccess
      - Tenant registry:      Companies, Projects, ProjectConnections (Project -> DB)
      - Access:               CompanyUsers (company membership), UserProjectAccess
      - Session/control:      UserSessions, Invitations, JoinRequests, Otp

   Run once on the target SQL Server to create MainDB from scratch.
   ============================================================================= */

IF DB_ID('MainDBEncryptz') IS NULL
    CREATE DATABASE MainDBEncryptz;
GO

USE MainDBEncryptz;
GO

/* -----------------------------------------------------------------------------
   1. Roles  (global, shared across all clients)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Roles') IS NULL
CREATE TABLE dbo.Roles
(
    RoleId       INT IDENTITY(1,1) PRIMARY KEY,
    RoleName     NVARCHAR(100)  NOT NULL,
    Description  NVARCHAR(300)  NULL,
    IsActive     BIT            NOT NULL CONSTRAINT DF_Roles_IsActive  DEFAULT (1),
    CreatedAt    DATETIME       NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
);
GO

/* -----------------------------------------------------------------------------
   2. Users  (global login identity)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Users') IS NULL
CREATE TABLE dbo.Users
(
    UserId        INT IDENTITY(1,1) PRIMARY KEY,
    FullName      NVARCHAR(200)  NOT NULL,
    Email         NVARCHAR(256)  NOT NULL,
    MobileNumber  NVARCHAR(20)   NULL,
    PasswordHash  NVARCHAR(200)  NULL,          -- BCrypt hash
    RoleId        INT            NULL REFERENCES dbo.Roles(RoleId),
    AadhaarNumber NVARCHAR(20)   NULL,
    IsActive      BIT            NOT NULL CONSTRAINT DF_Users_IsActive  DEFAULT (1),
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);
GO
CREATE INDEX IX_Users_Mobile ON dbo.Users(MobileNumber);
GO

/* -----------------------------------------------------------------------------
   3. MenuItems + RoleMenuAccess  (global menu tree + per-role permissions)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.MenuItems') IS NULL
CREATE TABLE dbo.MenuItems
(
    MenuId        INT IDENTITY(1,1) PRIMARY KEY,
    MenuName      NVARCHAR(150)  NOT NULL,
    MenuPath      NVARCHAR(300)  NULL,
    Icon          NVARCHAR(100)  NULL,
    ParentMenuId  INT            NULL REFERENCES dbo.MenuItems(MenuId),
    SortOrder     INT            NOT NULL CONSTRAINT DF_MenuItems_Sort DEFAULT (0),
    IsActive      BIT            NOT NULL CONSTRAINT DF_MenuItems_IsActive DEFAULT (1)
);
GO

IF OBJECT_ID('dbo.RoleMenuAccess') IS NULL
CREATE TABLE dbo.RoleMenuAccess
(
    RoleMenuAccessId INT IDENTITY(1,1) PRIMARY KEY,
    RoleId     INT NOT NULL REFERENCES dbo.Roles(RoleId),
    MenuId     INT NOT NULL REFERENCES dbo.MenuItems(MenuId),
    CanView    BIT NOT NULL CONSTRAINT DF_RMA_View   DEFAULT (0),
    CanCreate  BIT NOT NULL CONSTRAINT DF_RMA_Create DEFAULT (0),
    CanEdit    BIT NOT NULL CONSTRAINT DF_RMA_Edit   DEFAULT (0),
    CanDelete  BIT NOT NULL CONSTRAINT DF_RMA_Delete DEFAULT (0),
    CONSTRAINT UQ_RMA_Role_Menu UNIQUE (RoleId, MenuId)
);
GO

/* -----------------------------------------------------------------------------
   4. Companies  (= Clients / tenants). A company groups multiple projects.
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Companies') IS NULL
CREATE TABLE dbo.Companies
(
    CompanyId    INT IDENTITY(1,1) PRIMARY KEY,
    CompanyName  NVARCHAR(200) NOT NULL,
    CompanyCode  NVARCHAR(50)  NOT NULL,
    Address      NVARCHAR(400) NULL,
    City         NVARCHAR(100) NULL,
    PhoneNumber  NVARCHAR(30)  NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_Companies_IsActive  DEFAULT (1),
    CreatedAt    DATETIME      NOT NULL CONSTRAINT DF_Companies_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_Companies_Code UNIQUE (CompanyCode)
);
GO

/* -----------------------------------------------------------------------------
   5. Projects  (a company has MANY projects; EACH project has its OWN database).
      ProjectKey is the routing key used to resolve that project's DB.
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NULL
CREATE TABLE dbo.Projects
(
    ProjectId    INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId    INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    ProjectName  NVARCHAR(200) NOT NULL,
    ProjectKey   NVARCHAR(50)  NOT NULL,          -- === routing key -> ProjectDB ===
    IsActive     BIT NOT NULL CONSTRAINT DF_Projects_IsActive  DEFAULT (1),
    CreatedAt    DATETIME NOT NULL CONSTRAINT DF_Projects_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_Projects_Key UNIQUE (ProjectKey)
);
GO
CREATE INDEX IX_Projects_Company ON dbo.Projects(CompanyId);
GO

/* -----------------------------------------------------------------------------
   6. ProjectConnections  ·  THE REGISTRY  (Project -> its own DB)
      One row per project. Password stored ENCRYPTED (ITenantSecretProtector).
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.ProjectConnections') IS NULL
CREATE TABLE dbo.ProjectConnections
(
    ProjectConnectionId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId     INT NOT NULL REFERENCES dbo.Projects(ProjectId),
    ProjectKey    NVARCHAR(50)  NOT NULL,         -- mirror of Projects.ProjectKey for fast lookup
    ServerName    NVARCHAR(200) NOT NULL,         -- e.g. 72.60.206.241
    DatabaseName  NVARCHAR(200) NOT NULL,         -- e.g. FelixProject_C001_P001
    DbUser        NVARCHAR(100) NOT NULL,
    DbPasswordEnc NVARCHAR(500) NOT NULL,         -- ENCRYPTED password (never plaintext)
    ExtraOptions  NVARCHAR(400) NULL
                  CONSTRAINT DF_PC_Extra DEFAULT ('TrustServerCertificate=True;MultipleActiveResultSets=True'),
    IsActive      BIT NOT NULL CONSTRAINT DF_PC_IsActive DEFAULT (1),
    UpdatedAt     DATETIME NOT NULL CONSTRAINT DF_PC_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_PC_ProjectKey UNIQUE (ProjectKey)
);
GO

/* -----------------------------------------------------------------------------
   7. CompanyUsers  (which users belong to which company + their role there)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CompanyUsers') IS NULL
CREATE TABLE dbo.CompanyUsers
(
    CompanyUserId     INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId         INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    UserId            INT NOT NULL REFERENCES dbo.Users(UserId),
    RoleInCompany     NVARCHAR(100) NOT NULL,
    TechnicianId      INT NULL,
    AssignedBy        INT NULL REFERENCES dbo.Users(UserId),
    AssignedAt        DATETIME NOT NULL CONSTRAINT DF_CU_AssignedAt DEFAULT (GETDATE()),
    IsActive          BIT NOT NULL CONSTRAINT DF_CU_IsActive DEFAULT (1),
    CONSTRAINT UQ_CU_Company_User UNIQUE (CompanyId, UserId)
);
GO
CREATE INDEX IX_CompanyUsers_User ON dbo.CompanyUsers(UserId);
GO

/* -----------------------------------------------------------------------------
   8. UserProjectAccess  ·  WHICH PROJECTS A USER CAN ACCESS (managed in MainDB)
      (Location-level access is stored inside each project's own DB.)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserProjectAccess') IS NULL
CREATE TABLE dbo.UserProjectAccess
(
    UserProjectAccessId INT IDENTITY(1,1) PRIMARY KEY,
    UserId       INT NOT NULL REFERENCES dbo.Users(UserId),
    ProjectId    INT NOT NULL REFERENCES dbo.Projects(ProjectId),
    IsActive     BIT NOT NULL CONSTRAINT DF_UPA_IsActive DEFAULT (1),
    GrantedBy    INT NULL REFERENCES dbo.Users(UserId),
    GrantedAt    DATETIME NOT NULL CONSTRAINT DF_UPA_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_UPA_User_Project UNIQUE (UserId, ProjectId)
);
GO
CREATE INDEX IX_UPA_User ON dbo.UserProjectAccess(UserId);
GO

/* -----------------------------------------------------------------------------
   9. UserSessions  (current selection: company -> project -> location)
      SelectedLocationId is a plain int (locations live in the project DB).
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserSessions') IS NULL
CREATE TABLE dbo.UserSessions
(
    UserSessionId      INT IDENTITY(1,1) PRIMARY KEY,
    UserId             INT NOT NULL REFERENCES dbo.Users(UserId),
    SelectedCompanyId  INT NULL REFERENCES dbo.Companies(CompanyId),
    SelectedProjectId  INT NULL REFERENCES dbo.Projects(ProjectId),
    SelectedLocationId INT NULL,                 -- lives in the project DB; no FK here
    AuthToken          NVARCHAR(MAX) NULL,
    UpdatedAt          DATETIME NOT NULL CONSTRAINT DF_US_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_US_User UNIQUE (UserId)
);
GO

/* -----------------------------------------------------------------------------
   10. Invitations / JoinRequests / Otp  (control-plane)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Invitations') IS NULL
CREATE TABLE dbo.Invitations
(
    InvitationId  INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId     INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    Email         NVARCHAR(256) NOT NULL,
    RoleInCompany NVARCHAR(100) NOT NULL,
    Token         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Inv_Token DEFAULT (NEWID()),
    Status        NVARCHAR(30)  NOT NULL CONSTRAINT DF_Inv_Status DEFAULT ('Pending'),
    Remarks       NVARCHAR(400) NULL,
    InvitedBy     INT NULL REFERENCES dbo.Users(UserId),
    ExpiresAt     DATETIME NOT NULL,
    CreatedAt     DATETIME NOT NULL CONSTRAINT DF_Inv_CreatedAt DEFAULT (GETDATE())
);
GO

IF OBJECT_ID('dbo.JoinRequests') IS NULL
CREATE TABLE dbo.JoinRequests
(
    RequestId     INT IDENTITY(1,1) PRIMARY KEY,
    UserId        INT NOT NULL REFERENCES dbo.Users(UserId),
    CompanyId     INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    RequestedRole NVARCHAR(100) NOT NULL,
    Remarks       NVARCHAR(400) NULL,
    Status        NVARCHAR(30)  NOT NULL CONSTRAINT DF_JR_Status DEFAULT ('Pending'),
    RejectionReason NVARCHAR(400) NULL,
    ReviewedBy    INT NULL REFERENCES dbo.Users(UserId),
    RequestedAt   DATETIME NOT NULL CONSTRAINT DF_JR_RequestedAt DEFAULT (GETDATE())
);
GO

IF OBJECT_ID('dbo.Otp') IS NULL
CREATE TABLE dbo.Otp
(
    OtpId        INT IDENTITY(1,1) PRIMARY KEY,
    MobileNumber NVARCHAR(20)  NOT NULL,
    OtpCode      NVARCHAR(10)  NOT NULL,
    ExpiresAt    DATETIME      NOT NULL,
    IsUsed       BIT NOT NULL CONSTRAINT DF_Otp_IsUsed DEFAULT (0),
    CreatedAt    DATETIME NOT NULL CONSTRAINT DF_Otp_CreatedAt DEFAULT (GETDATE())
);
GO

PRINT 'MainDB schema created (per-project routing).';
GO
