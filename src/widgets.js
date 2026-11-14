// -----------------------------------------------------------------------------
// Dashboard widget "TV shows": the coming episodes of the shared calendars,
// then where each followed show stands (next episode in N days, ended, no
// date). Shared calendars only: a dashboard is seen by the whole household.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXT, formatWhen, pick, relativeDay } from './i18n.js';
import { showStatus } from './scenes.js';
import { daysUntil, fold } from './shows.js';

export const SHOWS_WIDGET = 'upcoming_episodes';
export const WIDGET_DAYS = ['7', '14', '31'];
const MAX_ITEMS = 8;
const MAX_ROWS = 10;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The show titles of the `shows` setting, folded. */
export function parseShowFilter(setting) {
  return String(setting ?? '')
    .split(/[,;\n]/)
    .map(fold)
    .filter(Boolean);
}

/**
 * The widget content.
 * @param {import('./syncer.js').Syncer} syncer
 * @param {{ settings?: object, language?: string, now: number }} request
 */
export function showsContent(syncer, { settings = {}, language = 'en', now }) {
  const text = pick(TEXT, language);
  if (!syncer.ready) {
    return {
      ttl_seconds: 30,
      components: [{ type: 'text', variant: 'caption', text: text.loading }],
    };
  }
  const wanted = parseShowFilter(settings.shows);
  const shows = syncer
    .sharedShows()
    .filter((entry) => wanted.length === 0 || wanted.includes(fold(entry.show.name)));
  if (shows.length === 0) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: text.noShared }],
    };
  }

  const components = [];
  const days = Number(WIDGET_DAYS.includes(String(settings.days)) ? settings.days : '14');
  const items = shows
    .flatMap(({ show, episodes }) =>
      episodes
        .filter((episode) => episode.end > now && daysUntil(episode, now) < days)
        .map((episode) => ({ show, episode })),
    )
    .sort((a, b) => a.episode.start - b.episode.start)
    .slice(0, MAX_ITEMS);
  if (items.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: text.nothing });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: items.map(({ show, episode }) => {
        const left = daysUntil(episode, now);
        return {
          title: truncate(show.name, 60),
          subtitle: truncate(
            [episode.code, formatWhen(episode, language), show.channel].filter(Boolean).join(' · '),
            60,
          ),
          ...(left <= 1
            ? {
                badge: {
                  text: relativeDay(left, language),
                  color: left <= 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.INFO,
                },
              }
            : {}),
        };
      }),
    });
  }

  if (settings.show_status !== false) {
    components.push({
      type: 'status',
      items: shows
        .map((entry) => showStatus(entry, language, now))
        .sort((a, b) => (a.next?.start ?? Infinity) - (b.next?.start ?? Infinity))
        .slice(0, MAX_ROWS)
        .map((status) => ({
          label: truncate(status.show, 40),
          value: truncate(
            status.next ? relativeDay(status.days_left, language) : status.status,
            40,
          ),
          icon: status.next ? 'calendar' : status.statusCode === 'ended' ? 'check-circle' : 'clock',
          color: status.next
            ? status.days_left <= 1
              ? WIDGET_COLORS.SUCCESS
              : WIDGET_COLORS.INFO
            : WIDGET_COLORS.NEUTRAL,
        })),
    });
  }
  return { ttl_seconds: 900, components };
}
