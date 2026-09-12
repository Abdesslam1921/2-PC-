import { describe, expect, it } from "vitest";

describe("Meta MCP OAuth credentials", () => {
  it.skipIf(process.env.RUN_META_CREDENTIALS_TEST !== "1")(
    "accepts the supplied app credentials at Meta's OAuth token endpoint",
    async () => {
      const appId = process.env.META_MCP_CLIENT_ID;
      const appSecret = process.env.META_MCP_CLIENT_SECRET;
      expect(appId).toBeTruthy();
      expect(appSecret).toBeTruthy();

      const params = new URLSearchParams({
        client_id: appId!,
        client_secret: appSecret!,
        grant_type: "client_credentials",
      });
      const response = await fetch(
        `https://graph.facebook.com/oauth/access_token?${params.toString()}`
      );
      const payload = (await response.json()) as {
        access_token?: string;
        error?: { message?: string };
      };

      expect(
        response.ok,
        payload.error?.message ?? "Meta OAuth credentials were rejected"
      ).toBe(true);
      expect(typeof payload.access_token).toBe("string");
    },
    20_000
  );
});
