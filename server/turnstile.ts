import { getConnecteurSecret } from "./db";

export async function verifyTurnstile(ownerId: number, token?: string) {
  const secret = await getConnecteurSecret(ownerId, "cloudflare_turnstile");
  if (!secret) return true;
  if (!token) return false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      }
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
