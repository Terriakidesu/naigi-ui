const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { apiTarget, assetPath, frontendPath } = require("../src/desktop-protocol.cjs");

test("API proxy targets stay on the selected Naigi server", () => {
  assert.equal(
    apiTarget("https://chat.example.com", "naigi://app/v1/conversations?limit=2").href,
    "https://chat.example.com/v1/conversations?limit=2",
  );
  assert.throws(() => apiTarget("https://chat.example.com", "https://evil.example/v1/me"));
  assert.throws(() => apiTarget("https://chat.example.com", "naigi://app/settings"));
});

test("frontend routes resolve to the bundled app pages", () => {
  assert.equal(frontendPath("/"), "index.html");
  assert.equal(frontendPath("/app"), "chat.html");
  assert.equal(frontendPath("/channels/@me/abc"), "chat.html");
  assert.equal(frontendPath("/instance-admin/users"), undefined);
  assert.equal(frontendPath("/instance-admin"), undefined);
  assert.throws(() => apiTarget("https://chat.example.com", "naigi://app/v1/instance-admin/auth/me"));
  assert.throws(() => apiTarget("https://chat.example.com", "naigi://app/v1/%69nstance-admin/auth/me"));
});

test("static assets cannot escape the bundled frontend directory", async () => {
  const root = path.resolve(".build/frontend");
  assert.equal(await assetPath(root, "/assets/twemoji/1f600.svg"), path.join(root, "assets/twemoji/1f600.svg"));
  assert.equal(await assetPath(root, "/%2e%2e/package.json"), undefined);
  assert.equal(await assetPath(root, "/%5c..%5cpackage.json"), undefined);
});
