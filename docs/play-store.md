# Google Play: listing, forms and release

Everything to fill in Play Console for EventBetter, plus the release steps.
Answers reflect the app as built: Google sign-in, the two non-sensitive
Calendar scopes, local notifications, AdMob banner with Google's consent SDK,
and no server.

## Store listing (Grow users → Store presence → Main store listing)

**App name** (max 30):

> EventBetter

**Short description** (max 80):

> Recurring Google Calendar events where every occurrence has its own title.

**Full description** (max 4000):

> Google Calendar gives every occurrence of a recurring event the same title.
> EventBetter fixes that: it creates recurring events where each occurrence
> has its own numbered title, so you can see at a glance how far along you are.
>
> Set up "Tuff Gym membership", monthly, 12 occurrences, and your calendar shows:
> • Oct 30: Tuff Gym membership: 1st month over
> • Nov 30: Tuff Gym membership: 2nd month over
> • …
> • Sep 30: Tuff Gym membership: 12th month over
>
> Use it for memberships, habits, milestones, anniversaries or anything that
> repeats.
>
> FEATURES
> • One real recurring event in Google Calendar, so deleting it there offers "All events" like any other series
> • Title templates with placeholders: {name}, {count}, {ord} (1st, 2nd, 3rd), {elapsed}, {unit} and {units}
> • Repeat every few days, weeks, months or years; stop after a number of occurrences or on an end date
> • Month ends handled correctly: a series starting on the 31st lands on the last day of shorter months
> • Optional extra occurrence on the start date, like "Tuff Gym membership started"
> • Live preview of the first titles as you type
> • Reminders: a Google Calendar reminder plus an optional phone notification at 9:00 AM the day before
> • Edit or delete a recurring event anytime, or delete them all at once
> • Light and dark mode
>
> YOUR CALENDAR, KEPT SEPARATE
> EventBetter creates its own calendar named "EventBetter" and only creates and
> changes events there, never in your other calendars. There's no EventBetter
> server: your data goes only between your phone and Google, and your Google
> data is never used for advertising.
>
> EventBetter is free, shows one banner ad, and is open source under the MIT
> license.

**Graphics:**
- App icon: `assets/store/play-icon-512.png` (512×512)
- Feature graphic: `assets/store/feature-graphic.png` (1024×500)
- Phone screenshots: 2 to 8, taken on your phone (see "Screenshots" below)

**Category:** Productivity. **Tags:** calendar, productivity.
**Contact details:** email `support@jumppack.online`, website `https://jumppack.online/eventbetter/`.

## Screenshots

Use a production or preview build so there's no dev-menu button, and
put the phone in light mode for some and dark for one. Suggested set:

1. The recurring events list with 2 or 3 events and the progress bars
2. Google Calendar showing a few numbered occurrences
3. The add form with the live preview filled in
4. The title template guide with Examples expanded
5. Settings (Reminders and the Danger zone)
6. Dark mode list

Capture with Power + Volume down. Play accepts PNG or JPEG, 320 to 3840 px
on each side, ratio no more than 2:1.

## Policy: App content (Policy → App content)

**Privacy policy:** `https://jumppack.online/eventbetter/privacy/`

**Ads:** Yes, the app contains ads.

