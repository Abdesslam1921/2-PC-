import { describe, expect, it, vi } from "vitest";
import { handleMetaOAuthCallback } from "./metaOAuth";

describe("Meta OAuth callback guardrails", () => {
  it("rejects malformed state before touching the database", async () => {
    const res = { redirect: vi.fn(), status: vi.fn(() => ({ send: vi.fn() })) };
    await handleMetaOAuthCallback(
      { query: { state: "bad", code: "code" } } as never,
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("requires an authorization code", async () => {
    const send = vi.fn();
    const res = { redirect: vi.fn(), status: vi.fn(() => ({ send })) };
    await handleMetaOAuthCallback(
      { query: { state: "A".repeat(43) } } as never,
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining("لم تتم الموافقة على ربط Meta")
    );
  });
});
