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

The script adds the tables `dbo.DbServers` and `dbo.PlatformSettings`, six
columns on `dbo.Companies` (`DbServerId`, `ProvisionError`, `ProvisionStartedAt`,
`CreatedBy`, `FirstBranchName`, `ProvisionAttempt`) and the procedures
`sp_Company_Create`, `sp_Company_GetCreationState`, `sp_Provision_*`,
`sp_Platform_*DbServer*` and `sp_Platform_*Setting*`. It also re-creates
`sp_User_GetCompanies` (one more column, `IsCreator`) and
`sp_Platform_GetCompanies` (three more columns: `ProvisionStatus`,
`ProvisionError`, `DatabaseName`). No existing row is changed, nothing is
removed, and no database is created or touched by the script. It is safe to run
again.

## Order

1. `13_Company_Tenancy_Schema.sql`
2. `14_Company_Tenancy_Cutover.sql`
3. `19_Module_Management.sql`
4. `20_Company_Provisioning.sql`, with the SaaS main database selected
5. Deploy the new API.

**Every time script 14 is run again, run script 19 and then script 20 again.**
Script 14 re-creates `sp_User_GetCompanies` and `sp_Platform_GetCompanies` in
their earlier form.

Script 20 refuses to run while `dbo.Projects` exists, that is before script 14
has been run, or after a rollback with script 15. It also refuses when
`dbo.sp_Tenant_GetConnection` or `dbo.fn_ModuleUsers` is missing. It then stops
with a message and changes nothing.

Script 20 needs no undo. The tables and columns it adds stay in place after a
rollback with script 15, and the previous API ignores them. The procedures it
adds are called only by the API that creates companies. `sp_User_GetCompanies`
and `sp_Platform_GetCompanies` are different: they are also used by the API
that was deployed with script 14, which ignores the extra columns, and script 15
replaces both with its own versions.

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

The login and its encrypted password are copied onto each company when its
database is ready. Changing a server's password in Platform Admin therefore does
not change the companies that already exist: edit each of them under Company
Databases.

One login owns every company database on the server. The separation between
companies rests on the API, not on SQL Server permissions.

## What the API does on the server

1. Claims the job (`sp_Provision_Begin`). Only one run can hold the job of a
   company; a second run finds nothing to do.
2. `CREATE DATABASE EncryptzTenant_NNNNNN`. The name is made from the company id
   only.
3. Runs `New_Tenant_Database.sql` in it (about 1,470 batches; it can take
   minutes).
4. Checks the result, then marks the company `Ready`
   (`sp_Provision_Complete`, which copies the server details onto the company).

Before step 2 the API checks that it can read `New_Tenant_Database.sql` and that
the script has the shape it expects. If not, the attempt fails and no database
is created.

If the script or the last step fails, the API drops the database it created in
that same attempt and marks the company `Failed`. It never drops or reuses a
database that already existed under that name: then the attempt fails and a
platform administrator must look.

### Dropping

The API drops a database by name. Just before every drop it asks the main
database (`sp_Provision_GetStatus`) and drops only when both are true:

