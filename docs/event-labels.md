# Event labels (custom colors) in the Calendar API

Google's expanded event colors (announced June 2026) are exposed through the
Calendar API as **event labels**. This records what was checked, before the app
relied on it, by `scripts/probe-event-labels.mjs` on 2026-11-10 against a
personal Google account with the scope `calendar.app.created`.

Docs: the [Calendar resource](https://developers.google.com/workspace/calendar/api/v3/reference/calendars)
(`labelProperties`), the [Event resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
(`eventLabelId`) and [events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
(`eventLabelVersion`).

## Verified

- `GET /colors` still returns 11 event colors (classic `colorId`) and 24 calendar colors. The 24 colors in Calendar's own picker are not that list.
- A **fresh calendar already holds 24 default labels** (unnamed, UUID ids, a hex each): `#ef6c00 #7cb342 #039be5 #e67c73 #f6bf26 #f4511e #a79b8e #33b679 #7986cb #8e24aa #e4c441 #3f51b5 #c0ca33 #795548 #0b8043 #009688 #ad1457 #616161 #f09300 #b39ddb #9e69af #d81b60 #d50000 #4285f4`.
- `calendars.get` returns `labelProperties.eventLabels` with or without `eventLabelVersion=1`.
- `calendars.patch` with `labelProperties.eventLabels` works under `calendar.app.created`. It replaces the whole array: sending the 24 back plus 2 new ones gave 26.
- Any valid hex is stored as sent (`#123abc` stayed). An invalid one is rejected with HTTP 400 ("must be a valid RGB color in the hexadecimal format").
- `events.insert` with `eventLabelId` and `eventLabelVersion=1` works. `events.get` and `events.instances` return `eventLabelId` without any parameter.
- Renaming one occurrence (summary only, no version parameter) leaves its label in place.
- Patching the **master's** `eventLabelId` changes every occurrence, renamed ones included.
- An empty `eventLabelId` clears the label.
- The classic `colorId` still works without the version parameter, and Google linked `colorId: 9` to the label `#3f51b5` (Blueberry) by itself. With `eventLabelVersion=1`, `colorId` is ignored.

## Not verified

- Whether a calendar created before the feature (the app's own, from September) has the 24 default labels. The app looks colors up by hex and adds what's missing, so it doesn't depend on it.
- How Calendar draws a label (text color, dark mode). Check in the Google Calendar app.
- What an account without the feature returns. The app detects support by behavior; see Color in `CLAUDE.md`.
- The classic `colorId` to hex mapping beyond id 9.

## Running the probe again

Use a short-lived token from [Google's OAuth Playground](https://developers.google.com/oauthplayground/)
with the scope `https://www.googleapis.com/auth/calendar.app.created`. Copy the
access token, then run this so it never appears on screen, and copy something
else afterwards:

```bash
GOOGLE_ACCESS_TOKEN="$(pbpaste)" node scripts/probe-event-labels.mjs
```

It creates a throwaway calendar, runs the checks and deletes the calendar.
