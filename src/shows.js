// -----------------------------------------------------------------------------
// Pure functions over TVmaze answers: a show and its episodes turned into
// small plain objects, in the time zone of Gladys (TZ). The rest of the
// integration never reads a raw TVmaze object.
// -----------------------------------------------------------------------------

import { addDays, daysBetween, localDate, localTime } from './time.js';

// Status codes of the integration (frozen: scene outputs carry their labels).
export const STATUS_CODES = ['scheduled', 'running', 'tbd', 'in_development', 'ended'];
// Episodes kept behind today: the calendar shows the last two weeks.
export const PAST_DAYS = 14;
// A season is read when it holds the next episode or one of the last days.
export const MAX_SEASONS = 3;
// Used when TVmaze knows no runtime for an episode nor for its show.
const DEFAULT_RUNTIME_MIN = 30;

const pad = (number) => String(number).padStart(2, '0');

/** Lowercase, without accents nor extra blanks: "Les  Revenants" matches "les revenants". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Plain text of a TVmaze summary (simple HTML), at most `max` characters. */
export function plainText(html, max = 600) {
  const text = String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `S02E10`, or `S02 special` for an episode without a number. */
export function episodeCode(season, number) {
  const s = Number.isInteger(season) ? `S${pad(season)}` : '';
  if (Number.isInteger(number)) {
    return `${s}E${pad(number)}`;
  }
  return s ? `${s} special` : 'special';
}

/**
 * One episode, or `null` when it has no air date yet (TBA).
 * An episode without an air time (a streaming release, most often) is a
 * full-day event on its air date; a timed one lasts its runtime.
 */
export function normalizeEpisode(raw, show = {}) {
  if (!raw?.id || !/^\d{4}-\d{2}-\d{2}$/.test(raw.airdate ?? '')) {
    return null;
  }
  const stamp = Date.parse(raw.airstamp ?? '');
  const fullDay = !raw.airtime || Number.isNaN(stamp);
  const runtime = Number(raw.runtime) || Number(show.runtime) || DEFAULT_RUNTIME_MIN;
  const start = fullDay ? localTime(raw.airdate, 0) : stamp;
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    season: Number.isInteger(raw.season) ? raw.season : null,
    number: Number.isInteger(raw.number) ? raw.number : null,
    code: episodeCode(raw.season, raw.number),
    airdate: raw.airdate,
    fullDay,
    start,
    end: fullDay ? localTime(addDays(raw.airdate, 1), 0) : start + runtime * 60_000,
    // The local day of the episode: its air date when it has no time.
    day: fullDay ? raw.airdate : localDate(start),
    url: typeof raw.url === 'string' && raw.url.startsWith('https://') ? raw.url : '',
    summary: plainText(raw.summary),
  };
}

/** The integration's status code of a show. */
export function statusCode(status, hasNext) {
  if (status === 'Ended') {
    return 'ended';
  }
  if (hasNext) {
    return 'scheduled';
  }
  if (status === 'To Be Determined') {
    return 'tbd';
  }
  if (status === 'In Development') {
    return 'in_development';
  }
  return 'running';
}

/** A show (`/shows/<id>?embed[]=nextepisode&embed[]=previousepisode&embed[]=seasons`). */
export function normalizeShow(raw) {
  const embedded = raw?._embedded ?? {};
  const channel = raw?.network ?? raw?.webChannel ?? null;
  const base = {
    id: raw.id,
    name: String(raw.name ?? `#${raw.id}`).trim(),
    runtime: Number(raw.runtime ?? raw.averageRuntime) || null,
    status: String(raw.status ?? ''),
    channel: String(channel?.name ?? ''),
    country: String(channel?.country?.code ?? ''),
    year: /^\d{4}/.test(raw.premiered ?? '') ? raw.premiered.slice(0, 4) : '',
    url: typeof raw.url === 'string' ? raw.url : `https://www.tvmaze.com/shows/${raw.id}`,
    seasons: (embedded.seasons ?? [])
      .filter((season) => season?.id)
      .map((season) => ({
        id: season.id,
        number: season.number,
        premiereDate: season.premiereDate ?? null,
        endDate: season.endDate ?? null,
      })),
  };
  const next = normalizeEpisode(embedded.nextepisode, base);
  const previous = normalizeEpisode(embedded.previousepisode, base);
  return { ...base, next, previous, statusCode: statusCode(base.status, Boolean(next)) };
}

/**
 * The seasons whose episodes the calendar needs: the one of the next episode
 * and the later ones, and the one of the previous episode when it aired in
 * the last PAST_DAYS. Nothing for a show without a next episode: its
 * previous episode is already known.
 */
export function seasonsToRead(show, today) {
  if (!show.next) {
    return [];
  }
  const recent = show.previous && show.previous.day >= addDays(today, -PAST_DAYS);
  return show.seasons
    .filter(
      (season) =>
        season.number >= (show.next.season ?? Infinity) ||
        (recent && season.number === show.previous.season),
    )
    .sort((a, b) => a.number - b.number)
    .slice(0, MAX_SEASONS);
}

/** The episodes of a show, by start, without duplicates. */
export function mergeEpisodes(show, rawEpisodes) {
  const byId = new Map();
  for (const episode of [show.previous, show.next]) {
    if (episode) {
      byId.set(episode.id, episode);
    }
  }
  for (const raw of rawEpisodes) {
    const episode = normalizeEpisode(raw, show);
    if (episode) {
      byId.set(episode.id, episode);
    }
  }
  return [...byId.values()].sort((a, b) => a.start - b.start || a.id - b.id);
}

/** The next episode at `now` (one airing now included), or null. */
export function nextEpisode(episodes, now) {
  return episodes.find((episode) => episode.end > now) ?? null;
}

/** The last episode aired before `now`, or null. */
export function lastEpisode(episodes, now) {
  let last = null;
  for (const episode of episodes) {
    if (episode.end <= now) {
      last = episode;
    }
  }
  return last;
}

/** Whole days from today to the day of an episode (0 today). */
export function daysUntil(episode, now) {
  return daysBetween(localDate(now), episode.day);
}
