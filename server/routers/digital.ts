import { z } from "zod";
import {
  confirmDigitalOrderPayment,
  createDigitalOrder,
  consumeDigitalDownload,
  getDigitalDownloadStats,
  getGoogleOAuthConnection,
  listDigitalOrders,
  listStoreProducts,
} from "../db";
import { sendGmailMessage } from "../callCenterNotifications";
import { storageGetSignedUrl } from "../storage";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

type DownloadResult = Awaited<ReturnType<typeof confirmDigitalOrderPayment>>;

function makeAbsoluteLink(baseUrl: string | undefined, path: string) {
  if (!baseUrl) return path;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

async function emailDigitalLinks(
  ownerId: number,
  result: DownloadResult,
  baseUrl?: string
) {
  if (!result.customerEmail || !result.links.length) return "skipped" as const;
  const connection = await getGoogleOAuthConnection(ownerId);
  if (!connection?.refreshToken || !connection.email) return "skipped" as const;
  const links = result.links
    .map((link, index) =>
      [
        `${index + 1}. ${link.title}`,
        `رابط التنزيل: ${makeAbsoluteLink(baseUrl, link.url)}`,
        `صالح إلى: ${new Date(link.expiresAt).toLocaleString("ar-DZ")}`,
        `الحد الأقصى للتنزيل: ${link.maxDownloads} مرات`,
      ].join("\n")
    )
    .join("\n\n");
  const subject = `عبدو ستور · روابط تنزيل طلبك ${result.orderNumber}`;
  const body = [
    `مرحبًا ${result.customerEmail}،`,
    "تم تأكيد دفع طلبك الرقمي. يمكنك تنزيل ملفاتك من الروابط الآمنة التالية:",
    "",
    links,
    "",
    "تنبيه: الروابط مؤقتة ومحدودة بعدد مرات التنزيل المحدد من صاحب المتجر. لا تشاركها مع الآخرين.",
    "",
    "شكرًا لثقتك في عبدو ستور.",
  ].join("\n");
  try {
    await sendGmailMessage(
      connection.refreshToken,
      connection.email,
      result.customerEmail,
      subject,
      body
    );
    return "sent" as const;
  } catch (error) {
    console.warn("[Digital] Gmail delivery failed:", error);
    return "failed" as const;
  }
}

async function confirmAndEmail(
  ownerId: number,
  orderId: number,
  baseUrl?: string,
  forceNewLink = false
) {
  const result = await confirmDigitalOrderPayment(
    ownerId,
    orderId,
    forceNewLink
  );
  const emailStatus = await emailDigitalLinks(ownerId, result, baseUrl);
  return { ...result, emailStatus };
}

export const digitalRouter = router({
  products: protectedProcedure.query(async ({ ctx }) => {
    const products = await listStoreProducts(getStoreId(ctx));
    return products.filter((product): product is NonNullable<typeof product> =>
      Boolean(product && product.productKind === "digital")
    );
  }),
  orders: protectedProcedure.query(async ({ ctx }) =>
    listDigitalOrders(getStoreId(ctx))
  ),
  stats: protectedProcedure.query(async ({ ctx }) =>
    getDigitalDownloadStats(getStoreId(ctx))
  ),
  createOrder: publicProcedure
    .input(
      z.object({
        customerName: z.string().trim().min(2).max(180),
        customerEmail: z.string().trim().email().max(320),
        notes: z.string().trim().max(1000).optional(),
        lines: z
          .array(
            z.object({
              productId: z.number().int().positive(),
              quantity: z.number().int().min(1).max(10),
            })
          )
          .min(1)
          .max(20),
      })
    )
    .mutation(async ({ input }) =>
      createDigitalOrder(
        {
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          notes: input.notes,
        },
        input.lines
      )
    ),
  confirmPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        baseUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      confirmAndEmail(getStoreId(ctx), input.orderId, input.baseUrl)
    ),
  regenerateLinks: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        baseUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      confirmAndEmail(getStoreId(ctx), input.orderId, input.baseUrl, true)
    ),
  resolveDownload: publicProcedure
    .input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }))
    .mutation(async ({ input }) => {
      const download = await consumeDigitalDownload(input.token);
      const signedUrl = await storageGetSignedUrl(download.storageKey);
      return { ...download, signedUrl };
    }),
});
