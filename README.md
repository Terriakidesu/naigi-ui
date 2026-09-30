# Naigi UI

Node.js/Electron desktop client for [Naigi](../priv-chat). No Bun runtime is used in this repository.

## Development

Install Node.js 22 or newer and npm, then run:

```sh
npm install
npm start
```

Enter your Naigi server origin, such as `https://chat.example.com` or `http://localhost:3000` for development. Run the backend separately from `../priv-chat`. Use **File → Change server** to connect elsewhere.

This initial client loads the existing frontend from the selected server; it does not yet bundle a separate copy of the chat UI. The server still supplies all chat and encryption code, just as it does in a browser. Browser storage is isolated by server origin in persistent Electron sessions. Switching servers does not erase saved sessions or encryption keys.

## Checks and packaging

```sh
npm run check
npm test
npm run pack
npm run dist
```

Build on each target platform (or a CI matrix): Windows NSIS installer, macOS DMG, and Linux AppImage/deb. Outputs go to `dist/`. Public releases need platform signing/notarization configuration and app icons; neither is configured yet. macOS signing requires a Mac.

## Security and limitations

- Remote chat content has no preload bridge or Node.js access. Context isolation, sandboxing, and web security remain enabled.
- The local server chooser has a narrow IPC bridge; privileged handlers validate its sender.
- Remote servers must use HTTPS. Certificate errors are not bypassed. HTTP is accepted only for loopback development.
- Microphone/camera and notification permissions are restricted to the selected server and require an explicit prompt. External links open in the system browser.
- No native tray, updater, global push-to-talk, or background push integration yet. Firebase browser push may not work in Electron; native notifications will need integration.
- Validate LiveKit calls, media-device selection, encrypted WASM initialization, and history recovery on each OS before distributing. A desktop session is a new device; browser encryption keys are not automatically imported.
- Only the server address is written by the shell. Do not add plaintext message or passphrase persistence.
