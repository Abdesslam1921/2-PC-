// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

const recovery = vi.hoisted(() => ({
  tryChunkReload: vi.fn(() => true),
}));

vi.mock("@/lib/chunkLoadRecovery", () => ({
  isChunkLoadError: (error: unknown) =>
    /Failed to fetch dynamically imported module|ChunkLoadError/.test(
      String((error as Error)?.message ?? "")
    ),
  tryChunkReload: recovery.tryChunkReload,
}));

function Boom({ error }: { error: Error }): never {
  throw error;
}

describe("ErrorBoundary stale-chunk recovery", () => {
  beforeEach(() => {
    recovery.tryChunkReload.mockReset();
    recovery.tryChunkReload.mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("auto-reloads once for a failed lazy chunk", () => {
    render(
      <ErrorBoundary>
        <Boom
          error={
            new Error(
              "Failed to fetch dynamically imported module: /assets/Builder.js"
            )
          }
        />
      </ErrorBoundary>
    );
    expect(recovery.tryChunkReload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("جارٍ تحميل النسخة الجديدة من الصفحة...")).toBeTruthy();
  });

  it("shows a manual reload instead of looping when the guard suppresses it", () => {
    recovery.tryChunkReload.mockReturnValue(false);
    render(
      <ErrorBoundary>
        <Boom error={new Error("ChunkLoadError: Loading chunk 12 failed")} />
      </ErrorBoundary>
    );
    expect(screen.getByText("تعذّر تحميل جزء من الصفحة.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "إعادة تحميل الصفحة" })
    ).toBeTruthy();
  });

  it("keeps the ordinary error UI for non-chunk errors", () => {
    render(
      <ErrorBoundary>
        <Boom error={new Error("boom")} />
      </ErrorBoundary>
    );
    expect(recovery.tryChunkReload).not.toHaveBeenCalled();
    expect(screen.getByText("An unexpected error occurred.")).toBeTruthy();
  });
});
