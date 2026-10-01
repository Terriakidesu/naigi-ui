import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(root, "frontend", "client");
const sourceRoot = path.join(clientRoot, "src");
const pagesRoot = path.join(clientRoot, "pages");
const publicRoot = path.join(clientRoot, "public");
const outputRoot = path.join(root, ".build", "frontend");
const entries = [
  "auth",
  "register",
  "unlock",
  "main",
  "new",
  "settings",
  "server-settings",
  "voice-audio-worklet",
  "desktop",
];
const pages = [
  "index",
  "register",
  "unlock",
  "chat",
  "new",
  "settings",
  "server-settings",
];
const styleSheets = [
  "base.css",
  "navigation.css",
  "conversation.css",
  "composer.css",
  "profile-editor.css",
  "pages.css",
  "responsive.css",
  "controls.css",
  "space-settings.css",
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await mkdir(path.join(outputRoot, "assets"), { recursive: true });

await build({
  entryPoints: entries.map((entry) => path.join(sourceRoot, `${entry}.ts`)),
  outdir: outputRoot,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: ["chrome140"],
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  assetNames: "assets/[name]-[hash]",
  publicPath: "/",
  minify: process.env.NODE_ENV === "production",
  legalComments: "linked",
});

await Promise.all(pages.map(async (page) => {
  await cp(path.join(pagesRoot, `${page}.html`), path.join(outputRoot, `${page}.html`));
}));

const css = await Promise.all(styleSheets.map((sheet) => readFile(path.join(clientRoot, "styles", sheet), "utf8")));
await writeFile(path.join(outputRoot, "app.css"), css.join("\n"));
await Promise.all([
  cp(path.join(publicRoot, "favicon.svg"), path.join(outputRoot, "favicon.svg")),
  cp(path.join(publicRoot, "push-sw.js"), path.join(outputRoot, "push-sw.js")),
  cp(path.join(publicRoot, "assets"), path.join(outputRoot, "assets"), { recursive: true }),
  cp(path.join(root, "frontend", "LICENSE"), path.join(outputRoot, "LICENSE")),
  cp(
    path.join(root, "node_modules", "@matrix-org", "matrix-sdk-crypto-wasm", "pkg", "matrix_sdk_crypto_wasm_bg.wasm"),
    path.join(outputRoot, "assets", "matrix_sdk_crypto_wasm_bg.wasm"),
  ),
  cp(
    path.join(root, "node_modules", "livekit-client", "dist", "livekit-client.e2ee.worker.mjs"),
    path.join(outputRoot, "livekit-e2ee-worker.mjs"),
  ),
]);

console.log(`Built the bundled Naigi frontend in ${path.relative(root, outputRoot)}/`);
