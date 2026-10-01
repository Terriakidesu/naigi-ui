const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseSetCookie, setCookieHeaders, storeResponseCookies } = require("../src/session-cookies.cjs");

test("server session cookies are converted to selected-origin Electron cookies", () => {
  assert.deepEqual(
    parseSetCookie(
      "priv_chat_session=token; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure",
      "https://naigi.local/v1/auth/login",
      1_700_000_000_000,
    ),
    {
      url: "https://naigi.local/v1/auth/login",
      name: "priv_chat_session",
      value: "token",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      expirationDate: 1_700_003_600,
      secure: true,
    },
  );
});

test("cookie domains cannot escape the selected server", () => {
  assert.equal(
    parseSetCookie("session=token; Domain=other.example", "https://naigi.local/v1/auth/login"),
    undefined,
  );
});

test("set-cookie headers preserve separate cookies and expiry cookies", () => {
  const headers = {
    getSetCookie: () => [
      "one=1; Path=/",
      "two=; Path=/; Max-Age=0",
    ],
  };
  assert.deepEqual(setCookieHeaders(headers), headers.getSetCookie());
});

test("response cookies are written before the proxied response is returned", async () => {
  const written = [];
  await storeResponseCookies(
    { cookies: { set: async (cookie) => written.push(cookie) } },
    { headers: { getSetCookie: () => ["priv_chat_session=token; Path=/; Max-Age=60"] } },
    "https://naigi.local/v1/auth/login",
    1_700_000_000_000,
  );
  assert.equal(written.length, 1);
  assert.equal(written[0].name, "priv_chat_session");
  assert.equal(written[0].expirationDate, 1_700_000_060);
});
