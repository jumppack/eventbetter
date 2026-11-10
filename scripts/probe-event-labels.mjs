#!/usr/bin/env node
// Probes how the Calendar API handles the new event labels (custom colors)
// before the app relies on them. Creates a throwaway calendar, runs the
// checks below and deletes it afterwards. Reads an access token with the
// calendar.app.created scope from GOOGLE_ACCESS_TOKEN; it never prints it.
//
//   read -s GOOGLE_ACCESS_TOKEN && export GOOGLE_ACCESS_TOKEN
//   node scripts/probe-event-labels.mjs

import { randomUUID } from "node:crypto";

const BASE = process.env.GOOGLE_API_BASE ?? "https://www.googleapis.com/calendar/v3";
const token = process.env.GOOGLE_ACCESS_TOKEN;
if (!token) {
  console.error("Set GOOGLE_ACCESS_TOKEN first (see the comment at the top of this file).");
  process.exit(1);
}

async function call(method, path, { query, body } = {}) {
  const qs = query ? "?" + new URLSearchParams(query) : "";
  const res = await fetch(`${BASE}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, ok: res.ok, json };
}

const results = [];
function note(name, verdict, detail = "") {
  results.push({ name, verdict, detail });
  console.log(`[${verdict}] ${name}${detail ? ": " + detail : ""}`);
}
const fail = (r) => `HTTP ${r.status} ${JSON.stringify(r.json?.error ?? r.json)?.slice(0, 300)}`;
const labelsOf = (cal) => cal?.labelProperties?.eventLabels ?? [];
const view = (e) => ({ summary: e.summary, colorId: e.colorId, eventLabelId: e.eventLabelId });

let calendarId;
try {
  // 0. Palettes. Which palettes does /colors report, and how big are they?
  const colors = await call("GET", "/colors");
  if (colors.ok) {
    note(
      "colors endpoint",
      "INFO",
      `event palette ${Object.keys(colors.json.event ?? {}).length}, calendar palette ${Object.keys(colors.json.calendar ?? {}).length}`,
    );
  } else {
    note("colors endpoint", "INFO", fail(colors));
  }

  // 1. Throwaway calendar.
  const created = await call("POST", "/calendars", {
    body: { summary: `EventBetter label probe ${new Date().toISOString()}` },
  });
  if (!created.ok) throw new Error("Could not create the test calendar: " + fail(created));
  calendarId = created.json.id;
  note("create calendar", "OK");
  const cal = `/calendars/${encodeURIComponent(calendarId)}`;

  // 2. Read labels, with and without the version parameter.
  for (const v of [undefined, "1"]) {
    const got = await call("GET", cal, { query: v ? { eventLabelVersion: v } : undefined });
    const labels = labelsOf(got.json);
    note(
      `calendars.get${v ? " eventLabelVersion=1" : ""}`,
      got.ok ? "INFO" : "FAIL",
      got.ok
        ? `${labels.length} labels on a fresh calendar${labels.length ? ": " + labels.slice(0, 30).map((l) => `${l.id.slice(0, 8)}=${l.backgroundColor}${l.name ? "(" + l.name + ")" : ""}`).join(" ") : ""}; has labelProperties: ${"labelProperties" in (got.json ?? {})}`
        : fail(got),
    );
  }

  // 3. Add custom labels. patch replaces the whole array, so read first.
  const existing = labelsOf((await call("GET", cal, { query: { eventLabelVersion: "1" } })).json);
  const blue = { id: randomUUID(), backgroundColor: "#1e88e5", name: "probe blue" };
  const odd = { id: randomUUID(), backgroundColor: "#123abc" };
  let added = await call("PATCH", cal, {
    body: { labelProperties: { eventLabels: [...existing, blue, odd] } },
  });
  let how = "plain";
  if (!added.ok) {
    added = await call("PATCH", cal, {
      query: { eventLabelVersion: "1" },
      body: { labelProperties: { eventLabels: [...existing, blue, odd] } },
    });
    how = "eventLabelVersion=1";
  }
  note("calendars.patch adds labels (scope calendar.app.created)", added.ok ? "OK" : "FAIL", added.ok ? how : fail(added));

  const after = labelsOf((await call("GET", cal, { query: { eventLabelVersion: "1" } })).json);
  const byId = new Map(after.map((l) => [l.id, l]));
  note(
    "labels persisted, hex kept as sent",
    byId.get(blue.id)?.backgroundColor === blue.backgroundColor && byId.get(odd.id)?.backgroundColor === odd.backgroundColor
      ? "OK"
      : "FAIL",
    after.map((l) => `${l.backgroundColor}${l.name ? "(" + l.name + ")" : ""}`).join(" ") || "no labels came back",
  );
  note("existing labels kept after patch", existing.every((l) => byId.has(l.id)) ? "OK" : "FAIL", `${existing.length} before, ${after.length} after`);

  const bad = await call("PATCH", cal, {
    body: { labelProperties: { eventLabels: [...after, { id: randomUUID(), backgroundColor: "blue" }] } },
  });
  note("invalid hex is rejected", bad.ok ? "INFO" : "OK", bad.ok ? "accepted 'blue' as a hex (no validation)" : fail(bad));

  // 4. A recurring event with a label, like the app creates.
  const rrule = "RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=4";
  const start = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const next = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const master = await call("POST", `${cal}/events`, {
    query: { eventLabelVersion: "1" },
    body: { summary: "Probe series: 1st", start: { date: start }, end: { date: next }, recurrence: [rrule], eventLabelId: blue.id },
  });
  if (!master.ok) {
    note("events.insert with eventLabelId", "FAIL", fail(master));
  } else {
    note("events.insert with eventLabelId", "OK", JSON.stringify(view(master.json)));
    const eid = encodeURIComponent(master.json.id);

    // 5. Read it back with and without the version parameter.
    for (const v of [undefined, "1"]) {
      const g = await call("GET", `${cal}/events/${eid}`, { query: v ? { eventLabelVersion: v } : undefined });
      note(`events.get${v ? " eventLabelVersion=1" : ""}`, "INFO", g.ok ? JSON.stringify(view(g.json)) : fail(g));
    }

    // 6. Instances, then rename one the way the app does (summary only).
    const listInstances = (v) =>
      call("GET", `${cal}/events/${eid}/instances`, { query: v ? { eventLabelVersion: v } : undefined });
    for (const v of [undefined, "1"]) {
      const l = await listInstances(v);
      note(
        `instances${v ? " eventLabelVersion=1" : ""}`,
        "INFO",
        l.ok ? `${l.json.items.length} items, labels: ${[...new Set(l.json.items.map((i) => i.eventLabelId ?? "none"))].map((x) => x.slice(0, 8)).join(",")}` : fail(l),
      );
    }
    const inst = (await listInstances("1")).json?.items ?? [];
    const second = inst[1];
    if (second) {
      const renamed = await call("PATCH", `${cal}/events/${encodeURIComponent(second.id)}`, { body: { summary: "Probe series: 2nd" } });
      note("rename an occurrence (summary only, no version parameter)", renamed.ok ? "OK" : "FAIL", renamed.ok ? JSON.stringify(view(renamed.json)) : fail(renamed));
      const re = (await listInstances("1")).json?.items ?? [];
      const labels = re.map((i) => i.eventLabelId === blue.id);
      note("renamed occurrence keeps the series label", labels.every(Boolean) ? "OK" : "FAIL", `labelled: ${labels.map((x) => (x ? "yes" : "NO")).join(" ")}`);

      // 7. Change the label on the master only; do the renamed ones follow?
      const swap = await call("PATCH", `${cal}/events/${eid}`, {
        query: { eventLabelVersion: "1" },
        body: { eventLabelId: odd.id },
      });
      note("events.patch changes the master's label", swap.ok ? "OK" : "FAIL", swap.ok ? JSON.stringify(view(swap.json)) : fail(swap));
      const re2 = (await listInstances("1")).json?.items ?? [];
      const follow = re2.map((i) => i.eventLabelId === odd.id);
      note("a master-only label change reaches every occurrence", follow.every(Boolean) ? "OK" : "FAIL", `following: ${follow.map((x) => (x ? "yes" : "NO")).join(" ")}`);

      // 8. Removing the label.
      const clear = await call("PATCH", `${cal}/events/${eid}`, { query: { eventLabelVersion: "1" }, body: { eventLabelId: "" } });
      note("empty eventLabelId clears it", clear.ok && !clear.json.eventLabelId ? "OK" : "FAIL", clear.ok ? JSON.stringify(view(clear.json)) : fail(clear));
    }
  }

  // 9. The classic colorId, as the fallback.
  const classic = await call("POST", `${cal}/events`, {
    body: { summary: "Probe classic color", start: { date: start }, end: { date: next }, colorId: "9" },
  });
  note("classic colorId still works", classic.ok && classic.json.colorId === "9" ? "OK" : "FAIL", classic.ok ? JSON.stringify(view(classic.json)) : fail(classic));
  const ignored = await call("POST", `${cal}/events`, {
    query: { eventLabelVersion: "1" },
    body: { summary: "Probe colorId with version 1", start: { date: start }, end: { date: next }, colorId: "9" },
  });
  note("colorId is ignored when eventLabelVersion=1", "INFO", ignored.ok ? JSON.stringify(view(ignored.json)) : fail(ignored));
} catch (e) {
  note("probe aborted", "FAIL", e.message);
} finally {
  if (calendarId) {
    const del = await call("DELETE", `/calendars/${encodeURIComponent(calendarId)}`);
    console.log(del.ok || del.status === 204 ? "Test calendar deleted." : "Could not delete the test calendar: " + fail(del));
  }
}

console.log("\nSUMMARY");
for (const r of results) console.log(`${r.verdict.padEnd(4)} ${r.name}`);
