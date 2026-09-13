// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDraftHistory } from "./useDraftHistory";
import { DEFAULT_MODERN_CONFIG } from "@shared/storefront/storefrontConfig";

describe("useDraftHistory (client-side undo/redo)", () => {
  it("tracks dirty state and supports undo/redo over content", () => {
    const { result } = renderHook(() => useDraftHistory(DEFAULT_MODERN_CONFIG));
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.update({ ...DEFAULT_MODERN_CONFIG, sections: [] });
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.config?.sections.length).toBe(0);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.config?.sections.length).toBe(
      DEFAULT_MODERN_CONFIG.sections.length
    );
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.config?.sections.length).toBe(0);

    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });

  it("reset clears history without marking dirty", () => {
    const { result } = renderHook(() => useDraftHistory(DEFAULT_MODERN_CONFIG));
    act(() => {
      result.current.update({ ...DEFAULT_MODERN_CONFIG, sections: [] });
    });
    act(() => result.current.reset(DEFAULT_MODERN_CONFIG));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.dirty).toBe(false);
  });
});
