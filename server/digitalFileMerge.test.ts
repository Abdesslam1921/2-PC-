import { describe, expect, it } from "vitest";
import {
  mergeDigitalFileFields,
  type DigitalFileFields,
} from "./digitalFileMerge";

const stored: DigitalFileFields = {
  digitalFileName: "guide.pdf",
  digitalFileStorageKey: "digital-products/42/guide_abc123.pdf",
  digitalFileUrl: "/manus-storage/digital-products/42/guide_abc123.pdf",
  digitalFileSize: 5120,
  digitalFileMimeType: "application/pdf",
  digitalMaxDownloads: 5,
  digitalLinkValidityHours: 72,
};

describe("mergeDigitalFileFields — saving a digital product never wipes its file", () => {
  it("keeps every stored field when the input omits the file fields", () => {
    const merged = mergeDigitalFileFields(stored, {});
    expect(merged).toEqual(stored);
    expect(merged.digitalFileStorageKey).toBe(
      "digital-products/42/guide_abc123.pdf"
    );
    expect(merged.digitalFileUrl).toBe(
      "/manus-storage/digital-products/42/guide_abc123.pdf"
    );
  });

  it("keeps the file while allowing unrelated settings to change", () => {
    const merged = mergeDigitalFileFields(stored, { digitalMaxDownloads: 3 });
    expect(merged.digitalMaxDownloads).toBe(3);
    // The file reference is untouched.
    expect(merged.digitalFileStorageKey).toBe(stored.digitalFileStorageKey);
    expect(merged.digitalFileUrl).toBe(stored.digitalFileUrl);
    expect(merged.digitalFileName).toBe("guide.pdf");
  });

  it("only replaces the file when a new explicit value is provided", () => {
    const merged = mergeDigitalFileFields(stored, {
      digitalFileStorageKey: "digital-products/42/new_xyz789.pdf",
      digitalFileUrl: "/manus-storage/digital-products/42/new_xyz789.pdf",
      digitalFileName: "new.pdf",
    });
    expect(merged.digitalFileStorageKey).toBe(
      "digital-products/42/new_xyz789.pdf"
    );
    expect(merged.digitalFileName).toBe("new.pdf");
  });

  it("treats an explicit null as 'leave unchanged' (fail-safe, never wipes)", () => {
    const merged = mergeDigitalFileFields(stored, {
      digitalFileStorageKey: null,
      digitalFileUrl: null,
    });
    expect(merged.digitalFileStorageKey).toBe(stored.digitalFileStorageKey);
    expect(merged.digitalFileUrl).toBe(stored.digitalFileUrl);
  });

  it("stays null when there is no stored file and no input", () => {
    const merged = mergeDigitalFileFields({}, {});
    expect(merged.digitalFileStorageKey).toBeNull();
    expect(merged.digitalFileUrl).toBeNull();
  });
});
