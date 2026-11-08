import { eq } from "drizzle-orm";
import { IApp } from "bedest-core";
import { SSystemSetting } from "../schemas/SSystemSetting";

const MAINTENANCE_KEY = "maintenance_mode";

/**
 * Maintenance mode [BUG-08]: the database is the source of truth (shared by
 * every node), read through a short in-process cache (bedest-lite has no
 * Redis: other processes see a change within the cache TTL).
 */
export class ServiceSystem {
  private cache: { value: boolean; expiresAt: number } | undefined;

  constructor(
    private readonly ttlMs = 5000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Forget the cached value (Redis invalidation, tests). */
  invalidate() {
    this.cache = undefined;
  }

  async getMaintenance(c: IApp): Promise<boolean> {
    const now = this.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }
    const [row] = await c.db
      .select({ value: SSystemSetting.value })
      .from(SSystemSetting)
      .where(eq(SSystemSetting.key, MAINTENANCE_KEY))
      .limit(1);
    const value = row?.value === true;
    this.cache = { value, expiresAt: now + this.ttlMs };
    return value;
  }

  /** Persists the flag; a failed write propagates (500), never silently local. */
  async setMaintenance(c: IApp, status: boolean): Promise<void> {
    await c.db
      .insert(SSystemSetting)
      .values({ key: MAINTENANCE_KEY, value: status, updatedAt: c.nowDatetime })
      .onConflictDoUpdate({
        target: SSystemSetting.key,
        set: { value: status, updatedAt: c.nowDatetime },
      });
    this.cache = { value: status, expiresAt: this.now() + this.ttlMs };
  }
}

export default new ServiceSystem();
