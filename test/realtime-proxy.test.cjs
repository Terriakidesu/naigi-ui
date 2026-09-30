const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cookieHeader, validCloseCode } = require("../src/realtime-proxy.cjs");

test("WebSocket proxy cookie headers retain only name/value pairs", () => {
  assert.equal(cookieHeader([
    { name: "priv_chat_session", value: "abc" },
    { name: "theme", value: "dark" },
  ]), "priv_chat_session=abc; theme=dark");
  assert.equal(cookieHeader([]), "");
});

test("WebSocket proxy forwards only close codes permitted by the protocol", () => {
  assert.equal(validCloseCode(1000), true);
  assert.equal(validCloseCode(1001), true);
  assert.equal(validCloseCode(4001), true);
  assert.equal(validCloseCode(1005), false);
  assert.equal(validCloseCode(1006), false);
  assert.equal(validCloseCode(5000), false);
});
