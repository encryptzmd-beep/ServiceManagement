/* =============================================================================
   ProjectDB  ·  Per-PROJECT service-app database
   -----------------------------------------------------------------------------
   Model (confirmed): Company -> many Projects. Each project is routed (by
   ProjectKey, via MainDB.dbo.ProjectConnections) to a service-app database.

   That database may be EITHER
     (a) a brand-new DEDICATED DB (clone of this template), OR
     (b) an EXISTING / SHARED client DB reused across companies/projects.
   Because (b) means one DB can hold multiple companies/projects, EVERY business
   table MUST carry CompanyId + ProjectId + LocationId and be filtered by them.

   Holds:
     - Locations  (scoped by CompanyId + ProjectId)
     - All business / "internal" tables (Customers, Complaints, Products, SpareParts,
       Schedule, Technicians, Payments, WarrantyReturns, RepairParts, Tracking, ...),
       every row scoped by CompanyId + ProjectId + LocationId.

   ACCESS MODEL: access is per-user at the PROJECT level (MainDB.UserProjectAccess).
   Locations are NOT access-controlled per user — anyone with project access sees all
   of that project's locations and picks one.

   Tables that DO NOT belong here (they live in MainDB):
     Users, Roles, MenuItems/RoleMenuAccess, Companies, Projects, ProjectConnections,
     CompanyUsers, UserProjectAccess, UserSessions, Invitations, JoinRequests, Otp.

   Provisioning a project (onboarding API or manual):
     1. New DB: clone this template as FelixProject_<ProjectKey>.
        Existing/shared DB: run 02_Tenant_Columns.sql against it to add the columns.
     2. Insert MainDB.dbo.Projects + MainDB.dbo.ProjectConnections rows.
     3. Seed this DB's Locations (CompanyId + ProjectId) and grant UserProjectAccess.

   Files:
     01_Locations_And_Access.sql  Locations (CompanyId+ProjectId) + read/validate procs
     02_Tenant_Columns.sql        add CompanyId/ProjectId/LocationId to business tables
     03_Proc_Pattern.sql          scoped business proc pattern (CompanyId+ProjectId+LocationId)
   ============================================================================= */
