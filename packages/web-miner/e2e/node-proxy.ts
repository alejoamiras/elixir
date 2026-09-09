// Two forwarding proxies in front of the isolated node, so a spec can switch the miner between two
// distinct endpoints and watch each one's traffic: `GET /__stats` counts the JSON-RPC requests an
// endpoint forwarded, `POST /__mode {"mode":"ok"|"down"|"throttled"}` makes it answer 503 (a node
// that stopped serving) or 429 with a Retry-After (a public node rate-limiting the page) instead,
// and the browser talks to them across origins under CORS.
//
//   bun e2e/node-proxy.ts <upstream-url> <port-a> <port-b>
const [upstream, ...ports] = process.argv.slice(2);
if (!upstream || ports.length !== 2) throw new Error('usage: node-proxy.ts <upstream> <port-a> <port-b>');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-expose-headers': 'retry-after',
};

type Mode = 'ok' | 'down' | 'throttled';

const refusal = (mode: Exclude<Mode, 'ok'>) =>
  mode === 'down'
    ? new Response('{"error":{"message":"node down"}}', {
        status: 503,
        headers: { ...CORS, 'content-type': 'application/json' },
      })
    : new Response('{"error":{"message":"rate limited"}}', {
        status: 429,
        headers: { ...CORS, 'content-type': 'application/json', 'retry-after': '60' },
      });

function serve(port: number) {
  const state = { count: 0, mode: 'ok' as Mode };
  Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (url.pathname === '/__stats') return Response.json(state, { headers: CORS });
      if (url.pathname === '/__mode') {
        state.mode = ((await req.json()) as { mode: Mode }).mode;
        return Response.json(state, { headers: CORS });
      }
      state.count++;
      if (state.mode !== 'ok') return refusal(state.mode);
      const res = await fetch(upstream, {
        method: req.method,
        headers: { 'content-type': req.headers.get('content-type') ?? 'application/json' },
        body: req.method === 'POST' ? await req.text() : undefined,
      });
      return new Response(await res.arrayBuffer(), {
        status: res.status,
        headers: { ...CORS, 'content-type': res.headers.get('content-type') ?? 'application/json' },
      });
    },
  });
  console.log(`node-proxy: http://127.0.0.1:${port} → ${upstream}`);
}

for (const p of ports) serve(Number(p));
