# Company-level tenancy: release steps

One company = one tenant = one database. The connection of a tenant is stored on
its `Companies` row. Access to a module replaces access to a project.

> **NOT YET VERIFIED.** The scripts below have been reviewed by reading
> only. They have **not been executed anywhere**. Rehearse them on restored
> COPIES of the main database and of one tenant database before you run them on
> the live server (see "Rehearsal on copies").
>
> The new API and the new UI have also **never run against a real API or
> database**. Only unit tests and a build were run.

The scripts, in the order they are used:

- `16_Company_Tenancy_Precheck.sql` - read-only report. Run it days before the release, before script 14.
- `13_Company_Tenancy_Schema.sql` - adds columns and tables. Safe ahead of the release.
- `14_Company_Tenancy_Cutover.sql` - the cut-over, run during the release.
- `15_Company_Tenancy_Rollback.sql` - the undo: restores the project tables and project access.
- `18_Company_Tenancy_Rollback_Connections_Once.sql` - run right after script 15: copies connection changes made since the cut-over back to the project tables, once per cut-over.
- `17_Company_Tenancy_Rollback_Connections.sql` - superseded by script 18. Do not run it.

## How to run

- Run each script in SSMS (or `sqlcmd` with `-I`) with the SaaS main database
  selected.
- The scripts contain no `USE` statement. They refuse to run in a system
  database (`master`, `model`, `msdb`, `tempdb`) or in a database without
  `dbo.Companies`.
- Take a backup first.

## Never edit these scripts

The six files are frozen. If something needs correcting, add a NEW numbered
file. The next free number in this folder is 19. A later script must not
re-create `dbo.sp_Tenant_GetConnection` or `dbo.sp_Project_GetConnection`:
script 14 and script 15 set these dates and script 18 reads them. Every SQL change must be a file
in the repository.

## Before the release (any time, the running API is not affected)

1. Back up the main database and every tenant database.
2. In the main database run `16_Company_Tenancy_Precheck.sql`. It only reads.
   It needs the project tables, so run it before the release, not after. It
   prints a heading and then one result set for each of five sections. How to
   act on each:
   - **1. Conditions that stop the cut-over.** Zero rows is OK. Any row must be
     fixed first, because script 14 refuses to run on it: a company with more
     than one active project, a database used by active projects of two
     different companies (same server and database name), or an active project
     with more than one connection row.
   - **2. Company administrators who will gain entry.** These are active members
     with the company role `Admin` or `CompanyAdmin` who have no project access
     today. After the cut-over these roles always have the Service module, so
     they will be able to enter. If someone on this list must stay out, change
     their company role before the release.
   - **3. Members per company.** For information: how many members keep access,
     how many have none, and how many administrators gain entry. Members with
     none cannot open the Service module after the cut-over until an
     administrator grants it.
   - **4. Project grants without company membership.** For information. These
     people could not enter before and are not migrated.
   - **5. Objects with `QUOTED_IDENTIFIER` or `ANSI_NULLS` off that mention
     `Companies`.** Zero rows is OK. Script 13 adds a filtered index to
     `dbo.Companies`, and a procedure or view saved with these settings off
     would fail when it writes to that table. Do not change it by hand. Ask for a
     numbered script that re-creates it with both options on, and run that
     before script 13.
3. In the main database run `13_Company_Tenancy_Schema.sql`. It only adds
   columns and tables and seeds the Service module. It is safe to run again.

## Release (short maintenance window)

1. Stop the API. **The API must stay stopped from before script 14 starts until
   script 14 has printed `Company-level tenancy cut-over complete.`**
2. Back up the main database now, inside the maintenance window, after the API
   is stopped and before script 14. The backup from before the window does not
   contain changes made while the API was still running.
3. In the main database run `14_Company_Tenancy_Cutover.sql`.
   - It stops with an error, and nothing has been renamed, if:
     - the wrong database is selected, or script 13 has not been run (no
       `TenantKey` column, no `Modules`, `CompanyModules` or `UserModuleAccess`
       table, or no `SERVICE` module);
     - a company has more than one active project, a database is shared by two
       companies, or a project has more than one connection row (the pre-check
       report, section 1, shows these ahead of time);
     - the copy of the connections and access fails (it is rolled back);
     - the copied data does not match the project tables (routing key or scope
       differs, or someone with project access has no Service module access);
     - renaming the project tables fails (it is rolled back).
   - After such an error, fix the cause and run script 14 again. It is safe to
     run again. Once the tables are renamed, a second run prints
     `Project tables are already renamed: data copy skipped, procedures refreshed.`
     and only refreshes the procedures.
   - The script also lists project grants of people who are not members of the
     company. They could not enter before and cannot enter now. They are not
     migrated.
   - The last result set lists every company with its tenant key, scope id,
     database, provision status and the number of users who can open the Service
     module. Administrators are counted. Check it: each company with a database
     should be `Ready`.
4. Deploy the new API. The new UI can be deployed with this release or later,
   but it works only with the new API (it needs `auth/modules`). Never serve
   the new UI against the previous API.
