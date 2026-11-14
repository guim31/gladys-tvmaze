# TVmaze

The upcoming episodes of your TV shows in Gladys, from [TVmaze](https://www.tvmaze.com), a free TV
guide: a calendar per user, a dashboard widget and scene triggers. No account, no API key.

This integration is not affiliated with TVmaze. It was tested against the real TVmaze API and the
test double of Gladys, not yet on a real Gladys instance: feedback welcome on the forum or on GitHub.

## What you get

- **A "TV shows" calendar per user**, in the Gladys calendar: every episode of the shows you follow,
  from two weeks back to one year ahead, with its season and episode number (S02E10), its title,
  its channel or platform (FOX, Apple TV, Netflix…) as the location, and its summary. An episode with
  an air time lasts its runtime; an episode released without a time (streaming, most often) is a
  full-day event.
- **A dashboard widget**, "Upcoming episodes": the coming episodes, then where each show stands (next
  episode in 3 days, ended, running without a date).
- **Two scene triggers**: an episode of a followed show airs today (in the morning or at its air time),
  and a new episode is announced for a show that had none.
- **A scene action**, "Read the next episode": the next episode of a show, the days left and the
  status of the show.

The calendar view, the dashboard calendar and the built-in "calendar event is coming" trigger of Gladys
also work with these calendars once they are shared.

## Configuration

**Each user** enables the integration on its page, under "My calendars", and lists the shows they
follow in **Shows followed**, separated by commas:

- a **title**: `Severance`, `The Simpsons`. The best TVmaze match is taken;
- a **TVmaze id**: `#526` (or `526`);
- a **TVmaze address**: `https://www.tvmaze.com/shows/526/the-office`.

The description of your calendar says which show each title matched (year, channel, id), the titles
TVmaze does not know, and the other shows with the same title: "The Office" matches the American
series of 2005 (#526), and the British one of 2001 is #1292. To pick another one, write its id instead
of the title. 25 shows at most per user.

The calendar is **private** at first. **Share** it (the toggle under "My calendars") to see it on the
dashboard and to use it in scenes: like every Gladys calendar, only shared calendars reach the scenes,
and a shared calendar is visible to the whole household.

The **administrator** chooses the language of the dates and statuses passed to the scenes. Calendar
names and descriptions follow the language of each user.

## Actions

On the integration page, for the administrator:

- **Check**: reads TVmaze again now for every user, and says how many shows and upcoming episodes
  were read.
- **Search a show**: type a title, get the best TVmaze matches with their year, channel and id, to
  copy into a list.

## Scenes

**Trigger "Episode today"**: a followed show (on a shared calendar) airs an episode today. The
**When** filter chooses the moment: **in the morning** (09:00), or **at the air time** (09:00 too for an
episode released without a time). The **Show** filter takes the exact title as shown in the
calendar; empty, every show. Variables: show, episode title, code (S02E10), season, episode number,
channel, date, air time, and the users who follow the show.

**Trigger "New episode announced"**: a followed show that had no next episode gets one: a new season
dated, a show back from a break. Same variables, plus the days left.

**Action "Read the next episode"**: the next episode of a show (its title or the beginning of it;
empty: the soonest of all), with `found` (1 or 0), episode, code, date, `days_left` (-1 without a
date), channel, status of the show and last episode aired.

**Examples**:

- _Tell the household the day an episode airs_: trigger "Episode today", when "In the morning", then
  the Gladys action "Send a message" to the users you choose, its text built with the variables
  Show, Code and Channel picked from the list. Nothing is sent until you create such a scene.
- _Dim the lights at the air time_: trigger "Episode today", when "At the air time", show "The
  Simpsons", then a lighting action.
- _Weekly reminder_: a scheduled scene on Sunday evening, the action "Read the next episode", then a
  message with its Show and Date outputs.

## Dashboard

Add the **Upcoming episodes** widget to a dashboard. Settings: the shows to show (exact titles; empty,
every shared show), the period (7, 14 or 31 days) and whether to show the status of each show.

## Limits

- **Data**: TVmaze's guide. Air times are those of the original channel, converted to the time zone of
  Gladys: a US show airing at 20:00 in New York appears at 02:00 in Paris. Local broadcasts (a French
  channel airing an American show) are not covered.
- **Refresh**: every 6 hours, and when a user changes their list. TVmaze allows 20 calls every
  10 seconds: the integration spaces its calls and reads each show once, whoever follows it.
- An episode without an air date yet (TBA) is not in the calendar until TVmaze dates it.
- At most 500 episodes per calendar (far beyond a year of weekly shows).

## Troubleshooting

- **The calendar stays empty**: check its description (Gladys calendar page). "Not found on TVmaze"
  means the title matched nothing: search it with the "Search a show" action and use its id.
- **The wrong show**: write its id (`#1292`) instead of the title.
- **No scene fires**: the calendar must be shared, and the show filter must be the exact title.
- **"TVmaze unreachable"**: the integration keeps the previous episodes and tries again, after a minute
  then less and less often. Logs: integration page, Logs tab (`LOG_LEVEL=debug` for more detail).

## Credits

Show and episode data, summaries included, come from [TVmaze](https://www.tvmaze.com/api) under the
[CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) license. Every calendar and event
description credits TVmaze.