**App access:** "All or some functionality is restricted." Play's reviewers
can't create accounts or use their own, so add sign-in details for a
**dedicated review Google account** (create a Gmail just for this, strong
unique password, **no 2-step verification**, signed in once on a phone so new
-account security checks are cleared; optionally create one sample recurring
event in it). Enter its address and password **only in Play Console**, never in
this repo. Name: "Reviewer Google account". Any other information (under 500
characters):
> EventBetter signs in only with Google. On the device, tap Continue with
> Google and choose the account above (add it to the device in Android
> Settings > Passwords & accounts if it isn't listed). Then tap Allow Calendar
> access. The app creates its own "EventBetter" calendar in that account and
> only manages events there. The account has no 2-step verification. All
> features are free; there's no paid content.

Tick "Sign-in details … provide full access to all the features". Keep the
account and password unchanged, since every update is reviewed with it. The
OAuth app is in production, so it doesn't need to be a test user.

**Content rating:** fill in the IARC questionnaire as a **Utility,
Productivity, Communication or Other** app. Answer **No** to violence,
sexual content, profanity, drugs, gambling, user-to-user communication,
sharing location and digital purchases. Expected rating: Everyone / PEGI 3.

**Target audience and content:** **18 and over**. This keeps the app out of
Play's Families policy, which has extra ad requirements for apps aimed at
children. The app isn't designed to appeal to children.

**News app:** No. **Government app:** No. **Financial features:** none.
**Health:** none. **Advertising ID:** Yes, the app uses the advertising ID,
for **Advertising or marketing**, **Analytics** and **Fraud prevention,
security and compliance**, matching the Data safety form (the Google Mobile
Ads SDK declares the `AD_ID` permission). Play blocks sending a release for
review until this declaration is saved.

**Account deletion:** EventBetter has no accounts of its own (it uses Google
sign-in and stores nothing on a server), so if Play asks, explain that there's
no app account to delete, and point to Settings → Danger zone → Disconnect
Google account and the privacy policy's deletion section.

## Data safety (Policy → App content → Data safety)

Overview questions:
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (in-app delete and disconnect; deletion steps in the privacy policy)

Data types:

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| **Calendar → Calendar events** | Yes (sent to the user's own Google Calendar) | No | Required | App functionality |
| **Location → Approximate location** (from IP, by the ads SDK) | Yes | Yes | Required | Advertising or marketing, Analytics, Fraud prevention, security and compliance |
| **App activity → App interactions** (ads SDK) | Yes | Yes | Required | Advertising or marketing, Analytics, Fraud prevention, security and compliance |
| **App info and performance → Diagnostics** (ads SDK) | Yes | Yes | Required | Analytics, Fraud prevention, security and compliance |
| **Device or other IDs** (advertising ID, app set ID, by the ads SDK) | Yes | Yes | Required | Advertising or marketing, Analytics, Fraud prevention, security and compliance |

Notes:
- **Name, email and profile picture are not "collected":** the app gets them
  from Google sign-in and keeps them only on the phone; it never transmits them
  anywhere. If you'd rather be conservative, declare **Personal info → Name**
  and **Email address** as collected, not shared, for App functionality.
- **Calendar events** go to Google Calendar on the user's behalf (that's the
  app's whole purpose), not to the developer. They're declared to be safe.
- **Ads SDK data:** Google's
  [data disclosure guidance](https://developers.google.com/admob/android/privacy/play-data-disclosure)
  lists IP address, product interactions, diagnostics and device identifiers,
  encrypted in transit. Re-check that page when you fill in the form, since
  Google updates it with SDK releases.
- None of this data is processed "ephemerally" only, and none is collected
  for personalization by the developer.

## Releasing

1. **Build:** `npx eas-cli@latest build --profile production --platform android`
   makes a signed `.aab` with the real AdMob IDs and the version code bumped.
2. **First upload is manual.** Play's API can't create an app's first release, so
   download the `.aab` from the EAS build page and upload it in
   **Test and release → Testing → Closed testing → Create track/release**.
   Later releases can go up with `npx eas-cli@latest submit --profile production`
   (it uploads a draft to the closed-testing track) once a Google service
   account key is set up in EAS (`npx eas-cli@latest credentials`). The key is
   a secret: it lives in EAS, never in this repo.
3. **Play App Signing SHA-1.** After the first upload, Play re-signs the app.
   Copy the **App signing key certificate SHA-1** from **Test and release →
   App integrity** and add it as another **Android** OAuth client in Google
   Cloud (package `online.jumppack.eventbetter`). Without it, Google sign-in
   fails in builds installed from Play.
4. **Closed test:** add 12+ testers (an email list or Google Group), share the
   opt-in link, and make sure each tester installs the app from Play. The 14
   days count from when 12 testers are opted in.
5. **Production access:** after 14 days with 12 opted-in testers, apply on the
   Play Console dashboard. Google asks a few questions about the test.
6. **After launch:** in AdMob, link the app to its Play listing (Apps → App
   settings → Add app store details). That clears "Requires review" and starts
   real ad serving; AdMob also checks `https://jumppack.online/app-ads.txt`.
