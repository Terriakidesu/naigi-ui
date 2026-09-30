const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeServerUrl } = require("../src/server-url.cjs");

test("accepts HTTPS origins and loopback development servers", () => {
  assert.equal(normalizeServerUrl("https://chat.example.com/"), "https://chat.example.com");
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(normalizeServerUrl(`http://${host}:3000`), `http://${host}:3000`);
  }
});

test("rejects insecure remote servers, credentials, paths and other schemes", () => {
  for (const value of ["http://chat.example.com", "https://user:pass@chat.example.com", "https://chat.example.com/chat", "https://chat.example.com?key=secret", "https://chat.example.com/#x", "file:///tmp/chat", "javascript:alert(1)", "not a URL"]) {
    assert.throws(() => normalizeServerUrl(value));
  }
});
