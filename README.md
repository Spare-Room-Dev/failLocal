# FailLocal

A playable model of a fictional Pilbara iron ore mine, built to show how a cyber outage propagates through production.
The site is fictional, and every number carries one of four labels:

- **sourced**: taken from a published source, cited in the register;
- **measured**: from a lab run, with its run id, date and evidence;
- **assumed**: a modelling choice, explained in the decision log;
- **computed**: worked out by the engine (stock levels, outage lengths, production deferred, revenue at risk).

`engine/` holds the register schema, the simulation engine and the CLI, as pure TypeScript. Run `npm install` first, then `npm test` and `npm run typecheck`.

```sh
npm run cli -- validate register/pilbara-model-site.yaml
npm run cli -- simulate register/pilbara-model-site.yaml --scenario s1-as-reported --variant unprepared [--json]
npm run cli -- pack register/pilbara-model-site.yaml --out out/continuity-pack.md
```

- `validate` checks the register and prints one issue per line (exit 1) or confirms it is valid.
- `simulate` runs one scenario as `unprepared` or `prepared`; `--json` prints the full timeline.
- `pack` writes the continuity pack as Markdown. PDF output comes later.
- A usage error (an unknown command, a missing argument or option value) prints the usage and exits 2.

## Website

`site/` is the playable website, a static Vite + React app.

```sh
npm run dev -w site     # local dev server
npm run build -w site   # build to site/dist, then run the build guard (scripts/check-build.mjs)
npm run e2e -w site     # build, preview under the deployed headers, and run the Playwright checks
```

`npm test -w site` builds the register JSON first; before a bare `npx vitest` in `site/`, run `npm run register -w site` once so the tests read the current register.

Adding `?e2e` to the URL installs a test hook, `window.__faillocal`, that only changes playback speed, for the end-to-end tests.
The build guard fails the build on inline script or style in `index.html`, on any URL other than the register's sources (and a short list of library namespace strings), on more than 450 KB of gzipped JS (D-104), and on a bundle that carries the YAML parser (the register ships as prebuilt JSON).
Deployment is the static `site/dist` folder on Cloudflare Pages; `site/public/_headers` is copied into it and sets the Content-Security-Policy and other security headers for every path.
Every page also sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` set to `same-origin`, and the fingerprinted files under `/assets/` are cached for a year as immutable (D-113).

## Deploy

`npm run release -w site` is the release build: the normal build and build guard, then the release gate (`scripts/release-check.mjs`, D-115).
The gate fails while any placeholder or draft copy remains in the built JS or HTML, while the link-preview URLs in `index.html` are not absolute `https://` addresses, and when `dist/_headers` is missing.
Set `VITE_SITE_ORIGIN` to the site's address, `https://` and no trailing slash, for example `https://faillocal.example.com`; the link preview is built from it.

Cloudflare Pages, connected to the Git repository:

- **Root directory:** the repository root (leave it empty), so the npm workspaces install together.
- **Build command:** `npm run release -w site`
- **Build output directory:** `site/dist`
- **Environment variable:** `VITE_SITE_ORIGIN`, set to the site's address as above.
- **Node version:** read from `.node-version` (Node 22).

Or upload a build from this machine instead (direct upload, needs a Cloudflare login):

```sh
VITE_SITE_ORIGIN=https://faillocal.example.com npm run release -w site
npx wrangler pages deploy site/dist --project-name faillocal
```

After each deploy, run the end-to-end checks against the live site and confirm the security headers are served:

```sh
E2E_BASE_URL=https://faillocal.example.com npm run e2e -w site
curl -sI https://faillocal.example.com/ | grep -i content-security-policy
```

`E2E_BASE_URL` points the Playwright suite at a site that is already being served, instead of building and previewing one locally.

Every judgement and assumed value in the register is explained in [docs/decisions.md](docs/decisions.md).
Licensed under Apache-2.0.
