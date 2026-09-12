import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";

export type LandingLength = "short" | "medium" | "long";
export type AidaStage = "attention" | "interest" | "desire" | "action";

export type LandingGenerationProduct = {
  title: string;
  description: string;
  productType: string | null;
  collectionName: string | null;
  price: string | null;
  compareAtPrice: string | null;
  images: Array<{ url: string; storageKey: string; altText: string | null }>;
  variants: Array<{
    color: string | null;
    size: string | null;
    price: string | null;
    available: boolean;
  }>;
};

export type GeneratedMicroCommitment = {
  question: string;
  options: string[];
  ctaLabel: string | null;
};

export type GeneratedLandingDraft = {
  designSystem: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundTone: string;
    visualMood: string;
  };
  sections: Array<{
    aidaStage: AidaStage;
    sectionType: string;
    eyebrow: string | null;
    headline: string;
    body: string;
    bullets: string[];
    ctaLabel: string | null;
    microCommitment: GeneratedMicroCommitment | null;
    visualBrief: string;
  }>;
};

export type GeneratedLandingScene = {
  position: number;
  url: string;
  prompt: string;
};

const sectionPlans: Record<LandingLength, string> = {
  short:
    "أنشئ 4 أقسام بالترتيب: hero/attention، problem/interest، solution/desire، cta/action.",
  medium:
    "أنشئ 6 أقسام بالترتيب: hero/attention، problem/interest، solution/desire، benefits/desire، offer/desire، cta/action.",
  long: "أنشئ 8 أقسام بالترتيب: hero/attention، problem/interest، solution/desire، benefits/desire، features/desire، proof/desire، offer/desire، cta/action.",
};

const expectedCounts: Record<LandingLength, number> = {
  short: 4,
  medium: 6,
  long: 8,
};

const outputSchema = {
  name: "ai_landing_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      designSystem: {
        type: "object",
        properties: {
          primaryColor: { type: "string" },
          secondaryColor: { type: "string" },
          accentColor: { type: "string" },
          backgroundTone: { type: "string" },
          visualMood: { type: "string" },
        },
        required: [
          "primaryColor",
          "secondaryColor",
          "accentColor",
          "backgroundTone",
          "visualMood",
        ],
        additionalProperties: false,
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            aidaStage: {
              type: "string",
              enum: ["attention", "interest", "desire", "action"],
            },
            sectionType: { type: "string" },
            eyebrow: { type: ["string", "null"] },
            headline: { type: "string" },
            body: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            ctaLabel: { type: ["string", "null"] },
            microCommitment: {
              type: ["object", "null"],
              properties: {
                question: { type: "string" },
                options: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 4,
                },
                ctaLabel: { type: ["string", "null"] },
              },
              required: ["question", "options", "ctaLabel"],
              additionalProperties: false,
            },
            visualBrief: { type: "string" },
          },
          required: [
            "aidaStage",
            "sectionType",
            "eyebrow",
            "headline",
            "body",
            "bullets",
            "ctaLabel",
            "microCommitment",
            "visualBrief",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["designSystem", "sections"],
    additionalProperties: false,
  },
} as const;

function visibleContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: unknown }).type === "text" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map(part => part.text)
    .join("");
}

function normalizeMicroCommitment(
  raw: unknown
): GeneratedMicroCommitment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const question =
    typeof record.question === "string" ? record.question.trim() : "";
  const options = Array.isArray(record.options)
    ? record.options
        .filter((option): option is string => typeof option === "string")
        .map(option => option.trim())
        .filter(Boolean)
    : [];
  if (!question || options.length < 2) return null;
  const ctaLabel =
    typeof record.ctaLabel === "string" ? record.ctaLabel.trim() : "";
  return {
    question,
    options: options.slice(0, 4),
    ctaLabel: ctaLabel || null,
  };
}

