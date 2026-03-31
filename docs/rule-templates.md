# Rule Templates

Built-in rule templates are intended to cover the repetitive cases that most developer-oriented setups run into:

- third-party AI sites
- common third-party developer tooling sites
- international video sites that should exit through a specific region
- mainland video sites that should stay direct

Templates are not a replacement for the compiler's built-in policy. They sit on top of it and are meant for fast customization.

## Current Templates

### Developer

- `developer-ai-sites`
  Routes common third-party AI sites to `AI-Out`.
  Includes:
  - `openrouter.ai`
  - `perplexity.ai`

- `developer-common-sites`
  Routes common third-party developer sites to `Dev-Common-Out`.
  Includes:
  - `gitlab.com`
  - `npmjs.com`
  - `registry.npmjs.org`
  - `vercel.com`
  - `cloudflare.com`
  - `docker.com`
  - `hub.docker.com`
  - `stackoverflow.com`
  - `huggingface.co`

### Video

- `video-us`
  Routes international streaming sites to `US`.

- `video-hk`
  Routes international streaming sites to `HK`.

- `video-sg`
  Routes international streaming sites to `SG`.

- `video-jp`
  Routes Japan-oriented video sites to `JP`.

- `cn-video-direct`
  Keeps common mainland video sites on `direct`.

The international streaming templates currently cover:

- `youtube.com`
- `youtu.be`
- `netflix.com`
- `nflxvideo.net`
- `disneyplus.com`
- `disney-plus.net`
- `hulu.com`
- `max.com`
- `twitch.tv`

The JP template currently covers:

- `abema.tv`
- `niconico.jp`
- `dmm.com`
- `lemino.docomo.ne.jp`

The CN direct template currently covers:

- `bilibili.com`
- `bilibili.tv`
- `iqiyi.com`
- `iq.com`
- `youku.com`
- `mgtv.com`

## CLI Usage

List templates:

```bash
./node_modules/.bin/tsx src/cli/index.ts templates list
```

Show one template:

```bash
./node_modules/.bin/tsx src/cli/index.ts templates show video-sg
```

## Natural-Language Mapping

The `author` command can infer templates from short prompts.

Examples:

- `开发者网站走香港，视频网站走新加坡`
- `AI 工具走香港，视频网站走美国，每45分钟自动更新`
- `国内视频网站直连，YouTube Netflix 走美国`

Typical mapping behavior:

- `开发者网站` -> `developer-common-sites`
- `AI 工具` -> `developer-ai-sites`
- `视频网站走美国` -> `video-us`
- `视频网站走香港` -> `video-hk`
- `视频网站走新加坡` -> `video-sg`
- `日本视频网站` -> `video-jp`
- `国内视频网站直连` -> `cn-video-direct`

## Design Boundary

Templates are intentionally coarse-grained. They are best for:

- "a whole class of sites should go to one region"
- "these common developer sites should use the developer selector"
- "these common AI sites should use the AI selector"

If a user needs one-off exceptions, prefer the DSL instead of adding more template complexity.
