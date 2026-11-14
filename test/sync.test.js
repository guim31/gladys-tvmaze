// -----------------------------------------------------------------------------
// The calendars: one per enabled user, filled with the episodes of their
// shows from the real TVmaze answers of the fixtures (a running show with
// dates, an ended one, a running one without a date, an ambiguous title).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOW, account, createWorld, fakeTvMaze, fixture } from './helpers/world.js';
import { parseShowList } from '../src/config.js';
import { createTvMaze } from '../src/tvmaze.js';

const LIST =
  '#83, https://www.tvmaze.com/shows/169/breaking-bad, Severance, The Office, zzz unknown';

test('a user gets a "TV shows" calendar with the episodes of the window', async () => {
  const world = await createWorld({ accounts: [account('alice', LIST)] });
  const calendar = world.calendarOf('alice');
  assert.equal(calendar.external_id, 'ext:test-integration:alice:shows');
  assert.equal(calendar.name, 'Séries TV');
  assert.equal(calendar.shared, false, 'private until the user shares it');
  const events = world.eventsOf('alice');
  // The Simpsons, season 38: two weeks back (from 31 October) to the season finale.
  assert.deepEqual(
    events.map((event) => event.name.split(' · ')[0]),
    ['S38E05', 'S38E06', 'S38E07', 'S38E08', 'S38E09', 'S38E10'].map((c) => `The Simpsons ${c}`),
  );
  assert.deepEqual(events[2], {
    calendar_external_id: calendar.external_id,
    external_id: 'ext:test-integration:alice:episode-3792162',
    name: 'The Simpsons S38E07 · Dream Scenari-Moe',
    start: '2026-11-16T01:30:00.000Z',
    end: '2026-11-16T02:00:00.000Z',
    location: 'FOX',
    description: events[2].description,
    url: 'https://www.tvmaze.com/episodes/3792162/the-simpsons-38x07-dream-scenari-moe',
  });
  assert.match(events[2].description, /TVmaze\.com \(CC BY-SA\)$/);
});

