const SubscriptionService = {
  create(input) {
    const sub = this.normalize(input);
    const unit = Config.UNITS[sub.frequency];
    const calendarId = CalendarRepository.getOrCreate(sub.calendar).getId();
    const key = this.keyFor(sub);

    const existing = CalendarRepository.findSeriesByKey(calendarId, key);
    if (existing) {
      const count = CalendarRepository.listInstances(
        calendarId,
        existing.id,
      ).length;
      return { name: sub.name, created: 0, skipped: count };
    }

    const occurrences = Schedule.occurrences(sub);
    const texts = occurrences.map(({ n }) =>
      this.buildText(sub, unit, n, sub.title),
    );
    let firstDate = occurrences.length ? occurrences[0].date : null;

    if (sub.startTitle) {
      texts.unshift(this.buildText(sub, unit, 0, sub.startTitle));
      firstDate = Schedule.parseDate(sub.start);
    }

    if (!texts.length)
      throw new Error("No events fall between the start and end dates");

    const series = CalendarRepository.createSeries(calendarId, {
      ...texts[0],
      date: firstDate,
      rrule: Schedule.rrule({ ...sub, count: texts.length }),
      key,
      name: sub.name,
    });

    const instances = CalendarRepository.listInstances(calendarId, series.id);
    if (instances.length !== texts.length) {
      Logger.log(
        `Expected ${texts.length} occurrences, Google created ${instances.length}`,
      );
    }

    // the first occurrence already carries the series title
    instances.slice(1).forEach((instance, i) => {
      const text = texts[i + 1];
      if (text)
        CalendarRepository.renameInstance(calendarId, instance.id, text);
    });

    return { name: sub.name, created: instances.length, skipped: 0 };
  },

  remove(name, calendarName) {
    const cal = CalendarRepository.find(calendarName);
    if (!cal) throw new Error(`Calendar "${calendarName}" not found`);

    const series = CalendarRepository.findSeriesByName(cal.getId(), name);
    series.forEach((s) => CalendarRepository.deleteSeries(cal.getId(), s.id));
    return { name, deleted: series.length };
  },

  // for events created by the old one-event-per-occurrence version
  removeLegacy(prefix, calendarName, from = "2000-01-01", to = "2100-01-01") {
    const cal = CalendarRepository.find(calendarName);
    if (!cal) throw new Error(`Calendar "${calendarName}" not found`);

    const deleted = CalendarRepository.deleteByPrefix(
      cal,
      prefix,
      Schedule.parseDate(from),
      Schedule.parseDate(to),
    );
    return { prefix, deleted };
  },

  keyFor(sub) {
    return [sub.name, sub.start, sub.frequency, sub.interval].join("|");
  },

  buildText(sub, unit, n, template) {
    const vars = Template.vars(sub.name, n, sub.interval, unit);
    return {
      title: Template.fill(template, vars),
      description: Template.fill(sub.description, vars),
    };
  },

  normalize(input) {
    // drop empty fields so they fall back to defaults instead of overriding them
    const provided = Object.fromEntries(
      Object.entries(input).filter(
        ([, v]) => v !== undefined && v !== "" && !Number.isNaN(v),
      ),
    );
    const sub = { ...Config.DEFAULTS, ...provided };

    if (!sub.name) throw new Error("Title is required");
    if (!sub.start) throw new Error("Start date is required");
    if (!Config.UNITS[sub.frequency])
      throw new Error(`Unknown frequency: ${sub.frequency}`);
    if (sub.interval < 1) throw new Error("Repeat every must be at least 1");
    if (sub.maxCount < 1)
      throw new Error("Number of events must be at least 1");
    if (
      sub.end &&
      Schedule.parseDate(sub.end) < Schedule.parseDate(sub.start)
    ) {
      throw new Error("End date is before start date");
    }
    return sub;
  },
};