export async function generateLandingDraft({
  product,
  length,
  locale,
  notes,
}: {
  product: LandingGenerationProduct;
  length: LandingLength;
  locale: string;
  notes?: string;
}) {
  const signedImageUrls = await Promise.all(
    product.images
      .slice(0, 3)
      .map(async image =>
        image.url.startsWith("http")
          ? image.url
          : storageGetSignedUrl(image.storageKey)
      )
  );
  const imageReferences = signedImageUrls.map(url => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));
  const productData = JSON.stringify({
    title: product.title,
    description: product.description,
    type: product.productType,
    collection: product.collectionName,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    variants: product.variants.map(variant => ({
      color: variant.color,
      size: variant.size,
      price: variant.price,
      available: variant.available,
    })),
    imageCount: product.images.length,
  });
  const result = await invokeLLM({
    model: "gemini-3-flash-preview",
    maxTokens: 6000,
    outputSchema,
    messages: [
      {
        role: "system",
        content:
          "أنت Senior Conversion Copywriter وCreative Campaign Art Director لمتاجر عربية. أنشئ JSON فقط وفق المخطط المطلوب. اكتب بلغة المتجر المحددة وبنبرة محلية طبيعية. التزم بـAIDA. ممنوع اختراع مراجعات عملاء أو شهادات أو تقييمات أو ادعاءات غير موجودة في بيانات المنتج. المنتج في صورته الأصلية هو مصدر الحقيقة: لا تغيّر العبوة أو الشعار أو اللون أو النسب أو المادة. اجعل أزرار CTA متنوعة ومتعلقة بالمنتج والحافز المطروح في كل قسم، ولا تكرر نص «اطلب الآن» في كل الأزرار. في القسم الأخير cta/action اكتب microCommitment حقيقيًا: سؤال قصير تفاعلي واحد بلهجة محلية قبل الطلب (مثل: «واش تحب المقاس M ولا L؟»، «الكمية: 1 ولا 2؟»، «اللون اللي يعجبك؟»، «كيف تحب تستلم؟») مع 2-4 خيارات قصيرة جدًا مستمدة من متغيرات المنتج الفعلية حين تتوفر، وctaLabel مخصص بعد الاختيار يخصّص زر التأكيد (مثل «أكّد طلبية مقاس L»). microCommitment يجب أن يكون null في كل الأقسام غير قسم cta/action، ولا يطلب بيانات شخصية، ولا يخترع خيارات غير موجودة في بيانات المنتج. visualBrief ليس وصف خلفية بسيطة؛ اكتب له Conceptual Product Mockup Scene شديد الإبداع، يحدد بوضوح البيئة، الفكرة، زاوية الكاميرا، المستوى/الدعامة، الضوء، الخامات، الحركة أو الدراما البصرية، والعناصر المحيطة. يجب أن يكون كل قسم حملة مصغرة مختلفة فعليًا، لا تغير لون الخلفية فقط. لا تطلب نصًا داخل الصورة، واجعل المنتج واضحًا وغير محجوب. لا تكرر الرسالة أو البيئة بين الأقسام. اجعل النص قصيرًا ومباشرًا ومركزًا على التحويل.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `اللغة/اللهجة: ${locale}\nبيانات المنتج الفعلية: ${productData}\nالطول المطلوب: ${length}\n${sectionPlans[length]}\nتعليمات المالك الإضافية: ${notes?.trim() || "لا توجد"}\nلكل قسم اكتب visualBrief مفصلًا لمشهد إعلاني كامل مختلف يستعمل صورة المنتج الأصلية مرجعًا ويحذف خلفيتها المصدرية، مع فكرة تصويرية حقيقية لا مجرد gradient. يجب أن تتضمن العبارة «صورة المنتج الأصلية» وتمنع النصوص والعلامات الإضافية داخل الصورة.\nتنويع CTA: اجعل نص زر كل قسم مختلفًا ومرتبطًا بالمنتج والحافز، ولا تستعمل «اطلب الآن» في أكثر من قسم واحد.\nmicroCommitment: في القسم الأخير cta/action فقط املأ كائن microCommitment بسؤال تفاعلي قصير قبل الطلب مع 2-4 خيارات مشتقة من بيانات المتغيرات الفعلية أعلاه (مثل المقاس M/L أو اللون أو الكمية أو طريقة الاستلام) وctaLabel يُخصّص زر التأكيد بعد الاختيار. اجعل microCommitment مساويًا null في باقي الأقسام.`,
          },
          ...imageReferences,
        ],
      },
    ],
  });
  const raw = visibleContent(result.choices[0]?.message.content ?? "");
  let draft: GeneratedLandingDraft;
  try {
    draft = JSON.parse(raw) as GeneratedLandingDraft;
  } catch {
    throw new Error("أعاد الذكاء الاصطناعي مخططًا غير صالح. أعد المحاولة.");
  }
  if (
    !Array.isArray(draft.sections) ||
    draft.sections.length !== expectedCounts[length]
  )
    throw new Error("لم يطابق التوليد عدد الأقسام المطلوب. أعد المحاولة.");
  if (
    draft.sections.some(
      section =>
        !["attention", "interest", "desire", "action"].includes(
          section.aidaStage
        ) ||
        !section.headline.trim() ||
        !section.visualBrief.includes("صورة المنتج الأصلية")
    )
  )
    throw new Error("لم يلتزم التوليد بحماية المنتج الأصلي. أعد المحاولة.");
  draft.sections = draft.sections.map((section, index) => ({
    ...section,
    ctaLabel: section.ctaLabel?.trim() || null,
    microCommitment:
      section.aidaStage === "action" || index === draft.sections.length - 1
        ? normalizeMicroCommitment(section.microCommitment)
        : null,
  }));
  return { draft, model: result.model, referenceImageUrl: signedImageUrls[0] };
}