test('the calendar description says what was matched, and what was not', async () => {
  const world = await createWorld({ accounts: [account('alice', LIST, 'en')] });
  const { description } = world.calendarOf('alice');
  assert.match(description, /^Followed: The Simpsons \(1989, FOX, #83\), Breaking Bad/);
  assert.match(description, /Severance \(2022, Apple TV, #44933\)/);
  // The ambiguous title: the best match, and the other shows of that title.
  assert.match(description, /The Office \(2005, NBC, #526\)/);
  assert.match(description, /Same title as "The Office": The Office \(2001, BBC Two, #1292\)/);
  assert.match(description, /Not found on TVmaze: zzz unknown\./);
  assert.ok(description.length <= 500);
  assert.equal(world.calendarOf('alice').name, 'TV shows', 'the language of the user');
});

test('an episode without an air time is a full-day event on its air date', async () => {
  const show = fixture('show-44933');
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
  const api = fakeTvMaze({ '/shows/44933': show });
  const world = await createWorld({ accounts: [account('bob', 'Severance')], api });
  const [event] = world.eventsOf('bob');
  assert.equal(event.name, 'Severance S03E01 · Season 3 premiere');
  assert.equal(event.start, '2026-11-20');
  assert.equal(event.full_day, true);
  assert.equal(event.end, undefined);
  assert.equal(event.location, 'Apple TV');
});

test('a show followed by two users is read once', async () => {
  const world = await createWorld({
    accounts: [account('alice', '#83'), account('bob', 'https://www.tvmaze.com/shows/83')],
  });
  assert.deepEqual(world.api.calls, ['/shows/83', '/seasons/201386/episodes']);
  assert.equal(world.eventsOf('alice').length, 6);
  assert.equal(world.eventsOf('bob').length, 6);
  assert.notEqual(world.eventsOf('alice')[0].external_id, world.eventsOf('bob')[0].external_id);
});

test('TVmaze is read again after six hours, not before', async () => {
  const world = await createWorld({ accounts: [account('alice', '#83')] });
  world.clock.now += 3 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(world.api.calls.length, 2);
  world.clock.now += 3 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(world.api.calls.length, 4);
});

test('a show removed from the list leaves the calendar', async () => {
  const world = await createWorld({ accounts: [account('alice', '#83, #169')] });
  assert.equal(world.eventsOf('alice').length, 6);
  await world.editAccount('alice', '#169');
  assert.equal(world.eventsOf('alice').length, 0);
  assert.match(world.calendarOf('alice').description, /Breaking Bad/);
  assert.doesNotMatch(world.calendarOf('alice').description, /Simpsons/);
});

test('TVmaze unreachable: the events stay, the calendar says so, the sync is retried', async () => {
  const api = fakeTvMaze();
  const world = await createWorld({ accounts: [account('alice', '#83')], api });
  assert.equal(world.eventsOf('alice').length, 6);
  // A new show cannot be read: nothing is pruned.
  api.fail = true;
  await world.editAccount('alice', '#83, #169');
  assert.equal(world.eventsOf('alice').length, 6);
  assert.match(world.calendarOf('alice').description, /TVmaze injoignable.*#169/);
  // The cached show survives an outage at its refresh.
  world.clock.now += 7 * 3_600_000;
  await world.editAccount('alice', '#83');
  assert.equal(world.eventsOf('alice').length, 6);
  api.fail = false;
  world.clock.now += 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  assert.doesNotMatch(world.calendarOf('alice').description, /injoignable/);
});

test('a calendar switched off is not written, a disabled user is forgotten', async () => {
  const world = await createWorld({ accounts: [account('alice', '#83')] });
  world.calendarOf('alice').sync = false;
  world.fake.calendarEvents.length = 0;
  await world.fake.calendarAccountUpdated('alice');
  await world.app.idle();
  assert.equal(world.eventsOf('alice').length, 0);
  world.fake.calendarAccounts.length = 0;
  world.fake.calendars.length = 0;
  await world.fake.calendarAccountUpdated('alice');
  await world.app.idle();
  assert.equal(world.app.syncer.users.size, 0);
  assert.equal(world.app.catalog.shows.size, 0, 'nobody follows #83 any more');
});

test('an empty list publishes an empty calendar that says what to do', async () => {
  const world = await createWorld({ accounts: [account('alice', '')] });
  assert.match(world.calendarOf('alice').description, /^Aucune série/);
  assert.equal(world.api.calls.length, 0);
});

test('the list accepts titles, ids and addresses, without duplicates, 25 at most', () => {
  assert.deepEqual(parseShowList(' Severance ;#83\nhttps://www.tvmaze.com/shows/83/x, 169,, '), {
    entries: [
      { query: 'Severance', raw: 'Severance' },
      { id: 83, raw: '#83' },
      { id: 169, raw: '169' },
    ],
    dropped: 0,
  });
  const many = Array.from({ length: 30 }, (_, i) => `#${i + 1}`).join(',');
  assert.equal(parseShowList(many).entries.length, 25);
  assert.equal(parseShowList(many).dropped, 5);
});

test('the TVmaze client spaces its calls and waits on a 429', async () => {
  let clock = NOW;
  const slept = [];
  let answers = [429, 200];
  const client = createTvMaze({
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    fetch: async () => {
      const status = answers.shift() ?? 200;
      return { status, ok: status === 200, headers: new Map(), json: async () => [] };
    },
  });
  await client.search('x');
  assert.deepEqual(slept, [10_000], 'a 429 waits 10 s, then tries again');
  await client.search('y');
  assert.deepEqual(slept, [10_000, 600], 'calls are 600 ms apart');
  answers = [404];
  assert.equal(await client.show(1), null);
  answers = [429, 429, 429];
  await assert.rejects(client.search('z'), /HTTP 429 \(rate limited\)/);
});
