# Company-level tenancy: release steps

One company = one tenant = one database. The connection of a tenant is stored on
its `Companies` row. Access to a module replaces access to a project.

> **NOT YET VERIFIED.** The three scripts below have been reviewed by reading
> only. They have **not been executed anywhere**. Rehearse them on restored
> COPIES of the main database and of one tenant database before you run them on
> the live server.

The scripts:

- `13_Company_Tenancy_Schema.sql` - adds columns and tables. Safe ahead of the release.
- `14_Company_Tenancy_Cutover.sql` - the cut-over, run during the release.
- `15_Company_Tenancy_Rollback.sql` - the undo.

## How to run

- Run each script in SSMS (or `sqlcmd` with `-I`) with the SaaS main database
  selected.
- The scripts contain no `USE` statement. They refuse to run in a system
  database (`master`, `model`, `msdb`, `tempdb`) or in a database without
  `dbo.Companies`.
- Take a backup first.

## Never edit these scripts

The three files are frozen. If something needs correcting, add a NEW numbered
file. The next free number in this folder is 16. Every SQL change must be a file
in the repository.

## Before the release (any time, the running API is not affected)

1. Back up the main database and every tenant database.
2. In the main database run `13_Company_Tenancy_Schema.sql`. It only adds
   columns and tables and seeds the Service module. It is safe to run again.
3. Look for the conditions the cut-over refuses to run on. Each one stops it
   before anything is changed:
   - a company with more than one active project;
   - a database used by active projects of two different companies (same server
     and database name);
   - an active project with more than one connection row.

   Fix them first. The cut-over lists the offending rows when it stops.

## Release (short maintenance window)

1. Stop the API. **The API must stay stopped from before script 14 starts until
   script 14 has printed `Company-level tenancy cut-over complete.`**
2. In the main database run `14_Company_Tenancy_Cutover.sql`.
   - It stops with an error, and nothing has been renamed, if:
     - the wrong database is selected, or script 13 has not been run (no
       `TenantKey` column, no `Modules`, `CompanyModules` or `UserModuleAccess`
       table, or no `SERVICE` module);
     - a company has more than one active project, a database is shared by two
       companies, or a project has more than one connection row (see above);
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
3. Deploy the new API. The UI does not have to change in this release.
4. Start the API.

## Check after the release

- Staff login, select company, pick branch, open the dashboard.
- Technician login, open work orders.
- Customer portal login.
- Platform Admin: the company's database is listed and "Test connection" succeeds.
- A user who was logged in before the release can keep working. Their token
  carries the old project key, which is now the company's tenant key, so it
  should still reach the same database. If it does not, they log in again.

## Undo

1. Stop the API.
2. In the main database run `15_Company_Tenancy_Rollback.sql`.
3. Deploy the previous API and UI, then start it.

What the rollback does:

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

Still NOT restored:

- The new columns and tables from script 13 stay in place. The previous API
  ignores them.
- A company created after the cut-over has no project row and is not visible to
  the previous API.

## What changed for administrators

- A company's database is attached on the company. The "Projects & Databases"
  tab now shows one entry per company.
- "Project access" is access to the Service module. Company administrators
  (Admin, CompanyAdmin) always have it.
- Deactivating a member removes their module access. Reactivating does not give
  it back: an administrator grants it again.
- When attaching an existing database by hand, the tenant database script must
  be run with the company's `TenantScopeId` as `ProjectId`. It is `1` for a new
  company. A migrated company keeps its old project id.
