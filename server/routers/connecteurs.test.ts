import { describe, expect, it } from "vitest";
import { connecteurKinds, MAX_PIXELS_PER_CONNECTEUR } from "./connecteurs";

describe("connecteurs contract", () => {
  it("exposes all supported integrations in stable order", () => {
    expect(connecteurKinds).toEqual([
      "meta_capi",
      "tiktok_capi",
      "snapchat_capi",
      "facebook_domain",
      "cloudflare_turnstile",
      "google_sheets",
      "abandoned_orders",
      "notifications",
    ]);
  });

  it("limits each application to seven pixels", () => {
    expect(MAX_PIXELS_PER_CONNECTEUR).toBe(7);
  });
});
