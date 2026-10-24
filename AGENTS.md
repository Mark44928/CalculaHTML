# AGENTS.md — CalculaHTML

## Project

Static HTML/CSS/JS calculator. No build tooling, no dependencies. Open `index.html` directly.

## Termux notes

- Working dir: `/data/data/com.termux/files/home/CalculaHTML`
- Use `TMPDIR=/data/data/com.termux/files/usr/tmp` for any temp work.
- No FHS paths, no sudo.

## Conventions

- Keep everything in `index.html`, `css/styles.css`, `js/app.js`. Do not introduce frameworks.
- Themes are defined as CSS custom properties under `[data-theme="..."]` in `css/styles.css`. Add new themes there and register an `<option>` in `index.html`.
- Calculator logic lives in the IIFE in `js/app.js`. State: `current`, `previous`, `operator`, `memory`, `history`.
- No comments unless necessary; match existing style.

## Tasks

- Adding a theme: add a `[data-theme="name"]` block with all variables, then add `<option value="name">`.
- Adding a button: add `<button class="btn ..." data-action="..." data-value="...">` in the `.keys` grid, then handle the action in `handleAction`.
- Test by opening `index.html` in a browser or a simple static server: `python3 -m http.server 8080`.

## Verification

- `node --check js/app.js` for JS syntax.
- Manual smoke test in browser.
