import { describe, expect, it } from "vitest";

describe("Google OAuth configuration", () => {
  it("has configured client credentials and reaches the Google token endpoint", async () => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: "abdou_store_validation_code",
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: "https://abdou-store.invalid/api/google/oauth/callback",
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 15000);
});
