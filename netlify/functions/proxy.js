// netlify/functions/proxy.js
const BAD = new Set(["connection","transfer-encoding","content-length","host"]);

function pickForwardHeaders(h = {}) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    const lk = k.toLowerCase();
    // Forward useful headers from the browser (Range is important for video)
    if (["range","accept","accept-language","accept-encoding","cache-control"].includes(lk)) {
      out[lk] = v;
    }
  }
  return out;
}

function ua() {
  // A normal desktop UA to satisfy picky CDNs
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";
}

// Optional site-specific overrides if a host needs a particular referer
const OVERRIDES = {
  // example:
  // "video.cdn-example.com": { referer: "https://example.com/", origin: "https://example.com" }
};

exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: cors(),
    };
  }

  // Expect /proxy?url=<encoded>
  let target = null;
  try {
    const params = new URLSearchParams(event.rawQuery || "");
    target = params.get("url");
  } catch (_) {}

  if (!target) {
    return { statusCode: 400, body: "Missing ?url=" };
  }

  let u;
  try { u = new URL(target); } catch { return { statusCode: 400, body: "Bad URL" }; }

  // Build upstream headers
  const fwd = pickForwardHeaders(event.headers);
  const host = u.host.toLowerCase();
  const o = OVERRIDES[host] || {};
  const hdrs = {
    ...fwd,
    "user-agent": ua(),
    "referer": o.referer || `${u.protocol}//${u.host}/`,
    "origin":  o.origin  || `${u.protocol}//${u.host}`,
  };

  let upstream;
  try {
    upstream = await fetch(u.toString(), {
      method: "GET", // force GET for safety (HLS usually GETs)
      headers: hdrs,
      redirect: "follow",
    });
  } catch (e) {
    return { statusCode: 502, headers: cors(), body: "Upstream fetch failed" };
  }

  // Copy headers through
  const headers = Object.fromEntries(upstream.headers.entries());
  Object.assign(headers, cors());

  const buf = Buffer.from(await upstream.arrayBuffer());
  return {
    statusCode: upstream.status,
    headers,
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
};

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
  };
}
