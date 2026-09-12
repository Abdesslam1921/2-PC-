import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getStoreProductById: vi.fn(),
  createLandingGeneration: vi.fn(),
  completeLandingGeneration: vi.fn(),
  discardLandingGeneration: vi.fn(),
  approveLandingPage: vi.fn(),
  getLandingPageForOwner: vi.fn(),
  listLandingPagesForOwner: vi.fn(),
  replaceLandingScenes: vi.fn(),
  generateLandingDraft: vi.fn(),
  generateLandingScenes: vi.fn(),
}));

vi.mock("../db", () => ({
  getStoreProductById: mocks.getStoreProductById,
  createLandingGeneration: mocks.createLandingGeneration,
  completeLandingGeneration: mocks.completeLandingGeneration,
  discardLandingGeneration: mocks.discardLandingGeneration,
  approveLandingPage: mocks.approveLandingPage,
  getLandingPageForOwner: mocks.getLandingPageForOwner,
  listLandingPagesForOwner: mocks.listLandingPagesForOwner,
  replaceLandingScenes: mocks.replaceLandingScenes,
}));
vi.mock("../landingGeneration", () => ({
  generateLandingDraft: mocks.generateLandingDraft,
  generateLandingScenes: mocks.generateLandingScenes,
}));

import { appRouter } from "../routers";

