import { useCallback, useState } from "react";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

interface HistoryState {
  past: StorefrontConfig[];
  present: StorefrontConfig | null;
  future: StorefrontConfig[];
}

/**
 * Client-side undo/redo over local draft content. It never talks to the server
 * and never touches `concurrencyVersion` — that token is owned by the autosave
 * layer (`baseVersion`), which is updated only after a successful save.
 */
export function useDraftHistory(initial: StorefrontConfig | null) {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initial,
    future: [],
  });
  const [dirty, setDirty] = useState(false);

  const update = useCallback((next: StorefrontConfig) => {
    setState(s => ({
      past: s.present ? [...s.past, s.present] : s.past,
      present: next,
      future: [],
    }));
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setState(s => {
      if (!s.past.length || !s.present) return s;
      const prev = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: prev,
        future: [s.present, ...s.future],
      };
    });
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    setState(s => {
      if (!s.future.length || !s.present) return s;
      const [next, ...rest] = s.future;
      return { past: [...s.past, s.present], present: next, future: rest };
    });
    setDirty(true);
  }, []);

  const reset = useCallback((config: StorefrontConfig | null) => {
    setState({ past: [], present: config, future: [] });
    setDirty(false);
  }, []);

  const markSaved = useCallback(() => setDirty(false), []);

  return {
    config: state.present,
    update,
    undo,
    redo,
    reset,
    dirty,
    markSaved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
