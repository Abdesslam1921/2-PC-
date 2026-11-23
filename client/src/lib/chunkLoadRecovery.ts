/**
 * Recovery for stale lazy chunks after a deploy.
 *
 * A tab opened before a release still references old hashed chunk names. The
 * first navigation to a lazily loaded route then fails to fetch the chunk.
 * Reloading the page once picks up the new index.html and chunk names.
 *
 * The marker prevents a reload loop: within the window we do not reload again,
 * so a genuinely broken deployment falls back to the error UI instead of
 * reloading forever.
 */
const STORAGE_KEY = "storefront:chunk-reload-at";
const RELOAD_WINDOW_MS = 10_000;

let memoryMarker = 0;

export function isChunkLoadError(error: unknown): boolean {
  let message = "";
  if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
  } else if (error && typeof error === "object" && "name" in error) {
    const named = error as { name?: unknown; message?: unknown };
    message = `${String(named.name ?? "")}: ${String(named.message ?? "")}`;
  } else {
    message = String(error ?? "");
  }
  return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message
  );
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export interface TryChunkReloadOptions {
  now?: number;
  storage?: StorageLike | null;
  reload?: () => void;
}

/**
 * Returns true when a reload was triggered, false when the recent marker
 * suppressed a second automatic reload.
 */
export function tryChunkReload(options: TryChunkReloadOptions = {}): boolean {
  const now = options.now ?? Date.now();
  const reload = options.reload ?? (() => window.location.reload());
  const storage = options.storage === undefined ? defaultStorage() : options.storage;

  let last = memoryMarker;
  if (storage) {
    try {
      last = Number(storage.getItem(STORAGE_KEY) || 0) || last;
    } catch {
      // Storage can be blocked (private mode/webview): keep the memory marker.
    }
  }
  if (last > 0 && now - last < RELOAD_WINDOW_MS) return false;

  memoryMarker = now;
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Ignore storage failures; the memory marker still guards this tab.
    }
  }
  reload();
  return true;
}

/** Test helper: clears the in-memory marker. */
export function resetChunkReloadMarkerForTests(): void {
  memoryMarker = 0;
}
