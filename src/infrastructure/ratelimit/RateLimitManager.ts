import { DefaultContext, rateLimit } from "elysia-rate-limit";

interface IRateLimitDerived {
  clientIp?: unknown;
  rateLimitEmail?: unknown;
}

export interface ILimiterOptions {
  /** Key namespace; also keeps buckets of different limiters apart. */
  name: string;
  /** Read on every request so limits follow the current configuration. */
  max: () => number;
  durationMs: number;
  key: (derived: { clientIp: string; rateLimitEmail: string }) => string;
}

class RateLimitManager {
  private stores = new Set<DefaultContext>();

  /**
   * A rate-limit plugin whose hooks apply only to the routes of the
   * instance that `.use()`s it (`scoping: "scoped"`). Failed requests are
   * counted, so failed logins consume the budget. Buckets are kept in
   * process memory (single node).
   */
  limiter(opts: ILimiterOptions) {
    const store = new DefaultContext();
    this.stores.add(store);

    return rateLimit({
      scoping: "scoped",
      duration: opts.durationMs,
      // A function also gives each limiter a unique plugin seed, so two
      // limiters with equal numbers are never de-duplicated by Elysia.
      max: () => opts.max(),
      countFailedRequest: true,
      context: store,
      generator: (_request, _server, derived: IRateLimitDerived) =>
        `${opts.name}:${opts.key({
          clientIp:
            typeof derived.clientIp === "string" ? derived.clientIp : "unknown",
          rateLimitEmail:
            typeof derived.rateLimitEmail === "string"
              ? derived.rateLimitEmail
              : "",
        })}`,
      errorResponse: new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded, retry later",
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    });
  }

  /** Clears every bucket (used between tests). */
  async resetAll() {
    for (const store of this.stores) {
      await store.reset();
    }
  }
}

export default new RateLimitManager();
