# Security and limitations

## Desktop boundary

- The bundled frontend runs at the local `naigi://app` origin without Node.js access.
- Electron sandboxing, context isolation, and web security remain enabled.
- Launcher and chat windows use separate narrow preload bridges. IPC handlers validate the sender and frame; preloads must never be attached to remote content.
- The HTTP bridge is restricted to the selected server's `/v1` API and rejects server-admin API paths. Realtime uses a random loopback-only WebSocket bridge.
- Remote servers require HTTPS. TLS certificate verification is not bypassed; HTTP is accepted only for loopback development.

## Storage and permissions

Each server has a separate persistent Electron session for login cookies, encrypted crypto storage, and preferences. The shell saves the selected server address. Never add plaintext message or encryption-passphrase persistence.

Microphone/camera and notification permissions require a prompt. External links open in the system browser. A desktop session is a separate device; browser keys are not automatically imported.

## Known limitations

- No native tray, updater, global push-to-talk, or background push integration.
- Firebase browser push may not work in Electron.
- Published Windows builds are unsigned; custom app icons and signing/notarization are not configured.
- Unit checks and packaging do not establish end-to-end compatibility. Live authentication, realtime, encrypted WASM initialization, recovery, calls, and device selection still need testing on each OS.

Do not commit generated bundles, `node_modules/`, release packages, environment files, or local Electron profiles.
