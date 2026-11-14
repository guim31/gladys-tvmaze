// -----------------------------------------------------------------------------
// Scene triggers, the scene action and the widget, on the shared calendars.
// The Simpsons S38E07 airs Monday 16 November 2026 at 01:30 UTC, 02:30 in
// Paris (fixtures).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { account, createWorld, fakeTvMaze, fixture } from './helpers/world.js';
import { TRIGGERS } from '../src/scenes.js';
import { SHOWS_WIDGET } from '../src/widgets.js';

async function sharedWorld(options = {}) {
  const world = await createWorld({
    accounts: [account('alice', '#83, #169, Severance')],
    ...options,
  });
  await world.share('alice');
  return world;
}

const at = (iso) => Date.parse(iso);

test('"episode today" fires in the morning and at the air time, once each', async () => {
  const world = await sharedWorld();
  world.clock.now = at('2026-11-16T01:30:20Z');
  assert.equal(await world.app.tick(), 1);
  world.clock.now = at('2026-11-16T01:31:00Z');
  assert.equal(await world.app.tick(), 0, 'once');
  world.clock.now = at('2026-11-16T08:00:10Z'); // 09:00 in Paris
  assert.equal(await world.app.tick(), 1);
  const events = world.fake.sceneEvents;
  assert.deepEqual(
    events.map((event) => [event.key, event.data.moment]),
    [
      [TRIGGERS.EPISODE_TODAY, 'air_time'],
      [TRIGGERS.EPISODE_TODAY, 'morning'],
    ],
  );
  assert.deepEqual(events[1].data, {
    show: 'The Simpsons',
    episode: 'Dream Scenari-Moe',
    code: 'S38E07',
    season: 38,
    number: 7,
    channel: 'FOX',
    date: 'lun. 16 nov., 02:30',
    time: '02:30',
    moment: 'morning',
    users: 'Alice',
  });
});

test('a restart after the moment fires nothing, a private calendar neither', async () => {
  const late = await sharedWorld({ now: at('2026-11-16T08:20:00Z') });
  assert.equal(await late.app.tick(), 0);
  const world = await createWorld({ accounts: [account('alice', '#83')] });
  world.clock.now = at('2026-11-16T08:00:10Z');
  assert.equal(await world.app.tick(), 0, 'not shared');
});

test('"episode announced" fires when a show without a date gets one', async () => {
  const show = fixture('show-44933');
  const api = fakeTvMaze({ '/shows/44933': () => show });
  const world = await sharedWorld({ api });
  assert.equal(world.fake.sceneEvents.length, 0, 'the first reading announces nothing');
  show._embedded.nextepisode = {
    ...show._embedded.previousepisode,
    id: 9_000_001,
    name: 'Season 3 premiere',
    season: 3,
    number: 1,
    airdate: '2026-11-20',
    airtime: '',
    airstamp: '2026-11-20T12:00:00+00:00',
  };
  world.clock.now += 6 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  const [event] = world.fake.sceneEvents;
  assert.equal(event.key, TRIGGERS.EPISODE_ANNOUNCED);
  assert.equal(event.data.show, 'Severance');
  assert.equal(event.data.code, 'S03E01');
  assert.equal(event.data.days_left, 5);
  assert.equal(event.data.time, '');
  assert.ok(world.eventsOf('alice').some((entry) => entry.name.startsWith('Severance S03E01')));
});

test('"next episode": a show by its title, or the soonest of all', async () => {
  const world = await sharedWorld();
  const run = async (fields) => (await world.fake.sceneAction('next_episode', fields)).data.outputs;
  assert.deepEqual(await run({}), {
    found: 1,
    show: 'The Simpsons',
    episode: 'Dream Scenari-Moe',
    code: 'S38E07',
    date: 'lun. 16 nov., 02:30',
    days_left: 2,
    channel: 'FOX',
    status: 'Prochain épisode daté',
    last_episode: 'S38E06 · The Kosmic Kruiser · lun. 9 nov., 02:30',
  });
  const ended = await run({ show: 'breaking bad' });
  assert.equal(ended.found, 1);
  assert.equal(ended.days_left, -1);
  assert.equal(ended.status, 'Terminée');
  assert.match(ended.last_episode, /El Camino/);
  assert.equal((await run({ show: 'sever' })).status, 'En cours, sans date');
  assert.equal((await run({ show: 'Lost' })).found, 0);
});

test('the widget lists the coming episodes and where each show stands', async () => {
  const world = await sharedWorld();
  const get = async (settings, language = 'en') =>
    (await world.fake.widgetGet(SHOWS_WIDGET, { settings, language, units: 'metric' })).data
      .content;
  const content = await get({ days: '14' });
  assert.deepEqual(validateWidgetContent(content), []);
  const [list, status] = content.components;
  assert.deepEqual(
    list.items.map((item) => item.subtitle),
    ['S38E07 · Mon 16 Nov, 02:30 · FOX', 'S38E08 · Mon 23 Nov, 02:00 · FOX'],
  );
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['The Simpsons', 'In 2 days'],
      ['Breaking Bad', 'Ended'],
      ['Severance', 'Running, no date yet'],
    ],
  );
  const short = await get({ show_status: false, shows: 'Severance' });
  assert.deepEqual(validateWidgetContent(short), []);
  assert.deepEqual(short.components, [
    { type: 'text', variant: 'caption', text: 'No episode in this period.' },
  ]);
  world.clock.now = Date.parse('2026-11-15T23:30:00Z'); // Monday 00:30 in Paris
  const today = await get({ show_status: false }, 'fr');
  assert.deepEqual(today.components[0].items[0].badge, { text: "Aujourd'hui", color: 'success' });
});

test('the widget says when nothing is shared', async () => {
  const world = await createWorld({ accounts: [account('alice', '#83')] });
  const ack = await world.fake.widgetGet(SHOWS_WIDGET, { settings: {}, language: 'de' });
  assert.match(ack.data.content.components[0].text, /Kein geteilter Serienkalender/);
});
