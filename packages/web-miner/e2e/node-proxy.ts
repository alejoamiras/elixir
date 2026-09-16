// Two forwarding proxies in front of the isolated node, so a spec can switch the miner between two
// distinct endpoints and watch each one's traffic: `GET /__stats` counts the JSON-RPC requests an
// endpoint forwarded, `POST /__mode {"mode":"ok"|"down"|"throttled"|"foreign"}` makes it answer 503
// (a node that stopped serving), 429 with a Retry-After (a public node rate-limiting the page), or
// forward everything but report another rollup address (a node of some other deployment), and the
// browser talks to them across origins under CORS.
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

type Mode = 'ok' | 'down' | 'throttled' | 'foreign';

/** The upstream's node info with its rollup address altered in the last digit: another deployment's node. */
const foreignInfo = (body: string): string =>
  body.replace(/("rollupAddress":"0x[0-9a-fA-F]{39})([0-9a-fA-F])"/, (_, head: string, last: string) => {
    const flipped = ((Number.parseInt(last, 16) + 1) % 16).toString(16);
    return `${head}${flipped}"`;
  });

const refusal = (mode: Exclude<Mode, 'ok' | 'foreign'>) =>
  mode === 'down'
    ? new Response('{"error":{"message":"node down"}}', {
        status: 503,
        headers: { ...CORS, 'content-type': 'application/json' },
      })
    : new Response('{"error":{"message":"rate limited"}}', {
        status: 429,
        headers: { ...CORS, 'content-type': 'application/json', 'retry-after': '60' },
      });

/** The request to the upstream and its answer back, the node info altered when `foreign`. */
async function forward(req: Request, foreign: boolean): Promise<Response> {
  const body = req.method === 'POST' ? await req.text() : undefined;
  const res = await fetch(upstream, {
    method: req.method,
    headers: { 'content-type': req.headers.get('content-type') ?? 'application/json' },
    body,
  });
  const answer =
    foreign && body?.includes('node_getNodeInfo') ? foreignInfo(await res.text()) : await res.arrayBuffer();
  return new Response(answer, {
    status: res.status,
    headers: { ...CORS, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

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
      if (state.mode !== 'ok' && state.mode !== 'foreign') return refusal(state.mode);
      return forward(req, state.mode === 'foreign');
    },
  });
  console.log(`node-proxy: http://127.0.0.1:${port} → ${upstream}`);
}

for (const p of ports) serve(Number(p));
