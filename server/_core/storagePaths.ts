import path from "path";

/** Absolute root every stored file must stay inside. */
export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "file_storage");

/**
 * Normalise an untrusted storage key and refuse anything that could escape the
 * storage root.
 *
 * The HTTP layer already decodes the URL once, so an explicit extra decode here
 * also catches double-encoding (`%252e%252e%252f` → `../`). After decoding we
 * refuse (in order): NUL bytes, backslashes, absolute paths, any residual
 * percent-escape (over-encoded input) and `..`/`.` path segments. The caller is
 * still expected to resolve the result inside the root as the final check.
 *
 * Returns the normalised key (`a/b/c`) or `null` when the input is unsafe.
 */
export function sanitizeStorageKey(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let decoded = raw;
  if (decoded.includes("\0") || /%00/i.test(decoded)) return null;

  for (let pass = 0; pass < 2; pass += 1) {
    if (!/%[0-9a-fA-F]{2}/.test(decoded)) break;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  // Anything still percent-encoded after two passes is deliberately over-encoded.
  if (/%[0-9a-fA-F]{2}/.test(decoded)) return null;
  if (decoded.includes("\0")) return null;
  if (decoded.includes("\\")) return null;
  if (path.isAbsolute(decoded)) return null;

  const segments = decoded.split("/").filter(segment => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.some(segment => segment === "." || segment === "..")) return null;
  return segments.join("/");
}

/**
 * Resolve a normalised key inside the storage root. Returns the absolute path,
 * or `null` when the resolved path would fall outside the root. This is the
 * authoritative containment check — the string checks above are only a filter.
 */
export function resolveWithinStorageRoot(key: string): string | null {
  const root = path.resolve(LOCAL_STORAGE_ROOT);
  const target = path.resolve(root, key);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(prefix)) return null;
  return target;
}
