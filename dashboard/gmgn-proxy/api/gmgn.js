// Vercel Serverless Function — GMGN IPv4 Proxy
// CF Workers 走 IPv6 被 GMGN 拒绝，此函数运行在 AWS Lambda (IPv4)

const GMGN_BASE = "https://openapi.gmgn.ai";
const ALLOWED_ORIGINS = [
  "https://liquidityos-data.fanfan09132022.workers.dev",
  "http://localhost:8787",
];

module.exports = async function handler(req, res) {
  const origin = req.headers["origin"] || req.headers["referer"] || "";
  const corsOrigin = ALLOWED_ORIGINS.find((o) => origin.startsWith(o)) || ALLOWED_ORIGINS[0];

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "X-Proxy-Key");
    return res.status(204).end();
  }

  // Simple auth: CF Worker sends a shared secret
  const proxyKey = req.headers["x-proxy-key"];
  const expectedKey = process.env.PROXY_KEY;
  if (!expectedKey || proxyKey !== expectedKey) {
    return res.status(403).json({ error: "unauthorized" });
  }

  // Extract GMGN path from query
  const gmgnPath = req.query.path;
  if (!gmgnPath) {
    return res.status(400).json({ error: "missing path parameter" });
  }

  // Forward all other query params (except 'path') to GMGN
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== "path") params.set(key, value);
  }

  const gmgnApiKey = process.env.GMGN_API_KEY;
  if (!gmgnApiKey) {
    return res.status(500).json({ error: "GMGN_API_KEY not configured" });
  }

  // Add auth params
  params.set("timestamp", String(Math.floor(Date.now() / 1000)));
  params.set("client_id", `liquidityos_${Math.random().toString(36).slice(2, 8)}`);

  const url = `${GMGN_BASE}${gmgnPath}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const upstream = await fetch(url, {
      headers: {
        "X-APIKEY": gmgnApiKey,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const body = await upstream.text();

    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: "gmgn_upstream_failed", message: err.message });
  }
}
