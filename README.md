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

Every judgement and assumed value in the register is explained in [docs/decisions.md](docs/decisions.md).
Licensed under Apache-2.0.
