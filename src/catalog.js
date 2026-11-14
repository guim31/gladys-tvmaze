// -----------------------------------------------------------------------------
// The shows followed by the household, read from TVmaze and kept in memory.
// A show followed by several users is read once. Each show is read again
// after REFRESH_MS (a few calls per show, spaced by the client): 20 shows
// cost about 40 calls every 6 hours, far below the 20 calls / 10 s limit.
//
// Titles typed by the users are resolved by the TVmaze search, best score
// first, and remembered for a week: a resolution never moves on its own
// from one refresh to the next.
// -----------------------------------------------------------------------------

import { localDate } from './time.js';
import { fold, mergeEpisodes, nextEpisode, normalizeShow, seasonsToRead } from './shows.js';

export const REFRESH_MS = 6 * 3_600_000;
// A show read during the previous refresh (a sync takes minutes) is due at
// this one, not six hours later.
const FRESH_MS = REFRESH_MS - 30 * 60_000;
// A show TVmaze answers 404 for, while it was known: dropped at the third
// answer in a row, never on a single one.
const MISSING_LIMIT = 3;
// The gap after the last known episode that makes a new one an announcement.
const BREAK_MS = 14 * 86_400_000;
const SEARCH_TTL_MS = 7 * 86_400_000;
// After a failed reading, a show is not asked again before this delay.
const FAILURE_BACKOFF_MS = 10 * 60_000;

/** A search result, small. */
export function summarize(show) {
  const channel = show?.network ?? show?.webChannel ?? null;
  return {
    id: show.id,
    name: String(show.name ?? `#${show.id}`),
    year: /^\d{4}/.test(show.premiered ?? '') ? show.premiered.slice(0, 4) : '',
    country: String(channel?.country?.code ?? ''),
    channel: String(channel?.name ?? ''),
  };
}

export class Catalog {
  /**
   * @param {object} options
   * @param {ReturnType<import('./tvmaze.js').createTvMaze>} options.client
   * @param {() => number} options.now
   */
  constructor({ client, now }) {
    this.client = client;
    this.now = now;
    /** show id → { show, episodes, fetchedAt } */
    this.shows = new Map();
    /** show id → time of the last failed reading */
    this.failedAt = new Map();
    /** folded title → { match, others, at } */
    this.searches = new Map();
    /** shows that had no next episode and now have one: [{ show, episode }] */
    this.announced = [];
  }

  /** The top results of a title search (the admin "Search" action). */
  async search(query, limit = 5) {
    const results = await this.client.search(query);
    return results.slice(0, limit).map((entry) => summarize(entry.show));
  }

  /**
   * One entry of a user's list resolved to a show id.
   * @returns {Promise<{ id: number, others?: object[] } | { notFound: true }>}
   */
  async resolve(entry) {
    if (entry.id) {
      return { id: entry.id };
    }
    const key = fold(entry.query);
    const cached = this.searches.get(key);
    if (cached && this.now() - cached.at < SEARCH_TTL_MS) {
      return cached.match ? { id: cached.match.id, others: cached.others } : { notFound: true };
    }
    const results = (await this.client.search(entry.query)).map((r) => summarize(r.show));
    const [match] = results;
    // Shows under the very same title (The Office, US and UK): the users
    // are told, and pick one by its id.
    const others = match
      ? results.slice(1).filter((other) => fold(other.name) === fold(match.name))
      : [];
    this.searches.set(key, { match: match ?? null, others: others.slice(0, 3), at: this.now() });
    return match ? { id: match.id, others: others.slice(0, 3) } : { notFound: true };
  }

  /**
   * A show and its episodes, from the cache when fresh enough.
   * @returns {Promise<{ show: object, episodes: object[], fetchedAt: number } | null>} null: no
   *   such show on TVmaze. Throws when TVmaze cannot be read and nothing is cached.
   */
  async load(id, { force = false } = {}) {
    const cached = this.shows.get(id);
    const now = this.now();
    if (cached && !force && now - cached.fetchedAt < FRESH_MS) {
      return cached;
    }
    if (cached && !force && now - (this.failedAt.get(id) ?? -Infinity) < FAILURE_BACKOFF_MS) {
      return cached;
    }
    try {
      const raw = await this.client.show(id);
      if (!raw?.id) {
        if (cached && (cached.missing ?? 0) + 1 < MISSING_LIMIT) {
          cached.missing = (cached.missing ?? 0) + 1;
          this.failedAt.set(id, now);
          return cached;
        }
        this.shows.delete(id);
        return null;
      }
      const show = normalizeShow(raw);
      const rawEpisodes = [];
      for (const season of seasonsToRead(show, localDate(now))) {
        rawEpisodes.push(...(await this.client.seasonEpisodes(season.id)));
      }
      const entry = { show, episodes: mergeEpisodes(show, rawEpisodes), fetchedAt: now };
      // A show back on the schedule (a renewal dated, a season announced):
      // it had no next episode at the last reading, or none left and the new
      // one comes after a break. A show dated one episode at a time (daily
      // shows) is not announced at every episode.
      const lastKnown = cached?.episodes.at(-1);
      const back =
        cached &&
        show.next &&
        show.next.end > now &&
        (!cached.show.next ||
          (!nextEpisode(cached.episodes, now) &&
            (!lastKnown || show.next.start - lastKnown.end >= BREAK_MS)));
      if (back) {
        this.announced.push({ show, episode: show.next });
      }
      this.shows.set(id, entry);
      this.failedAt.delete(id);
      return entry;
    } catch (err) {
      this.failedAt.set(id, now);
      if (cached) {
        return cached;
      }
      throw err;
    }
  }

  /** The announcements since the last call. */
  takeAnnounced() {
    const list = this.announced;
    this.announced = [];
    return list;
  }

  /** Forgets the shows nobody follows any more. */
  keepOnly(ids) {
    for (const id of this.shows.keys()) {
      if (!ids.has(id)) {
        this.shows.delete(id);
        this.failedAt.delete(id);
      }
    }
  }
}
