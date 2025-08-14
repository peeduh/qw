// netlify/functions/proxy.js
export async function handler(event) {
  const params = new URLSearchParams(event.rawQuery || "");
  const target = params.get("url");
  if (!target) {
    return { statusCode: 400, body: "Missing ?url=" };
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: event.httpMethod,
      headers: event.headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });
  } catch (err) {
    return { statusCode: 502, body: "Upstream fetch failed." };
  }

  const headers = Object.fromEntries(upstream.headers.entries());
  // Allow your frontend to read the response
  headers["access-control-allow-origin"] = "*";
  headers["access-control-allow-headers"] = "*";
  headers["access-control-allow-methods"] = "GET,HEAD,POST,OPTIONS";

  const arrayBuf = await upstream.arrayBuffer();
  const body = Buffer.from(arrayBuf).toString("base64");

  return {
    statusCode: upstream.status,
    headers,
    body,
    isBase64Encoded: true, // lets binary (m3u8/ts/m4s) pass through safely
  };
}
