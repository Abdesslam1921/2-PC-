import { describe, expect, it } from "vitest";

describe("Meta user access token", () => {
  it.skipIf(process.env.RUN_META_USER_TOKEN_TEST !== "1")(
    "is accepted by Meta Graph API",
    async () => {
      const accessToken = process.env.META_ADS_USER_ACCESS_TOKEN;
      expect(accessToken).toBeTruthy();

      const params = new URLSearchParams({
        fields: "id,name",
        access_token: accessToken!,
      });
      const response = await fetch(
        `https://graph.facebook.com/me?${params.toString()}`
      );
      const payload = (await response.json()) as {
        id?: string;
        name?: string;
        error?: { message?: string };
      };

      expect(
        response.ok,
        payload.error?.message ?? "Meta user access token was rejected"
      ).toBe(true);
      expect(payload.id).toBeTruthy();
    },
    20_000
  );
});
