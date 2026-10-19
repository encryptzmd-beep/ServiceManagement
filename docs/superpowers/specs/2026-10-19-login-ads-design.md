# Login page redesign with admin-managed advertisement slider

Date: 2026-10-19
Mockup: https://claude.ai/artifact/RhSX1L6LXADgjKCsv4kpHU (artboards "Option A: Light" and "SaaS admin: Login ads")

## Why

The sign-in page is the one screen every user of every company sees. Today its left
half is four hard-coded SVG slides about the product. The platform (SaaS) admin wants
to use that space to advertise: new modules, offers, webinars, partners. The ads need
to change without a code release. The page also gets a new, lighter colour scheme.

## Goals

- A new login layout, Option A from the mockup:
  - **Left (about 58%):** the advertisement slider, in a rounded panel inset 20px
    from the edges.
  - **Right:** the sign-in form on a light background (#F4F6FA).
- The slides are managed by the platform admin from a new **Login Ads** tab in
  Platform Admin. The admin can add a slide, edit it, reorder slides, switch a
  slide on or off, and delete it.
- The ads change the moment the admin saves. No deploy is needed.

## Non-goals

- Ads per company or per user. The login page is shown before anyone signs in or
  picks a company, so there is one global set of ads.
- Click tracking, impressions or analytics on ads.
- Video slides, or ads anywhere other than the login page.
- Changes to the register page. It keeps its current look, which is a possible
  follow-up.

## Anti-goals (would count as failure even if it works)

- A slow or broken login page. The form must render and work at once, even when the
  ads endpoint is slow, failing or empty.
- An uploaded file that the browser treats as anything other than an image. Serve
  only from our own list of image types and send `nosniff`, the same rule as the Job
  Portal photo.
- Any login behaviour changing: email/password login, forgot-password OTP modal, the
  location-logout banner and the error messages must all keep working exactly as now.

## The login page (Option A)

Colours stay on brand:

| Use | Colour |
|---|---|
| Primary button | red #D42B2B |
| Links, focus ring and secondary button | navy #1B4A7A |
| Main text | #14213D |
| Muted text | #5A6A7E |
| Field borders | #D5DCE6 |

The font stays DM Sans.

**Right panel, top to bottom:**

1. "Welcome back" heading and the line "Sign in to continue to your workspace."
2. The location-logout banner, when it is showing.
3. The Email address field.
4. The Password field, with "Forgot password?" on the same line as its label.
5. The red "Sign in" button. It shows the spinner while loading, and the error
   message appears under it.
6. A divider reading "New to Encryptz?".
7. A "Create an account" outlined button that goes to `/register`.
8. The copyright footer.

The right panel has no logo of its own. The logo badge sits on the slider, at its top
left. Restyle the forgot-password modal to the light theme as well.

**Changes to the form:** the mockup's "Keep me signed in" checkbox is **left out**,
because nothing behind it exists today. Inputs keep their current bindings and
`autocomplete` values.

**Slider:**

- **Image:** fills the panel with `object-fit: cover`.
- **Shading:** a dark gradient over the bottom half, so white text stays readable.
- **Top bar:** the logo badge at top left, made of `logo.png` on white plus
  "ENCRYPTZ ERP", and a counter like "1 / 4" at top right.
- **Text:** the tag pill, headline, short text and link button at the bottom. Each
  one shows only when it is filled in, and the link button needs both a button label
  and a link. With nothing filled in, the slide is just the image and the shading
  is dropped.
- **Controls:** dots, plus previous and next buttons.
- **Timing:** it moves on every 5 seconds and pauses while the pointer is over the
  slider.
- **Number of slides:** with one slide there are no dots, arrows, counter or timer.
  With no active slides it shows one fallback slide: navy #1B4A7A with the logo
  badge and the line "Enterprise Resource Planning Platform". The four old SVG slides
  are removed.
- **Links:** they open in a new tab with `rel="noopener noreferrer"`. Accept only
  `https://` or `http://` links, both when saving and when showing.
- **Narrow screens:** below 820px the slider is hidden, as now, and the ads are
  **not fetched**.
- **Loading:** the form never waits for the ads. While they load, the fallback slide
  shows.

## The admin tab (Platform Admin → Login Ads)

- **Who can open it:** it is a new tab, shown only when `isPlatformAdmin()` is true,
  added to the same guard list as `servers`, `settings`, `applications` and
  `verification` (`platform-admin-component.ts:274`). It also appears in the sidebar
  when the sections live there.
- **Layout:** as in the mockup.
  - **The list:** order number, thumbnail, headline (or "(image only)"), link, the
    "shows" text and Active or Hidden status, plus edit and delete buttons.
  - **The edit form** has these fields:
    - image upload
    - Tag (40 characters)
    - Button text (30)
    - Headline (120)
    - Short text (250)
    - Link (500, optional)
    - Show from and Show until (dates, both optional)
    - Active
- **The "shows" text:** "Always", "From 1 Oct 2026", "Until …" or "1 Oct – 31 Oct
  2026". When the until date has passed, the status reads "Ended".
- **Reordering:** up and down arrow buttons on each row. The project has no
  `@angular/cdk`, and it is not added just for drag and drop. Saving the order sends
  the whole list of ids.
- **New slides** are added at the end of the order. A new slide needs an image; when
  editing, the image is optional and the old one is kept if no new one is chosen.
- **Delete** asks for confirmation and removes the slide for good.
- **Image rules:** JPG, PNG or WebP only, up to 2 MB, recommended size 1600 × 1000.
  Check both the file extension and the first bytes of the file (the magic number) on
  the server.

## Data (MainDB, new script `25_Login_Ads.sql`)

Follow the style of `24_Notifications.sql`:

- the same header block and SET options
- a guard that the right database is selected
- additive and safe to re-run
- `CREATE OR ALTER` procedures

Never edit an older script.

```
dbo.LoginAds
  LoginAdId    INT IDENTITY PK
  SortOrder    INT NOT NULL
  Tag          NVARCHAR(40)  NOT NULL DEFAULT ''
  Title        NVARCHAR(120) NOT NULL DEFAULT ''
  Body         NVARCHAR(250) NOT NULL DEFAULT ''
  ButtonText   NVARCHAR(30)  NOT NULL DEFAULT ''
  LinkUrl      NVARCHAR(500) NOT NULL DEFAULT ''
  ShowFrom     DATE NULL
  ShowUntil    DATE NULL
  IsActive     BIT NOT NULL DEFAULT 1
  ImageName    NVARCHAR(200) NOT NULL
  ImageType    NVARCHAR(20)  NOT NULL      -- image/jpeg | image/png | image/webp
  Image        VARBINARY(MAX) NOT NULL
  ImageVersion INT NOT NULL DEFAULT 1      -- bumped on each new image, used for cache busting
  CreatedAt / CreatedBy / UpdatedAt / UpdatedBy
```

The procedures:

| Procedure | What it does |
|---|---|
| `sp_LoginAd_ListPublic` | Active slides where today falls between `ShowFrom` and `ShowUntil` (either can be NULL), in `SortOrder`. Returns no image bytes. |
| `sp_LoginAd_ListAll` | Every slide for the admin, without image bytes. |
| `sp_LoginAd_GetImage(@Id)` | The image bytes and type. For the public endpoint it returns the image only when the slide is currently shown. |
| `sp_LoginAd_Save` | Insert or update. A NULL image on update keeps the old one. |
| `sp_LoginAd_SetActive`, `sp_LoginAd_Delete`, `sp_LoginAd_Reorder(@Ids JSON)` | Switch a slide on or off, delete it, and save a new order. |

"Today" means the server date, `CAST(GETDATE() AS DATE)`.

## API

**Public endpoints** (`[AllowAnonymous]`, new `LoginAdsController`, route
`api/loginads`):

- `GET api/loginads` returns
  `[{ id, tag, title, body, buttonText, linkUrl, imageUrl }]`.
  - `imageUrl` is `api/loginads/{id}/image?v={ImageVersion}`.
  - Cache for 60 seconds.
- `GET api/loginads/{id}/image` returns the image.
  - The content type comes from our own list, and `X-Content-Type-Options: nosniff`
    is sent.
  - Cache publicly for a day, since the `v` parameter changes when the image does.
  - Returns 404 when the slide is not currently shown.

**Admin endpoints** (on `PlatformController`, `[PlatformUnlocked]`, platform admin
only, checked the same way as settings):

- `GET platform/login-ads`
- `GET platform/login-ads/{id}/image`, so hidden slides have a thumbnail too
- `POST platform/login-ads/save`: multipart, with the fields plus an optional file,
  and `[RequestSizeLimit]` about 2.5 MB
- `POST platform/login-ads/{id}/active`
- `POST platform/login-ads/reorder`
- `DELETE platform/login-ads/{id}`

Responses use the existing `ApiResponse<T>` wrapper. The Angular `api` service gains
the matching methods.

## Tests

Follow the existing patterns in `EncryptzTests`:

- the rules for validating an image (type, size and magic number)
- link validation (only http and https)
- the date filter for which slides show
- a non-admin being refused on the admin endpoints

Angular specs for:

- the login slider: the fallback when the list is empty, one slide with no controls,
  next and previous wrapping around, and empty fields hidden
- the new admin tab: the guard, the list, save and reorder

## Builder's call

- Exact spacing, sizes and hover states, based on the mockup.
- Whether the slider becomes its own small component, such as
  `login-ad-slider`.
- Cross-fade versus slide transition, as long as it is short (300–500 ms) and
  respects `prefers-reduced-motion`.
- Error and empty states in the admin tab, following the other tabs.

## Calls made in this design (not stated by the user)

- The "Keep me signed in" checkbox is dropped, because there is nothing behind it.
- The fallback is one plain navy brand slide, not the old four SVG slides.
- Images are stored in the database, the same way as Job Portal photos. The limit is
  2 MB, and JPG, PNG and WebP are allowed.
- The optional show-from and show-until dates use the server's date.
- The register page is left unchanged.
