import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createStorefrontVersion,
  saveStorefrontDraft,
  type StorefrontDb,
} from "./storefrontDb";
import {
  STOREFRONT_VERSION_CONFLICT_CODE,
  isDuplicateKeyError,
  isStorefrontVersionConflict,
} from "./storefrontConcurrency";

const duplicateKeyError = () =>
  Object.assign(new Error("Duplicate entry"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });

/**
 * Minimal drizzle-like executor for saveStorefrontDraft:
 *   select().from().where().limit(1)
 *   update().set().where()   -> [ResultSetHeader]
 *   insert().values()
 */
function makeDraftDb(options: {
  draft: { concurrencyVersion: number; configJson?: string } | null;
  reReadVersion?: number;
  updateAffected?: number;
  insertError?: unknown;
}) {
  const calls = { select: 0, update: 0, insert: 0, updateWhere: 0 };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.select += 1;
            if (calls.select === 1) {
              return options.draft
                ? [
                    {
                      configJson: options.draft.configJson ?? "{}",
                      concurrencyVersion: options.draft.concurrencyVersion,
                    },
                  ]
                : [];
            }
            return [
              {
                concurrencyVersion:
                  options.reReadVersion ?? options.draft?.concurrencyVersion ?? 0,
              },
            ];
          },
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          calls.update += 1;
          calls.updateWhere += 1;
          return [{ affectedRows: options.updateAffected ?? 1 }];
        },
      }),
    }),
    insert: () => ({
      values: async () => {
        calls.insert += 1;
        if (options.insertError) throw options.insertError;
        return [{}];
      },
    }),
  };
  return { db: db as unknown as StorefrontDb, calls };
}

/** Minimal executor for createStorefrontVersion: select latest + insert. */
function makeVersionDb(options: {
  latest: number[];
  insertErrors?: unknown[];
}) {
  const calls = { select: 0, insert: 0 };
  let readIndex = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              calls.select += 1;
              const value = options.latest[Math.min(readIndex, options.latest.length - 1)];
              readIndex += 1;
              return [{ versionNumber: value }];
            },
          }),
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        const index = calls.insert;
        calls.insert += 1;
        const error = options.insertErrors?.[index];
        if (error) throw error;
        return [{}];
      },
    }),
  };
  return { db: db as unknown as StorefrontDb, calls };
}

const draftInput = {
  ownerId: 1,
  storeId: 7,
  configJson: '{"templateKey":"modern","sections":[]}',
  expectedVersion: 5,
  updatedBy: 1,
};

describe("saveStorefrontDraft — optimistic concurrency", () => {
  it("rejects a stale expectedVersion without writing", async () => {
    const { db, calls } = makeDraftDb({
      draft: { concurrencyVersion: 6 },
    });
    const result = await saveStorefrontDraft(draftInput, db);
    expect(result).toEqual({ conflict: true, currentVersion: 6 });
    expect(calls.update).toBe(0);
    expect(calls.insert).toBe(0);
  });

  it("detects a race when the conditional UPDATE matches zero rows", async () => {
    const { db, calls } = makeDraftDb({
      draft: { concurrencyVersion: 5 },
      reReadVersion: 6,
      updateAffected: 0,
    });
    const result = await saveStorefrontDraft(draftInput, db);
    expect(result).toEqual({ conflict: true, currentVersion: 6 });
    // It attempted exactly one compare-and-swap and reported the real version.
    expect(calls.updateWhere).toBe(1);
    expect(calls.insert).toBe(0);
  });

  it("writes exactly one version step when the conditional UPDATE wins", async () => {
    const { db, calls } = makeDraftDb({
      draft: { concurrencyVersion: 5 },
      updateAffected: 1,
    });
    const result = await saveStorefrontDraft(draftInput, db);
    expect(result).toEqual({ conflict: false, version: 6 });
    expect(calls.updateWhere).toBe(1);
  });

  it("two first saves racing on insert: the unique key produces a conflict, not a crash", async () => {
    const { db, calls } = makeDraftDb({
      draft: null,
      insertError: duplicateKeyError(),
      reReadVersion: 1,
    });
    const result = await saveStorefrontDraft(
      { ...draftInput, expectedVersion: 0 },
      db
    );
    expect(result).toEqual({ conflict: true, currentVersion: 1 });
    expect(calls.insert).toBe(1);
    expect(calls.update).toBe(0);
  });

  it("the compare-and-swap version is part of the UPDATE predicate (source guard)", () => {
    const source = readFileSync("server/storefrontDb.ts", "utf8");
    const updateBlock = source.slice(
      source.indexOf("const next = input.expectedVersion + 1"),
      source.indexOf("if (affectedRows(update) !== 1)")
    );
    expect(updateBlock).toContain("eq(storefrontDrafts.concurrencyVersion, input.expectedVersion)");
    expect(updateBlock).toContain("eq(storefrontDrafts.storeId, input.storeId)");
  });
});

