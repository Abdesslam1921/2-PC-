/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODERN_CONFIG } from "@shared/storefront/storefrontConfig";

const mocks = vi.hoisted(() => ({
  managed: {
    data: undefined as any,
    refetch: vi.fn(),
  },
  saveDraft: { mutateAsync: vi.fn() },
  publish: { mutateAsync: vi.fn() },
  rollback: { mutateAsync: vi.fn() },
  invalidate: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: {
      managed: { useQuery: () => mocks.managed },
      saveDraft: { useMutation: () => mocks.saveDraft },
      publish: { useMutation: () => mocks.publish },
      rollback: { useMutation: () => mocks.rollback },
    },
    useUtils: () => ({
      storefront: { managed: { invalidate: mocks.invalidate } },
    }),
  },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useStoreDraft } from "./useStoreDraft";

const waitForAutosave = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 1150));
  });
};

const seedManagedDraft = (version = 2) => {
  mocks.managed.data = {
    draft: {
      config: DEFAULT_MODERN_CONFIG,
      version,
    },
    published: null,
    publishedHealth: {
      ok: true,
      latestVersionNumber: null,
      servedVersionNumber: null,
      servedFallback: false,
      reason: null,
      normalizationDrops: 0,
    },
    versions: [],
  };
};

const emptyConfig = () => ({
  ...DEFAULT_MODERN_CONFIG,
  sections: [],
});

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.managed.refetch.mockResolvedValue({ data: mocks.managed.data });
  mocks.saveDraft.mutateAsync.mockResolvedValue({ conflict: false, version: 3 });
  mocks.publish.mutateAsync.mockResolvedValue({ versionNumber: 10 });
  mocks.rollback.mutateAsync.mockResolvedValue({
    versionNumber: 11,
    draftVersion: 4,
    config: DEFAULT_MODERN_CONFIG,
    draftConflict: false,
  });
});

afterEach(() => {
  cleanup();
});

describe("useStoreDraft â€” autosave concurrency", () => {
  it("batches rapid edits into one draft save and never publishes", async () => {
    seedManagedDraft(2);
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    act(() =>
      result.current.update({
        ...emptyConfig(),
        sections: [DEFAULT_MODERN_CONFIG.sections[0]],
      })
    );

    await waitForAutosave();

    expect(mocks.saveDraft.mutateAsync).toHaveBeenCalledTimes(1);
    const payload = mocks.saveDraft.mutateAsync.mock.calls[0][0];
    expect(payload.expectedVersion).toBe(2);
    // The LAST edit wins locally, but only one debounced write is sent.
    expect(payload.config.sections).toHaveLength(1);
    expect(mocks.publish.mutateAsync).not.toHaveBeenCalled();
  });

  it("reports a stale-save conflict without auto-overwriting the newer draft", async () => {
    seedManagedDraft(2);
    mocks.saveDraft.mutateAsync.mockResolvedValueOnce({
      conflict: true,
      currentVersion: 9,
    });
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    await waitForAutosave();

    expect(result.current.conflict).toBe(9);
    // No silent rebase/retry: exactly one save attempt, local edits stay dirty.
    expect(mocks.saveDraft.mutateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(true);
    expect(mocks.publish.mutateAsync).not.toHaveBeenCalled();
  });

  it("force-save is the only path that writes over a newer draft", async () => {
    seedManagedDraft(2);
    mocks.saveDraft.mutateAsync
      .mockResolvedValueOnce({ conflict: true, currentVersion: 9 })
      .mockResolvedValueOnce({ conflict: false, version: 10 });
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    await waitForAutosave();
    expect(result.current.conflict).toBe(9);

    await act(async () => {
      await result.current.forceSave();
    });

    expect(mocks.saveDraft.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.saveDraft.mutateAsync.mock.calls[1][0].expectedVersion).toBe(9);
    expect(result.current.conflict).toBeNull();
    expect(result.current.dirty).toBe(false);
  });

  it("publishes exactly the draft version it just flushed", async () => {
    seedManagedDraft(2);
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    await act(async () => {
      await result.current.publish();
    });

    expect(mocks.saveDraft.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.publish.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.publish.mutateAsync).toHaveBeenCalledWith({
      expectedDraftVersion: 3,
    });
  });

  it("does not publish when the flush hits a conflict", async () => {
    seedManagedDraft(2);
    mocks.saveDraft.mutateAsync.mockResolvedValueOnce({
      conflict: true,
      currentVersion: 4,
    });
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    await act(async () => {
      await result.current.publish();
    });

    expect(mocks.publish.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.conflict).toBe(4);
  });

  it("keeps dirty when an edit lands while the save is in flight", async () => {
    seedManagedDraft(2);
    let resolveSave: (value: unknown) => void = () => {};
    mocks.saveDraft.mutateAsync.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSave = resolve;
        })
    );
    const { result } = renderHook(() => useStoreDraft());
    await waitFor(() => expect(result.current.config).not.toBeNull());

    act(() => result.current.update(emptyConfig()));
    await waitForAutosave();
    // Save is in flight; a newer edit arrives before it resolves.
    act(() =>
      result.current.update({
        ...emptyConfig(),
        sections: [DEFAULT_MODERN_CONFIG.sections[0]],
      })
    );
    await act(async () => {
      resolveSave({ conflict: false, version: 3 });
      await Promise.resolve();
    });

    expect(result.current.dirty).toBe(true);
    expect(result.current.config?.sections).toHaveLength(1);
  });
});

