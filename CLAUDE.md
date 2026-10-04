# EventBetter — Project Spec

You are helping build **EventBetter**, an Android app published on the Google Play Store. This file is the source of truth for decisions already made. Read it fully before writing code, and keep it updated when a decision changes.

## What the app does

Google Calendar recurring events all share one title. EventBetter creates recurring events where every occurrence has its own numbered title, so users can see how long they've been subscribed to something.

Example: "Tuff Gym membership", starting 2026-09-30, monthly, 12 events, produces a single recurring series in Google Calendar whose occurrences are titled:

- Oct 30, 2026: Tuff Gym membership: 1st month over
- Nov 30, 2026: Tuff Gym membership: 2nd month over
- …
- Feb 28, 2027: Tuff Gym membership: 5th month over (clamped to month end)
- …
- Sep 30, 2027: Tuff Gym membership: 12th month over

Because it's a real recurring series, deleting any occurrence in Google Calendar offers "All events".

A working prototype exists as a Google Apps Script web app. Its remaining source is in `reference/apps-script/` (Styles.html). The other files were deleted once ported: Config, Template, Schedule, Controller and Client to `src/lib/` (milestone 1), CalendarRepository and Subscription to `src/api/calendarApi.js` and `src/services/subscriptionService.js` (milestone 2), Index.html to `src/components/SubscriptionForm.js` (milestone 3). Port its logic; don't reinvent it. The Apps Script version uses `CalendarApp` and the Advanced Calendar service. The app calls the same Calendar REST v3 endpoints directly with `fetch`.

## Fixed decisions

| Area | Decision |
|---|---|
| App name | EventBetter |
| Android package ID | `online.jumppack.eventbetter` (permanent, never change) |
| Platform | Android only for v1. Don't add iOS config, but avoid Android-only code where a cross-platform option costs nothing |
| Stack | Expo (latest stable SDK), React Native, JavaScript with JSX. Use Expo Router for navigation |
| Builds | Expo development build (not Expo Go, since native Google sign-in requires it). EAS Build (cloud) and EAS Submit. Dev builds are installed on a physical Android phone; no local Android SDK |
| Backend | None. Google Calendar is the database. No server, no analytics service, no own database |
| Auth | Google account sign-in, then an incremental request for Calendar access |
| Calendar target | The app writes only into its own secondary calendar named "EventBetter", which it creates on first use |
| Reminders | Both Google Calendar reminders on the series and local notifications on the device. Fixed default: 1 day before at 9:00 AM local time |
| Monetization | Free with ads (Google AdMob) |
| Play Console | Personal developer account |
| Domain | `jumppack.online` (owned). Hosts the homepage, privacy policy and `app-ads.txt` |
| Source | Public GitHub repo, MIT license. Nothing secret is ever committed |

When a library's API or a Google policy described here seems out of date, check the current official docs and tell me what changed before building on it.

## Core logic (port from `reference/apps-script/`)

Put this in `src/lib/` as pure functions with no React or network imports, fully unit tested with Jest.

### Template placeholders

| Placeholder | Meaning | Example |
|---|---|---|
| `{name}` | Subscription name | Tuff Gym membership |
| `{count}` | Occurrence number | 1, 2, 3 |
| `{ord}` | Occurrence number as an ordinal | 1st, 2nd, 3rd (11th, 12th, 13th, 21st, 22nd…) |
| `{elapsed}` | count × repeat-every | quarterly: 3, 6, 9 |
| `{unit}` | day, week, month or year | month |
| `{units}` | unit pluralized to match `{elapsed}` | 1 month, 2 months |

Unknown placeholders are left as literal text. Default template: `{name}: {ord} {unit} over`. An optional start event template (for example `{name} started`) adds an extra occurrence on the start date itself, using `count = 0`.

### Dates

