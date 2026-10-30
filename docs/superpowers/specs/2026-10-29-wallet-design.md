# Wallet — credits for individuals (welcome + referral)

Date: 29-Oct-2026 · Status: draft for approval

## Why

Every individual in the Encryptz ecosystem has one lifelong account (Individual ID). We want to
reward people for joining and for bringing friends, with **credits** they will later spend —
mostly on subscribing to Encryptz products. Spending/redeeming is **planned later**; this
version only earns credits, shows them, and keeps a trustworthy history so redeem can be added
without reworking anything.

## Goals

1. A **Wallet** personal application (next to Job Portal and Expense Manager) showing the
   available balance and the full credit history.
2. The **available balance is always visible** once a person is signed in.
3. Platform Admin sets **Welcome credits**; a person gets them automatically once onboarded.
4. Platform Admin sets **Referral credits**; a person invites a friend by e-mail, and when the
   friend is onboarded **both** get the referral credits.
5. Credits are kept as a **ledger**: append-only entries, balance = sum of entries.

## Non-goals (this version)

- Redeeming / spending credits, subscriptions, expiry of credits.
- Admin manually adding or removing credits.
- Converting credits to or from money.

## Anti-goals (would be a failure even if it "works")

- A person getting the same welcome or referral reward twice (double-click, retry, re-save of
  the profile, two parallel requests).
- A balance that can disagree with the history (no stored balance that is edited separately).
- Ledger rows that are edited or deleted — corrections are always a new entry.

## Decisions made with the user

- **Onboarded** = the person's account profile (MainDB `dbo.Users`) has **both a full name and
  a mobile number** saved. Note: self-registration (`sp_User_SelfRegister`) already requires
  both, so a self-registered person is onboarded the moment their account is created. Accounts
  made by other paths become onboarded the moment they have both: `sp_Mgmt_SaveUser` and
  `sp_Company_CreateTechnicianUser` (MainDB script 14) also save a mobile number, so they run the
  check too; anyone still without a mobile is onboarded when they first save one on
  header > Profile (`sp_User_UpdateProfile`). The mobile number is required at sign-up on the
  server too (`RegistrationRules.Problem` refuses a missing or invalid one).
- **No verification (OTP) for now** — there is no SMS/OTP subscription yet — but it is wanted
  in the near future. So "is this person onboarded?" lives in **one place**
  (`dbo.fn_Wallet_IsOnboarded`), and the check is safe to call again: when OTP arrives, that
  function adds "mobile verified" and the OTP-confirm step simply calls the check as well.
- **Existing users get no welcome credits** (user, 29-Oct-2026): only accounts created after
  script 27 first runs. Script 27 stores the moment in `dbo.PlatformSettings`
  (`WalletStartedAt`, written once, never overwritten, not editable in Platform Admin); the
  check pays only users whose `Users.CreatedAt >= WalletStartedAt`.
- Welcome credits and referral credits are **two Platform Admin settings**.
- Invites are **by e-mail**; when the friend is onboarded **both parties** get the referral
  credits.
- Balance shown always; redeem later; credits mostly for subscribing to our products.

## Builder's calls (proposed by Claude, confirmed with "go")

- **Where it lives:** MainDB, beside `dbo.Users` — the wallet belongs to the Individual ID,
  not to one app, and onboarding happens in MainDB procedures. New script
  `EncryptzAPI/Database/MainDB/27_Wallet.sql` (never edit existing scripts; safe to re-run,
  same guard style as other MainDB scripts).
- **Credits are whole numbers** (INT). Settings accept 0 – 100000. **0 switches that reward
  off** (no ledger row is written).
- **Amount paid** = the setting's value at the moment of onboarding, not when the invite was
  sent.
- **Once only:** welcome once per person; referral once per friend (one inviter is credited
  per friend). Enforced in the database with unique indexes, not only in code.
- **Inviting rules:** cannot invite your own e-mail; cannot invite an e-mail that already has
  an account (told "This person already has an account"); re-inviting the same friend re-sends
  the mail and does not create a second invite. No expiry on invite links. No daily limit
  (easy to add later).
- **Which inviter counts** when several people invited the same e-mail: the one whose link the
  friend used; if the friend registered without a link, the earliest open invite to that
  e-mail.
- **Abuse guard until OTP exists:** one person may send at most **20 invites per day**
  (a constant in `WalletRules`, not a setting).
- The friend gets **two** entries (Welcome, Referral – joined), the inviter one entry
  (Referral – friend joined, naming the friend).

## Data (MainDB)

`dbo.WalletLedger` — one row per credit movement, never updated or deleted.

| Column | Notes |
|---|---|
| EntryId BIGINT IDENTITY PK | |
| UserId INT FK Users | the wallet owner |
| Amount INT | positive = earned; negative reserved for redeem later; never 0 |
| Kind VARCHAR(20) | `Welcome`, `ReferralJoined` (the friend), `ReferralInviter` (the inviter); later `Redeem`, `Adjustment` |
| ReferralId INT NULL FK | source referral for referral entries |
| Note NVARCHAR(200) | text shown in the history, e.g. "Your friend Anu joined" |
| CreatedAt DATETIME2 | |

