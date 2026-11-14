# TVmaze for Gladys Assistant

The upcoming episodes of your TV shows in [Gladys Assistant](https://gladysassistant.com), from
[TVmaze](https://www.tvmaze.com), a free TV guide with a public API: no account, no key. Every member of
the household lists the shows they follow; their episodes fill a "TV shows" calendar, the dashboard and the
scenes.

This is an **external integration** of type `calendar` (Gladys 5.2.0 or later): it runs in its own
sandboxed container and pushes calendars and events into the core calendar store, per user. It reads
`api.tvmaze.com` (`transports: cloud`).

> Developed without a real Gladys instance: tested against the real TVmaze API (a running show with dates,
> an ended show, a show without a date, an ambiguous title), with the SDK's fake Gladys, and in its Docker
> image under the Gladys sandbox constraints. Feedback welcome on the Gladys forum or in the issues.

## Features

- **Per user**: every member enables the integration in **My calendars** and lists their shows by title,
  TVmaze id (`#526`) or TVmaze address. Up to 25 shows each.
- **A "TV shows" calendar**: every episode from two weeks back to a year ahead, with season and episode
  number, title, channel or platform, and summary. Episodes without an air time (streaming) are full-day
  events. The calendar description says which show each title matched and lists the other shows with the
  same title (The Office, US or UK).
- **Scene triggers**: "Episode today" (in the morning or at the air time, filter by show) and "New episode
  announced" (a show without a next episode gets one: a new season dated).
- **Scene action** "Read the next episode": next episode, days left, status of the show, last episode aired.
- **Dashboard widget** "Upcoming episodes": the coming episodes, then where each show stands.
- **Administrator actions**: "Check" (read TVmaze again now) and "Search a show" (top matches with ids).
- Four languages (English, French, German, Spanish): the calendars follow the language of their owner.

## Requirements

- Gladys Assistant **5.2.0 or later** (calendar integrations).
- Internet access to `api.tvmaze.com`.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-tvmaze`.
2. Each user opens **Integrations → TVmaze**, lists their shows in **My calendars** and clicks **Enable**.
3. Share the calendar in the list under the form to see it on the dashboard and use it in scenes.

The user documentation, in [English](docs/en.md), [French](docs/fr.md), [German](docs/de.md) and
[Spanish](docs/es.md), details every field, trigger and example.

## Limits

- Air times are those of the original channel (converted to the time zone of Gladys); local rebroadcasts
  are not covered.
- Refreshed every 6 hours and when a list changes; TVmaze's limit of 20 calls every 10 seconds is respected
  (calls spaced by 600 ms, each show read once whoever follows it).
- Scenes and the widget only see **shared** calendars, like the calendar scenes of Gladys.
- An "Episode today" moment that passes while the integration is stopped fires no scene.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests replay real TVmaze answers recorded on 14 November 2026 (`test/fixtures`) against the SDK's fake
Gladys (`@gladysassistant/integration-sdk/testing`), in the `Europe/Paris` time zone, with an injectable
clock: they never touch the network. See [`CLAUDE.md`](CLAUDE.md) for the architecture and the rules of the
repository. Releases go through **Actions → Release**, which bumps the version, rolls
[`CHANGELOG.md`](CHANGELOG.md) and builds the multi-arch image on `ghcr.io`.

## Credits

- Show and episode data from [TVmaze](https://www.tvmaze.com/api), licensed
  [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). The TVmaze logo on the cover belongs to
  TVmaze.
- Built on the official [Gladys integration template](https://github.com/GladysAssistant/integration-template-js)
  and [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js) (Apache-2.0).
- Requested in Pierre-Gilles' list of integrations to bring to the Gladys store (TVmaze, upcoming episodes).

Not affiliated with TVmaze.

## License

[Apache-2.0](LICENSE)
