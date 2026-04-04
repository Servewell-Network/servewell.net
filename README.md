# ServeWell.Net

ServeWell.Net is a Cloudflare Workers site focused on Bible reading, comparative views, and tools that help people serve others well.

Most product details now live on the website itself:

- `/features` for currently available capabilities
- `/whats-next` for roadmap items and direction
- `/about` for mission and contribution context

## Project Guidance

- For architecture/modularity principles and coding guardrails, see [AGENTS.md](AGENTS.md).

## Local Development

Requirements:

- Node.js 22+
- npm

Install dependencies:

```bash
npm install
```

Run locally (Wrangler):

```bash
npm run dev
```

Useful commands:

- `npm run deploy` deploy Worker + assets
- `npm run cf-typegen` regenerate Cloudflare types
- `npm run test` run tests
- `npm run build:servewell-app-shell` bundle browser app shell

## Content Generation Scripts

This repository includes phased data-processing scripts used to generate chapter pages and related assets.

- `npm run p2-3` regenerates chapter HTML into `public/-/`
- `npm run p1a-2`, `npm run p1b-2`, and related review scripts support earlier data phases

## Source Data and Attribution

ServeWell.Net uses and derives from generous upstream Bible data/resources, including:

- STEPBible data: https://github.com/STEPBible/STEPBible-Data
- Berean Standard Bible resources: https://berean.bible/

Please preserve and extend attribution where required when updating data workflows.