Unique filtered indexes: one `Welcome` per UserId; one `ReferralJoined` and one
`ReferralInviter` per ReferralId.

`dbo.Referrals` — one row per invite.

| Column | Notes |
|---|---|
| ReferralId INT IDENTITY PK | |
| InviterUserId INT FK Users | |
| Email NVARCHAR(256) | the friend's e-mail, stored trimmed/lower |
| Token UNIQUEIDENTIFIER | in the sign-up link |
| Status VARCHAR(10) | `Sent` → `Joined` (account made) → `Credited` (onboarded, credits paid) |
| FriendUserId INT NULL FK Users | set when the friend's account is made |
| SentAt, JoinedAt, CreditedAt | |

Unique (InviterUserId, Email). A friend's account is linked to at most one referral (unique
filtered index on FriendUserId).

Settings: two new keys in `dbo.PlatformSettings`: `WelcomeCredits`, `ReferralCredits`
(seeded 0), validated in `PlatformSettingRules`.

App: a `WALLET` row in `dbo.Modules`, `AppType='Personal'`, icon `account_balance_wallet`,
RoutePath `apps/wallet`, released.

## Behaviour

**Onboarding check** — `dbo.sp_Wallet_OnUserOnboarded @UserId`, run by a new trigger
`TR_Users_Wallet` (AFTER INSERT, UPDATE on `dbo.Users`, like `TR_Users_IndividualId`), so
every path that creates or edits a user — self-registration, profile, admin-created users,
technicians, and any future path — is covered without re-creating those procedures (several
of them have competing versions in scripts 14/15). It does nothing unless
`fn_Wallet_IsOnboarded` says yes and the user was created at or after `WalletStartedAt`.
It links the user's referral if not yet linked (the token from the sign-up link, read from
`SESSION_CONTEXT(N'ReferralToken')`, which `sp_User_SelfRegister` sets before its INSERT;
otherwise the earliest `Sent` referral for the user's e-mail). Then, in the same transaction,
idempotently (NOT EXISTS checks under UPDLOCK plus the unique indexes make a second run a
no-op):
1. write the Welcome entry if WelcomeCredits > 0 and none exists;
2. if the user is linked to a referral in status `Joined`, write both referral entries if
   ReferralCredits > 0, and set the referral to `Credited` (also `Credited` with no entries
   when the setting is 0, so it is not paid later).

**Linking the friend** — the sign-up link is `/register?ref=<token>`. The register page
pre-fills the invited e-mail and passes the token to `self-register`; `sp_User_SelfRegister`
(re-created in script 27 from its script 06 version, with a new optional `@ReferralToken`)
puts it in the session context before the INSERT. The link's referral is used even if the
friend registers with another e-mail; without a usable token the earliest `Sent` referral for
the account's e-mail is used. Linking sets `Joined` + FriendUserId + JoinedAt; paying sets
`Credited`.

**Invite mail** — sent by the API through the existing `IEmailService`: inviter's name, a line
on what Encryptz is, the referral credit amount (if > 0), and the sign-up link. If sending
fails the invite is still saved and shown with "Mail not sent – resend".

## API (new `WalletController`, `[Authorize]`, user from the token)

- `GET api/wallet/balance` → `{ balance }` (for the header).
- `GET api/wallet/ledger?page=` → entries newest first + balance.
- `GET api/wallet/referrals` → my invites with status.
- `POST api/wallet/referrals` `{ email }` → create/resend invite, send mail.
- `self-register` DTO gains optional `ReferralToken`.
- Platform settings: existing `settings` / `settings/save` endpoints, new keys.

## UI (Angular)

- **Wallet app** (`apps/wallet`, `authGuard`, inside `personal-shell-component` like Job
  Portal): a balance card; "Invite a friend" — e-mail box + Send, with a line "You and your
  friend each get N credits when they join" (hidden when 0); "My invites" list (e-mail, date,
  Sent / Joined / Credited, Resend); "History" — date, note, +amount, paged.
- **Header balance**: a small chip "N credits" next to `app-notification-bell` in both
  `header-component` and the personal shell header; clicking it opens the Wallet app. Loaded on
  sign-in and refreshed after any wallet action (a shared signal in a `WalletService`).
- **Register page** reads `?ref=` and sends it with the registration.
- **Platform Admin > Settings tab**: two number fields, Welcome credits and Referral credits,
  with the hint "0 = off".

## Left to the builder

Exact component/file names, wording of the mail and screen texts, paging size, styling
consistent with Job Portal, tests (unit tests for `PlatformSettingRules` and the wallet
service; SQL script tried on a copy/dev DB only — the server in appsettings is LIVE).
