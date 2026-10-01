const fs = require("node:fs/promises");
const path = require("node:path");

const APP_ORIGIN = "naigi://app";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
  "frame-src https://www.youtube-nocookie.com",
].join("; ");

const pageRoutes = new Map([
  ["/", "index.html"],
  ["/register", "register.html"],
  ["/unlock", "unlock.html"],
  ["/app", "chat.html"],
  ["/new", "new.html"],
  ["/settings", "settings.html"],
  ["/server-settings", "server-settings.html"],
]);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

function apiTarget(serverOrigin, requestUrl) {
  const url = new URL(requestUrl);
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("Malformed API path.");
  }
  if (url.protocol !== "naigi:" || url.hostname !== "app" || url.port || url.username || url.password
    || !/^\/v1(?:\/|$)/.test(url.pathname)
    || /^\/v1\/instance-admin(?:\/|$)/i.test(decodedPathname)) {
    throw new Error("Only Naigi v1 API requests may be proxied.");
  }
  const target = new URL(`${url.pathname}${url.search}`, serverOrigin);
  if (target.origin !== serverOrigin) throw new Error("API target escaped the selected server.");
  return target;
}

function frontendPath(pathname) {
  if (pageRoutes.has(pathname)) return pageRoutes.get(pathname);
  if (/^\/channels\/[^/]+\/[^/]+$/.test(pathname)) return "chat.html";
  if (/^\/instance-admin(?:\/|$)/.test(pathname)) return undefined;
  if (!pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("\0")) return undefined;
  return pathname.slice(1);
}

async function assetPath(frontendRoot, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const relative = frontendPath(decoded);
  if (!relative) return undefined;
  const root = path.resolve(frontendRoot);
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return undefined;
  return candidate;
}

function failure(status, error) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

async function createProtocolHandler({ frontendRoot, serverOrigin, session, fetchApi }) {
  return async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return failure(400, "invalid_request");
    }
    if (url.protocol !== "naigi:" || url.hostname !== "app" || url.port || url.username || url.password) {
      return failure(403, "untrusted_origin");
    }

    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      if (!new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]).has(request.method)) {
        return failure(405, "method_not_allowed");
      }
      try {
        return await fetchApi(request, session, serverOrigin);
      } catch {
        return failure(502, "server_unavailable");
      }
    }

    if (!new Set(["GET", "HEAD"]).has(request.method)) return failure(405, "method_not_allowed");
    const filename = await assetPath(frontendRoot, url.pathname);
    if (!filename) return failure(404, "not_found");

    let data;
    try {
      data = await fs.readFile(filename);
    } catch {
      return failure(404, "not_found");
    }

    const extension = path.extname(filename).toLowerCase();
    const headers = new Headers({
      "content-type": mimeTypes.get(extension) ?? "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    if (extension === ".html") {
      headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
      if (!data.toString("utf8").includes('src="/desktop.js"')) {
        data = Buffer.from(data.toString("utf8").replace("</body>", '<script type="module" src="/desktop.js"></script></body>'));
      }
    }
    if (path.basename(filename) === "push-sw.js") headers.set("service-worker-allowed", "/");
    return new Response(request.method === "HEAD" ? null : data, { status: 200, headers });
  };
}

module.exports = {
  APP_ORIGIN,
  CONTENT_SECURITY_POLICY,
  apiTarget,
  assetPath,
  createProtocolHandler,
  frontendPath,
};
