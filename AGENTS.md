# AGENTS.md — CalculaHTML

## Project

Static HTML/CSS/JS calculator. No build tooling, no dependencies. Open `index.html` directly. CI at `.github/workflows/ci.yml`.

## Termux Notes

- Working dir: `~/repos/CalculaHTML` (/data/data/com.termux/files/home/repos/CalculaHTML)
- Use `TMPDIR=/data/data/com.termux/files/usr/tmp` for any temp work.
- No FHS paths, no sudo.

## Conventions

- Keep everything in `index.html`, `css/styles.css`, `js/app.js`. Do not introduce frameworks.
- Themes are defined as CSS custom properties under `[data-theme="..."]` in `css/styles.css`. Add new themes there and register an `<option>` in `index.html`.
- Calculator logic lives in the IIFE in `js/app.js`. State: `current`, `previous`, `operator`, `memory`, `history`.
- No comments unless necessary; match existing style.

## Tasks

- Theme: add `[data-theme="name"]` block with all CSS vars, then `<option value="name">`.
- Button: add `<button class="btn" data-action data-value>` in `.keys` grid, handle in `handleAction`.
- Test: open `index.html` in a browser or `python3 -m http.server 8080`.

## Verification

- `node --check js/app.js` — JS syntax
- `node --check sw.js` — service worker syntax
- `JSON.parse(fs.readFileSync('manifest.webmanifest'))` — manifest valid
- `make check` — all of the above + verifies inline CSS **and** JS match the single-file `index.html` (a JS edit that never reaches the page is the silent-failure mode this guards)
- `node tests/test_csv.mjs` — unit tests for the history CSV builder (extracted via markers, 7 assertions)
- `make sync-size` / `make sync-js` — sync `css/styles.css` / `js/app.js` into `index.html`
- Manual smoke test in browser (the CSV download and `?` overlay need a real browser)
