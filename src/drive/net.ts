/*
 * THE APP'S NETWORK, FOR A DRIVE (drive debugging #4, Brad 2026-10-31: "yes i like it all"): each request it makes -
 * to the MCP server, a room, anything - as one "[net]" line: the method, the host and path (the query is dropped: it
 * can carry a token), the status and the time; a WebSocket's open, and at its close the code, the reason, how long it
 * lived and how many messages went each way. Never a body or a message's content. The same on every shell: fetch and
 * WebSocket are the app's own, wrapped where they stand. The drive's own socket (skip) is left alone.
 */
const where = (u: unknown): string => {
  try { const x = new URL(String(u)); return `${x.host}${x.pathname}`; } catch { return String(u).split('?')[0]; }
};

export function watchNet(say: (line: string) => void, skip: string): void {
  const g = globalThis as any;

  if (typeof g.fetch === 'function' && !g.fetch.__drive) {
    const original = g.fetch.bind(g);
    const traced = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url ?? String(input);
      const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
      const t0 = Date.now();
      try {
        const r = await original(input, init);
        say(`[net] ${method} ${where(url)} -> ${r.status} in ${Date.now() - t0} ms`);
        return r;
      } catch (e) {
        say(`[net] ${method} ${where(url)} -> failed in ${Date.now() - t0} ms: ${(e as Error)?.message ?? e}`);
        throw e;
      }
    };
    (traced as any).__drive = true;
    g.fetch = traced;
  }

  const WS = g.WebSocket;
  if (typeof WS === 'function' && !WS.__drive) {
    class Traced extends WS {
      static __drive = true;
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).startsWith(skip)) return;
        const self = this as any;
        const w = where(url);
        const t0 = Date.now();
        let into = 0;
        let out = 0;
        self.addEventListener('open', () => say(`[net] ws ${w} open in ${Date.now() - t0} ms`));
        self.addEventListener('message', () => { into++; });
        self.addEventListener('error', () => say(`[net] ws ${w} error`));
        self.addEventListener('close', (ev: any) => say(`[net] ws ${w} closed ${ev?.code ?? ''}${ev?.reason ? ` (${ev.reason})` : ''} after ${Math.round((Date.now() - t0) / 1000)} s - ${into} in, ${out} out`));
        const send = self.send.bind(self);
        self.send = (data: unknown) => { out++; return send(data); };
      }
    }
    g.WebSocket = Traced;
  }
}
