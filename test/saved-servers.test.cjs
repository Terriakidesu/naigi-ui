const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createSavedServerStore, normalizeSavedServers } = require("../src/saved-servers.cjs");

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "naigi-saved-servers-"));
  const file = path.join(directory, "server.json");
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, file, store: createSavedServerStore(file) };
}

test("legacy saved addresses migrate into the server list", () => {
  assert.deepEqual(normalizeSavedServers({ server: "https://chat.example.com/" }), {
    server: "https://chat.example.com", servers: ["https://chat.example.com"],
  });
});

test("saved addresses are normalized, deduplicated, and validated", () => {
  assert.deepEqual(normalizeSavedServers({ server: "https://CHAT.example.com", servers: [
    "https://chat.example.com/", "http://remote.example", "https://user:secret@example.com", "file:///x",
    "https://example.com/path", "https://example.com/?token=secret", "https://example.com/#secret", null,
    "http://localhost:3000", "https://second.example",
  ] }), { server: "https://chat.example.com", servers: ["https://chat.example.com", "http://localhost:3000", "https://second.example"] });
  assert.deepEqual(normalizeSavedServers(null), { server: "", servers: [] });
});

test("new stores start empty and remembered servers persist across app restarts", async (t) => {
  const { file, store, directory } = await fixture(t);
  assert.deepEqual(await store.list(), { server: "", servers: [] });
  await store.remember("https://one.example");
  await store.remember("https://two.example");
  await store.remember("https://one.example");
  assert.deepEqual(await createSavedServerStore(file).list(), {
    server: "https://one.example", servers: ["https://one.example", "https://two.example"],
  });
  assert.deepEqual(await fs.readdir(directory), ["server.json"]);
  if (process.platform !== "win32") assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test("legacy addresses are preserved when adding another server", async (t) => {
  const { file, store } = await fixture(t);
  await fs.writeFile(file, JSON.stringify({ server: "https://legacy.example" }));
  await store.remember("https://new.example");
  assert.deepEqual((await store.list()).servers, ["https://new.example", "https://legacy.example"]);
});

test("forgetting removes only the selected origin and updates the last-used address", async (t) => {
  const { store } = await fixture(t);
  await store.remember("https://one.example");
  await store.remember("https://two.example");
  assert.deepEqual(await store.remove("https://two.example"), { server: "https://one.example", servers: ["https://one.example"] });
  assert.deepEqual(await store.remove("https://one.example"), { server: "", servers: [] });
});

test("concurrent changes do not lose saved servers", async (t) => {
  const { store } = await fixture(t);
  await Promise.all([store.remember("https://one.example"), store.remember("https://two.example"), store.remember("https://three.example")]);
  assert.deepEqual((await store.list()).servers, ["https://three.example", "https://two.example", "https://one.example"]);
});

test("invalid requests cannot save credentials or arbitrary URLs", async (t) => {
  const { store } = await fixture(t);
  assert.throws(() => store.remember("https://user:secret@example.com"));
  assert.throws(() => store.remove("file:///tmp/example"));
  assert.deepEqual((await store.list()).servers, []);
});

test("corrupt settings do not prevent saving a valid new server", async (t) => {
  const { file, store } = await fixture(t);
  await fs.writeFile(file, "{broken");
  assert.deepEqual((await store.list()).servers, []);
  await store.remember("https://one.example");
  assert.equal((await store.list()).server, "https://one.example");
});

test("saved lists are bounded without dropping the most recent server", () => {
  const servers = Array.from({ length: 60 }, (_, index) => `https://server-${index}.example`);
  const saved = normalizeSavedServers({ server: "https://latest.example", servers });
  assert.equal(saved.servers.length, 50);
  assert.equal(saved.servers[0], "https://latest.example");
});
