// -----------------------------------------------------------------------------
// Wiring between the Gladys SDK and the shows: the handlers, the refresh of
// TVmaze every few hours, the daily slide of the window and the watcher of
// the air days. Takes the SDK client as a parameter so the tests drive it
// with the SDK's fake Gladys and a replayed TVmaze.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { Catalog, REFRESH_MS } from './catalog.js';
import { normalizeConfig } from './config.js';
import { TEXT, allLanguages, pick } from './i18n.js';
import { AirWatcher, SCENE_ACTIONS, announcedEvent } from './scenes.js';
import { Syncer, createLimiter, describe, showLabel } from './syncer.js';
import { addDays, localDate, localTime } from './time.js';
import { createTvMaze } from './tvmaze.js';
import { SHOWS_WIDGET, showsContent } from './widgets.js';

const logger = createLogger({ name: 'app' });

export const CHECK_ACTION = 'check';
export const SEARCH_ACTION = 'search';
// The watcher looks every 30 s: a scene fires within half a minute.
export const TICK_MS = 30_000;
// The window slides once a day, a few minutes after local midnight.
const DAILY_AT_MINUTES = 5;
// A failed synchronization (TVmaze or the core unreachable, a 429) is
// retried after a minute, then twice as late each time, up to an hour.
const RETRY_MIN_MS = 60_000;
const RETRY_MAX_MS = 60 * 60_000;

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [deps] test seams
 * @param {() => number} [deps.now]
 * @param {boolean} [deps.timers] false: no timers (tests drive `tick()` and `refresh()`)
 * @param {(ms: number) => Promise<void>} [deps.sleep] for the limiters
 * @param {Function} [deps.fetch] for the TVmaze client
 */
