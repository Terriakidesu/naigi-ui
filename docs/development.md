# Development and packaging

## Setup

Install Node.js 22 or newer and npm, then run:

```sh
npm install
npm start
```

Start the [Naigi server](https://github.com/Terriakidesu/naigi) separately and select its origin in the launcher. No Bun runtime is required for the desktop project.

## Source layout

| Path | Purpose |
| --- | --- |
| `frontend/client/` | Editable user-facing chat frontend |
| `scripts/build-frontend.mjs` | Node/esbuild frontend bundler |
| `src/main.cjs` | Electron windows, permissions, navigation, and API bridge |
| `src/preload.cjs` | Launcher-only IPC bridge |
| `src/chat-preload.cjs` | Bundled chat-only IPC bridge |
| `src/desktop-protocol.cjs` | Local frontend routes and assets |
| `src/realtime-proxy.cjs` | Authenticated realtime bridge |
| `test/` | Node desktop tests |

Build output goes to ignored `.build/frontend/`; do not edit or commit generated assets. The desktop app does not load its frontend from the server or include the server admin console.

## Checks

```sh
npm run check
npm test
npm run build:frontend
```

`check` validates JavaScript syntax. `test` runs the desktop tests in `test/`; the copied frontend TypeScript tests use the reference project's Bun test API and are not run by this command. The frontend build bundles TypeScript but does not perform a full type check.

Before distributing, test live sign-in, cookies, realtime, encrypted WASM initialization, history recovery, and LiveKit/media devices on each supported platform.

## Packaging

```sh
npm run pack
npm run dist
```

`pack` creates an unpacked app; `dist` builds distributable packages. Both rebuild the frontend. Outputs are ignored under `dist/`.

| Platform | Configured targets |
| --- | --- |
| Linux | AppImage, deb |
| Windows | NSIS installer, ZIP |
| macOS | DMG |

Prefer building on the target OS. macOS signing requires a Mac. Cross-building the Windows NSIS installer on Linux requires Wine; Linux deb packaging requires the libraries used by electron-builder's FPM tool.

Public builds currently lack custom icons and signing/notarization configuration. The initial release contains an AppImage and an unsigned Windows ZIP, not a completed Windows installer or deb package.

## Versioning

The desktop version is in `package.json` and `package-lock.json`, independent of the server version. Keep release notes grouped by minor version in `docs/changelogs/` and linked from `CHANGELOG.md`.
