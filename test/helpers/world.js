// -----------------------------------------------------------------------------
// A test world: the SDK's fake Gladys (which checks the calendar contract like
// the core: enabled users, `sync: false` → 403, window overlap, prune),
// TVmaze replayed from real answers recorded on 14 November 2026
// (test/fixtures), a settable clock and no timers. Times are read in
// Europe/Paris, the TZ the supervisor injects for a French instance.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.TZ = 'Europe/Paris';

// Saturday 14 November 2026, 21:00 in Paris, when the fixtures were recorded.
export const NOW = Date.parse('2026-11-14T20:00:00.000Z');

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));

/**
 * TVmaze from the fixtures: `routes` maps a path (without the query of the
 * show embeds) to a body, a status number or a function returning either.
 * `fail: true` makes every call throw, like a network down.
 */
export function fakeTvMaze(extra = {}) {
  const routes = {
    '/shows/83': fixture('show-83'),
    '/shows/169': fixture('show-169'),
    '/shows/526': fixture('show-526'),
    '/shows/44933': fixture('show-44933'),
    '/seasons/201386/episodes': fixture('season-201386-episodes'),
    // Severance season 3: listed, not dated, no episode yet (14 November 2026).
    '/seasons/183341/episodes': [],
    '/search/shows?q=the%20office': fixture('search-the-office'),
    '/search/shows?q=The%20Office': fixture('search-the-office'),
    '/search/shows?q=Severance': fixture('search-severance'),
    '/search/shows?q=severance': fixture('search-severance'),
    ...extra,
  };
  const api = {
    calls: [],
    fail: false,
    routes,
    async fetch(url) {
      const path = url.replace('https://api.tvmaze.com', '').replace(/\?embed.*$/, '');
      api.calls.push(path);
      if (api.fail) {
        throw new Error('getaddrinfo EAI_AGAIN api.tvmaze.com');
      }
      let body = Object.hasOwn(routes, path)
        ? routes[path]
        : path.startsWith('/search/')
          ? []
          : 404;
      if (typeof body === 'function') {
        body = body();
      }
      const status = typeof body === 'number' ? body : 200;
      return {
        status,
        ok: status >= 200 && status < 300,
        headers: new Map(),
        json: async () => structuredClone(body),
      };
    },
  };
  return api;
}

export function account(selector, shows, language = 'fr') {
  const firstName = selector[0].toUpperCase() + selector.slice(1);
  return { user: { selector, first_name: firstName, language }, config: { shows } };
}

/**
 * @param {object} [options]
 * @param {object[]} [options.accounts] calendar accounts
 * @param {object} [options.config] admin config
 * @param {object[]} [options.calendars] calendars already in Gladys
 * @param {number} [options.now]
 * @param {ReturnType<typeof fakeTvMaze>} [options.api]
 */
export async function createWorld(options = {}) {
  const clock = { now: options.now ?? NOW };
  const api = options.api ?? fakeTvMaze();
  const gladys = createFakeGladys({
    config: options.config ?? {},
    calendarAccounts: options.accounts ?? [],
    calendars: options.calendars ?? [],
    logger: options.logger,
  });
  const app = registerHandlers(gladys, {
    now: () => clock.now,
    sleep: async () => {},
    fetch: api.fetch,
    timers: false,
  });
  await gladys.connect();
  await app.idle();
  return {
    gladys,
    fake: gladys.fake,
    app,
    api,
    clock,
    calendarOf(selector) {
      return gladys.fake.calendars.find((calendar) => calendar.user === selector);
    },
    eventsOf(selector) {
      const calendar = gladys.fake.calendars.find((entry) => entry.user === selector);
      return gladys.fake.calendarEvents
        .filter((event) => event.calendar_external_id === calendar?.external_id)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    },
    /** The user shares their calendar (the toggle of "My calendars"). */
    async share(selector, shared = true) {
      const calendar = gladys.fake.calendars.find((entry) => entry.user === selector);
      calendar.shared = shared;
      await gladys.fake.calendarAccountUpdated(selector);
      await app.idle();
    },
    async editAccount(selector, shows) {
      const entry = gladys.fake.calendarAccounts.find((a) => a.user.selector === selector);
      entry.config = { shows };
      await gladys.fake.calendarAccountUpdated(selector);
      await app.idle();
    },
  };
}