- Parse `YYYY-MM-DD` as a local date. Never use `new Date("YYYY-MM-DD")`, which parses as UTC and can shift the day.
- Monthly and yearly occurrences are computed from the original start date, not the previous occurrence, and clamp to the last day of the month (Jan 31 gives Feb 28/29, then Mar 31).
- Occurrences stop at whichever comes first: the end date (optional) or the number of events (default 12).

### Recurrence rule

- `FREQ` = DAILY, WEEKLY, MONTHLY or YEARLY, `INTERVAL` = repeat-every, and always `COUNT` = total occurrences (including the start event, if any). Never use `UNTIL`, because the end-date/count logic is resolved into `COUNT` beforehand.
- Monthly with start day 29–31: add `BYMONTHDAY=28,…,<day>;BYSETPOS=-1` so short months clamp instead of being skipped.
- Yearly starting Feb 29: add `BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1`.
- Write a test proving the occurrence dates Google generates (via the instances endpoint) match `occurrences()` for a series starting on the 31st. If Google doesn't honor `BYSETPOS` as expected, stop and tell me. Verified 2026-09-30 on a real account: monthly from Jan 31 and yearly from Feb 29 both match. `calendarApi.live.test.js` (`npm run test:live`) is the repeatable version, and `create()` also refuses any series whose dates differ from the plan.

### Creating a subscription

1. Validate and normalize the input. Empty fields fall back to defaults.
2. Build the list of titles and descriptions for every occurrence.
3. Insert one all-day recurring event (`start.date` / `end.date` = next day) into the EventBetter calendar with:
   - the first occurrence's title as the summary
   - the RRULE
   - `reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 900 }] }`. For all-day events, minutes count back from midnight at the start of the day, so 900 = 9:00 AM the day before
   - `extendedProperties.private`: `ebKey` (dedupe key: name|start|frequency|interval), `ebName`, and `ebConfig` (compact JSON of the full form input, needed for the edit screen). Each value must stay under the Calendar API's per-value size limit, so check it and fail clearly if a config is too large
4. Fetch all instances (paginate) and patch each occurrence after the first with its own summary and description. Throttle the patches (roughly 250 ms apart) and retry on 403/429 rate-limit responses with backoff.
5. If a series with the same `ebKey` already exists, don't create a duplicate. Tell the user it already exists.

Series lookup uses `events.list` with `privateExtendedProperty` and filters out items that have a `recurringEventId` (renamed occurrences inherit the tags).

### Editing and deleting

- **Edit** = delete the series and recreate it from the edited config, after a confirmation dialog. Occurrence titles are all custom, so there's no safe in-place edit.
- **Delete** = delete the series master event, which removes all occurrences.

## Screens

1. **Sign in:** app name, a one-line explanation, and a "Continue with Google" button. After sign-in, explain in plain words why Calendar access is needed before the system permission prompt appears.
2. **Subscriptions list (home):** every EventBetter series, showing name, frequency ("Every 3 months"), progress ("5 of 12") and the next occurrence date. Pull to refresh, an empty state that explains the app, and a floating add button. A banner ad is anchored at the bottom of this screen only.
3. **Add / edit subscription:** fields and help text match the prototype's Index.html (now ported verbatim into `src/components/SubscriptionForm.js`):
   - Title
   - Start date (native date picker, defaults to today)
   - Frequency
   - Repeat every
   - End date (optional)
   - Number of events to create (default 12)
   - Title template, with the collapsible placeholder guide
   - Start event title (optional)

   There's no calendar field, because the app always uses its own calendar. Add a live preview of the first three generated titles and dates as the user types. Edit mode shows a Delete button.
