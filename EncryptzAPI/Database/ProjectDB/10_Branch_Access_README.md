# Branch access: release steps

> **NOT YET VERIFIED.** `10_Branch_Access.sql` has been reviewed by reading
> only. It has **not been executed anywhere**. Rehearse it on a copy of a
> company database first (see "Rehearsal on a copy").

## What it is

Script 10 stores, in each company database, which branches (`dbo.Locations`) a
member of the company may work in. A member is identified by the main user id
(`dbo.Users.MainUserId`). The script adds the tables `dbo.UserLocationAccess`
(member and branch) and `dbo.UserLocationAccessInit` (the member's first
branches were set once), and the procedures `sp_Branch_EnsureInitialised`,
`sp_Branch_GetForUser`, `sp_Branch_ValidateForUser`, `sp_Branch_GetAccess` and
`sp_Branch_SetAccess`.

## Where and when to run

Run it in each existing company database (`FelixServiceDB`,
`HamsterserviceDB`), with that database selected in SSMS. It can run before or
after the new API is deployed: both orders work.

Without it, the new API behaves as before (every member sees every branch) and
the Branch Access tab says that branch access is not set up in this company's
database yet. New company databases created by the API get the script
automatically.

The script stops with a message and changes nothing when it is run in a system
database, in the SaaS main database, or in a database that has no
`dbo.Locations`, no `dbo.Users` or no `Users.MainUserId` (run the earlier
ProjectDB scripts first).

## What happens when it runs

Two tables and five procedures are added. Every member that exists in the
company database (`Users.MainUserId` is not null) gets every active branch and
a "set once" mark. Nothing else changes: no existing table, procedure or row is
touched. Running it again changes nothing for members that already have the
mark.

## Rules

- Company administrators (`Admin`, `CompanyAdmin`) always have every branch;
  the API ignores any stored rows for them. (The first run of the script also
  stores rows for the administrators that exist then; an administrator who is
  later made an ordinary member keeps those branches and gets no later ones.)
- A new member gets every active branch the first time their branches are
  asked for: at their first login, or when an administrator opens Branch Access
  or changes one of their branches. A member whose company has no active branch
  at that moment is not marked and gets them when a branch exists.
- A branch created later is given to nobody until an administrator ticks it in
  Platform Admin -> Branch Access.
- A member with no branch sees "No branch assigned" and cannot enter. Removing a
  member's last branch keeps it that way: the mark stops the branches from being
  given again.

## Undo

None is needed: the previous API ignores the new objects. No script here drops
anything. To switch branch access off for one company database, an owner drops
the five procedures by hand; the API then falls back to "every branch".

## Check after running

- Straight after the first run, `SELECT COUNT(*) FROM dbo.UserLocationAccessInit`
  equals the number of linked users (`Users.MainUserId` greater than 0). Later it
  grows: members are marked at their first use, before they are mirrored.
- Log in as a technician: the branches are the same as before.

## Rehearsal on a copy

1. Run the script on a copy of a company database.
2. In Branch Access, remove one branch from a technician.
3. Log in as that technician: the branch is gone, and typing its id into
   `set-scope` is refused with "You do not have access to this branch".
4. Remove the technician's last branch: "No branch assigned", and still so
   after logging in again.
5. Add a new branch: only administrators see it.
6. An administrator still sees all branches.

## One company per database

The "set once" mark is kept per member, not per company. In a database that
holds more than one company or project (the older shared layout), a member who
was given branches for one of them gets none automatically for another: an
administrator ticks them in Branch Access. Databases created by the API hold
one company, so this does not arise there.
