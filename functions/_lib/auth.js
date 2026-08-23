// functions/_lib/auth.js
// Shared auth helpers for the admin API (Cloudflare Pages Functions).
// Zero-dependency session auth: an HMAC-SHA256-signed HttpOnly cookie,
// signed with the AUTH_SECRET env secret using Web Crypto.
// Underscore-prefixed directories are NOT routed by Pages Functions.

const COOKIE_NAME = "su_admin_session";
const MAX_AGE = 2592000; // 30 days in seconds
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** JSON response helper. */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** base64url encode a byte array (RFC 4648 §5). */
function base64urlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url decode back to a byte array. Throws on malformed input. */
function base64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Sign a payload object into a session token:
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadB64, AUTH_SECRET))
 */
export async function sign(payload, secret) {
  const key = await hmacKey(secret);
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Verify a session token: recompute the HMAC (constant-time via
 * crypto.subtle.verify) and check the exp claim. Returns the payload on
 * success, or null when invalid/expired/malformed.
 */
export async function verify(token, secret) {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigB64),
      encoder.encode(payloadB64)
    );
    if (!ok) return null;
    const payload = JSON.parse(decoder.decode(base64urlDecode(payloadB64)));
    if (!payload || typeof payload.role !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Parse the Cookie header into a { name: value } map. */
export function parseCookies(request) {
  const cookies = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }
  return cookies;
}

/**
 * Gate an endpoint on a valid admin session. Returns the payload object on
 * success, or a Response on failure — callers should do
 * `const session = await requireSession(request, env); if (session instanceof Response) return session;`
 * The payload carries { sub: email, role: "admin"|"editor", exp }.
 */
export async function requireSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];
  const payload = token ? await verify(token, env.AUTH_SECRET) : null;
  if (!payload) {
    return json({ error: "Unauthorized" }, 401);
  }
  return payload;
}

/** requireSession + role check. Editors are rejected with 403. */
export async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (session.role !== "admin") {
    return json({ error: "Admins only" }, 403);
  }
  return session;
}

/** Set-Cookie header value for the session cookie (HttpOnly, Secure, SameSite=Lax, 30 days). */
export function sessionCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
  ].join("; ");
}

/** Set-Cookie header value that clears the session cookie immediately. */
export function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

/**
 * Constant-time string comparison: HMAC both sides with AUTH_SECRET and let
 * crypto.subtle.verify do the comparison — never a plain `===` on secrets.
 */
export async function safeEqual(candidate, actual, secret) {
  try {
    const key = await hmacKey(secret);
    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(actual));
    return crypto.subtle.verify("HMAC", key, expected, encoder.encode(candidate));
  } catch {
    return false;
  }
}
