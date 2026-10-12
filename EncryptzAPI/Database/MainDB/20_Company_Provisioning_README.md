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
server role and nothing more. Use a dedicated login that has only `dbcreator`;
do not use `sa` or a `sysadmin` login.

**What `dbcreator` means.** A login in the `dbcreator` role can ALTER and DROP
**any** database on that SQL Server instance, not only the ones it created
(verify this on your server before relying on anything else). And this same
login is the **runtime login of every company created by the API**: every
request of those companies runs with it. So a mistake or a hole in the API, or
a leaked password, reaches every database on that instance.

Recommendation: host the company databases on an instance that holds neither
the main database nor company databases that were attached by hand. Or accept
that risk knowingly. **This is an owner decision before enabling** (see "Owner
decisions before enabling").

The password is stored encrypted with the same key as the tenant passwords
(`Tenant:SecretKey`). The key must be the same on every API instance. A password
can be at most 128 characters.

The login and its encrypted password are copied onto each company when its
database is ready. Changing a server's password in Platform Admin therefore does
not change the companies that already exist: edit each of them under Company
Databases.

One login owns every company database on the server. The separation between
companies rests on the API, not on SQL Server permissions.

### Options of a server

The options typed for a server are copied to every company created on it and
added, as typed, to that company's connection string. They must be real
connection options (for example `Encrypt=True;Connect Timeout=30`) and **may not
set the server, the database, the login or the password** (`Data Source`,
`Server`, `Database`, `Initial Catalog`, `User ID`, `Password`,
`Integrated Security`, `AttachDBFilename`, `Failover Partner`, `Authentication`
and their other spellings). Platform Admin refuses such options when the server
is saved or tested.

### Editing a server

The stored password belongs to the stored server name and login:

- when the name or the login of an existing server is changed, the password
  must be typed again;
- "Test" without a typed password tests the stored server, login and options. To
  test a changed name or login, type the password.

While a set-up is running on a server, only a changed **name or login** makes
that set-up fail (it is given up and its database is removed; retry it). A
changed password or changed options are simply used: the company gets the
password and options the server row has at the moment its set-up completes.

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

The API drops a database by name. Before every drop it gives the job up in the
main database (`sp_Provision_Abandon`). That procedure checks and marks in one
statement, and allows the drop only when all of this is true at that moment:

- the job still belongs to this attempt (`ProvisionAttempt` is the attempt's);
- the company is still waiting for its first database;
- **no company at all** names this database as its own. A platform
  administrator can attach the generated name to any company by hand under
  Company Databases; such a database is not dropped.

The company is then `Failed` and the attempt keeps the job, so nothing can
complete or retry it while the database is being dropped. When the main database
cannot be asked, or does not allow it, nothing is dropped.

In the same way a set-up does not become `Ready` when another company already
names its database (`sp_Provision_Complete` refuses): the set-up fails and the
database is left alone.

What remains: Company Databases does not know about a set-up that is running. If
a platform administrator attaches the generated name to another company in the
moment between the permission and the drop itself, that database is dropped. Do
not attach a database named `EncryptzTenant_NNNNNN` by hand while the company
with that number is being set up.

To drop, the API sets the database to single user (open connections are cut off)
and then drops it. If that fails half-way, the database can be left on the server
in single-user mode.

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
   server. The same holds when the API was stopped hard in the middle of a
   clean-up: the company then keeps the text "The set-up failed and is being
   cleaned up." and its database may or may not be gone.
3. The company became `Ready` by other means while its set-up ran (another
   database attached by hand). The database the API built is an orphan. This is
   written to the API log only, with the company id and the database name.
4. Another company names the database (the generated name was attached to it by
   hand). The set-up fails, the database is not dropped, and the error text on
   the company says "... was left on the server: another company uses it." A
   retry of that company then fails with "already exists" for as long as the
   other company keeps that name.
5. The attempt no longer owned the job when it wanted to clean up, or the main
   database could not be asked. The API log says so, with the company id and the
   database name. The note "The database ... was left on the server." is stored
   on the company when the attempt still could store it, that is when it turned
   out to own the job after all.

Two more cases need a look at the server:

- `CREATE DATABASE` itself failed or was cut off. The API does not drop anything,
  because it never saw the database as its own. The error text says that the
  database may have been created.
- The answer of the main database was lost while the company was being marked
  `Ready`, and the main database could not be asked afterwards. The API leaves
  the database in place and writes this to its log with the company id and the
  database name. If the company did not become `Ready`, it is given up later as
  a stuck job (see "Stuck jobs"); the database is still there then.

A database that a company names as its own is never dropped by the API, and the
error text never tells anyone to remove such a database without checking. Before
removing a database by hand, check under Company Databases that no company uses
it.

### Who notices

Nobody is told. Nothing alerts anyone to a `Failed` company or to a database
that was left behind, except the API log and the company list in Platform Admin
(status and error text). Somebody has to look there.

## Settings

Kept in `dbo.PlatformSettings`, changed in Platform Admin:

- `MaxCompaniesPerUser`, default `1`. Platform administrators are exempt.
  A company whose set-up failed does not count. But while a company is waiting
  for a retry, its creator cannot create another one ("Your earlier company is
  waiting for a retry") - as long as the creator is still an active member of
  that company, that is as long as they can retry it. A deactivated company
  still counts, unless its set-up failed.
- `TenantLookupSourceDb`, default empty. **Leaving it empty is the normal
  choice.** `New_Tenant_Database.sql` then creates its own defaults: 7 roles and
  7 complaint statuses, and 21 settings rows (Complaint and Sales numbering, and
  the Print header / footer rows, all blank or at their start values). A role
  that is missing is created by name the first time users are synchronised into
  the database (`sp_Tenant_SyncUsers`).

  When it is set, the new database first copies **every row** of these tables
  from that database on the same server: `Roles`, `ComplaintStatuses`,
  `MenuItems`, `RoleMenuAccess`, `SystemSettings`, `AppConfigurations`. Nothing
  is filtered. `SystemSettings` holds the source company's print header (company
  name, address, GSTIN, phone, header and footer text and images) and its
  running numbers (next complaint, bill and despatch number); the script's own
  defaults are only added for keys that are missing, so the copied values stay.
  **Never point this setting at a live company's database.** Use a clean
  template database, or leave it empty. The database must exist on that server
  and the login must be able to read it.

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
notices, it removes its own database (if `sp_Provision_Abandon` allows it) and
releases the job itself.

After an API restart, set-ups that were still queued are picked up again
(`sp_Provision_GetQueued`). If that fails at start (the main database is not
reachable), it is tried again every 5 minutes until it has worked once. A set-up
that was running when the API stopped is not continued: it is given up after 20
minutes.

When the API is stopped in the normal way, a running set-up is cancelled, cleans
up and is marked `Failed`. The API asks for up to 3 minutes for that. This only
helps when whatever stops the API waits that long: the service manager's stop
time-out (systemd `TimeoutStopSec`, the IIS application pool's shutdown time
limit) must be at least 3 minutes. Otherwise the process is killed earlier, and
a restart during a build leaves a half-built database exactly like a hard stop
(see "Databases that stay on the server", case 2).

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
set-up may still be removing its database. The state of a failed company
therefore allows a retry at the latest 30 minutes after its set-up started.

That is not the same as "can always be retried". A retry also needs:

- an active default server ("Company creation is not available right now"
  otherwise);
- somebody who may start it: the creator, while still an active member of the
  company, or a platform administrator. When the creator has left or was
  removed, only a platform administrator can retry.

Creating a company and retrying are limited to 5 calls per hour per user
(HTTP 429 after that), whatever address the calls come from.

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
8. The build time: note how long step 3 took on this server. The API cancels a
   set-up after 12 minutes; a build that comes near that needs a faster server
   before real use.
9. A normal stop during a build: start a set-up and stop the API the way it is
   stopped in production (service manager). The new database must be gone and
   the company `Failed` and retriable at once. If the database is still there,
   the service manager did not wait: raise its stop time-out to 3 minutes or
   more.
10. A hard stop during a build: start a set-up and kill the API process. Start
    it again. The half-built database stays; the company must be `Failed` after
    about 20 minutes (the sweeper runs every 5 minutes).
11. The 30-minute retry gate: for the company of step 10, Retry must answer "The
    earlier set-up is still being cleaned up" until 30 minutes after that set-up
    started, and work afterwards. The retry itself then fails with "already
    exists" until the half-built database is removed on the server; remove it
    and retry again.
12. Attaching the generated name to another company while a build runs: start a
    set-up for company N and, while it runs, attach `EncryptzTenant_NNNNNN` to
    another company under Company Databases. It must end with the build
    `Failed` and the database **not dropped**; the error text must say that
    another company uses it.
13. The rate limit: as ONE user, from two different IP addresses, call create or
    retry six times within an hour. The sixth call must be answered with HTTP
    429, whichever address it comes from.

## Owner decisions before enabling

Company creation stays off until a server is added. Before adding one, decide:

1. **The instance.** Which SQL Server instance holds the company databases. The
   login can alter and drop every database on it and is the runtime login of
   every company created there (see "The server login"). A separate instance,
   or the risk accepted knowingly.
2. **The lookup source.** `TenantLookupSourceDb` empty (the normal choice) or a
   clean template database. Never a live company's database.
3. **The stop time-out of the service manager.** At least 3 minutes (systemd
   `TimeoutStopSec`, IIS shutdown time limit), or half-built databases after
   every restart during a build are accepted.
4. **Who watches Failed companies.** Nothing alerts anyone: name the person who
   checks the company list in Platform Admin and the API log, and how often.
5. **`MaxCompaniesPerUser`.** The default is 1.
6. **The rehearsal.** Who runs the list above on a test server, and that it has
   passed, before the first real server is added.
