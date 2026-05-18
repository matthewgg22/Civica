import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(HERE, "../fixtures");

async function loadFixture(relativePath: string): Promise<unknown> {
  const buf = await readFile(resolve(FIXTURE_ROOT, relativePath), "utf-8");
  return JSON.parse(buf);
}

interface Route {
  match: (req: Request) => boolean;
  status?: number;
  fixture: string;
}

export function makeFakeFetch(routes: Route[]): typeof fetch {
  return (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    for (const route of routes) {
      if (route.match(req)) {
        const body = await loadFixture(route.fixture);
        return new Response(JSON.stringify(body), {
          status: route.status ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(`no fixture for ${req.method} ${req.url}`, { status: 599 });
  }) as unknown as typeof fetch;
}
