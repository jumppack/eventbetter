const CalendarRepository = {
  // ---- calendars (CalendarApp) ----

  find(name) {
    if (!name) return CalendarApp.getDefaultCalendar();
    return CalendarApp.getCalendarsByName(name)[0] || null;
  },

  getOrCreate(name) {
    return this.find(name) || CalendarApp.createCalendar(name);
  },

  // ---- recurring series (Advanced Calendar service) ----

  findSeriesByKey(calendarId, key) {
    return this.listSeries_(calendarId, `subscriptionKey=${key}`)[0] || null;
  },

  findSeriesByName(calendarId, name) {
    return this.listSeries_(calendarId, `subscriptionName=${name}`);
  },

  createSeries(calendarId, { title, description, date, rrule, key, name }) {
    return Calendar.Events.insert(
      {
        summary: title,
        description,
        start: { date: Schedule.toDateString(date) },
        end: { date: Schedule.toDateString(Schedule.addDays(date, 1)) },
        recurrence: [rrule],
        extendedProperties: {
          private: { subscriptionKey: key, subscriptionName: name },
        },
      },
      calendarId,
    );
  },

  listInstances(calendarId, seriesId) {
    const items = [];
    let pageToken;
    do {
      const res = Calendar.Events.instances(calendarId, seriesId, {
        maxResults: 250,
        pageToken,
      });
      items.push(...(res.items || []));
      pageToken = res.nextPageToken;
    } while (pageToken);
    return items;
  },

  renameInstance(calendarId, instanceId, { title, description }) {
    Calendar.Events.patch(
      { summary: title, description },
      calendarId,
      instanceId,
    );
    Utilities.sleep(Config.WRITE_DELAY_MS);
  },

  deleteSeries(calendarId, seriesId) {
    Calendar.Events.remove(calendarId, seriesId);
  },

  // ---- legacy: individual events created by the old version ----

  deleteByPrefix(cal, prefix, from, to) {
    const events = cal
      .getEvents(from, to)
      .filter((e) => e.getTitle().startsWith(prefix));
    events.forEach((e) => {
      e.deleteEvent();
      Utilities.sleep(Config.WRITE_DELAY_MS);
    });
    return events.length;
  },

  listSeries_(calendarId, property) {
    const res = Calendar.Events.list(calendarId, {
      privateExtendedProperty: property,
      maxResults: 250,
    });
    // renamed occurrences inherit the tag, so keep only the series itself
    return (res.items || []).filter((e) => !e.recurringEventId);
  },
};
