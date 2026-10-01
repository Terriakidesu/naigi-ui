const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function cookieHeader(cookies) {
  return cookies
    .filter((cookie) => typeof cookie?.name === "string" && typeof cookie?.value === "string")
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

function splitCombinedSetCookie(value) {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/);
}

function setCookieHeaders(headers) {
  if (typeof headers?.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values;
  }

  const combined = headers?.get?.("set-cookie");
  return typeof combined === "string" && combined ? splitCombinedSetCookie(combined) : [];
}

function defaultCookiePath(pathname) {
  if (!pathname.startsWith("/") || pathname === "/") return "/";
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
}

function domainMatchesHost(domain, hostname) {
  const normalizedDomain = domain.replace(/^\./, "").toLowerCase();
  const normalizedHost = hostname.toLowerCase();
  if (!normalizedDomain || !normalizedHost) return false;
  if (normalizedDomain === normalizedHost) return true;
  if (normalizedHost.includes(":")) return false;
  return normalizedHost.endsWith(`.${normalizedDomain}`);
}

function parseSetCookie(value, requestUrl, now = Date.now()) {
  if (typeof value !== "string") return undefined;

  let request;
  try {
    request = new URL(requestUrl);
  } catch {
    return undefined;
  }
  if (request.protocol !== "http:" && request.protocol !== "https:") return undefined;

  const parts = value.split(";");
  const pair = parts.shift()?.trim() ?? "";
  const equals = pair.indexOf("=");
  if (equals <= 0) return undefined;

  const name = pair.slice(0, equals).trim();
  const cookieValue = pair.slice(equals + 1).trim();
  if (!COOKIE_NAME.test(name) || /[\u0000-\u001f\u007f;]/.test(cookieValue)) return undefined;

  const details = {
    url: `${request.origin}${request.pathname || "/"}`,
    name,
    value: cookieValue,
    path: defaultCookiePath(request.pathname || "/"),
  };
  let hasMaxAge = false;

  for (const rawAttribute of parts) {
    const attribute = rawAttribute.trim();
    if (!attribute) continue;
    const separator = attribute.indexOf("=");
    const key = (separator < 0 ? attribute : attribute.slice(0, separator)).trim().toLowerCase();
    const attributeValue = separator < 0 ? "" : attribute.slice(separator + 1).trim();
    if (key === "domain") {
      if (!domainMatchesHost(attributeValue, request.hostname)) return undefined;
      details.domain = attributeValue.toLowerCase();
    } else if (key === "path") {
      if (attributeValue.startsWith("/")) details.path = attributeValue;
    } else if (key === "secure") {
      details.secure = true;
    } else if (key === "httponly") {
      details.httpOnly = true;
    } else if (key === "samesite") {
      const sameSite = attributeValue.toLowerCase();
      if (sameSite === "strict" || sameSite === "lax") details.sameSite = sameSite;
      else if (sameSite === "none") details.sameSite = "no_restriction";
    } else if (key === "max-age") {
      const seconds = Number.parseInt(attributeValue, 10);
      if (Number.isFinite(seconds)) {
        hasMaxAge = true;
        details.expirationDate = seconds <= 0 ? 0 : Math.floor(now / 1000) + seconds;
      }
    } else if (key === "expires" && !hasMaxAge) {
      const expiresAt = Date.parse(attributeValue);
      if (Number.isFinite(expiresAt)) details.expirationDate = Math.floor(expiresAt / 1000);
    }
  }

  return details;
}

async function storeResponseCookies(session, response, requestUrl, now = Date.now()) {
  for (const value of setCookieHeaders(response.headers)) {
    const details = parseSetCookie(value, requestUrl, now);
    if (details) await session.cookies.set(details);
  }
}

module.exports = {
  cookieHeader,
  parseSetCookie,
  setCookieHeaders,
  storeResponseCookies,
};
