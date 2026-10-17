import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { validateStorefrontConfig } from "@shared/storefront/storefrontConfig";
import { stripLegacyDefaultCategoriesFromConfig } from "@/storefront/sectionData";
import type { StorefrontConfig } from "@shared/storefront/storefrontConfig";

const SEED_KEY = "sf-builder-seed";

/** Debounced autosave window: rapid edits are batched into one draft save. */
export const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Configs are used exactly as stored, except for the untouched stock category
 * tiles that older template defaults shipped: they are dropped on load so they
 * can never flash in the storefront or be republished.
 */
export function normalizeConfig(next: StorefrontConfig): StorefrontConfig {
  return stripLegacyDefaultCategoriesFromConfig(next);
}

/**
 * Shared draft state for the unified store editor (content + theme).
 *
 * One global undo/redo stack over the whole config, one autosave pipeline with
 * optimistic concurrency, and flush-before-publish. It reuses the SAME
 * `storefront_drafts`/`versions` API — no new endpoints.
 *
 * Concurrency rules:
 * - Autosave is debounced and NEVER publishes.
 * - A stale save is reported as a conflict; it is never auto-rebased over the
 *   newer server draft (no silent last-write-wins). The merchant explicitly
 *   chooses "reload latest" or "force-save my edits".
 * - Publish sends the exact draft version it flushed, so a publish can never
 *   silently publish a newer draft the merchant did not see.
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
  /** Latest local config, used to detect edits that landed during a save. */
  const configRef = useRef<StorefrontConfig | null>(null);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

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
    const serverVersion = draft.version ?? 0;

    if (initialized.current && config?.templateKey === draft.config.templateKey) {
      /**
       * Never move the concurrency base forward silently while local edits are
       * pending: that would let the next autosave overwrite a newer server
       * draft. A dirty editor gets an explicit conflict instead.
       */
      if (serverVersion !== baseVersion) {
        if (dirty) setConflict(serverVersion);
        else setBaseVersion(serverVersion);
      }
      return;
    }
    if (seeded.current) {
      if (serverVersion !== baseVersion) {
        if (dirty) setConflict(serverVersion);
        else setBaseVersion(serverVersion);
      }
      return;
    }
    setConfigState(normalizeConfig(draft.config));
    setBaseVersion(serverVersion);
    initialized.current = true;
  }, [managed.data, config?.templateKey, baseVersion, dirty]);

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

  // Autosave (debounced, one in-flight save at a time). It never publishes.
  const savingRef = useRef(false);
  useEffect(() => {
    if (!config || !dirty || conflict !== null) return;
    if (savingRef.current) return;
    const payload = config;
    const handle = setTimeout(async () => {
      savingRef.current = true;
      setSaving(true);
      try {
        const res = await saveDraft.mutateAsync({
          config: payload,
          expectedVersion: baseVersion,
        });
        if (res.conflict) {
          /**
           * Do NOT auto-rebase and overwrite. Keep local edits and ask the
           * merchant to reload or explicitly force-save.
           */
          setConflict(res.currentVersion ?? 0);
          toast.error(
            "المسودة تغيّرت من جلسة أخرى — لم نكتب فوق النسخة الأحدث. اختر «تحميل الأحدث» أو «فرض حفظ تعديلاتي»."
          );
          return;
        }
        setBaseVersion(res.version ?? baseVersion);
        // An edit may have landed while this request was in flight: only clear
        // dirty when the saved payload is still the current config.
        if (configRef.current === payload) setDirty(false);
      } catch {
        /* keep local changes; the next edit/debounce retries */
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [config, dirty, baseVersion, conflict, saveDraft]);

  /** Save the current config now (used before publish / on demand). */
  const flushSave = useCallback(async (): Promise<{
    ok: boolean;
    version?: number;
  }> => {
    if (!config) return { ok: false };
    const valid = validateStorefrontConfig(config);
    if (!valid.ok) {
      toast.error(valid.message ?? "الإعداد غير صالح.");
      return { ok: false };
    }
    // Nothing pending and a real draft version already exists: no write needed.
    if (!dirty && baseVersion > 0) return { ok: true, version: baseVersion };

    const res = await saveDraft.mutateAsync({
      config: valid.data,
      expectedVersion: baseVersion,
    });
    if (res.conflict) {
      setConflict(res.currentVersion ?? 0);
      toast.error("المسودة تغيّرت من مكان آخر — لم يُحفظ/يُنشر.");
      return { ok: false };
    }
    if (res.version) setBaseVersion(res.version);
    setDirty(false);
    return { ok: true, version: res.version ?? baseVersion };
  }, [config, dirty, baseVersion, saveDraft]);

  /** Explicit user action from the conflict banner: overwrite once. */
  const forceSave = useCallback(async (): Promise<boolean> => {
    if (!config || conflict === null) return false;
    const valid = validateStorefrontConfig(config);
    if (!valid.ok) {
      toast.error(valid.message ?? "الإعداد غير صالح.");
      return false;
    }
    const res = await saveDraft.mutateAsync({
      config: valid.data,
      expectedVersion: conflict,
      force: true,
    });
    if (res.conflict) {
      setConflict(res.currentVersion ?? conflict);
      toast.error("تعذّر الحفظ: تغيّرت المسودة مرة أخرى. أعد المحاولة.");
      return false;
    }
    setBaseVersion(res.version ?? conflict);
    setDirty(false);
    setConflict(null);
    toast.success("تم حفظ تعديلاتك فوق النسخة الأحدث بناءً على طلبك.");
    return true;
  }, [config, conflict, saveDraft]);

  const publish = useCallback(async () => {
    try {
      const flushed = await flushSave();
      if (!flushed.ok || !flushed.version) return;
      const res = await publishMutation.mutateAsync({
        // Publish exactly the draft version the merchant just saw/saved.
        expectedDraftVersion: flushed.version,
      });
      toast.success(`تم النشر — الإصدار ${res.versionNumber}`);
      await utils.storefront.managed.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النشر.");
    }
  }, [flushSave, publishMutation, utils]);

  const reloadLatest = useCallback(async () => {
    const fresh = await managed.refetch();
    const draft = fresh.data?.draft;
    if (draft?.config) replaceConfig(draft.config);
    setBaseVersion(draft?.version ?? 0);
    setConflict(null);
  }, [managed, replaceConfig]);

  const rollback = useCallback(
    async (versionNumber: number) => {
      try {
        const res = await rollbackMutation.mutateAsync({ versionNumber });
        toast.success(`تم التراجع — أُنشئ الإصدار ${res.versionNumber}`);
        if (res.draftConflict) {
          toast.message(
            "المسودة تغيّرت من تبويب آخر، فلم نكتب فوقها. حُمّلت أحدث مسودة من الخادم."
          );
          await reloadLatest();
        } else {
          if (res.config) replaceConfig(res.config);
          setBaseVersion(res.draftVersion ?? baseVersion);
        }
        await utils.storefront.managed.invalidate();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التراجع.");
      }
    },
    [rollbackMutation, replaceConfig, reloadLatest, utils, baseVersion]
  );

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
    forceSave,
    publish,
    rollback,
    reloadLatest,
  };
}
