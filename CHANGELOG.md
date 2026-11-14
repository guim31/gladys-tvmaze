# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-14

### Added

- A "TV shows" calendar per user, filled from TVmaze with the episodes of the
  shows they follow (titles, TVmaze ids or addresses): two weeks back, a year
  ahead, with season and episode number, channel and summary.
- The calendar description says which show each title matched, the titles not
  found and the other shows with the same title.
- Scene triggers "Episode today" (in the morning or at the air time) and "New
  episode announced".
- Scene action "Read the next episode": next episode, days left, status of the
  show, last episode aired.
- Dashboard widget "Upcoming episodes".
- Administrator actions "Check" and "Search a show".
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-tvmaze/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-tvmaze/releases/tag/v1.0.0
