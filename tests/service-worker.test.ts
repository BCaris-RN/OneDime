import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(fetchAsset: typeof fetch) {
  const handlers = new Map<string, (event: any) => void>();
  let cachedBody = "cached-old";
  const cache = {
    addAll: vi.fn(async () => undefined),
    match: vi.fn(async () => new Response(cachedBody)),
    put: vi.fn(async (_request: Request, response: Response) => { cachedBody = await response.text(); })
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://onedime.test" }, addEventListener: (name: string, cb: (event: any) => void) => handlers.set(name, cb), skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
    caches: { open: vi.fn(async () => cache), match: vi.fn(async () => undefined), keys: vi.fn(async () => []) },
    fetch: fetchAsset,
    URL,
    Response
  });
  return { handlers, cache, getCachedBody: () => cachedBody };
}

function requestAsset(handlers: Map<string, (event: any) => void>, path: string) {
  let response: Promise<Response> | undefined;
  const waits: Promise<unknown>[] = [];
  handlers.get("fetch")!({
    request: new Request(`https://onedime.test${path}`),
    respondWith: (result: Promise<Response>) => { response = Promise.resolve(result); },
    waitUntil: (result: Promise<unknown>) => waits.push(Promise.resolve(result))
  });
  return { response, waits };
}

describe("service worker asset updates", () => {
  it("revalidates a cached asset while online and replaces the old bundle", async () => {
    const network = vi.fn(async () => new Response("deployed-new", { status: 200 }));
    const sw = worker(network as typeof fetch);
    const result = requestAsset(sw.handlers, "/app.js");
    expect(await result.response!.then(response => response.text())).toBe("deployed-new");
    await Promise.all(result.waits);
    expect(network).toHaveBeenCalledTimes(1);
    expect(sw.cache.put).toHaveBeenCalledTimes(1);
    expect(sw.getCachedBody()).toBe("deployed-new");
  });

  it("serves cached static assets while offline and never intercepts API responses", async () => {
    const network = vi.fn(async () => { throw new TypeError("offline"); });
    const sw = worker(network as typeof fetch);
    const result = requestAsset(sw.handlers, "/app.js");
    expect(await result.response!.then(response => response.text())).toBe("cached-old");

    const api = requestAsset(sw.handlers, "/api/stats");
    expect(api.response).toBeUndefined();
    expect(network).toHaveBeenCalledTimes(1);
  });
});
