import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isChunkLoadError,
  resetChunkReloadMarkerForTests,
  tryChunkReload,
} from "./chunkLoadRecovery";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("chunk load recovery", () => {
  beforeEach(() => {
    resetChunkReloadMarkerForTests();
  });

  it("recognises stale-chunk failures but not ordinary errors", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Failed to fetch dynamically imported module: https://x/assets/A.js"
        )
      )
    ).toBe(true);
    expect(
      isChunkLoadError(new Error("Importing a module script failed."))
    ).toBe(true);
    expect(isChunkLoadError({ name: "ChunkLoadError" })).toBe(true);
    expect(isChunkLoadError(new Error("network down"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("reloads once, suppresses a loop, then allows a later deploy", () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    expect(
      tryChunkReload({ storage, reload, now: 1_000 })
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // Same stale tab failing again within the window: no second reload.
    expect(
      tryChunkReload({ storage, reload, now: 5_000 })
    ).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    // A later failure (new deploy) may reload again.
    expect(
      tryChunkReload({ storage, reload, now: 20_000 })
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("still guards when storage is unavailable", () => {
    const reload = vi.fn();
    expect(tryChunkReload({ storage: null, reload, now: 100 })).toBe(true);
    expect(tryChunkReload({ storage: null, reload, now: 200 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
