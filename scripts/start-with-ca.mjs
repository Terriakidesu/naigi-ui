import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const configuredPath = process.env.NAIGI_CA_CERT?.trim() || process.env.NODE_EXTRA_CA_CERTS?.trim();
const certificatePath = path.resolve(configuredPath || path.join(os.homedir(), "Desktop", "caddy-root.crt"));

if (!existsSync(certificatePath)) {
  console.error(`Naigi CA certificate was not found: ${certificatePath}`);
  console.error("Set NAIGI_CA_CERT to the PEM certificate path, or copy root.crt to your Desktop as caddy-root.crt.");
  process.exit(1);
}

let certificate;
try {
  certificate = readFileSync(certificatePath, "utf8");
} catch (error) {
  console.error(`Could not read the Naigi CA certificate: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!/^\s*-----BEGIN CERTIFICATE-----\s*$/m.test(certificate)) {
  console.error(`The Naigi CA certificate is not PEM text: ${certificatePath}`);
  console.error("Copy Caddy's root.crt file only; do not use root.key.");
  process.exit(1);
}

const electron = spawn(require("electron"), [".", ...process.argv.slice(2)], {
  env: { ...process.env, NODE_EXTRA_CA_CERTS: certificatePath },
  stdio: "inherit",
});

electron.on("error", (error) => {
  console.error(`Could not start Electron: ${error.message}`);
  process.exitCode = 1;
});

electron.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
