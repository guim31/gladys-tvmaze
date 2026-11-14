// -----------------------------------------------------------------------------
// Synchronization: for every user who enabled the integration, one Gladys
// calendar, "TV shows", filled with the episodes of the shows they follow
// over a sliding window (two weeks back, a year ahead). Every publication
// carries the window, so the core prunes what is no longer there (a show
// removed from the list, an episode moved by the channel).
//
// Identifiers: the calendar is `<user>:shows`, an episode
// `<user>:episode-<TVmaze episode id>`, both under the integration prefix.
// Republishing the same window is a no-op upsert.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SHOWS_KEY, languageOf, parseShowList } from './config.js';
import { TEXT, pick } from './i18n.js';
import { PAST_DAYS } from './shows.js';
import { addDays, localDate, localTime } from './time.js';

const logger = createLogger({ name: 'sync' });

// The core takes 500 events per request, and a window is one request.
export const MAX_EVENTS = 500;
// Days of the window ahead of today.
export const FUTURE_DAYS = 366;
// TVmaze's green.
export const COLOR = '#3c948b';
const MAX_DESCRIPTION = 500;

/** A short reason for the logs, never a secret (there is none here). */
export const describe = (err) => err?.message ?? String(err);

/**
 * Write limiter: the core accepts 30 calendar writes per minute per
 * integration (429 beyond). Keeps a margin, waits when the minute is full.
 */
