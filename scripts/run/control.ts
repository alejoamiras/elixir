// A run's control server: what a browser spec cannot do from the page — settle an epoch, nudge the
// chain, forward the archive, flip a version — behind named POST handlers on a registry-claimed
// loopback port. The spec calls them between its own steps; each answers when the work is done.
export type ControlHandlers = Record<string, (body: unknown) => Promise<unknown>>;

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x));

/** Serves `handlers` under `/<name>`; a handler's throw is a 500 with its message, never a crash. */
export function serveControl(port: number, handlers: ControlHandlers): { url: string; stop: () => void } {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const name = new URL(req.url).pathname.replace(/^\//, '');
      const handler = handlers[name];
      if (req.method !== 'POST' || !handler)
        return new Response(json({ ok: false, error: `no control named ${name}` }), { status: 404 });
      let body: unknown = {};
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        /* an empty or non-JSON body is `{}` */
      }
      try {
        return new Response(json({ ok: true, result: await handler(body) }), {
          headers: { 'content-type': 'application/json' },
        });
      } catch (e) {
        return new Response(json({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
    },
  });
  return { url: `http://127.0.0.1:${port}`, stop: () => void server.stop(true) };
}
