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

A working prototype exists as a Google Apps Script web app. Its remaining source is in `reference/apps-script/` (CalendarRepository.gs, Subscription.gs, Index.html, Styles.html). Config, Template, Schedule, Controller and Client were deleted once ported to `src/lib/`. Port its logic; don't reinvent it. The Apps Script version uses `CalendarApp` and the Advanced Calendar service. The app calls the same Calendar REST v3 endpoints directly with `fetch`.

## Fixed decisions

| Area | Decision |
|---|---|
| App name | EventBetter |
| Android package ID | `online.jumppack.eventbetter` (permanent, never change) |
| Platform | Android only for v1. Don't add iOS config, but avoid Android-only code where a cross-platform option costs nothing |
| Stack | Expo (latest stable SDK), React Native, JavaScript with JSX. Use Expo Router for navigation |
| Builds | Expo development build (not Expo Go, since native Google sign-in requires it). EAS Build and EAS Submit |
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
- Write a test proving the occurrence dates Google generates (via the instances endpoint) match `occurrences()` for a series starting on the 31st. If Google doesn't honor `BYSETPOS` as expected, stop and tell me.

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
3. **Add / edit subscription:** fields and help text match `reference/apps-script/Index.html`:
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

- Use `@react-native-google-signin/google-signin` with its Expo config plugin (or whatever Google currently recommends for Android sign-in plus authorization, after checking current docs).
- Request only basic profile at sign-in, then the Calendar scope separately.
- Scope: prefer the narrowest scope that lets the app create and manage its own secondary calendar and that calendar's events (Google has a scope limited to app-created calendars). Check its current name, its sensitivity classification, and whether the app can find its own calendar again with it. If it can't meet the requirements, tell me the trade-offs before falling back to a broader scope.
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

- The prototype's service file is `reference/apps-script/Subscription.gs`. The deleted Config.gs defaulted `maxCount` to 24, superseded by this spec's 12.
- Delete each remaining reference file once it's fully ported: CalendarRepository.gs and Subscription.gs after milestone 2, Index.html after milestone 3, Styles.html after milestone 6.
- `src/lib/series.js` holds `keyFor`, `buildOccurrences` (titles and dates, used by both create and the live preview), `planSeries` (items, first date, RRULE, extended properties) and `encodeConfig`/`decodeConfig`. `ebConfig` carries a `v` version field for future migrations.
- Extended property values are capped at 1024 characters, and longer values are silently truncated by the API. `planSeries` measures UTF-8 bytes (never fewer than characters) and throws `PropertyTooLargeError`.
- `MAX_COUNT = 500` caps the number of events. Each occurrence after the first is patched separately, so this bounds creation time and quota use.
- `validate()` returns `{ sub, errors, valid }` with per-field errors for the form. `normalize()` throws a `ValidationError` carrying the same errors.

## Working style

- I prefer concise, direct explanations. Assume I'm a developer, but explain Android and Play Store specifics I may not know.
- Write clean, human-style code. Keep comments for the non-obvious "why", not narration.
- Don't add dependencies beyond those named here without telling me why first.
- Git: ask before every commit and push. Commit messages name the milestone ("Milestone N: …") and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the email makes GitHub show the co-author avatar). This repo's author email is the GitHub noreply address, set in local config.
- Never commit secrets or keystores. Keep real ad unit IDs and OAuth client IDs in config that's easy to swap.