- the job still belongs to this attempt (`ProvisionAttempt` is the attempt's);
- the company does not name this database as its own.

When the answer cannot be read, it does not drop either. To drop, the API sets
the database to single user (open connections are cut off) and then drops it. If
that fails half-way, the database can be left on the server in single-user mode.

Only after the clean-up does the attempt record its failure
(`sp_Provision_Fail`). That also releases the job, so that the company can be
retried (see "Retry").

### Databases that stay on the server

In these cases a database is left on the server for a platform administrator:

1. The clean-up failed. The error text on the company says that the database
   could not be removed and was left on the server.
2. The API was stopped hard (killed, crash, power) in the middle of a build. The
   half-built database stays. The company is given up after 20 minutes. A retry
   is possible 30 minutes after that set-up started; it then fails with
   "already exists" until a platform administrator removes that database on the
   server.
3. The answer of the final step was lost and the company became `Ready` by other
   means (a database attached by hand meanwhile). The database the API built is
   an orphan: no company uses it. This is written to the API log only, with the
   company id and the database name.
4. The attempt no longer owned the job when it wanted to clean up, or it could
   not read the state of the job. The API log says so, with the company id and
   the database name. The note "The database ... was left on the server." is
   stored on the company when the attempt still could store it, that is when it
   turned out to own the job after all.

Two more cases need a look at the server:

- `CREATE DATABASE` itself failed or was cut off. The API does not drop anything,
  because it never saw the database as its own. The error text says that the
  database may have been created.
- The answer of the main database was lost while the company was being marked
  `Ready`, and its status could not be read afterwards. The API leaves the
  database in place and writes this to its log with the company id and the
  database name. If the company did not become `Ready`, it is given up later as
  a stuck job (see "Stuck jobs"); the database is still there then.

A database that a company names as its own is never dropped by the API, and the
error text never tells anyone to remove such a database. Before removing a
database by hand, check under Company Databases that no company uses it.

Editing a server's name or login in Platform Admin while a set-up is running on
it makes that set-up fail: it is given up and its database is removed. Retry it.

## Settings

Kept in `dbo.PlatformSettings`, changed in Platform Admin:

- `MaxCompaniesPerUser`, default `1`. Platform administrators are exempt.
  A company whose set-up failed does not count. But while a company is waiting
  for a retry, its creator cannot create another one ("Your earlier company is
  waiting for a retry"). A deactivated company still counts, unless its set-up
  failed.
- `TenantLookupSourceDb`, default empty. Empty means the new database uses the
  script's built-in default roles and statuses. When set, the new database copies
  its lookup rows (roles, statuses, menus, settings) from that database on the
  same server. The database must exist there and the login must be able to read
  it.

## Stuck jobs

`sp_Provision_FailStuck` is called at API start and every 5 minutes. It marks a
company `Failed` in two cases:

- its set-up has been running for more than 20 minutes. The time is counted
  from the moment the API picked the job up, not from the moment the company was
  created;
- its set-up is queued and nobody picked it up for 160 minutes (about 2.5
  hours).

The API itself cancels a set-up after 12 minutes and then cleans up. The 20
minutes leave it time for that, so a set-up that is given up here is normally
one whose API was stopped.

A set-up that is given up while it is still running keeps its job: when it
notices, it removes its own database and releases the job itself.

After an API restart, set-ups that were still queued are picked up again
(`sp_Provision_GetQueued`). If that fails at start (the main database is not
reachable), it is tried again every 5 minutes until it has worked once. A set-up
that was running when the API stopped is not continued: it is given up after 20
minutes.

When the API is stopped in the normal way, a running set-up is cancelled, cleans
up and is marked `Failed`; the API waits up to 3 minutes for that. After a hard
stop the half-built database stays on the server (see "Databases that stay on
the server", case 2).

## Retry

Retry (`sp_Provision_Retry`) is only for a company that never got a database.
It can be started by the company's creator, as long as they are still an active
member of the company, or by a platform administrator.

A `Failed` company can be retried:

- at once, when its last set-up has finished cleaning up and released the job,
  or when it was given up while still queued;
- otherwise 30 minutes after that set-up started. This is the case when the API
  was stopped hard: nobody is left to release the job.

Until then Retry answers "The earlier set-up is still being cleaned up. Try
again in a few minutes." This keeps a retry from starting while the earlier
set-up may still be removing its database. A failed company can therefore always
be retried at the latest 30 minutes after its set-up started.

A company whose database was attached by hand is never rebuilt by Retry, also
not when that database was switched off in Platform Admin (such a company is
shown as `Failed` too).

Retry uses the server that is the default at that moment. If an earlier attempt
crashed and left a half-built database on a previous server, that database stays
there.

## Error text

The reason of a failed set-up is stored on the company and shown to platform
administrators only. It can contain server and database names.

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
6. If step 5 was done as another user (not as a platform administrator): as
   that user, try to create one more company. It must be refused ("Your earlier
   company is waiting for a retry").
7. Fix the setting and press Retry. The company must become `Ready`.
