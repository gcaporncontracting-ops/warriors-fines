// Cloudflare Pages Function: /api/store
// A tiny key/value API backed by a Cloudflare KV namespace, used by the
// Warriors Fines Wall in place of Claude's window.storage.
//
// Requires a KV namespace bound to this Pages project as "FINES_KV".
// (Cloudflare dashboard -> your Pages project -> Settings -> Functions ->
//  KV namespace bindings -> Variable name: FINES_KV)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const value = await env.FINES_KV.get(key);
  return new Response(value ?? 'null', {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.text();

  // basic guard so nothing invalid gets written
  try {
    JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be valid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  await env.FINES_KV.put(key, body);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