export function createLimiter({ now = Date.now, sleep, perMinute = 25 } = {}) {
  const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const stamps = [];
  return async function limit() {
    for (;;) {
      const t = now();
      while (stamps.length > 0 && stamps[0] <= t - 60_000) {
        stamps.shift();
      }
      if (stamps.length < perMinute) {
        stamps.push(t);
        return;
      }
      await wait(stamps[0] + 60_000 - t);
    }
  };
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** `The Office (2005, NBC, #526)` */
export function showLabel(show) {
  const details = [show.year, show.channel, `#${show.id}`].filter(Boolean).join(', ');
  return `${show.name} (${details})`;
}

/** The description of a user's calendar: what is followed, what went wrong. */
export function calendarDescription(user, language) {
  const text = pick(TEXT, language);
  const lines = [];
  if (user.shows.length === 0 && user.notFound.length === 0 && user.unavailable.length === 0) {
    lines.push(text.none);
  }
  if (user.shows.length > 0) {
    lines.push(`${text.following} ${user.shows.map(({ show }) => showLabel(show)).join(', ')}.`);
  }
  for (const { show, others } of user.shows) {
    if (others?.length > 0) {
      const list = others.map((other) => showLabel(other)).join(', ');
      lines.push(`${text.sameTitle(show.name)} ${list}.`);
    }
  }
  if (user.notFound.length > 0) {
    lines.push(`${text.notFound} ${user.notFound.join(', ')}.`);
  }
  if (user.unavailable.length > 0) {
    lines.push(`${text.unavailable} ${user.unavailable.join(', ')}.`);
  }
  if (user.dropped > 0) {
    lines.push(`${text.tooMany(user.dropped)}.`);
  }
  if (user.truncated > 0) {
    lines.push(`${text.truncated(user.truncated)}.`);
  }
  const credit = text.credit;
  return `${truncate(lines.join('\n'), MAX_DESCRIPTION - credit.length - 1)}\n${credit}`;
}

/** The name of an episode event: `Severance S02E10 · Cold Harbor`. */
export function eventName(show, episode) {
  const title = episode.name && episode.name !== show.name ? ` · ${episode.name}` : '';
  return truncate(`${show.name} ${episode.code}${title}`, 200);
}

export class Syncer {
  /**
   * @param {object} options
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
   * @param {import('./catalog.js').Catalog} options.catalog
   * @param {() => object} options.getConfig normalized admin settings
   * @param {() => number} options.now
   * @param {() => Promise<void>} [options.limit] write limiter
   */
  constructor({ gladys, catalog, getConfig, now, limit }) {
    this.gladys = gladys;
    this.catalog = catalog;
    this.getConfig = getConfig;
    this.now = now;
    this.limit = limit ?? (async () => {});
    /** userSelector → { selector, name, language, shows, notFound, unavailable, shared, sync } */
    this.users = new Map();
    this.ready = false;
    this.running = Promise.resolve();
  }

  /** Runs the synchronizations one after the other. */
  queue(task) {
    const run = this.running.then(task, task);
    this.running = run.catch(() => {});
    return run;
  }

  /** Every enabled user, re-read from the core (the resync contract). */
  syncAll({ force = false } = {}) {
    return this.queue(async () => {
      // "Check" reads each show once, however many users follow it.
      const forced = force ? new Set() : null;
      const accounts = await this.gladys.getCalendarAccounts();
      const calendars = await this.gladys.getCalendars();
      const enabled = new Set(accounts.map((account) => account.user.selector));
      for (const selector of this.users.keys()) {
        if (!enabled.has(selector)) {
          this.users.delete(selector);
        }
      }
      const failures = [];
      for (const account of accounts) {
        const own = calendars.filter((calendar) => calendar.user === account.user.selector);
        try {
          await this.syncAccount(account, own, { forced });
        } catch (err) {
          failures.push(`${account.user.selector}: ${describe(err)}`);
        }
      }
      this.catalog.keepOnly(this.followedIds());
      this.ready = true;
      if (failures.length > 0) {
        throw new Error(failures.join('; '));
      }
      return accounts.length;
    });
  }

  /** One user, after they enabled, disabled or changed their account. */
  syncUser(selector) {
    return this.queue(async () => {
      const account = (await this.gladys.getCalendarAccounts()).find(
        (entry) => entry.user.selector === selector,
      );
      if (!account) {
        // Disabled: the core already destroyed their calendar.
        this.users.delete(selector);
        this.catalog.keepOnly(this.followedIds());
        return false;
      }
      await this.syncAccount(account, await this.gladys.getCalendars(selector));
      this.catalog.keepOnly(this.followedIds());
      return true;
    });
  }

  followedIds() {
    return new Set(
      [...this.users.values()].flatMap((user) => user.shows.map(({ show }) => show.id)),
    );
  }

  calendarId(selector) {
    return this.gladys.externalId(`${selector}:shows`);
  }

  async syncAccount(account, existing, { forced = null } = {}) {
    const { selector } = account.user;
    const language = languageOf(account.user.language, this.getConfig().language);
    const { entries, dropped } = parseShowList(account.config?.[SHOWS_KEY]);

    const shows = [];
    const notFound = [];
    const unavailable = [];
    const seen = new Set();
    for (const entry of entries) {
      try {
        const resolved = await this.catalog.resolve(entry);
        if (resolved.notFound) {
          notFound.push(entry.raw);
          continue;
        }
        const force = forced !== null && !forced.has(resolved.id);
        forced?.add(resolved.id);
        const data = await this.catalog.load(resolved.id, { force });
        if (!data) {
          notFound.push(entry.raw);
        } else if (!seen.has(data.show.id)) {
          seen.add(data.show.id);
          shows.push({ ...data, others: resolved.others ?? [] });
        }
      } catch (err) {
        logger.debug(`${selector}: "${entry.raw}" not read: ${describe(err)}`);
        unavailable.push(entry.raw);
      }
    }
    const user = {
      selector,
      name: account.user.first_name || selector,
      language,
      shows,
      notFound,
      unavailable,
      dropped,
    };

    const today = localDate(this.now());
    const from = localTime(addDays(today, -PAST_DAYS), 0);
    let to = localTime(addDays(today, FUTURE_DAYS), 0);
    let list = shows
      .flatMap(({ show, episodes }) =>
        episodes
          .filter((episode) => episode.end > from && episode.start < to)
          .map((episode) => ({ show, episode })),
      )
      .sort((a, b) => a.episode.start - b.episode.start || a.episode.id - b.episode.id);
    // One request per window, 500 events at most: the latest ones are left
    // out (daily shows only), and the description says how many.
    user.truncated = Math.max(0, list.length - MAX_EVENTS);
    if (user.truncated > 0) {
      list = list.slice(0, MAX_EVENTS);
      to = list[list.length - 1].episode.start + 1;
    }

    const calendarId = this.calendarId(selector);
    await this.limit();
    await this.gladys.publishCalendars(selector, [
      {
        external_id: calendarId,
        name: pick(TEXT, language).calendar,
        description: calendarDescription(user, language),
        color: COLOR,
      },
    ]);
    // Only one calendar per user: anything else under the prefix is a leftover.
    for (const calendar of existing) {
      if (calendar.external_id !== calendarId) {
        await this.limit();
        await this.gladys.deleteCalendar(calendar.external_id);
      }
    }

    const flags = existing.find((calendar) => calendar.external_id === calendarId);
    user.shared = flags?.shared === true;
    user.sync = flags?.sync !== false;
    this.users.set(selector, user);

    // A show TVmaze could not give (and never gave): publishing the window
    // without its episodes would delete them. The previous content stays
    // until the next try.
    if (unavailable.length > 0) {
      throw new Error(`TVmaze unreachable for ${unavailable.length} show(s)`);
    }
    if (!user.sync) {
      // `sync: false` is the user saying no: the core would answer 403.
      return;
    }
    await this.limit();
    try {
      await this.gladys.publishCalendarEvents(
        calendarId,
        list.map(({ show, episode }) => ({
          external_id: this.gladys.externalId(`${selector}:episode-${episode.id}`),
          name: eventName(show, episode),
          ...(episode.fullDay
            ? { start: episode.airdate, full_day: true }
            : {
                start: new Date(episode.start).toISOString(),
                end: new Date(episode.end).toISOString(),
              }),
          ...(show.channel ? { location: truncate(show.channel, 500) } : {}),
          description: truncate(
            [episode.summary, pick(TEXT, language).credit].filter(Boolean).join('\n\n'),
            1000,
          ),
          ...(episode.url ? { url: episode.url } : {}),
        })),
        { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      );
    } catch (err) {
      // Switched off (403) or account disabled (404) since the list was
      // read: the user's notification follows.
      if (err?.status === 403 || err?.status === 404) {
        user.sync = false;
        return;
      }
      throw err;
    }
    logger.debug(`${selector}: ${shows.length} show(s), ${list.length} episode(s) published`);
  }

  /**
   * The shows of the shared calendars: the ones the household sees, the
   * only ones the scenes and the dashboard use (like the core's calendar
   * scenes). A show followed by several users appears once, with their names.
   * @returns {{ show: object, episodes: object[], followers: string[] }[]}
   */
  sharedShows() {
    const byId = new Map();
    for (const user of this.users.values()) {
      if (!user.shared || !user.sync) {
        continue;
      }
      for (const { show, episodes } of user.shows) {
        const entry = byId.get(show.id) ?? { show, episodes, followers: [] };
        entry.followers.push(user.name);
        byId.set(show.id, entry);
      }
    }
    return [...byId.values()];
  }
}
