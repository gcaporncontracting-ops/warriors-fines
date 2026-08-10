// src/worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/store") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      if (request.method === "GET") {
        const value = await env.FINES_KV.get(key);
        return new Response(value ?? "null", {
          headers: { "content-type": "application/json", "cache-control": "no-store" }
        });
      }
      if (request.method === "POST") {
        const sensitiveKeys = ["nominations", "payments", "payment_info", "wheel_options"];
        if (sensitiveKeys.includes(key)) {
          const passcode = request.headers.get("X-Admin-Passcode");
          if (passcode !== env.ADMIN_PASSCODE) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" }
            });
          }
        }
        const body = await request.text();
        try {
          JSON.parse(body);
        } catch {
          return new Response(JSON.stringify({ error: "Body must be valid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }
        await env.FINES_KV.put(key, body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("Method not allowed", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  worker_default as default
};
