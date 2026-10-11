# Company-level tenancy: release steps

One company = one tenant = one database. The connection of a tenant is stored on
its `Companies` row. Access to a module replaces access to a project.

> **NOT YET VERIFIED.** The scripts below have been reviewed by reading
> only. They have **not been executed anywhere**. Rehearse them on restored
> COPIES of the main database and of one tenant database before you run them on
> the live server (see "Rehearsal on copies").

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
file. The next free number in this folder is 19. Every SQL change must be a file
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
4. Deploy the new API. The UI does not have to change in this release.
5. Start the API.

## Rehearsal on copies

Do this once before the release, on restored copies.

**Danger.** A restored copy of the main database contains the real connection
details of every tenant. If you start the API against the copy and log in, it
connects to the LIVE tenant databases and writes user-sync data into them. Do
NOT start the API against the copy until every company row in the copy has been
pointed at a tenant-database copy or set to not routable (`ProvisionStatus` not
`Ready`).

The exact steps are in the plan file
`docs/superpowers/plans/2026-10-11-company-routing-and-modules-backend.md`,
Task 13, steps 2 to 7. Besides what the plan lists, try these three cases:

1. "+ New Project" in Platform Admin on a company that already has a database.
   It must be refused with "This company already has a database. Edit it instead".
2. A deactivated company with a user who is logged in to it. The user must be
   able to leave that company (company list, select company), and business
   calls must be refused.
3. Rollback after a connection was edited. Edit a company's connection in
   Platform Admin, run script 15, then script 18. The connection in
   `ProjectConnections` must follow.

## Check after the release

- Staff login, select company, pick branch, open the dashboard.
- Technician login, open work orders.
- Customer portal login.
- Platform Admin: the company's database is listed and "Test connection" succeeds.
- Invite someone and accept the invitation.
- Add a user.
- Add a technician.
- In Platform Admin switch a member's access off and on again.
- A member without access to the module sees the Service module card
  disabled, with the text "Ask your administrator".
- A user who was logged in before the release can keep working. Their token
  carries the old project key, which is now the company's tenant key, so it
  should still reach the same database. If it does not, they log in again.

## Undo

1. Stop the API.
2. In the main database run `15_Company_Tenancy_Rollback.sql`.
3. In the main database run `18_Company_Tenancy_Rollback_Connections_Once.sql`.
   Run it in the same sitting, right after script 15 printed
   `Project tables restored.` and before the previous API is started.
4. Deploy the previous API and UI, then start it.

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
- It refuses to run until script 15 has been run ("Run 15 first"). The same
  refusal appears when scripts 13 and 14 were never run on that database. Then
  there is nothing to undo.
- Script 18 copies once per cut-over. Run again, it stops with a message and
  changes nothing. Once the previous API has been running, the project tables
  are the live data.
- It records the cut-over in `dbo.TenancyRollbackLog`. It changes nothing in
  any tenant database.
- It ends with `Connections copied back to the project tables: N updated, M added.`

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

- The API caches each company's connection without an expiry. A connection or
  an active flag changed directly in SQL needs an API restart before it takes
  effect. Changes made through Platform Admin do not: they drop the cached entry.
- If the new API is started before script 14 has run, logged-in users get errors
  and nobody can pick a company. No data is harmed. Stop the API, run script 14,
  start the API.
- The company list at login is now by membership. A member who was not given
  the Service module sees the company in the list. In the module list the
  Service module is shown disabled with the reason.
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
