# OAuth verification submission: EventBetter

**Status: done (2026-10-05).** The app is **In production** and its
**branding is verified**. Google's console classifies both scopes as
**non-sensitive**, so no sensitive-scope review or demo video was needed.
Re-verification is only needed if the app name, logo, homepage, privacy
policy or domain changes, or if a sensitive scope is added.

The scope justifications and video script below are kept in case Google
reclassifies a scope, adds one, or asks follow-up questions.

## Before you submit

- [x] Homepage live: https://jumppack.online/eventbetter/
- [x] Privacy policy live on the same domain: https://jumppack.online/eventbetter/privacy/
- [x] `jumppack.online` verified in Search Console (with the account that owns the Cloud project)
- [x] Branding page complete: app name **EventBetter**, logo `assets/oauth-logo-120.png`, homepage and privacy policy URLs, authorized domain `jumppack.online`, support and developer contact emails
- [x] **Data access** lists exactly these two scopes and nothing else:
  - `https://www.googleapis.com/auth/calendar.app.created`
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- [x] ~~Demo video~~ not required while both scopes are non-sensitive
- [x] App published (Audience → Publish app) and branding verified

## Scope justifications

Paste each into the justification field for its scope. If the console
classifies `calendar.calendarlist.readonly` as non-sensitive, it may not ask
for one; keep the text in case a reviewer does.

### `calendar.app.created`

> EventBetter is an Android app that creates recurring Google Calendar events
> where every occurrence has its own numbered title (for example "Tuff Gym
> membership: 1st month over", "2nd month over", and so on). Google Calendar
> can't give occurrences of one recurring event different titles, so the app
> creates the recurring event and then sets each occurrence's title.
>
> The app uses this scope to create one secondary calendar named "EventBetter"
> and to create, read, update and delete events only in that calendar: it
> inserts the recurring event, lists its occurrences, renames each occurrence,
> reads the series back to show the user's list with progress and the next
> date, and deletes or recreates a series when the user deletes or edits it.
> The settings the user entered are stored in the event's private extended
> properties so the series can be edited later.
>
> This is the narrowest scope that allows this. The app never needs to see or
> change the user's other calendars or events, so broader scopes such as
> `calendar`, `calendar.events` or `calendar.events.owned` would grant far more
> access than the feature requires. All data goes directly between the user's
> device and Google; there is no server, and Google user data is never used
> for advertising.

### `calendar.calendarlist.readonly`

> `calendarList.list` doesn't accept the `calendar.app.created` scope, so
> without this scope the app can't find the "EventBetter" calendar it created
> after the user reinstalls the app or moves to a new phone. It would create a
> second calendar and lose track of the user's existing recurring events.
>
> The app reads the calendar list only on the device to find the calendar it
> created (matching its name, its description and owner access). It doesn't
> read events from any other calendar, doesn't store the list, and never
> sends it anywhere. Users can untick this scope on the consent screen and the
> app still works; only the reinstall recovery is skipped. This is the
> narrowest read-only scope that allows finding the app's own calendar.

## How the app uses the data (for the "how will the data be used" fields)

> Profile (name, email, picture) is shown in the app's Settings to identify
> the signed-in account and is used to request Calendar authorization for that
> account. Calendar data is used only to create and manage the user's
> EventBetter recurring events and to show them in the app. Nothing is sent to
> a developer server (there is none), shared with third parties, or used for
> advertising. The app shows AdMob banner ads, but the ad code receives no
> Google user data.

## Demo video script (about 3–4 minutes)

Record the phone screen with Android's built-in screen recorder (Quick
Settings → Screen record). Keep the phone language set to **English**. Use a
Google account that's listed as a test user. Narration is optional; on-screen
steps are enough, but a short spoken line per step helps the reviewer.

Google asks that the video show the OAuth client ID in the consent screen's
address bar. Android's native sign-in has no address bar, so show the client
ID in the Cloud console first (shot 1), and note this in the submission.

1. **Client ID (desktop screen recording, ~15 s).** Open Google Cloud console
   → Google Auth Platform → **Clients**. Show the **Android** client
   (package `online.jumppack.eventbetter`) and the **Web** client, with their
   client IDs visible. Say: "EventBetter is an Android app using these OAuth
   clients."
2. **Fresh start (~10 s).** On the phone, if EventBetter has access already,
   remove it first at myaccount.google.com/connections, and clear the app's
   storage (or reinstall) so the full flow appears. Open EventBetter.
3. **Sign-in (~20 s).** Tap **Continue with Google**, pick the account.
   Pause on the account chooser so "EventBetter" is readable.
4. **Explanation screen (~15 s).** Show the in-app Calendar access screen
   that explains why access is needed. Pause so the text is readable.
5. **Consent screen (~25 s).** Tap **Allow Calendar access**. On Google's
   consent screen, pause so the **app name "EventBetter"** and **both
   permissions** are readable ("Make secondary Google calendars, and see,
   create, change, and delete events on them" and "See the list of Google
   calendars you're subscribed to"). Tap **Allow** / **Continue**.
6. **`calendar.app.created`: create (~40 s).** Tap **+**, enter the title
   "Tuff Gym membership", a start date, repeats every 1 month, 4 occurrences.
   Show the live preview, tap **Create events**, and let the progress run
   ("Naming occurrences: 2 of 4…").
7. **Show the result in Google Calendar (~30 s).** Open the Google Calendar
   app. Show the new **EventBetter** calendar and two occurrences with
   different titles ("1st month over", "2nd month over"). Show that your other
   calendars are untouched.
8. **`calendar.app.created`: read, edit, delete (~40 s).** Back in
   EventBetter, show the list card (frequency, progress, next date). Open it,
   change the number of occurrences, tap **Save changes** and confirm. Then
   delete it from the card's trash icon and confirm; show it's gone from
   Google Calendar.
9. **`calendar.calendarlist.readonly`: recovery (~30 s).** Create one more
   event, then in Settings tap **Sign out** and sign in again (or reinstall).
   Show the list reappear: the app found its own calendar through the
   calendar list instead of creating a second one. Say: "The calendar list
   scope is only used to find EventBetter's own calendar again."
10. **Revoking access (~20 s).** Settings → Danger zone → **Disconnect Google
    account**, choose **Disconnect only**. Optionally show EventBetter gone
    from myaccount.google.com/connections.

Upload to YouTube Studio, set **Visibility: Unlisted**, and paste the link in
the verification form.

## Note to add in the submission's comments field

> EventBetter is a native Android app using Credential Manager and the
> AuthorizationClient API, so the consent screen is shown by Google Play
> services without a browser address bar. The video shows the app's OAuth
> clients in the Cloud console first, then the full in-app sign-in and
> consent flow. The app has no backend server; all Calendar requests go
> directly from the device to the Google Calendar API.
