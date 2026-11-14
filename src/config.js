// -----------------------------------------------------------------------------
// Settings. The admin `config_schema` holds what applies to everyone (the
// language of the scene texts); each user's `account_schema` holds the shows
// they follow, one text field. Defaults mirror the manifest
// (test/manifest.test.js).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
// A user follows this many shows at most: the rest of the list is ignored
// (and said so in the description of their calendar).
export const MAX_SHOWS = 25;
export const SHOWS_KEY = 'shows';

export const DEFAULT_CONFIG = {
  language: 'fr',
};

/** The admin settings, with defaults for anything missing or unknown. */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG };
  if (LANGUAGES.includes(raw?.language)) {
    config.language = raw.language;
  }
  return config;
}

/** A supported language, else the fallback. */
export function languageOf(value, fallback = DEFAULT_CONFIG.language) {
  const short = String(value ?? '')
    .slice(0, 2)
    .toLowerCase();
  return LANGUAGES.includes(short) ? short : fallback;
}

/**
 * The shows of one user's account text: titles, TVmaze ids (`44933`,
 * `#44933`) or TVmaze addresses, separated by commas, semicolons or lines.
 * Duplicates are dropped.
 * @returns {{ entries: ({ id: number, raw: string } | { query: string, raw: string })[], dropped: number }}
 */
export function parseShowList(text) {
  const seen = new Set();
  const entries = [];
  for (const part of String(text ?? '').split(/[,;\n]/)) {
    const raw = part.trim();
    if (!raw) {
      continue;
    }
    const byId = raw.match(/^#?(\d{1,8})$/) ?? raw.match(/tvmaze\.com\/shows\/(\d{1,8})/i);
    const entry = byId
      ? { id: Number(byId[1]), raw }
      : { query: raw.replace(/\s+/g, ' ').slice(0, 100), raw };
    const key = entry.id ? `#${entry.id}` : entry.query.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(entry);
    }
  }
  return { entries: entries.slice(0, MAX_SHOWS), dropped: Math.max(0, entries.length - MAX_SHOWS) };
}
