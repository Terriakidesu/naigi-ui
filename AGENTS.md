# Naigi UI agent notes

- Use Node.js/npm, not Bun. Run `npm run check`, `npm test`, and `npm run build:frontend` after changes.
- `frontend/client/` is the editable desktop frontend. `scripts/build-frontend.mjs` bundles it to ignored `.build/frontend/`; do not commit generated assets.
- `src/main.cjs` owns Electron windows, permissions, navigation, the restricted API bridge, and packaging entry. `src/preload.cjs` is only for the local launcher; `src/chat-preload.cjs` is only for the bundled local app. Never attach either preload to remote content.
- The server reference repo is checked out locally at `../priv-chat` and hosted at `https://github.com/Terriakidesu/naigi`. Keep it untouched unless the user explicitly requests backend work; desktop front-end edits belong here.
- Keep sandboxing, context isolation, and web security enabled. Validate IPC senders and server URLs. Restrict API proxying to the selected origin and `/v1`; never bypass TLS validation or expose arbitrary IPC to remote content.
- Never persist plaintext messages or encryption passphrases. Do not commit `node_modules/`, `dist/`, `.build/`, `.env`, or local Electron profile data.
