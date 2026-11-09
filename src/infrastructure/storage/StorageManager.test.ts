import { describe, it, expect, beforeEach, mock } from "bun:test";
import StorageManager from "./StorageManager";
import { ProviderLocal } from "./providers/ProviderLocal";

const codeOf = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err ? err.code : err;

const failure = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  );

beforeEach(() => {
  // Other files replace StorageManager methods with spies.
  mock.restore();
});

describe("StorageManager", () => {
  it("[QLT-01] without a provider: health 'disabled', upload/download 503, delete is a no-op", async () => {
    const restore = StorageManager.useProviderForTesting(null);
    try {
      expect(await StorageManager.healthCheck()).toBe("disabled");
      expect(
        codeOf(
          await failure(
            StorageManager.upload("k", new ArrayBuffer(1), "image/png"),
          ),
        ),
      ).toBe(503);
      expect(codeOf(await failure(StorageManager.download("k")))).toBe(503);
      await StorageManager.delete("k");
    } finally {
      restore();
    }
  });

  it("[BUG-18] with a provider every call is delegated to it", async () => {
    const dir = `./test_uploads/storage-manager-${crypto.randomUUID()}`;
    const restore = StorageManager.useProviderForTesting(
      new ProviderLocal(dir),
    );
    try {
      expect(await StorageManager.healthCheck()).toBe("ok");
      await StorageManager.upload(
        "a.txt",
        new TextEncoder().encode("hi").buffer,
        "text/plain",
      );
      const object = await StorageManager.download("a.txt");
      expect(await new Response(object?.stream).text()).toBe("hi");
      await StorageManager.delete("a.txt");
      expect(await StorageManager.download("a.txt")).toBeNull();
    } finally {
      restore();
    }
  });
});