describe("createStorefrontVersion — concurrent publish/rollback serialisation", () => {
  it("retries on a duplicate version number and appends the next one", async () => {
    const { db, calls } = makeVersionDb({
      latest: [4, 5],
      insertErrors: [duplicateKeyError()],
    });
    const result = await createStorefrontVersion(
      {
        ownerId: 1,
        storeId: 7,
        snapshotJson: "{}",
        sourceDraftVersion: 5,
        publishedBy: 1,
      },
      db
    );
    expect(result).toEqual({ versionNumber: 6 });
    expect(calls.insert).toBe(2);
  });

  it("returns a typed conflict after bounded retries (mapped to CONFLICT, not 500)", async () => {
    const { db, calls } = makeVersionDb({
      latest: [4],
      insertErrors: Array(5).fill(duplicateKeyError()),
    });
    let caught: unknown;
    try {
      await createStorefrontVersion(
        {
          ownerId: 1,
          storeId: 7,
          snapshotJson: "{}",
          sourceDraftVersion: null,
          publishedBy: 1,
        },
        db
      );
    } catch (error) {
      caught = error;
    }
    expect(isStorefrontVersionConflict(caught)).toBe(true);
    expect((caught as { code?: string }).code).toBe(
      STOREFRONT_VERSION_CONFLICT_CODE
    );
    expect(calls.insert).toBe(5);
  });

  it("does not retry non-duplicate database errors", async () => {
    const outage = Object.assign(new Error("connection lost"), {
      code: "PROTOCOL_CONNECTION_LOST",
    });
    const { db, calls } = makeVersionDb({ latest: [4], insertErrors: [outage] });
    await expect(
      createStorefrontVersion(
        {
          ownerId: 1,
          storeId: 7,
          snapshotJson: "{}",
          sourceDraftVersion: null,
          publishedBy: 1,
        },
        db
      )
    ).rejects.toBe(outage);
    expect(calls.insert).toBe(1);
  });

  it("recognises only real duplicate-key errors", () => {
    expect(isDuplicateKeyError(duplicateKeyError())).toBe(true);
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(isDuplicateKeyError({ code: "ER_LOCK_WAIT_TIMEOUT" })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it("recognises duplicate-key errors wrapped by drizzle (cause chain)", () => {
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: duplicateKeyError(),
    });
    expect(isDuplicateKeyError(wrapped)).toBe(true);
    const nested = Object.assign(new Error("outer"), {
      cause: Object.assign(new Error("inner"), { cause: duplicateKeyError() }),
    });
    expect(isDuplicateKeyError(nested)).toBe(true);
    expect(
      isDuplicateKeyError(
        Object.assign(new Error("outer"), {
          cause: Object.assign(new Error("inner"), { code: "ETIMEDOUT" }),
        })
      )
    ).toBe(false);
  });
});
