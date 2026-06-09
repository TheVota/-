# VSPO Fan Schedule API

VSPO Fan Schedule API is an unofficial Rails API server for tracking public
VSPO! VTuber live stream information.

This project is based on [YunzheZJU/non-stop-story](https://github.com/YunzheZJU/non-stop-story) and swaps the default seed data to VSPO! YouTube and Twitch channels.

This repository is not affiliated with, endorsed by, or sponsored by VSPO!,
Virtual Entertainment, Brave group, YouTube, or VTuber Live. Product names,
channel names, and service names belong to their respective owners.

## Browser Extension

The `extension/` directory contains an unofficial Chrome Manifest V3 popup
extension.

It fetches these public VSPO! pages and displays current/scheduled streams:

```text
https://vtuber-live.net/live?filter=vspo
https://vtuber-live.net/live_schedule?filter=vspo
```

To try it in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select the `extension/` directory.

## What It Provides

REST endpoints:

```text
/api/v1/lives/current
/api/v1/lives/scheduled
/api/v1/lives/ended
/api/v1/lives/open
/api/v1/lives/1
/api/v1/members
/api/v1/channels
/api/v1/platforms
/api/v1/rooms
/api/v1/hotnesses
```

GraphQL endpoint:

```text
/graphql
```

## Seed Data

`db/seeds.yml` contains the current VSPO! YouTube and Twitch channel list used to initialize members and channels.

The list was generated from the public VTuber Live VSPO channel page on 2026-06-07:

https://vtuber-live.net/prod_ch_list?prd=vspo

Current seed scope:

- YouTube and confirmed Twitch channels
- 32 VSPO! / VSPO! EN channels
- All members marked active by default

The seed data is intended as a convenience snapshot of public channel metadata.
Check the source pages and the relevant service terms before using it in a
public service or redistribution.

## Public Release Notes

Before publishing your own fork, check these items:

- Keep the original MIT `LICENSE` file and copyright notice.
- Do not commit `config/master.key`, `.env` files, real worker URLs, API keys,
  SMTP passwords, or production credentials.
- Review `config/credentials.yml.enc`; regenerate or remove it if it has ever
  contained real secrets.
- Use only icons and images that you created or have permission to redistribute.
- Make the project description clearly say this is an unofficial fan-made tool.

## Workers

Workers are external services that receive channel IDs and return live stream information. Configure them in `config/worker.yml`.

The app expects workers for:

```yaml
lives_detect:
  youtube:
    - https://your-detect-worker.example
  twitch:
    - worker: https://your-twitch-detect-worker.example
      proxy: http://your-proxy.example:1234
lives_check:
  youtube:
    - https://your-check-worker.example
  twitch:
    - worker: https://your-twitch-check-worker.example
      proxy: http://your-proxy.example:1234
members_track:
  youtube:
    - https://your-member-worker.example
```

Sample worker implementations from the original project are available here:

https://github.com/YunzheZJU/holo-schedule-workers

## Setup

Ruby version:

```text
2.6.5
```

Install dependencies:

```bash
bundle install
```

Initialize the database:

```bash
bundle exec rails db:setup
```

Run tests:

```bash
bundle exec rails t
```

Run the server:

```bash
bundle exec rails s
```
