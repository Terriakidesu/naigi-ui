# Naigi UI agent notes

- Use Node.js/npm, not Bun. Run `npm run check` and `npm test` after changes.
- `src/main.cjs` owns Electron windows, permissions, navigation, and packaging entry. `src/preload.cjs` is for the local launcher only; never attach it to remote content.
- The chat frontend is currently hosted by the separate `../priv-chat` backend. Do not modify that repository as part of desktop-shell work unless requested.
- Keep sandboxing, context isolation, and web security enabled. Validate IPC senders and server URLs. Never bypass TLS validation or expose arbitrary IPC to remote content.
- Never persist plaintext messages or encryption passphrases. Do not commit `node_modules/`, `dist/`, `.env`, or local Electron profile data.
