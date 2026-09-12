type EventName = "PageView" | "Lead" | "Purchase";
type ConversionInput = {
  eventName: EventName;
  eventId: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  phone?: string;
};

export async function sendConversionEvent(
  kind: "meta_capi" | "tiktok_capi" | "snapchat_capi",
  credentials: { identifier: string; secret: string },
  input: ConversionInput
) {
  const now = Math.floor(Date.now() / 1000);
  if (kind === "meta_capi") {
    const userData = input.phone
      ? { ph: [input.phone.replace(/\D/g, "")] }
      : {};
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(credentials.identifier)}/events`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: input.eventName,
              event_time: now,
              event_id: input.eventId,
              action_source: "website",
              event_source_url: "https://abdou.store",
              user_data: userData,
              custom_data: {
                currency: input.currency ?? "DZD",
                value: input.value ?? 0,
                content_ids: input.contentIds ?? [],
              },
            },
          ],
          access_token: credentials.secret,
        }),
      }
    );
    if (!response.ok) throw new Error(`Meta CAPI HTTP ${response.status}`);
    return { provider: "meta_capi" as const, success: true };
  }
  if (kind === "tiktok_capi") {
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Access-Token": credentials.secret,
        },
        body: JSON.stringify({
          event: input.eventName,
          event_id: input.eventId,
          timestamp: new Date().toISOString(),
          context: { page: { url: "https://abdou.store" } },
          properties: {
            currency: input.currency ?? "DZD",
            value: input.value ?? 0,
            content_ids: input.contentIds ?? [],
          },
          pixel_code: credentials.identifier,
        }),
      }
    );
    if (!response.ok)
      throw new Error(`TikTok Events API HTTP ${response.status}`);
    return { provider: "tiktok_capi" as const, success: true };
  }
  const response = await fetch(
    `https://tr.snapchat.com/v3/${encodeURIComponent(credentials.identifier)}/events`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${credentials.secret}`,
      },
      body: JSON.stringify({
        data: [
          {
            event_type: input.eventName,
            event_conversion_type: "WEB",
            event_tag: input.eventId,
            timestamp: new Date(now * 1000).toISOString(),
            user: input.phone ? { phone_number: input.phone } : undefined,
            price: input.value ?? 0,
            currency: input.currency ?? "DZD",
            item_ids: input.contentIds ?? [],
          },
        ],
      }),
    }
  );
  if (!response.ok)
    throw new Error(`Snapchat Conversions API HTTP ${response.status}`);
  return { provider: "snapchat_capi" as const, success: true };
}