function context(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "store-owner",
      email: "owner@example.com",
      name: "Store Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    store: {
      id: 7,
      ownerId: 42,
      name: "متجر",
      slug: "store",
      language: "dz-ar",
      templateId: null,
      aiStyleConfig: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    storeId: 7,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const product = {
  id: 7,
  title: "عطر أصلي",
  description: "رائحة دافئة",
  productType: "عطور",
  collectionName: null,
  price: "2500.00",
  compareAtPrice: "3000.00",
  images: [
    {
      id: 1,
      url: "/manus-storage/product.png",
      storageKey: "product.png",
      altText: "العطر",
    },
  ],
  variants: [
    { id: 4, color: "ذهبي", size: null, price: "2500.00", available: true },
  ],
};
const draft = {
  designSystem: {
    primaryColor: "#A66A1F",
    secondaryColor: "#24130D",
    accentColor: "#E9C16A",
    backgroundTone: "دافئ",
    visualMood: "فاخر",
  },
  sections: [
    {
      aidaStage: "attention" as const,
      sectionType: "hero",
      eyebrow: "عطر",
      headline: "رائحة تترك أثرًا",
      body: "وصف",
      bullets: [],
      ctaLabel: "اطلب الآن",
      visualBrief: "بيئة دافئة، ضع صورة المنتج الأصلية دون تغيير",
    },
    {
      aidaStage: "interest" as const,
      sectionType: "problem",
      eyebrow: null,
      headline: "حضورك يتكلم",
      body: "وصف",
      bullets: [],
      ctaLabel: null,
      visualBrief: "خلفية ناعمة، ضع صورة المنتج الأصلية دون تغيير",
    },
    {
      aidaStage: "desire" as const,
      sectionType: "solution",
      eyebrow: null,
      headline: "حل فاخر",
      body: "وصف",
      bullets: ["ثبات"],
      ctaLabel: null,
      visualBrief: "إضاءة ذهبية، ضع صورة المنتج الأصلية دون تغيير",
    },
    {
      aidaStage: "action" as const,
      sectionType: "cta",
      eyebrow: null,
      headline: "اطلب الآن",
      body: "وصف",
      bullets: [],
      ctaLabel: "اطلب الآن",
      visualBrief: "تكوين التحويل، ضع صورة المنتج الأصلية دون تغيير",
    },
  ],
};

describe("landings.createAiDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreProductById.mockResolvedValue(product);
    mocks.createLandingGeneration.mockResolvedValue(81);
    mocks.generateLandingDraft.mockResolvedValue({
      draft,
      model: "gemini-3-flash-preview",
      referenceImageUrl: "https://signed.example/product.png",
    });
    mocks.generateLandingScenes.mockResolvedValue(
      draft.sections.map((section, position) => ({
        position,
        url: `https://generated.example/${position}.png`,
        prompt: section.visualBrief,
      }))
    );
    mocks.completeLandingGeneration.mockResolvedValue({
      id: 81,
      status: "ready",
      sections: draft.sections,
    });
    mocks.discardLandingGeneration.mockResolvedValue(undefined);
  });

  it("generates and persists an AIDA draft from the owner's real product", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.landings.createAiDraft({
      productId: 7,
      pageLength: "short",
      locale: "dz-ar",
      notes: "الدفع عند الاستلام",
      settings: { slug: "attar-asli", delivery: "500", payment: "cod" },
    });

    expect(mocks.getStoreProductById).toHaveBeenCalledWith(7, 7);
    expect(mocks.createLandingGeneration).toHaveBeenCalledWith(
      7,
      product,
      expect.objectContaining({ pageLength: "short" })
    );
    expect(mocks.generateLandingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({ title: "عطر أصلي" }),
        length: "short",
      })
    );
    expect(mocks.generateLandingScenes).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImageUrl: "https://signed.example/product.png",
        sections: draft.sections,
      })
    );
    expect(mocks.completeLandingGeneration).toHaveBeenCalledWith(
      7,
      81,
      draft.designSystem,
      draft.sections,
      expect.any(Array),
      "/manus-storage/product.png"
    );
    expect(result).toMatchObject({ id: 81, status: "ready" });
  });

  it("rejects a product without its original image before creating a draft", async () => {
    mocks.getStoreProductById.mockResolvedValue({ ...product, images: [] });
    const caller = appRouter.createCaller(context());
    await expect(
      caller.landings.createAiDraft({
        productId: 7,
        pageLength: "short",
        locale: "dz-ar",
        settings: { slug: "sans-image", delivery: "", payment: "cod" },
      })
    ).rejects.toMatchObject({
      message: "أضف صورة أصلية واحدة على الأقل للمنتج قبل التوليد.",
    });
    expect(mocks.createLandingGeneration).not.toHaveBeenCalled();
  });

  it("creates an automatic slug when optional landing settings are omitted", async () => {
    const caller = appRouter.createCaller(context());
    await caller.landings.createAiDraft({
      productId: 7,
      pageLength: "short",
      locale: "dz-ar",
      settings: { payment: "cod" },
    });
    expect(mocks.createLandingGeneration).toHaveBeenCalledWith(
      7,
      product,
      expect.objectContaining({
        settings: expect.objectContaining({
          slug: expect.stringMatching(/^landing-7-/),
          delivery: "",
        }),
      })
    );
  });

  it("lists only the authenticated owner's saved landing pages", async () => {
    mocks.listLandingPagesForOwner.mockResolvedValue([
      { id: 81, title: "عطر أصلي", status: "ready" },
    ]);
    const caller = appRouter.createCaller(context());
    await expect(caller.landings.list()).resolves.toEqual([
      { id: 81, title: "عطر أصلي", status: "ready" },
    ]);
    expect(mocks.listLandingPagesForOwner).toHaveBeenCalledWith(7);
  });

  it("discards an unapproved draft and returns a friendly message when image generation is exhausted", async () => {
    mocks.generateLandingScenes.mockRejectedValue(
      new Error(
        'Image generation request failed (400 Bad Request): {"code":"failed_precondition","message":"your account has hit a usage exhausted"}'
      )
    );
    const caller = appRouter.createCaller(context());
    await expect(
      caller.landings.createAiDraft({
        productId: 7,
        pageLength: "short",
        locale: "dz-ar",
        settings: { payment: "cod" },
      })
    ).rejects.toMatchObject({
      message:
        "تم بلوغ الحد المتاح لتوليد الصور حاليًا. لم تُحفظ هذه المسودة؛ أعد المحاولة عند توفر التوليد.",
    });
    expect(mocks.discardLandingGeneration).toHaveBeenCalledWith(7, 81);
  });

  it("approves a ready draft before it appears in the owner's history", async () => {
    mocks.getLandingPageForOwner.mockResolvedValueOnce({
      id: 81,
      status: "ready",
    });
    mocks.approveLandingPage.mockResolvedValue({
      id: 81,
      status: "ready",
      approvedAt: new Date(),
    });
    const caller = appRouter.createCaller(context());
    await expect(caller.landings.approve({ id: 81 })).resolves.toMatchObject({
      id: 81,
      approvedAt: expect.any(Date),
    });
    expect(mocks.approveLandingPage).toHaveBeenCalledWith(7, 81);
  });
});