export function registerHandlers(gladys, deps = {}) {
  const now = deps.now ?? Date.now;
  const useTimers = deps.timers !== false;
  let config = normalizeConfig();
  let tickTimer = null;
  let dailyTimer = null;
  let refreshTimer = null;
  let stopped = false;
  let pending = Promise.resolve();
  let failing = false;
  let retryTimer = null;
  let retryMs = RETRY_MIN_MS;

  const client = createTvMaze({ fetch: deps.fetch, sleep: deps.sleep, now });
  const catalog = new Catalog({ client, now });
  const syncer = new Syncer({
    gladys,
    catalog,
    getConfig: () => config,
    now,
    limit: createLimiter({ now, sleep: deps.sleep }),
  });
  const watcher = new AirWatcher();

  const refreshWidget = () => gladys.requestWidgetRefresh(SHOWS_WIDGET);

  async function publishAnnouncements() {
    const shared = new Map(syncer.sharedShows().map((entry) => [entry.show.id, entry]));
    for (const { show, episode } of catalog.takeAnnounced()) {
      const entry = shared.get(show.id);
      if (!entry) {
        continue;
      }
      const event = announcedEvent(show, episode, entry.followers, config.language, now());
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        logger.info(`New episode announced for ${show.name}`);
      } catch (err) {
        logger.warn(`Scene trigger ${event.key} not sent: ${describe(err)}`);
      }
    }
  }

  // A synchronization failing again and again: one line, not one per try.
  // Only a full synchronization ends a failure: one user's success says
  // nothing of the others, whose retry stays scheduled.
  async function run(label, fn, { full = true } = {}) {
    try {
      const result = await fn();
      if (full) {
        if (failing) {
          failing = false;
          logger.info('Synchronization works again');
        }
        clearTimeout(retryTimer);
        retryTimer = null;
        retryMs = RETRY_MIN_MS;
      }
      return result;
    } catch (err) {
      if (!failing) {
        failing = true;
        logger.error(`${label} failed: ${describe(err)}`);
      } else {
        logger.debug(`${label} failed again: ${describe(err)}`);
      }
      scheduleRetry();
      return undefined;
    } finally {
      await publishAnnouncements();
      refreshWidget();
    }
  }

  // Every user is re-read on a retry: whatever failed is redone.
  function scheduleRetry() {
    if (!useTimers || stopped || retryTimer) {
      return;
    }
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (gladys.connected !== false) {
        await run('Synchronization', () => syncer.syncAll());
      }
    }, retryMs);
    retryTimer.unref?.();
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  async function tick() {
    if (!syncer.ready) {
      return 0;
    }
    const events = watcher.look(syncer.sharedShows(), config.language, now());
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Scene trigger ${event.key} not sent: ${describe(err)}`);
      }
    }
    if (events.length > 0) {
      logger.debug(`${events.length} air time(s) sent to the scenes`);
    }
    return events.length;
  }

  function scheduleDaily() {
    clearTimeout(dailyTimer);
    if (!useTimers || stopped) {
      return;
    }
    const next = localTime(addDays(localDate(now()), 1), DAILY_AT_MINUTES);
    dailyTimer = setTimeout(
      async () => {
        if (gladys.connected !== false) {
          await run('Daily slide', () => syncer.syncAll());
        }
        scheduleDaily();
      },
      Math.max(60_000, next - now()),
    );
    dailyTimer.unref?.();
  }

  function startTimers() {
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
    if (!useTimers || stopped) {
      return;
    }
    tickTimer = setInterval(() => {
      tick().catch((err) => logger.warn(`Air time check failed: ${describe(err)}`));
    }, TICK_MS);
    tickTimer.unref?.();
    // The catalog reads again the shows older than REFRESH_MS.
    refreshTimer = setInterval(() => {
      pending = run('Refresh', () => syncer.syncAll());
    }, REFRESH_MS);
    refreshTimer.unref?.();
  }

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
    } catch (err) {
      logger.error(`Could not read the configuration: ${describe(err)}`);
    }
    // The resync contract of the calendar type: an account enabled or a
    // calendar switched back on while disconnected is only known by
    // re-reading everything.
    pending = run('Synchronization', () => syncer.syncAll()).then(() => tick());
    scheduleDaily();
    startTimers();
  });

  gladys.on('disconnected', () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    clearTimeout(dailyTimer);
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
  });

  gladys.onConfigUpdated(async (newConfig) => {
    config = normalizeConfig(newConfig);
    logger.info('Configuration updated');
  });

  gladys.onCalendarAccountUpdated(async (userSelector) => {
    logger.info(`Shows of ${userSelector} updated`);
    pending = run('Synchronization', () => syncer.syncUser(userSelector), { full: false }).then(
      () => tick(),
    );
  });

  gladys.onAction(CHECK_ACTION, async () => {
    logger.info('Action "check": reading TVmaze again');
    try {
      await syncer.syncAll({ force: true });
    } catch (err) {
      logger.warn(`Check failed: ${describe(err)}`);
      return allLanguages((language) => pick(TEXT, language).checkFailed);
    } finally {
      await publishAnnouncements();
      refreshWidget();
    }
    const shows = new Map();
    for (const user of syncer.users.values()) {
      for (const entry of user.shows) {
        shows.set(entry.show.id, entry);
      }
    }
    const upcoming = [...shows.values()].reduce(
      (count, { episodes }) => count + episodes.filter((episode) => episode.end > now()).length,
      0,
    );
    return allLanguages((language) => pick(TEXT, language).check(shows.size, upcoming));
  });

  gladys.onAction(SEARCH_ACTION, async (fields = {}) => {
    const query = String(fields.query ?? '')
      .trim()
      .slice(0, 100);
    if (!query) {
      return allLanguages((language) => pick(TEXT, language).searchMissing);
    }
    logger.info('Action "search"');
    let results;
    try {
      results = await catalog.search(query, 3);
    } catch (err) {
      logger.warn(`Search failed: ${describe(err)}`);
      return allLanguages((language) => pick(TEXT, language).checkFailed);
    }
    if (results.length === 0) {
      return allLanguages((language) => pick(TEXT, language).searchEmpty(query));
    }
    const list = results.map((show) => showLabel(show)).join(' · ');
    return allLanguages((language) => {
      const text = pick(TEXT, language).searchFound(list);
      return text.length > 200 ? `${text.slice(0, 199)}…` : text;
    });
  });

  gladys.onSceneAction('next_episode', (fields) =>
    SCENE_ACTIONS.next_episode({ syncer, config, now: now() }, fields),
  );

  gladys.onWidgetGet(SHOWS_WIDGET, async ({ settings, language }) =>
    showsContent(syncer, { settings, language, now: now() }),
  );

  return {
    syncer,
    catalog,
    tick,
    /** A refresh, as the timer does it (tests). */
    refresh: () => (pending = run('Refresh', () => syncer.syncAll())),
    /** Resolves once the synchronization in progress is over (tests). */
    idle: async () => {
      await pending;
      await syncer.running;
    },
    async stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(dailyTimer);
      clearInterval(tickTimer);
      clearInterval(refreshTimer);
    },
  };
}
