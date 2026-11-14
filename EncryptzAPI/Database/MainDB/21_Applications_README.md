# Applications: run order

`21_Applications.sql` adds the type, the family, the route and the "Coming soon"
flag to `dbo.Modules`, lists the new applications and re-creates the procedures
behind a company's module page so they show commercial applications only.

## When to run

- After `20_Company_Provisioning.sql`, with the main database selected in SSMS.
- It is safe to run again.
- **Every time `14_Company_Tenancy_Cutover.sql` or `19_Module_Management.sql` is run
  again, run `21_Applications.sql` again afterwards** (order: 14, 19, 20, 21). Scripts
  14 and 19 re-create `sp_User_GetModules`, `sp_User_ValidateScope` and the
  `sp_Platform_*Module*` procedures without the type. Until script 21 runs again,
  personal applications show up on the module page of every company.

## What the API does without it

The API works against a main database without script 21: every application counts as
released, the company page shows no personal applications, and the Applications
section of Platform Admin answers with an error.

## Undo

No undo is needed. The previous API ignores the new columns and rows. To hide a seeded
application, set it inactive in Platform Admin, Applications.
