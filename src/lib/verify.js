/**
 * HMAC-SHA256 verification for signed fingerprints.
 * Matches the Laravel "kapalong/cdn-signer" package.
 */

const enc = new TextEncoder();

export async function verifyToken(token, expectedType, env) {
  if (!token || !token.includes(".")) {
    return { ok: false, status: 400, error: "Malformed token." };
  }

  if (!env.SIGNING_SECRET) {
    return { ok: false, status: 500, error: "Server misconfigured: SIGNING_SECRET missing." };
  }

  const [payloadB64, sig] = token.split(".");
  const sigLen = Number(env.SIG_LENGTH) || 16;

  // Recompute HMAC
  const expectedHex = await hmacHex(env.SIGNING_SECRET, payloadB64);
  const expectedShort = expectedHex.slice(0, sigLen);

  if (!constantTimeEqual(sig, expectedShort)) {
    return { ok: false, status: 403, error: "Invalid signature." };
  }

  // Decode payload
  let payload;
  try {
    const jsonStr = new TextDecoder().decode(base64urlDecode(payloadB64));
    payload = JSON.parse(jsonStr);
  } catch {
    return { ok: false, status: 400, error: "Bad payload." };
  }

  // Check type
  if (payload.t && payload.t !== expectedType) {
    return { ok: false, status: 403, error: "Type mismatch." };
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { ok: false, status: 410, error: "Link expired." };
  }

  // Sanity-check GDrive ID
  if (!payload.id || !/^[A-Za-z0-9_-]{20,}$/.test(payload.id)) {
    return { ok: false, status: 400, error: "Bad file id in payload." };
  }

  return { ok: true, payload };
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function base64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
