import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { validateStorefrontConfig } from "@shared/storefront/storefrontConfig";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

const SEED_KEY = "sf-builder-seed";

/**
 * Per-section style overrides are editable again (section-scoped overrides on
 * top of the global theme), so loaded configs are used exactly as stored.
 */
function normalizeConfig(next: StorefrontConfig): StorefrontConfig {
  return next;
}

/**
 * Shared draft state for the unified store editor (content + theme).
 *
 * One global undo/redo stack over the whole config, one autosave pipeline with
 * optimistic concurrency, and flush-before-publish. It reuses the SAME
 * `storefront_drafts`/`versions` API — no new endpoints.
 */
export function useStoreDraft() {
  const managed = trpc.storefront.managed.useQuery();
  const saveDraft = trpc.storefront.saveDraft.useMutation();
  const publishMutation = trpc.storefront.publish.useMutation();
  const rollbackMutation = trpc.storefront.rollback.useMutation();
  const utils = trpc.useUtils();

  const [config, setConfigState] = useState<StorefrontConfig | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflict, setConflict] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const past = useRef<StorefrontConfig[]>([]);
  const future = useRef<StorefrontConfig[]>([]);
  const [histVersion, setHistVersion] = useState(0);
  const initialized = useRef(false);
  const seeded = useRef(false);

  // Seed from startEditing (instant), then reconcile with the server draft.
  useEffect(() => {
    if (initialized.current) return;
    try {
      const raw = sessionStorage.getItem(SEED_KEY);
      if (!raw) return;
      const seed = JSON.parse(raw) as { config?: StorefrontConfig; version?: number };
      sessionStorage.removeItem(SEED_KEY);
      if (seed?.config) {
        setConfigState(normalizeConfig(seed.config));
        setBaseVersion(seed.version ?? 0);
        initialized.current = true;
        seeded.current = true;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!managed.data) return;
    const draft = managed.data.draft;
    if (!draft?.config) return;
    if (initialized.current && config?.templateKey === draft.config.templateKey) {
      // Reconcile the concurrency version so autosave never uses a stale one
      // (a stale baseVersion would raise a conflict and keep Publish disabled).
      setBaseVersion(draft.version ?? 0);
      return;
    }
    if (seeded.current) {
      setBaseVersion(draft.version ?? 0);
      return;
    }
    setConfigState(normalizeConfig(draft.config));
    setBaseVersion(draft.version ?? 0);
    initialized.current = true;
  }, [managed.data, config?.templateKey]);

  const update = useCallback(
    (next: StorefrontConfig) => {
      setConfigState(current => {
        if (current) {
          past.current = [...past.current, current];
          future.current = [];
        }
        return next;
      });
      setDirty(true);
      setHistVersion(v => v + 1);
    },
    []
  );

  const undo = useCallback(() => {
    setConfigState(current => {
      if (!past.current.length || !current) return current;
      const prev = past.current[past.current.length - 1];
      past.current = past.current.slice(0, -1);
      future.current = [current, ...future.current];
      setDirty(true);
      setHistVersion(v => v + 1);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setConfigState(current => {
      if (!future.current.length || !current) return current;
      const [next, ...rest] = future.current;
      future.current = rest;
      past.current = [...past.current, current];
      setDirty(true);
      setHistVersion(v => v + 1);
      return next;
    });
  }, []);

  const replaceConfig = useCallback((next: StorefrontConfig | null) => {
    past.current = [];
    future.current = [];
    setConfigState(next ? normalizeConfig(next) : next);
    setDirty(false);
    setHistVersion(v => v + 1);
  }, []);

  // Autosave (debounced). A single in-flight save at a time prevents the stale
  // `expectedVersion` races that caused spurious conflicts.
  const savingRef = useRef(false);
  useEffect(() => {
    if (!config || !dirty) return;
    if (savingRef.current) return;
    const handle = setTimeout(async () => {
      savingRef.current = true;
      setSaving(true);
      try {
        let res = await saveDraft.mutateAsync({
          config,
          expectedVersion: baseVersion,
        });
        if (res.conflict) {
          // Rebase on the server version and retry once so local edits are kept
          // (single-merchant editor). Non-blocking notice instead of a banner.
          res = await saveDraft.mutateAsync({
            config,
            expectedVersion: res.currentVersion ?? 0,
          });
          if (res.conflict) {
            setConflict(res.currentVersion ?? 0);
            toast.message("تم اكتشاف تعديل من جلسة أخرى — أُعيدت المزامنة.");
          }
        }
        if (!res.conflict) {
          setBaseVersion(res.version ?? baseVersion);
          setDirty(false);
        }
      } catch {
        /* retry on next change */
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [config, dirty, baseVersion, saveDraft]);

  /** Save the current config now (used before publish / on demand). */
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    const valid = validateStorefrontConfig(config);
    if (!valid.ok) {
      toast.error(valid.message ?? "الإعداد غير صالح.");
      return false;
    }
    const res = await saveDraft.mutateAsync({
      config: valid.data,
      expectedVersion: baseVersion,
    });
    if (res.conflict) {
      setConflict(res.currentVersion ?? 0);
      toast.error("المسودة تغيّرت من مكان آخر — لم يُحفظ/يُنشر.");
      return false;
    }
    if (res.version) setBaseVersion(res.version);
    setDirty(false);
    return true;
  }, [config, baseVersion, saveDraft]);

  const publish = useCallback(async () => {
    try {
      const ok = await flushSave();
      if (!ok) return;
      const res = await publishMutation.mutateAsync({});
      toast.success(`تم النشر — الإصدار ${res.versionNumber}`);
      await utils.storefront.managed.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النشر.");
    }
  }, [flushSave, publishMutation, utils]);

  const rollback = useCallback(
    async (versionNumber: number) => {
      try {
        const res = await rollbackMutation.mutateAsync({ versionNumber });
        toast.success(`تم التراجع — أُنشئ الإصدار ${res.versionNumber}`);
        if (res.config) replaceConfig(res.config);
        setBaseVersion(res.draftVersion ?? baseVersion);
        await utils.storefront.managed.invalidate();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التراجع.");
      }
    },
    [rollbackMutation, replaceConfig, utils, baseVersion]
  );

  const reloadLatest = useCallback(async () => {
    const fresh = await managed.refetch();
    const draft = fresh.data?.draft;
    if (draft?.config) replaceConfig(draft.config);
    setBaseVersion(draft?.version ?? 0);
    setConflict(null);
  }, [managed, replaceConfig]);

  return {
    managed,
    config,
    update,
    replaceConfig,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    histVersion,
    dirty,
    saving,
    conflict,
    setConflict,
    baseVersion,
    setBaseVersion,
    flushSave,
    publish,
    rollback,
    reloadLatest,
  };
}