4. **Settings:** signed-in account and sign out, "Manage ad privacy choices" (the consent SDK's privacy options form), links to the privacy policy and homepage, and "Disconnect Google account" (revoke access and clear local state), plus the app version and open-source licenses.

Show clear progress while a series is being created, because patching many occurrences takes several seconds. Disable the submit button while it runs.

## Reminders

- **Calendar reminders** are set on the series when it's created (see above). Nothing more to do.
- **Local notifications** use `expo-notifications`:
  - Schedule one notification per upcoming occurrence at 9:00 AM local time the day before, with body text like "Tomorrow: Tuff Gym membership: 3rd month over"
  - Only schedule the next 2 occurrences per subscription, with at most 50 in total
  - Reschedule everything from Calendar data on app launch, on returning to the foreground, and after any create, edit or delete. That way a reinstall or a new phone recovers automatically
  - Ask for notification permission (Android 13+) at a sensible moment, such as after the first subscription is created, not on launch
  - Store the mapping of scheduled notifications in AsyncStorage

## Ads (AdMob)

- Use `react-native-google-mobile-ads` with its Expo config plugin.
- Use Google's consent SDK (UMP, built into that library) and show the consent form before loading any ad. This is required for EEA/UK users.
- Use test ad unit IDs in development builds and real IDs only in production, read from config.
- Place a single anchored banner on the list screen. No interstitials in v1.
- **Hard rule:** no Google user data (calendar data, event titles, email, name) may ever be passed to the ad SDK or used to target ads. No custom targeting keywords. Google's API Services User Data Policy forbids this, and OAuth verification reviewers check it. Keep the ad code in its own module that imports nothing from the calendar or auth modules.

## Auth details

- Decided (milestone 2): a local Expo module, `modules/google-auth/` (Kotlin), wraps Google's current Android APIs. Credential Manager (`androidx.credentials` + `googleid`) handles sign-in, and `AuthorizationClient` (`play-services-auth`) handles scopes, token refresh (`clearToken`) and `revokeAccess`. `@react-native-google-signin` was rejected: its free edition is built on the deprecated legacy Google Sign-In SDK, and the maintained edition is paid. `src/api/auth.js` is the JS wrapper.
- Request only basic profile at sign-in, then the Calendar scope separately.
- Scopes (decided): `calendar.app.created` (create the app's own calendar and manage its events) plus `calendar.calendarlist.readonly`. `calendarList.list` doesn't accept `app.created`, so the list scope is what lets the app find its calendar again after a reinstall. Users can untick scopes, so `authorizeCalendar` checks what was granted: without `app.created` it fails, and without the list scope recovery is simply skipped. Our calendar is identified by summary + description + `accessRole: owner`. Scope sensitivity: confirm in the Cloud console (list scope reported non-sensitive; assume `app.created` is sensitive).
- Get access tokens from the SDK on each API call session and let the SDK handle refresh. Never store tokens yourself.
- Store the EventBetter calendar ID in AsyncStorage. If it's missing or the calendar was deleted, recover or recreate it.

## Project structure

Mirror the layered structure of the Apps Script prototype:

```
src/
  app/                  Expo Router screens (view layer)
  components/           reusable UI (glass card, form fields, list item, banner slot)
  lib/                  pure logic: template.js, schedule.js, rrule.js, validate.js (+ tests)
  services/             subscriptionService.js (orchestration), notificationService.js
  api/                  calendarApi.js (the only file that calls the Calendar REST API), auth.js
  ads/                  ads.js, consent.js (isolated, see Ads)
  config/               constants, defaults, ad unit IDs per environment
reference/apps-script/  prototype source (read-only)
website/                static pages for jumppack.online
```

## Visual design

- A "liquid glass" look consistent with the prototype: frosted translucent cards over soft colored background shapes, subtle light edges, rounded corners, and a blue-to-violet accent gradient on primary buttons.
- Use `expo-blur`. Android blur support is limited, so verify performance on a mid-range device and fall back to a translucent solid surface if blur is slow or unsupported.
- Support system light and dark mode. Keep touch targets at least 48dp and maintain readable contrast on glass surfaces.

## Website (`website/`, hosted at jumppack.online)

Generate simple static pages:

- `/eventbetter/`: homepage that describes the app, required by Google OAuth verification
- `/eventbetter/privacy/`: privacy policy. It must state:
  - which Google data is accessed and why
  - that data stays between the user's device and Google, with no EventBetter server
  - that Google user data is never used for advertising
  - which data AdMob collects
  - how to revoke access
  - compliance with the Google API Services User Data Policy, including the Limited Use requirements
  - contact email
- `/app-ads.txt` at the domain root, required by AdMob
- Ask me which hosting provider I want before writing deploy config.

## Launch checklist (guide me through these; many are manual steps I do)

1. **Google Cloud project:**
   - enable the Calendar API
   - set up the OAuth consent screen (External) with app name, logo, support email, homepage, privacy policy and authorized domain `jumppack.online`
   - verify the domain in Google Search Console
   - create an Android OAuth client with the package ID and SHA-1 for the local debug key, the EAS build key and the Play App Signing key, plus the Web client ID the sign-in library requires
   - add test users during development
2. **OAuth verification** for the Calendar scope: scope justification, demo video of the sign-in and Calendar flow, and policy compliance. Start this early, because it can take weeks.
3. **AdMob:** create the account and app, create the banner ad unit, publish `app-ads.txt`, and link the app to its Play listing.
4. **Play Console (personal account):**
   - $25 fee and identity verification
   - app content forms: data safety (declare the advertising ID and account info), ads declaration, content rating, target audience, privacy policy URL
   - meet the current target API level
   - a closed test with the currently required number of testers for the required number of days (check current policy, last known as 12 testers for 14 days) before applying for production access
5. **Store listing:** icon, feature graphic, screenshots, short and full description.

## Build order

Work in this order. Stop at the end of each milestone, summarize what was done, and wait for my go-ahead.

1. Scaffold the Expo project, add the folder structure, and port `src/lib/` with tests. No UI yet.
2. Sign-in, Calendar authorization, create or find the EventBetter calendar, and create a subscription end to end (a minimal form is fine). Includes the `BYSETPOS` verification test against the real API.
3. List screen, delete, edit (recreate), the full add/edit form with live preview, and settings.
4. Reminders: Calendar reminder on the series, plus local notifications with rescheduling.
5. Ads and consent.
6. Visual design pass (glass look, dark mode).
7. Website and privacy policy, EAS production build config, and a walkthrough of the launch checklist.

## Implementation notes (decided during build)

- The deleted Config.gs defaulted `maxCount` to 24, superseded by this spec's 12.
- Delete each remaining reference file once it's fully ported: Styles.html after milestone 6.
- `src/lib/series.js` holds `keyFor`, `buildOccurrences` (titles and dates, used by both create and the live preview), `planSeries` (items, first date, RRULE, extended properties) and `encodeConfig`/`decodeConfig`. `ebConfig` carries a `v` version field for future migrations.
- Extended property values are capped at 1024 characters, and longer values are silently truncated by the API. `planSeries` measures UTF-8 bytes (never fewer than characters) and throws `PropertyTooLargeError`.
- `MAX_COUNT = 500` caps the number of events. Each occurrence after the first is patched separately, so this bounds creation time and quota use.
- `rrule` (npm, dev dependency only) powers `rrule.expansion.test.js`, which expands every generated RRULE for ~16,000 series (every start day in 2027 and 2028, all frequencies, several intervals, with and without a start event) and checks the dates match `buildOccurrences()`. It's an offline safety net; the live Google instances test remains authoritative.
- India is a primary market. `npm test` runs every suite in four time zones (`jest.config.js` projects): Asia/Kolkata (IST, +05:30, where local midnight is the previous UTC day), UTC, America/Los_Angeles and Pacific/Auckland. `jest/timezone-environment.js` sets `TZ` on the real `process.env`, because test files only see a sandboxed copy. `timezone.test.js` asserts each zone is really applied. Never use `toISOString()` or `new Date("YYYY-MM-DD")` for calendar dates.
- Form UI (pulled forward from milestone 3 at the user's request): `src/components/SubscriptionForm.js` is shared by add and edit, with fields and help text copied verbatim from `Index.html` and a live preview of the first 3 titles. `@react-native-community/datetimepicker` (approved) provides the native Android date dialog through `DateTimePickerAndroid.open`; the optional End date has a "Clear" button. Frequency uses a JS bottom sheet, not a native picker.
- Glass look without new packages: `src/components/theme.js` holds light and dark tokens based on the prototype's. `Glass.js` draws the background and blobs with RN gradients and uses `boxShadow`, both of which need the New Architecture. In RN 0.86 the gradient prop is `experimental_backgroundImage`; plain `backgroundImage` is silently ignored. Real backdrop blur (`expo-blur`) is still milestone 6.
- Contrast: every text/background pair meets WCAG AA in both themes (4.5:1 text and placeholders, 3:1 field borders). `theme.contrast.test.js` composites the translucent layers over the background's lightest and darkest spots and enforces this, so check it whenever tokens change. Use `link` (not `accent`) for text-colored accents, `fieldBorder` for inputs, and `buttonFrom`/`buttonTo` for the primary button.
- Edit order (milestone 3): `update()` creates the new series first (the old one doesn't count as a duplicate), then deletes the old one, so a failed edit never loses the subscription. If the old one can't be removed, it throws `OldSeriesNotRemovedError` and both stay listed. Deletes treat 404/410 as already gone.
- List progress (`src/lib/summary.js`): "5 of 12" counts numbered occurrences dated today or earlier; the start event isn't counted but can be "Next". Dates compare as local YYYY-MM-DD strings. Series whose `ebConfig` can't be read are still listed and deletable, but not editable. `list()` never creates the calendar.
- `SubscriptionsProvider` caches the list for the edit screen and remounts per session so another account's data never shows.
- Open-source licenses: `npm run licenses` regenerates `src/config/licenses.json` from the Android bundle's source map, so only JS that actually ships is listed, plus a hand-kept list of native Android libraries in `scripts/generate-licenses.js`. Rerun after adding or upgrading a dependency.
- Settings' "Manage ad privacy choices" arrives with the consent SDK in milestone 5. The privacy policy and homepage links point at `src/config/links.js`; the pages themselves come in milestone 7.
- Reminders (milestone 4): `src/lib/reminders.js` plans the local notifications (9:00 AM local the day before, next 2 per subscription, 50 max, soonest first). `src/services/notificationService.js` diffs the plan against a key -> notification mapping in AsyncStorage and the OS's scheduled list, so unchanged reminders aren't rescheduled and fired or OS-cleared ones roll forward. Syncs run one at a time. `src/services/reminders.js` is the app-wide instance. Every list refresh syncs (launch, foreground via AppState, after create/edit/delete); sign-out and disconnect cancel everything. Permission is requested once, after the first subscription is created; Settings shows the state and links to system settings if the user said no permanently.
- No exact alarms: we don't request `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (Play restricts them to alarm and calendar apps), so Android may deliver reminders a few minutes late. `expo-notifications` adds only `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED` (reminders survive reboots). It needs a 96x96 white notification icon before launch (milestone 6/7); until then Android uses the app icon.
- `validate()` returns `{ sub, errors, valid }` with per-field errors for the form. `normalize()` throws a `ValidationError` carrying the same errors.

## Working style

- I prefer concise, direct explanations. Assume I'm a developer, but explain Android and Play Store specifics I may not know.
- Write clean, human-style code. Keep comments for the non-obvious "why", not narration.
- Don't add dependencies beyond those named here without telling me why first.
- Git: ask before every commit and push. Commit messages name the milestone ("Milestone N: …"; follow-up work on a finished milestone is "Milestone N.1", "N.2", …) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the email makes GitHub show the co-author avatar). This repo's author email is the GitHub noreply address, set in local config.
- Never commit secrets or keystores. Keep real ad unit IDs and OAuth client IDs in config that's easy to swap.
