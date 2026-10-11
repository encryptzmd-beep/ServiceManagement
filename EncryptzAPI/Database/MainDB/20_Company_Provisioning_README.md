# Company creation and database provisioning: release steps

> **NOT YET VERIFIED.** `20_Company_Provisioning.sql` has been reviewed by
> reading only. It has **not been executed anywhere**, and the new API code that
> uses it has never run against a real server. Rehearse it on a test server first
> (see "Rehearsal").

## What it is

Script 20 lets users create a company themselves. The procedures it adds record
the company, make its creator the company `Admin` and give the company the
Service module. The API then creates the company's database on a SQL server
that a platform administrator has added, and marks the company `Ready`.

The script adds the tables `dbo.DbServers` and `dbo.PlatformSettings`, five
columns on `dbo.Companies` (`DbServerId`, `ProvisionError`, `ProvisionStartedAt`,
`CreatedBy`, `FirstBranchName`) and the procedures `sp_Company_Create`,
`sp_Company_GetCreationState`, `sp_Provision_*`, `sp_Platform_*DbServer*` and
`sp_Platform_*Setting*`. It also re-creates `sp_User_GetCompanies` (one more
column, `IsCreator`) and `sp_Platform_GetCompanies` (three more columns:
`ProvisionStatus`, `ProvisionError`, `DatabaseName`). No existing row is
changed, nothing is removed, and no database is created or touched by the script.
It is safe to run again.

## Order

1. `13_Company_Tenancy_Schema.sql`
2. `14_Company_Tenancy_Cutover.sql`
3. `19_Module_Management.sql`
4. `20_Company_Provisioning.sql`, with the SaaS main database selected
5. Deploy the new API.

**Every time script 14 is run again, run script 19 and then script 20 again.**
Script 14 re-creates `sp_User_GetCompanies` and `sp_Platform_GetCompanies` in
their earlier form.

Script 20 needs no undo. The tables, columns and procedures are used only by the
new API; the previous API ignores them. A rollback with script 15 leaves them in
place.

## Nothing happens until a server is added

`dbo.DbServers` starts empty. Until a platform administrator adds an active
default server in the application, company creation answers "Company creation is
not available right now" and the API creates no database.

## The server login

One login per server does two things: it creates the database, and it is stored
on each company as that company's connection login. It needs the `dbcreator`
server role and nothing more. Recommendation: use a dedicated login that has only
`dbcreator`; do not use `sa` or a `sysadmin` login.

The password is stored encrypted with the same key as the tenant passwords
(`Tenant:SecretKey`). The key must be the same on every API instance.

## What the API does on the server

1. `CREATE DATABASE EncryptzTenant_NNNNNN`. The name is made from the company id
   only.
2. Runs `New_Tenant_Database.sql` in it (about 1,470 batches; it can take
   minutes).
3. Checks the result, then marks the company `Ready`
   (`sp_Provision_Complete`, which copies the server details onto the company).

If anything fails, the API drops the database it created in that same attempt and
marks the company `Failed`. It never drops or reuses a database that already
existed under that name: then the attempt fails and a platform administrator must
look.

## Settings

Kept in `dbo.PlatformSettings`, changed in Platform Admin:

- `MaxCompaniesPerUser`, default `1`. Platform administrators are exempt.
  Companies whose set-up failed do not count.
- `TenantLookupSourceDb`, default empty. Empty means the new database uses the
  script's built-in default roles and statuses. When set, the new database copies
  its lookup rows (roles, statuses, menus, settings) from that database on the
  same server. The database must exist there and the login must be able to read
  it.

## Stuck jobs

A company that has been "setting up" for more than 15 minutes is marked `Failed`
(`sp_Provision_FailStuck`, called at API start and every 5 minutes). The creator
or a platform administrator can then retry (`sp_Provision_Retry`).

## Rehearsal

Do this once on a test server, or with a test login, before real use:

1. Add a server in Platform Admin (default, active).
2. Create a company.
3. Watch it become `Ready`, then enter it.
4. Create a second company as the same user. It must be refused (limit).
5. Make the set-up fail: set `TenantLookupSourceDb` to a database that does not
   exist. Create a company as a platform administrator (exempt from the limit)
   or as another user. Check that the new database is gone, and that the company
   is `Failed` with the reason visible to the platform administrator only.
6. Fix the setting and press Retry. The company must become `Ready`.
