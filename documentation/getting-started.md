# Getting Started

## Prerequisites

- Node.js 18+
- npm 9+

## Install dependencies

```bash
cd dproject
npm install
```

## Run the demo (dev server)

```bash
npm run serve
```

Vite will start a local dev server and print a URL (typically `http://localhost:5173`).
Open it in any modern browser — WebGL2 is supported in Chrome, Firefox, Edge, and Safari 15+.

The page renders `VizModule` full-screen. Changes to `src/vizmodule.jsx` hot-reload automatically.

## Build the library for distribution

```bash
npm run build
```

Outputs two bundles to `dist/`:

| File | Format | Use case |
|---|---|---|
| `network-3d-viz.es.js` | ES module | Bundlers (Vite, webpack, Rollup) |
| `network-3d-viz.umd.js` | UMD | CDN / script tags |

## Watch mode (library development)

```bash
npm run dev
```

Rebuilds the library bundle on every file change (does **not** start a browser dev server).

## Project scripts summary

| Script | Command | Purpose |
|---|---|---|
| `serve` | `vite` | Dev server with HMR for the demo app |
| `build` | `vite build` | Produce distributable library bundles |
| `dev` | `vite build --watch` | Rebuild library on file change |