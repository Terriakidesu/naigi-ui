# Naigi Desktop

Standalone Node.js/Electron desktop client for [Naigi](../priv-chat). The chat frontend is bundled in this app; the separately self-hosted Naigi server provides the API and stores account data. No Bun runtime is used in this repository.

## Development

Install Node.js 22 or newer and npm, then run:

```sh
npm install
npm start
```

Run the backend separately from `../priv-chat`. On launch, enter your server origin, such as `https://chat.example.com` or `http://localhost:3000` for loopback development. **Check server** validates reachability and shows the server's version before connecting. Use **File → Change server…** to connect elsewhere.

The user-facing chat frontend source is maintained in `frontend/client/` and bundled by `npm run build:frontend`; the server's admin console is intentionally not included. The local frontend talks to the selected server's `/v1` user API through a restricted main-process bridge; the server does not supply the desktop UI. Each server gets its own persistent Electron session, including its login cookie, encrypted crypto store, and preferences. Switching servers does not erase saved sessions or encryption keys.

Naigi server v0.24.0 and newer expose `GET /v1/version`. Older servers can still be checked and used when their health endpoint is available; their version appears as **Unavailable**. The desktop app version comes from `package.json` and is displayed separately from the server version in the launcher, chat sidebar, and **Help → About Naigi**.

## Checks and packaging

```sh
npm run check
npm test
npm run build:frontend
npm run pack
npm run dist
```

Build on each target platform (or a CI matrix): Windows NSIS installer, macOS DMG, and Linux AppImage/deb. Outputs go to `dist/`. Public releases need platform signing/notarization configuration and app icons; neither is configured yet. macOS signing requires a Mac.

## Security and limitations

- Bundled chat content is served from a secure local `naigi://app` origin and has no Node.js access. Context isolation, sandboxing, and web security remain enabled.
- The local server chooser and chat window have separate narrow preload bridges; privileged IPC handlers validate their sender and frame.
- Main-process HTTP requests are limited to `/v1` on the selected origin. Realtime WebSockets use a random, loopback-only bridge. TLS verification is never bypassed.
- Remote servers must use HTTPS. Certificate errors are not bypassed. HTTP is accepted only for loopback development.
- Microphone/camera and notification permissions require an explicit prompt. External links open in the system browser.
- No native tray, updater, global push-to-talk, or background push integration yet. Firebase browser push may not work in Electron; native notifications will need integration.
- Validate LiveKit calls, media-device selection, encrypted WASM initialization, and history recovery on each OS before distributing. A desktop session is a new device; browser encryption keys are not automatically imported.
- Only the server address is written by the shell. Chat storage remains origin-scoped and must never persist plaintext messages or passphrases.
