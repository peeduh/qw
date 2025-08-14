// netlify/functions/proxy.js
export async function handler(event) {
  // Handle CORS preflight quickly
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
      },
    };
  }

  // 1) Try query param ?url=
  let urlParam = null;
  try {
    const params = new URLSearchParams(event.rawQuery || "");
    urlParam = params.get("url");
  } catch {}

  // 2) Or accept path-style: /proxy/<encoded-url> (splat forwarded by netlify.toml)
  let pathTarget = null;
  const path = event.path || "";
  const after = path.split("/.netlify/functions/proxy/")[1]    // when called directly
            || path.split("/proxy/")[1];                       // when called via pretty path
  if (after) {
    try { pathTarget = decodeURIComponent(after); } catch { pathTarget = after; }
  }

  const target = urlParam || pathTarget;
  if (!target) {
    return { statusCode: 400, body: "Missing target URL" };
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: event.httpMethod,
      headers: sanitizeHeaders(event.headers),
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });
  } catch (e) {
    return { statusCode: 502, body: "Upstream fetch failed" };
  }

  const headers = Object.fromEntries(upstream.headers.entries());
  headers["access-control-allow-origin"] = "*";
  headers["access-control-allow-headers"] = "*";
  headers["access-control-allow-methods"] = "GET,HEAD,POST,OPTIONS";

  const buf = Buffer.from(await upstream.arrayBuffer());
  return {
    statusCode: upstream.status,
    headers,
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
}

// Optional: remove hop-by-hop headers that can cause issues
function sanitizeHeaders(h = {}) {
  const bad = new Set([
    "connection","transfer-encoding","content-length","host","accept-encoding",
  ]);
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (!bad.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}