5. Start the API.

## Rehearsal on copies

Do this once before the release, on restored copies.

**Danger.** A restored copy of the main database holds the REAL connection
details of every tenant, in TWO places:

- `dbo.ProjectConnections`. The previous API reads it. Script 14 also copies it
  onto `dbo.Companies`, every time script 14 runs for a company that has an
  active project while the project tables exist (step 1a: it overwrites the
  company's connection, key and scope from the active project and its
  connection row).
- `dbo.Companies`, after script 14. The new API reads it.

If you start ANY API (the previous one or the new one) against the copy and log
in, it connects to the LIVE tenant databases and writes user data into them.
So:

1. Before you run script 14 on the copy, and before you start any API against
   the copy, point every `ProjectConnections` row in the copy at a
   tenant-database copy, or set it inactive.
2. Run script 14 on the copy.
3. After script 14, check that `dbo.Companies` shows the copy too (server and
   database name of every company), or that its `ProvisionStatus` is not
   `Ready`.
4. Only then start an API against the copy.

The exact steps are in the plan file
`docs/superpowers/plans/2026-10-11-company-routing-and-modules-backend.md`,
Task 13, steps 2 to 7. Besides what the plan lists, try these cases:

1. "+ New Project" in Platform Admin on a company that already has a database.
   It must be refused with "This company already has a database. Edit it instead".
2. A deactivated company with a user who is logged in to it. The user must be
   able to leave that company (company list, select company), and business
   calls must be refused.
3. Rollback after a connection was edited. Edit a company's connection in
   Platform Admin, run script 15, then script 18. The connection in
   `ProjectConnections` must follow.
4. Run script 18 a second time. It must stop with "already copied".
5. Run script 14 again (a new cut-over), then script 15. Start the previous API
   and edit a connection in Platform Admin. Then run script 18. It must stop
   and list that row. (Without a new cut-over, script 18 stops earlier with
   "already copied" and this check is never reached.)

Then try the new UI against the new API on the copies:

6. The company list is shown also when the user has only one company.
7. The module screen shows the Service card.
8. The branch screen is skipped when the user has only one branch.
9. The branch name is shown in the header.
10. Reload the page inside the application. The user stays logged in.
11. After that reload, header, "Switch company" shows the company list.
12. Two browser tabs on two different branches: the first tab reloads itself
    and then shows the branch chosen in the second tab.
13. A technician opens the site root: they arrive at the company list (not at
    an error), and after choosing company, module and branch they are on the
    work orders.
14. Reload the page on the company list before picking a company. The list is
    still there and the user is still logged in.
15. Two tabs: log out in one, then log in again in the other. The login must
    succeed and stay logged in (no bouncing back to the login page).

The detailed lists are in
`docs/superpowers/plans/2026-10-11-company-routing-and-modules-backend.md`
(Task 13) and `docs/superpowers/plans/2026-10-11-staff-scope-flow-ui.md`
(Task 9).

## Check after the release

- Staff login, select company, pick branch, open the dashboard.
- New UI: the company list is shown (also with one company).
- New UI: the module screen shows the Service card.
- New UI: with one branch the branch screen is skipped.
- New UI: the branch name is shown in the header.
- New UI: reload the page inside the application. The user stays logged in.
- New UI: after a reload, header, "Switch company" shows the company list.
- Technician login, open work orders.
- Customer portal login.
- Platform Admin: the company's database is listed and "Test connection" succeeds.
- Invite someone and accept the invitation.
- Add a user.
- Add a technician.
- In Platform Admin switch a member's access off and on again.
- With the new UI the Service module card is disabled and shows "Ask your
  administrator". With the previous UI the member sees the company but no
  project to choose.
- A user who was logged in before the release can keep working. Their token
  carries the old project key, which is now the company's tenant key, so it
  should still reach the same database. If it does not, they log in again.

## Undo

1. Stop the API.
2. Back up the main database.
3. In the main database run `15_Company_Tenancy_Rollback.sql`.
4. In the main database run `18_Company_Tenancy_Rollback_Connections_Once.sql`.
   Run it in the same sitting, right after script 15 printed
   `Project tables restored.` and before the previous API is started.
   Run script 18 only if the previous API has NOT been started since script 15
   first restored the tables. If it has been started, do NOT run script 18. The
   project tables are the live data. Correct connections in Platform Admin. If
   script 18 is run anyway: when a connection was saved since the rollback, it
   stops and lists those rows. When none was saved, it copies; that is
   still correct, because no connection was saved under the previous API.
5. Deploy the previous API TOGETHER WITH the previous UI, then start it. The
   new UI works only with the new API, so never leave the new UI in place.
   Keep the previous UI build at hand for this.

What the rollback (script 15) does:

- In one transaction it renames `Projects_Old`, `ProjectConnections_Old` and
  `UserProjectAccess_Old` back. If it renamed at least one of them, it also
  carries module access back to project access: people whose Service access was
  removed after the cut-over lose project access, people who got it after the
  cut-over receive it. It also attaches pending invitations created after the
  cut-over to the company's project.
