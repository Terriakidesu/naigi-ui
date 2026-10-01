const http = require("node:http");
const { randomBytes } = require("node:crypto");
const WebSocket = require("ws");
const { APP_ORIGIN } = require("./desktop-protocol.cjs");
const { cookieHeader } = require("./session-cookies.cjs");

function validCloseCode(code) {
  return code === 1000
    || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code))
    || (code >= 3000 && code < 5000);
}

function closePeer(peer, code, reason) {
  if (peer.readyState !== WebSocket.OPEN && peer.readyState !== WebSocket.CONNECTING) return;
  const safeCode = validCloseCode(code) ? code : 1000;
  const safeReason = Buffer.byteLength(reason) <= 123 ? reason : "";
  try {
    peer.close(safeCode, safeReason);
  } catch {
    peer.terminate();
  }
}

function connectPair(client, remote) {
  client.on("message", (data, isBinary) => {
    if (remote.readyState === WebSocket.OPEN) remote.send(data, { binary: isBinary });
  });
  remote.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });
  client.on("close", (code, reason) => {
    closePeer(remote, code, reason);
  });
  remote.on("close", (code, reason) => {
    closePeer(client, code, reason);
  });
  client.on("error", () => remote.terminate());
  remote.on("error", () => client.close(1011, "Realtime server unavailable."));
}

async function createRealtimeProxy({ serverOrigin, session }) {
  const token = randomBytes(24).toString("base64url");
  const expectedPath = `/realtime/${token}`;
  const server = http.createServer((_request, response) => {
    response.writeHead(404, { "content-type": "text/plain", "cache-control": "no-store" });
    response.end("Not found");
  });
  const webSockets = new WebSocket.WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url, `http://${request.headers.host}`);
    } catch {
      socket.destroy();
      return;
    }
    const expectedHost = `127.0.0.1:${server.address()?.port}`;
    if (requestUrl.pathname !== expectedPath || request.headers.host !== expectedHost || request.headers.origin !== APP_ORIGIN) {
      socket.destroy();
      return;
    }

    void (async () => {
      const target = new URL("/v1/realtime", serverOrigin);
      const cookies = await session.cookies.get({ url: target.href });
      target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
      const remote = new WebSocket(target, {
        origin: serverOrigin,
        headers: cookies.length ? { cookie: cookieHeader(cookies) } : {},
        handshakeTimeout: 15_000,
        maxPayload: 16 * 1024 * 1024,
      });
      const timeout = setTimeout(() => socket.destroy(), 15_000);
      remote.once("open", () => {
        clearTimeout(timeout);
        webSockets.handleUpgrade(request, socket, head, (client) => connectPair(client, remote));
      });
      remote.once("error", () => {
        clearTimeout(timeout);
        socket.destroy();
      });
      socket.once("close", () => {
        clearTimeout(timeout);
        remote.terminate();
      });
    })().catch(() => socket.destroy());
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  return {
    url: `ws://127.0.0.1:${port}${expectedPath}`,
    close() {
      for (const client of webSockets.clients) client.close(1001, "Desktop connection closed.");
      webSockets.close();
      server.close();
    },
  };
}

module.exports = { closePeer, cookieHeader, createRealtimeProxy, validCloseCode };
