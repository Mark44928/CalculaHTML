# Contributing to CalculaHTML

Thanks for improving CalculaHTML! It is a dependency-free static calculator:
plain HTML/CSS/JS, no frameworks, no build step.

## Ground rules

1. **No frameworks, no npm, no build tooling.** Everything stays in
   `index.html`, `css/styles.css`, and `js/app.js` (service worker in
   `sw.js`, manifest in `manifest.webmanifest`).
2. **Calculator logic lives in one place**: the IIFE in `js/app.js` with
   state keys `current`, `previous`, `operator`, `memory`, `history`. New
   buttons follow `<button class="btn" data-action data-value>` in the
   `.keys` grid and are handled in `handleAction()`.
3. **Themes are data-driven**: add a `[data-theme="name"]` block of CSS
   custom properties in `css/styles.css` *and* register the matching
   `<option value="name">` in `index.html`. Both halves or the theme won't
   appear.
4. **Style**: match the surrounding code. No comments unless genuinely
   needed.

## Getting started

1. Fork and clone the repository.
2. Open `index.html` directly in a browser, or serve it:
   `python3 -m http.server 8080`.
3. Make your change.
4. Verify:
   - `node --check js/app.js` and `node --check sw.js` (syntax, must pass —
     CI runs these)
   - the manifest is valid JSON
   - manual smoke test: digits, `+ - × ÷`, `%`, memory buttons, history,
     theme switching, dark mode persistence.

## Pull requests

- One feature/fix per PR; keep the diff small.
- Screenshot before/after for visual changes.
- Commit message: one imperative line (`add key repeat animation`,
  `fix percent-of-current handling`).

## Reporting issues

Open an issue with your browser, OS, and a short description + screenshot.
If the calculator misbehaves, list the exact key sequence that triggers it.
