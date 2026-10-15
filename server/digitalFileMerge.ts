/**
 * Preservation rule for a digital product's file reference.
 *
 * Editing a digital product must NEVER wipe its attached file just because the
 * edit form did not include the file fields. `updateStoreProduct` merges the
 * incoming input over the stored row: any field the caller did NOT send
 * (`undefined`) keeps the current value; only an explicit new value replaces it.
 * A deliberate `null` is treated as "leave unchanged" too (fail-safe: a digital
 * file is never wiped by an edit that does not carry a real replacement).
 *
 * This is what keeps `digitalFileStorageKey` / `digitalFileUrl` (and the file
 * metadata) intact across a save-without-touching-the-file, and it is the unit
 * under test in `digitalFileMerge.test.ts`.
 */
export type DigitalFileFields = {
  digitalFileName?: string | null;
  digitalFileStorageKey?: string | null;
  digitalFileUrl?: string | null;
  digitalFileSize?: number | null;
  digitalFileMimeType?: string | null;
  digitalMaxDownloads?: number | null;
  digitalLinkValidityHours?: number | null;
};

export function mergeDigitalFileFields<T extends DigitalFileFields>(
  current: T,
  input: Partial<DigitalFileFields>
): Required<DigitalFileFields> {
  return {
    digitalFileName: input.digitalFileName ?? current.digitalFileName ?? null,
    digitalFileStorageKey:
      input.digitalFileStorageKey ?? current.digitalFileStorageKey ?? null,
    digitalFileUrl: input.digitalFileUrl ?? current.digitalFileUrl ?? null,
    digitalFileSize: input.digitalFileSize ?? current.digitalFileSize ?? null,
    digitalFileMimeType:
      input.digitalFileMimeType ?? current.digitalFileMimeType ?? null,
    digitalMaxDownloads:
      input.digitalMaxDownloads ?? current.digitalMaxDownloads ?? null,
    digitalLinkValidityHours:
      input.digitalLinkValidityHours ?? current.digitalLinkValidityHours ?? null,
  };
}
