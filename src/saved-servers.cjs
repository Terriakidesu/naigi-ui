const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { normalizeServerUrl } = require("./server-url.cjs");

const MAX_SERVERS = 50;

function normalizeSavedServers(value) {
  const servers = [];
  const candidates = [value?.server, ...(Array.isArray(value?.servers) ? value.servers : [])];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const origin = normalizeServerUrl(candidate.trim());
      if (!servers.includes(origin) && servers.length < MAX_SERVERS) servers.push(origin);
    } catch { /* Do not expose invalid or credential-bearing saved addresses. */ }
  }
  return { server: servers[0] ?? "", servers };
}

function createSavedServerStore(configPath) {
  let pending = Promise.resolve();

  async function read() {
    try {
      return normalizeSavedServers(JSON.parse(await fs.readFile(configPath, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return { server: "", servers: [] };
      throw error;
    }
  }

  function update(transform) {
    const operation = pending.then(async () => {
      const value = transform(await read());
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600, flag: "wx" });
        await fs.rename(temporaryPath, configPath);
      } finally {
        await fs.rm(temporaryPath, { force: true });
      }
      return value;
    });
    pending = operation.catch(() => undefined);
    return operation;
  }

  return {
    list: () => pending.then(read),
    remember(input) {
      const origin = normalizeServerUrl(input);
      return update(({ servers }) => normalizeSavedServers({ server: origin, servers }));
    },
    remove(input) {
      const origin = normalizeServerUrl(input);
      return update(({ servers }) => normalizeSavedServers({ servers: servers.filter((server) => server !== origin) }));
    },
  };
}

module.exports = { createSavedServerStore, normalizeSavedServers };
