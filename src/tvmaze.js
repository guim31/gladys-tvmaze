// -----------------------------------------------------------------------------
// TVmaze (https://www.tvmaze.com/api): public, no account, no key for reading.
// Its limit is 20 calls every 10 seconds per IP address (HTTP 429 beyond):
// the client spaces its calls by 600 ms (17 per 10 s at most) and, on a 429,
// waits and tries again. The responses are cached by the catalog
// (src/catalog.js): each show is read again every few hours.
//
// The data (summaries, images) are licensed CC BY-SA by TVmaze: the
// documentation credits it, and so does every calendar description.
// -----------------------------------------------------------------------------

export const API_BASE = 'https://api.tvmaze.com';
const REQUEST_TIMEOUT_MS = 15_000;
export const MIN_SPACING_MS = 600;
const RETRY_429_MS = 10_000;
const MAX_429_RETRIES = 2;
const USER_AGENT = 'gladys-tvmaze (+https://github.com/guim31/gladys-tvmaze)';

export class TvMazeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'TvMazeError';
    this.status = status;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the global fetch by default (tests inject one)
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 */
export function createTvMaze({
  fetch = globalThis.fetch,
  sleep = defaultSleep,
  now = Date.now,
} = {}) {
  let last = -Infinity;
  // One call at a time: the spacing holds even when two users sync at once.
  let queue = Promise.resolve();

  async function call(path) {
    for (let attempt = 0; ; attempt += 1) {
      const wait = last + MIN_SPACING_MS - now();
      if (wait > 0) {
        await sleep(wait);
      }
      last = now();
      let response;
      try {
        response = await fetch(`${API_BASE}${path}`, {
          headers: { accept: 'application/json', 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new TvMazeError(`TVmaze unreachable: ${err?.message ?? err}`);
      }
      if (response.status === 429 && attempt < MAX_429_RETRIES) {
        const after = Number(response.headers?.get?.('retry-after'));
        await sleep(after > 0 && after <= 60 ? after * 1000 : RETRY_429_MS);
        continue;
      }
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        const reason = response.status === 429 ? ' (rate limited)' : '';
        throw new TvMazeError(`TVmaze answered HTTP ${response.status}${reason}`, response.status);
      }
      try {
        return await response.json();
      } catch {
        throw new TvMazeError('TVmaze sent something that is not JSON');
      }
    }
  }

  /** GET a path of the API: the parsed JSON, `null` on a 404. */
  function get(path) {
    const run = queue.then(
      () => call(path),
      () => call(path),
    );
    queue = run.catch(() => {});
    return run;
  }

  return {
    get,
    /** `[{ score, show }]`, best first (TVmaze's fuzzy search, 10 results at most). */
    async search(query) {
      const list = await get(`/search/shows?q=${encodeURIComponent(query)}`);
      return Array.isArray(list) ? list.filter((entry) => entry?.show?.id) : [];
    },
    /** A show with its next and previous episodes and its seasons, or `null`. */
    show(id) {
      return get(
        `/shows/${Number(id)}?embed[]=nextepisode&embed[]=previousepisode&embed[]=seasons`,
      );
    },
    /** The episodes of a season (specials included). */
    async seasonEpisodes(seasonId) {
      const list = await get(`/seasons/${Number(seasonId)}/episodes`);
      return Array.isArray(list) ? list : [];
    },
  };
}