- The restore and the carry-back happen together or not at all. On an error
  everything is rolled back, the `*_Old` tables are still there, and you run the
  script again.
- It then restores the old procedures as they were on 2026-10-11.
- When it did restore the tables it prints `Module access carried back to project access.`
  and `Project tables restored.`
- When the tables were already in place (nothing to restore) it prints
  `No project tables were restored in this run: project access was left as it is.`
  It does not touch project access, because the previous API has been
  maintaining it. Running it again is safe.
- It ends with `Rollback complete. Redeploy the previous API and UI.`

What script 18 does:

- After the cut-over the connection of a company (server, database, user,
  password, extra options, ready state) is stored only on its
  `Companies` row. Script 15 does not copy changes made there back, so the
  previous API would read stale rows in `ProjectConnections`.
- Script 18 first lists the rows it will change (company, project key, old and
  new database name, old and new active flag; never a password). Then, in one
  transaction, it updates the connection row of every active project whose
  company was migrated (the company's `TenantKey` equals the project key) and
  has a server, database and user. It adds a row when the project has none and
  the company has a password. A connection is active only when the company's
  database is `Ready`.
- It stops with a message, and changes nothing, in these cases:
  - "The project tables are not there. Run 15_Company_Tenancy_Rollback.sql
    first." Run script 15, then script 18.
  - "Script 14 (the cut-over) was never run on this database: there is nothing
    to copy back." There is nothing to undo.
  - "Run 15_Company_Tenancy_Rollback.sql first: the previous procedures are not
    restored." Script 15 has not finished. Run it first.
  - "The connections were already copied back for this cut-over on ..." There is
    nothing more to do.
  - "The check for connections changed after the rollback could not run.
    Nothing was copied. ..." followed by the error text. Nothing was changed.
    Do not start the previous API as if the copy had run: the connections in
    `ProjectConnections` are still the old ones. Note the error text, fix the
    cause, and run script 18 again.
  - "N connection row(s) were changed after the rollback. ..." Script 18 lists
    those rows (never a password). A connection was saved under the previous API
    since the rollback, so the project tables are the live data. Do not copy.
    Correct connections in Platform Admin.
    It can also appear after a cut-over attempt that did not finish, where the
    newer row may be script 18's own earlier copy. The action is the same:
    there is nothing to copy; use Platform Admin.
- Script 18 copies once per cut-over. Run again, it stops with a message and
  changes nothing. Once the previous API has been running, the project tables
  are the live data.
- It records the cut-over in `dbo.TenancyRollbackLog`. It changes nothing in
  any tenant database.
- It ends with `Connections copied back to the project tables: N updated, M added.`
  and then `This script will not copy again for this cut-over.`

The reverse case: connection changes made in `ProjectConnections` under the
previous API after a rollback are copied again by the next cut-over. Script 14
(step 1a) overwrites the company's connection, key and scope from the active
project and its connection row, every time it runs while the project tables
exist. A company whose connection row is inactive or has no real password is
then set to not routable (`ProvisionStatus` `None`).

Still NOT restored:

- The new columns and tables from script 13 stay in place. The previous API
  ignores them.
- A company created after the cut-over has no project row and is not visible to
  the previous API.

## Things to know

- Do not switch a company's Service module off by SQL
  (`CompanyModules.IsEnabled = 0`) in production. Then no user can open the
  Service module of that company (`dbo.fn_ModuleUsers` returns nobody), and the
  next user synchronisation sends an empty user list to the company's database.
  The full synchronisation deactivates every user and technician there that is
  not in the list, so it would deactivate all of them. (This will be fixed in a later
  release.)
- The API caches each company's connection without an expiry. A connection or
  an active flag changed directly in SQL needs an API restart before it takes
  effect. Changes made through Platform Admin do not: they drop the cached entry.
- If the new API is started before script 14 has run, logged-in users get errors
  and nobody can pick a company. No data is harmed. Stop the API, run script 14,
  start the API.
- The company list at login is now by membership. A member who was not given
  the Service module sees the company in the list. With the new UI the Service
  module card is disabled and shows "Ask your administrator". With the previous
  UI the member sees the company but no project to choose.
- A platform administrator working inside a company that is attached AFTER this
  release may land on another company's tabs in Platform Admin until the UI is
  updated. Pick the company from the filter.

## What changed for administrators

- A company's database is attached on the company. The "Projects & Databases"
  tab now shows one entry per company.
- "+ New Project" on a company that already has a database is refused, and the
  key of a company cannot be changed: edit the existing entry instead.
- "Project access" is access to the Service module. Company administrators
  (Admin, CompanyAdmin) always have it.
- Deactivating a member removes their module access. Reactivating does not give
  it back: an administrator grants it again.
- When attaching an existing database by hand, the tenant database script must
  be run with the company's `TenantScopeId` as `ProjectId`. It is `1` for a new
  company. A migrated company keeps its old project id.
