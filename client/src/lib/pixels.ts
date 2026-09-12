export type PixelIds = { meta?: string; tiktok?: string; snapchat?: string };

const cleanId = (value?: string) =>
  value
    ?.trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80) || "";

export function loadConfiguredPixels(ids: PixelIds) {
  const meta = cleanId(ids.meta);
  if (meta && !document.querySelector(`[data-abdou-meta-pixel="${meta}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://connect.facebook.net/en_US/fbevents.js`;
    script.dataset.abdouMetaPixel = meta;
    script.onload = () => {
      const fbq = (window as Window & { fbq?: (...args: unknown[]) => void })
        .fbq;
      fbq?.("init", meta);
      fbq?.("track", "PageView");
    };
    document.head.appendChild(script);
  }
  const tiktok = cleanId(ids.tiktok);
  if (
    tiktok &&
    !document.querySelector(`[data-abdou-tiktok-pixel="${tiktok}"]`)
  ) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    script.dataset.abdouTiktokPixel = tiktok;
    document.head.appendChild(script);
  }
  const snapchat = cleanId(ids.snapchat);
  if (
    snapchat &&
    !document.querySelector(`[data-abdou-snapchat-pixel="${snapchat}"]`)
  ) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://sc-static.net/scevent.min.js";
    script.dataset.abdouSnapchatPixel = snapchat;
    document.head.appendChild(script);
  }
}

export function trackPixelEvent(
  ids: PixelIds,
  event: "PageView" | "Lead" | "Purchase",
  params: Record<string, unknown> = {}
) {
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (ids.meta && fbq) fbq("track", event, params);
  const ttq = (
    window as Window & {
      ttq?: { track?: (name: string, data?: Record<string, unknown>) => void };
    }
  ).ttq;
  if (ids.tiktok && ttq?.track) ttq.track(event, params);
  const snaptr = (window as Window & { snaptr?: (...args: unknown[]) => void })
    .snaptr;
  if (ids.snapchat && snaptr) snaptr("track", event, params);
}
