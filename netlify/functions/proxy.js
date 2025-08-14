// CommonJS version so it runs regardless of your package.json "type"
const BAD = new Set(["connection","transfer-encoding","content-length","host","accept-encoding"]);

function sanitizeHeaders(h = {}) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (!BAD.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

exports.handler = async function (event) {
  // CORS preflight
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

  // We’ll support only query style: /proxy?url=<encoded>
  let target = null;
  try {
    const params = new URLSearchParams(event.rawQuery || "");
    target = params.get("url");
  } catch (_) {}

  if (!target) {
    return { statusCode: 400, body: "Missing ?url=" };
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: event.httpMethod,
      headers: sanitizeHeaders(event.headers),
      body: ["GET","HEAD"].includes(event.httpMethod) ? undefined : event.body,
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
};
