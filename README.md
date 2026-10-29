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
The site is hosted on Vercel as the static `site/dist` folder (D-116). `site/public/_headers` is the one list of security headers: `vite preview` and the end-to-end suite serve it, and the root `vercel.json` carries the same rules for Vercel. A unit test and the release gate fail if the two ever differ.
Every page also sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` set to `same-origin`, and the fingerprinted files under `/assets/` are cached for a year as immutable (D-113).

## Deploy

`npm run release -w site` is the release build: the normal build and build guard, then the release gate (`scripts/release-check.mjs`, D-115).
The gate fails while a marked placeholder or draft marker remains in the built JS or HTML, while the link-preview URLs in `index.html` are not absolute `https://` addresses, while `dist/og.png` is still the placeholder render, and when the root `vercel.json` is missing or its headers differ from `site/public/_headers` (D-116).
It does not catch draft labels that carry no marker; the owner approves those through the copy checklist, not the gate.
Set `VITE_SITE_ORIGIN` to the site's address, `https://` and no trailing slash: `https://faillocal.spareroomdev.com`. The link preview is built from it.
Set it as an environment variable, not in a `.env` file: the build guard (`scripts/check-build.mjs`) reads only the environment, so a value from `.env.production` would reach the page but fail the guard.

Vercel, connected to the GitHub repository:

- **Import** the repository `Spare-Room-Dev/failLocal` as a new project. Leave the **Root Directory** as the repository root, so the npm workspaces install together.
- **Build settings** come from `vercel.json`: the build command is `npm run release -w site` and the output directory is `site/dist`. The install command is Vercel's default, `npm install` at the root, which installs both workspaces.
- **Node version** comes from `engines.node` in the root `package.json` (`22.x`), which overrides the version in the project settings.
- **Environment variable:** `VITE_SITE_ORIGIN=https://faillocal.spareroomdev.com`, for Production.
- **Preview deployments** have their own addresses, but the release build fails without `VITE_SITE_ORIGIN`. Set the same value for Preview too; preview builds then carry the production address in `og:url` and `og:image`, which only matters if a preview link is shared.
- **Custom domain:** add `faillocal.spareroomdev.com` under the project's Domains settings.
- **Vercel Toolbar:** turn it off for Preview (Settings → General → Vercel Toolbar → Preview: Off). It is on by default for preview deployments and loads its script from `https://vercel.live`, which the site's Content-Security-Policy blocks.

Or deploy from this machine with the Vercel CLI (needs a Vercel login; the first run links the folder to the project). Vercel builds it with the settings above:

```sh
npx vercel deploy --prod
```

After each deploy, run the end-to-end checks against the live site and confirm the security headers are served:

```sh
E2E_BASE_URL=https://faillocal.spareroomdev.com npm run e2e -w site
curl -sI https://faillocal.spareroomdev.com/ | grep -iE 'content-security-policy|cross-origin-opener-policy|cross-origin-resource-policy|strict-transport-security'
curl -sI "https://faillocal.spareroomdev.com$(curl -s https://faillocal.spareroomdev.com/ | grep -o '/assets/[^"]*\.js' | head -1)" | grep -i cache-control
```

Vercel sends `Strict-Transport-Security` on custom domains by default, and its docs say a project's own header changes it; the `curl` check should show the value from `vercel.json`, `max-age=31536000; includeSubDomains`.
Vercel also serves `site/public/_headers` as a plain file at `/_headers`. It is harmless: it holds only the public header list.

`E2E_BASE_URL` points the Playwright suite at a site that is already being served, instead of building and previewing one locally.

Every judgement and assumed value in the register is explained in [docs/decisions.md](docs/decisions.md).
Licensed under Apache-2.0.
