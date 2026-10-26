# CalculaHTML

<p align="center">
  <a href="https://mark44928.github.io/CalculaHTML/"><img src="assets/preview.svg" alt="CalculaHTML preview" width="420"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/Mark44928/CalculaHTML" alt="License">
  <a href="https://github.com/Mark44928/CalculaHTML/actions/workflows/ci.yml"><img src="https://github.com/Mark44928/CalculaHTML/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/github/deployments/Mark44928/CalculaHTML/github-pages?label=pages" alt="GitHub Pages">
  <img src="https://img.shields.io/github/last-commit/Mark44928/CalculaHTML" alt="Last commit">
  <img src="https://img.shields.io/github/stars/Mark44928/CalculaHTML?style=social" alt="Stars">
</p>

A feature-rich, responsive calculator that runs entirely in the browser: 14 themes plus a System (auto) mode, scientific functions, memory, a history tape, keyboard support, and offline PWA support.

**Live demo:** https://mark44928.github.io/CalculaHTML/

## Features

- Basic arithmetic: `+ − × ÷`, percentages, sign toggle, backspace
- Scientific functions: `sin cos tan log ln √ x² x³ x^y 1/x n!`, constants `π` and `e`
- Memory: `MC MR M+ M− MS`
- History tape with up to 40 entries
- 14 themes + System (auto light/dark): Dark, Light, Gruvbox, Everforest, Tokyo Night, Dracula, Nord, Catppuccin Mocha, One Dark, Solarized Dark, Rose Pine, Monokai, GitHub Dark, Old Dark
- Keyboard support, copy result, angle mode (DEG/RAD)
- Responsive layout, accessible controls, reduced-motion friendly
- Progressive Web App: installable, offline-capable (manifest + service worker)
- No frameworks and no build step. Google Fonts load when online and fall back to system fonts offline.

## Install as an app (PWA)

1. Open the [live demo](https://mark44928.github.io/CalculaHTML/) in Chrome, Edge, or Safari.
2. Use **Install app** / **Add to Home Screen**.
3. Launch it like a native app. The service worker caches the app shell so it keeps working offline.

## Usage

### Live

Open https://mark44928.github.io/CalculaHTML/ — nothing to install.

### Local

```bash
git clone https://github.com/Mark44928/CalculaHTML.git
cd CalculaHTML
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly also works, but a local server enables the service worker and PWA install.

## Themes

Switch themes from the dropdown or the color swatches. The choice is saved in `localStorage`. **System** follows your OS light/dark preference.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `0-9`, `.` | input |
| `+ - * / ^` | operators |
| `Enter` / `=` | evaluate |
| `Backspace` | delete |
| `Esc` | clear all |
| `Delete` | clear entry |
| `%` | percent |

## Project structure

```
CalculaHTML/
├── index.html
├── css/styles.css
├── js/app.js
├── assets/
│   ├── icon.svg
│   ├── icon-192.png / icon-512.png
│   ├── maskable-192.png / maskable-512.png
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   └── preview.svg
├── offline.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── README.md
├── AGENTS.md
├── LICENSE
└── .github/workflows/
    ├── ci.yml
    └── pages.yml
```

## Development

No dependencies to install.

```bash
npm run check        # node --check js/app.js
npm run start        # python3 -m http.server 8080
```

CI runs the JavaScript syntax check and validates `manifest.webmanifest` on every push and pull request.

## Browser support

Recent Chrome, Edge, Firefox, and Safari. The layout uses `color-mix()` and modern CSS, so older browsers may not render every theme effect correctly. PWA install depends on the browser.

## Contributing

Issues and pull requests are welcome. Keep the project framework-free and dependency-free.

## License

MIT — see [LICENSE](LICENSE).
