// -----------------------------------------------------------------------------
// Scene triggers and action (manifest `scene_triggers` / `scene_actions`).
//
// The core already offers "an event is coming" on any shared calendar, which
// the "TV shows" calendars feed. What the integration adds, with the show,
// the episode code and the channel as variables:
//
//   - trigger `episode_today`: a followed show has an episode today, fired
//     in the morning (MORNING_MINUTES) or at its air time, the `moment`
//     filter choosing. With a "Send a message" action, the users chosen in
//     the scene are told the day it airs;
//   - trigger `episode_announced`: a show that had no next episode gets one
//     (a new season dated, a show back from a break);
//   - action `next_episode`: the next episode of a show (or of all of them),
//     with the days left and the status of the show. `found` and
//     `days_left` are numbers: the core's "condition on variables"
//     compares strictly.
//
// Like the core's calendar scenes, only SHARED calendars are involved: a
// scene is household business, a private calendar stays private.
// -----------------------------------------------------------------------------

import { STATUS_TEXT, formatTime, formatWhen, pick } from './i18n.js';
import { daysUntil, fold, lastEpisode, nextEpisode } from './shows.js';
import { localDate, localTime } from './time.js';

export const TRIGGERS = {
  EPISODE_TODAY: 'episode_today',
  EPISODE_ANNOUNCED: 'episode_announced',
};
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);
export const MOMENTS = ['morning', 'air_time'];
// "This morning": 09:00 local. Also the air time of an episode released
// without a time (streaming).
export const MORNING_MINUTES = 9 * 60;
// A moment is reported within this delay of its time, never later: a restart
// hours later fires nothing.
export const FRESH_MS = 5 * 60_000;

/** `S02E10 · Cold Harbor · ven. 20 nov.` */
function episodeLine(episode, language) {
  return [episode.code, episode.name, formatWhen(episode, language)].filter(Boolean).join(' · ');
}

/** The variables shared by the triggers. */
function episodeData(show, episode, language) {
  return {
    show: show.name,
    episode: episode.name,
    code: episode.code,
    season: episode.season ?? 0,
    number: episode.number ?? 0,
    channel: show.channel,
    date: formatWhen(episode, language),
    time: formatTime(episode),
  };
}

/** When a moment of an episode falls. */
export function momentTime(episode, moment) {
  if (moment === 'air_time' && !episode.fullDay) {
    return episode.start;
  }
  return localTime(episode.day, MORNING_MINUTES);
}

/**
 * Watches the episodes of the shared shows and reports their moments of the
 * day. Each (episode, moment) fires once.
 */
export class AirWatcher {
  constructor() {
    /** `<episode id>:<moment>` → time of the moment */
    this.fired = new Map();
  }

  /**
   * @param {ReturnType<import('./syncer.js').Syncer['sharedShows']>} shows
   * @returns {{ key: string, data: object }[]}
   */
  look(shows, language, now) {
    const events = [];
    const today = localDate(now);
    for (const { show, episodes, followers } of shows) {
      for (const episode of episodes) {
        if (episode.day !== today) {
          continue;
        }
        for (const moment of MOMENTS) {
          const key = `${episode.id}:${moment}`;
          const at = momentTime(episode, moment);
          if (this.fired.has(key) || at > now || now - at > FRESH_MS) {
            continue;
          }
          this.fired.set(key, at);
          events.push({
            key: TRIGGERS.EPISODE_TODAY,
            data: { ...episodeData(show, episode, language), moment, users: followers.join(', ') },
          });
        }
      }
    }
    for (const [key, at] of this.fired) {
      if (now - at > 2 * 86_400_000) {
        this.fired.delete(key);
      }
    }
    return events;
  }
}

/** The scene event of a show back on the schedule. */
export function announcedEvent(show, episode, followers, language, now) {
  return {
    key: TRIGGERS.EPISODE_ANNOUNCED,
    data: {
      ...episodeData(show, episode, language),
      days_left: daysUntil(episode, now),
      users: followers.join(', '),
    },
  };
}

/** The shared show a scene asks for: same title, else a title starting with it. */
export function findShow(shows, title) {
  const wanted = fold(title);
  return (
    shows.find((entry) => fold(entry.show.name) === wanted) ??
    shows.find((entry) => fold(entry.show.name).startsWith(wanted))
  );
}

const EMPTY_STATUS = {
  found: 0,
  show: '',
  episode: '',
  code: '',
  date: '',
  days_left: -1,
  channel: '',
  status: '',
  last_episode: '',
};

/** Where a show stands at `now`, for the `next_episode` action and the widget. */
export function showStatus({ show, episodes }, language, now) {
  const next = nextEpisode(episodes, now);
  const last = lastEpisode(episodes, now);
  const code = next ? 'scheduled' : show.statusCode === 'scheduled' ? 'running' : show.statusCode;
  return {
    found: 1,
    show: show.name,
    episode: next?.name ?? '',
    code: next?.code ?? '',
    date: next ? formatWhen(next, language) : '',
    days_left: next ? Math.max(0, daysUntil(next, now)) : -1,
    channel: show.channel,
    status: pick(STATUS_TEXT, language)[code],
    last_episode: last ? episodeLine(last, language) : '',
    statusCode: code,
    next,
  };
}

export const SCENE_ACTIONS = {
  /**
   * @param {{ syncer: import('./syncer.js').Syncer, config: object, now: number }} context
   * @param {{ show?: string }} fields
   */
  async next_episode({ syncer, config, now }, fields = {}) {
    const shows = syncer.sharedShows();
    let entry;
    if (fold(fields.show)) {
      entry = findShow(shows, fields.show);
    } else {
      // No show named: the soonest next episode of all.
      entry = shows
        .map((candidate) => ({ candidate, next: nextEpisode(candidate.episodes, now) }))
        .filter(({ next }) => next)
        .sort((a, b) => a.next.start - b.next.start)[0]?.candidate;
    }
    if (!entry) {
      return { ...EMPTY_STATUS };
    }
    // eslint-disable-next-line no-unused-vars
    const { statusCode, next, ...status } = showStatus(entry, config.language, now);
    return status;
  },
};