export type GeneratedLandingSceneSection = Omit<
  GeneratedLandingDraft["sections"][number],
  "microCommitment"
>;

export async function generateLandingScenes({
  referenceImageUrl,
  sections,
  designSystem,
}: {
  referenceImageUrl: string;
  sections: GeneratedLandingSceneSection[];
  designSystem: GeneratedLandingDraft["designSystem"];
}) {
  const scenes: GeneratedLandingScene[] = [];
  for (let position = 0; position < sections.length; position += 1) {
    const section = sections[position];
    const artDirection = [
      "Build a dramatic campaign-opening key visual: a surprising but credible environment, cinematic depth, hero-scale lighting, and a sculptural focal platform.",
      "Build an editorial discovery still life: layered foreground, meaningful supporting props from the product category, tactile materials, and a deliberately composed camera angle.",
      "Build an aspirational desire scene: an elevated conceptual setting, refined atmospheric light, physical texture, subtle motion cues, and a premium fashion/editorial sensibility.",
      "Build a decisive conversion scene: the product looks immediately attainable yet premium, with a strong foreground, precise contact shadow, and visual energy without visual clutter.",
    ][position % 4];
    const prompt = `Edit the supplied product image into one complete, high-concept premium ecommerce campaign scene for a mobile Arabic landing page. This must look like an award-winning art-directed product photograph, never like a product cutout placed over a colored backdrop. First remove the ENTIRE original photo background and discard it completely. Recompose the same product naturally inside a genuinely new environment. Preserve exactly the recognizable product form, package silhouette, brand marks, printed typography, colors, materials, and proportions; never change, rebrand, reshape, or duplicate the product. Scene purpose: ${section.sectionType} / ${section.aidaStage}. ${artDirection} Creative brief: ${section.visualBrief}. Palette: primary ${designSystem.primaryColor}, secondary ${designSystem.secondaryColor}, accent ${designSystem.accentColor}; mood: ${designSystem.visualMood}. Use a distinct lens perspective, practical studio/cinematic lighting, spatial depth, authentic contact shadows, rich material contrast, atmospheric layers, and intentional premium styling. Portrait 4:5 composition. Reserve the TOP 38% of the frame as a clean, dark or softly textured IMAGE-ONLY negative-space headline zone: no product, no important props, and no busy detail in that top area. Place the complete product lower in the remaining frame, fully visible and not cropped, so HTML Arabic copy can sit above it without ever covering the product. Generate NO text, NO Arabic letters, NO English letters, NO prices, NO UI, NO borders, NO collage, NO source-photo rectangle, NO flat recolored original background, NO duplicate product, and NO remnants of the original source background.`;
    const generated = await generateImage({
      prompt,
      originalImages: [{ url: referenceImageUrl, mimeType: "image/png" }],
      quality: "medium",
    });
    if (!generated.url)
      throw new Error("تعذر إنشاء المشهد الإبداعي لأحد الأقسام.");
    scenes.push({ position, url: generated.url, prompt });
  }
  return scenes;
}
