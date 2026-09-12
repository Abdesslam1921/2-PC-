import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Cable,
  CheckCircle2,
  Facebook,
  Globe2,
  Info,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PageIntro } from "@/components/PageIntro";

type Kind =
  | "meta_capi"
  | "tiktok_capi"
  | "snapchat_capi"
  | "facebook_domain"
  | "cloudflare_turnstile"
  | "google_sheets"
  | "abandoned_orders"
  | "notifications"
  | "shark_cod"
  | "order_clean"
  | "thank_you"
  | "contact_bar"
  | "content_guard"
  | "ad_shield"
  | "tracking_retarget"
  | "message_order"
  | "negotiator";
type Pixel = { id?: number; label: string; pixelId: string; enabled: boolean };
type SupportNumberRow = { label: string; number: string; active: boolean };
type Form = {
  label: string;
  identifier: string;
  secret: string;
  domain: string;
  verificationCode: string;
  enabled: boolean;
  pixels: Pixel[];
  whatsappPhoneId: string;
  whatsappToken: string;
  telegramBotToken: string;
  telegramChatId: string;
  smsProvider: string;
  smsApiUrl: string;
  smsApiKey: string;
  whatsappRecipient: string;
  smsRecipient: string;
  sharkTitle: string;
  sharkDescriptionBefore: string;
  sharkDescriptionAfter: string;
  sharkButtonText: string;
  sharkDiscountPercent: string;
  sharkTargetMode: "all" | "product" | "landing";
  sharkTargetProductId: string;
  sharkTargetLandingPageId: string;
  orderCleanWindowHours: string;
  orderCleanMaxOrders: string;
  orderCleanAction: "review" | "block";
  thankYouMessage: string;
  thankYouButtonText: string;
  thankYouButtonUrl: string;
  contactPhoneEnabled: boolean;
  contactPhoneNumber: string;
  contactPhoneSticky: boolean;
  contactWhatsappEnabled: boolean;
  contactWhatsappNumber: string;
  contactWhatsappSticky: boolean;
  contactShowOnStore: boolean;
  contactShowOnProduct: boolean;
  contactShowOnLanding: boolean;
  guardProtectImages: boolean;
  guardBlockRightClick: boolean;
  guardPreventSelection: boolean;
  guardWatermarkEnabled: boolean;
  guardWatermarkText: string;
  guardBlockHotlink: boolean;
  guardBlockAdReferrers: boolean;
  guardBlockMetaAdsLibrary: boolean;
  guardBlockedMessage: string;
  trackNumbers: SupportNumberRow[];
  trackTitle: string;
  trackHint: string;
  trackCta: string;
  trackMessage: string;
  trackStatusEnabled: boolean;
  trackStatusMessage: string;
  retargetEnabled: boolean;
  retargetType: "product" | "landing";
  retargetProductId: string;
  retargetLandingPageId: string;
  retargetLandingUrl: string;
  retargetDiscount: string;
  retargetDelay: string;
  retargetMessage: string;
  messageOrderTitle: string;
  messageOrderWelcome: string;
  messageOrderInstructions: string;
  messageOrderButtonText: string;
  negotiatorAutoNegotiate: boolean;
};
type Card = {
  kind: Kind;
  title: string;
  short: string;
  accent: string;
  icon: typeof Facebook;
  identifier: string;
  secret: string;
  importance: string;
  steps: string[];
  mode:
    | "pixel"
    | "standard"
    | "domain"
    | "toggle"
    | "notifications"
    | "shark_cod"
    | "order_clean"
    | "thank_you"
    | "contact_bar"
    | "content_guard"
    | "ad_shield"
    | "tracking_retarget"
    | "message_order"
    | "negotiator";
};

const cards: Card[] = [
  {
    kind: "meta_capi",
    title: "Facebook Pixel + Conversions API",
    short: "ربط Facebook Pixel وإرسال التحويلات عبر Conversions API.",
    accent: "#3157D5",
    icon: Facebook,
    identifier: "Pixel ID",
    secret: "Access Token الخاص بـ Conversions API",
    importance:
      "يجمع بين Pixel للقياس في المتصفح وConversions API لإرسال الأحداث من الخادم.",
    steps: [
      "افتح Events Manager واختر Pixel المناسب.",
      "أنشئ Access Token من Settings.",
      "أدخل التوكن مرة واحدة ثم أضف البكسلات أدناه.",
    ],
    mode: "pixel",
  },
  {
    kind: "tiktok_capi",
    title: "TikTok Pixel + Events API",
    short: "ربط TikTok Pixel وإرسال الأحداث عبر Events API.",
    accent: "#171923",
    icon: Zap,
    identifier: "TikTok Pixel ID",
    secret: "Access Token الخاص بـ Events API",
    importance: "يجمع بين TikTok Pixel وEvents API لإرسال الأحداث من الخادم.",
    steps: [
      "افتح TikTok Events Manager.",
      "أنشئ Access Token من إعدادات Events API.",
      "أدخل التوكن ثم أضف Pixel IDs المطلوبة.",
    ],
    mode: "pixel",
  },
  {
    kind: "snapchat_capi",
    title: "Snapchat Pixel + Conversions API",
    short: "ربط Snapchat Pixel وإرسال التحويلات عبر Conversions API.",
    accent: "#DDB400",
    icon: Zap,
    identifier: "Snap Pixel ID",
    secret: "Access Token الخاص بـ Conversions API",
    importance:
      "يجمع بين Snap Pixel وConversions API لإرسال التحويلات من الخادم.",
    steps: [
      "افتح Snapchat Ads Manager ثم Events Manager.",
      "أنشئ Pixel وAccess Token.",
      "أدخل التوكن ثم أضف Pixel IDs.",
    ],
    mode: "pixel",
  },
  {
    kind: "facebook_domain",
    title: "التحقق من نطاق Facebook",
    short: "تجهيز نطاق متجرك داخل Business Manager.",
    accent: "#16845C",
    icon: Globe2,
    identifier: "النطاق",
    secret: "رمز التحقق",
    importance:
      "التحقق من النطاق ضروري لإدارة أحداث الويب وأولوية التحويلات على Meta.",
    steps: [
      "أضف النطاق في Business Settings.",
      "اختر طريقة Meta-tag وانسخ رمز التحقق.",
      "الصق النطاق والرمز هنا.",
    ],
    mode: "domain",
  },
  {
    kind: "cloudflare_turnstile",
    title: "Cloudflare Turnstile",
    short: "حماية نماذج الطلب من البوتات والطلبات الوهمية.",
    accent: "#F38020",
    icon: ShieldCheck,
    identifier: "Site Key",
    secret: "Secret Key للتحقق الخادمّي",
    importance:
      "يضيف تحققًا خفيفًا يحافظ على تجربة العميل، مع إلزام التحقق الخادمّي قبل قبول الطلب.",
    steps: [
      "أنشئ Widget من Cloudflare Turnstile.",
      "انسخ Site Key للواجهة وSecret Key للخادم.",
      "فعّل التطبيق لاختبار الحماية على نماذج الطلب.",
    ],
    mode: "standard",
  },
  {
    kind: "google_sheets",
    title: "Google Sheets — ربط Google ومزامنة الطلبات",
    short:
      "ربط حساب Google لمزامنة الطلبات وإرسال إشعارات Gmail لفريق Call Center.",
    accent: "#34A853",
    icon: Globe2,
    identifier: "Spreadsheet ID",
    secret: "",
    importance:
      "يربط صاحب المتجر حساب Google الخاص به بملف Sheets المحدد، ويستعمل صلاحية OAuth المصرح بها لمزامنة الطلبات وإرسال إشعارات Gmail إلى حسابات Call Center المفعلة.",
    steps: [
      "أنشئ أو افتح ملف Google Sheets.",
      "أدخل Spreadsheet ID ثم اضغط ربط Google.",
      "وافق على صلاحية Sheets وGmail لإرسال إشعارات الطلبات والحالات.",
      "أعد الربط إذا كان Google متصلًا قبل إضافة إشعارات Gmail.",
    ],
    mode: "standard",
  },
  {
    kind: "abandoned_orders",
    title: "الطلبات المتروكة",
    short: "استقبال ومتابعة الطلبات التي لم يكتمل إرسالها.",
    accent: "#DE7C2A",
    icon: MessageCircle,
    identifier: "",
    secret: "",
    importance:
      "عند التفعيل تُحفظ البيانات التي يملؤها الزائر قبل إتمام الطلب في قسم الطلبات المتروكة.",
    steps: [
      "فعّل التطبيق لبدء استقبال الطلبات المتروكة.",
      "راجعها من قسم الطلبات المتروكة.",
      "أوقف التطبيق لإيقاف الاستقبال دون حذف البيانات السابقة.",
    ],
    mode: "toggle",
  },
  {
    kind: "notifications",
    title: "إشعارات الطلبات",
    short: "إرسال تنبيهات الطلبات عبر WhatsApp وTelegram وSMS.",
    accent: "#0EA5A4",
    icon: MessageCircle,
    identifier: "",
    secret: "",
    importance:
      "اختر القنوات التي تريد استعمالها واستقبل تنبيهًا عند إنشاء طلب جديد أو تغيّر حالته.",
    steps: [
      "أدخل بيانات القناة التي تملكها.",
      "فعّل القنوات المطلوبة.",
      "احفظ الإعدادات ثم اختبر إرسال إشعار.",
    ],
    mode: "notifications",
  },
  {
    kind: "shark_cod",
    title: "SHARK COD · Exit Popup & Tracking Analytics",
    short:
      "عرض تخفيض ذكي قبل مغادرة صفحة المنتج أو صفحة الهبوط مع قياس النتائج.",
    accent: "#E04F68",
    icon: Zap,
    identifier: "",
    secret: "",
    importance:
      "يساعدك Exit Popup على استرجاع الزائر المتردد بعرض محدود، بينما تقيس التحليلات المشاهدات والنقرات والطلبات الناتجة عن التخفيض.",
    steps: [
      "فعّل التطبيق وحدد نسبة التخفيض.",
      "خصص نصوص نافذة الخروج وزر الدعوة إلى الإجراء.",
      "اختر استهداف كل الصفحات أو منتجًا أو Funnel محددًا.",
      "راجع Views وCTR وDiscount Orders من لوحة التحليلات.",
    ],
    mode: "shark_cod",
  },
  {
    kind: "order_clean",
    title: "OrderClean · حماية الطلبات",
    short: "حماية الطلبات من التكرار والأنماط المشبوهة قبل تأكيدها.",
    accent: "#DC5B68",
    icon: ShieldCheck,
    identifier: "",
    secret: "",
    importance:
      "يكتشف تكرار رقم الهاتف خلال فترة تحددها، ثم يسمح لك بتسجيل الحالة للمراجعة أو حجب الطلبات المتكررة. لا تُخزن أرقام الهواتف في سجل الحماية؛ تُحفظ بصمة آمنة فقط.",
    steps: [
      "فعّل التطبيق.",
      "حدد نافذة التكرار وعدد الطلبات المسموح بها.",
      "اختر المراجعة أو الحجب.",
      "تابع إحصائيات الطلبات المسموحة والمراجعة والمحجوبة.",
    ],
    mode: "order_clean",
  },
  {
    kind: "thank_you",
    title: "Thank You Popup · نافذة الشكر",
    short: "رسالة تأكيد تظهر بعد نجاح الطلب مع زر خروج أو تتبع قابل للتخصيص.",
    accent: "#4E8DDD",
    icon: CheckCircle2,
    identifier: "",
    secret: "",
    importance:
      "تظهر للعميل مباشرة بعد إرسال طلب COD بنجاح. تبدأ برسالة عربية وزر «خروج» يعود إلى الصفحة الرئيسية، ويمكنك استبدال الرابط برابط تتبع الطلب.",
    steps: [
      "فعّل نافذة الشكر بعد إتمام الطلب.",
      "خصص رسالة التأكيد ونص الزر.",
      "اترك الرابط / للعودة إلى الصفحة الرئيسية، أو ضع رابط التتبع.",
      "يمكن استعمال {orderNumber} داخل الرابط ليُستبدل برقم الطلب تلقائيًا.",
    ],
    mode: "thank_you",
  },
  {
    kind: "contact_bar",
    title: "Contact Bar · أزرار الاتصال الثابتة",
    short: "تسهيل التواصل مع الزبائن عبر الهاتف وWhatsApp في صفحات المتجر.",
    accent: "#16A6A1",
    icon: Phone,
    identifier: "",
    secret: "",
    importance:
      "يعرض أزرار اتصال واضحة وثابتة في صفحات المتجر وصفحة المنتج والفانل، حتى يصل الزبون إلى الهاتف أو WhatsApp بسرعة.",
    steps: [
      "فعّل التطبيق.",
      "أدخل رقم الهاتف ورقم WhatsApp.",
      "فعّل كل زر وحدد إن كان ثابتًا.",
      "اختر الصفحات التي يظهر فيها الشريط ثم احفظ.",
    ],
    mode: "contact_bar",
  },
  {
    kind: "content_guard",
    title: "ContentGuard · حماية محتوى المتجر",
    short: "تقليل نسخ الصور والمحتوى والكشط مع إعدادات حماية متدرجة.",
    accent: "var(--brand)",
    icon: ShieldCheck,
    identifier: "",
    secret: "",
    importance:
      "يضيف طبقات حماية عملية مثل منع النسخ السطحي والنقر بالزر الأيمن والعلامة المائية. لا توجد حماية مطلقة من تصوير الشاشة أو أدوات المطور.",
    steps: [
      "فعّل التطبيق.",
      "اختر حماية الصور ومنع النسخ السطحي.",
      "فعّل العلامة المائية واكتب النص الظاهر.",
      "احفظ الإعدادات واختبر تجربة الشراء.",
    ],
    mode: "content_guard",
  },
  {
    kind: "ad_shield",
    title: "AdShield · حماية مصادر الإعلانات",
    short: "تقييد بعض مصادر الكشط المعلنة مع إبقاء الوصول الحقيقي آمنًا.",
    accent: "#C85C69",
    icon: ShieldCheck,
    identifier: "",
    secret: "",
    importance:
      "يمكنه تقييد الزيارات التي تحمل إحالة واضحة من Meta Ads Library أو مصادر إعلانية. هذا التعرف غير مضمون لأن الإحالة قابلة للإخفاء أو التزوير، لذلك لا يمنع كل زائر من Meta بشكل قطعي.",
    steps: [
      "فعّل التطبيق فقط عند الحاجة.",
      "فعّل حجب الإحالات الإعلانية أو Meta Ads Library.",
      "خصص رسالة الحجب.",
      "اختبر عدم منع الزبائن القادمين من إعلاناتك.",
    ],
    mode: "ad_shield",
  },
  {
    kind: "tracking_retarget",
    title: "Tracking & Retargeting · تتبع واتساب",
    short:
      "خانة تتبع بعد الشراء + إشعار تلقائي بحالة الشحن + رسالة تخفيض بعد التسليم.",
    accent: "#0D9488",
    icon: Send,
    identifier: "",
    secret: "",
    importance:
      "بعد إتمام الزبون طلبه تظهر له خانة جذابة «تتبع طلبك» تأخذه مباشرة إلى واتساب الرقم المفعّل لديك. وكلما تغيّرت حالة الطلب في ForShip تُرسل الحالة الجديدة تلقائيًا إلى واتساب الزبون، وعند تأكيد التسليم تُرسل رسالة استرجاع برابط منتج وتخفيض يُطبَّق تلقائيًا بعد المدة الزمنية التي تحددها هنا.",
    steps: [
      "فعّل التطبيق وأدخل بيانات WhatsApp Cloud API للإرسال التلقائي إلى الزبون.",
      "أضف أرقام الدعم وفعّل رقمًا واحدًا فقط ليستقبل رسائل تتبع الطلب من المشترين.",
      "خصص رسائل الحالة وخانة «تتبع طلبك» التي تظهر للزبون بعد الشراء.",
      "اختر منتج حملة الاسترجاع ونسبة التخفيض والمدة بعد التسليم ثم احفظ.",
    ],
    mode: "tracking_retarget",
  },
  {
    kind: "message_order",
    title: "الطلب عبر الرسالة",
    short: "يزيد من الطلبات عبر فورم رسالة بسيط داخل المتجر.",
    accent: "#6366F1",
    icon: MessageCircle,
    identifier: "",
    secret: "",
    importance:
      "يضيف نموذج طلب مدمج داخل صفحات المتجر، يتيح للزبون إرسال طلبه عبر رسالة نصية مع بياناته الكاملة. مفيد للزبائن الذين يفضلون التواصل السريع بدلًا من ملء نموذج الطلب التقليدي.",
    steps: [
      "فعّل التطبيق وخصص عنوان النموذج والرسالة الترحيبية.",
      "أدخل تعليمات يراها الزبون قبل إرسال الطلب.",
      "اختر نص الزر ثم احفظ الإعدادات.",
      "ستظهر أداة الطلب عبر الرسالة في واجهة المتجر تلقائيًا.",
    ],
    mode: "message_order",
  },
  {
    kind: "negotiator",
    title: "Negotiator AI · مفاوض الذكاء الاصطناعي",
    short:
      "شاتبوت ذكي يتفاوض مع الزبون على السعر والتوصيل ضمن الحدود التي تحددها.",
    accent: "#7C3AED",
    icon: Bot,
    identifier: "",
    secret: "",
    importance:
      "يحوّل شاتبوت صفحة المنتج إلى مفاوض تلقائي: يقدم تخفيضًا أو توصيلًا مجانيًا أو عرضًا بديلًا لإقناع الزبون المتردد، مع التزام صارم بالصلاحيات والحدود التي تضعها لكل منتج على حدة. يمكنه أيضًا الاعتماد على أرقام Costs & Profitability ليتفاوض وحده دون كشف أرقامك الداخلية.",
    steps: [
      "فعّل التطبيق.",
      "ضع حدودًا عامة (أقصى تخفيض، توصيل مجاني، حد أدنى للسعر).",
      "خصص صلاحيات كل منتج على حدة.",
      "فعّل «التفاوض الذكي» ليقرأ تكاليف المنتج من Profitability Engine ويقرر العرض الأنسب وحده.",
    ],
    mode: "negotiator",
  },
];

const emptyPixel = (): Pixel => ({
  label: "Pixel 1",
  pixelId: "",
  enabled: true,
});
const emptyForm = (): Form => ({
  label: "",
  identifier: "",
  secret: "",
  domain: "",
  verificationCode: "",
  enabled: false,
  pixels: [emptyPixel()],
  whatsappPhoneId: "",
  whatsappToken: "",
  telegramBotToken: "",
  telegramChatId: "",
  smsProvider: "",
  smsApiUrl: "",
  smsApiKey: "",
  whatsappRecipient: "",
  smsRecipient: "",
  sharkTitle: "قبل خروجك",
  sharkDescriptionBefore: "يمكنك الاستفادة من تخفيض خاص",
  sharkDescriptionAfter: "هذا التخفيض لن يظهر لك مرة أخرى",
  sharkButtonText: "الاستفادة من هذا التخفيض",
  sharkDiscountPercent: "10",
  sharkTargetMode: "all",
  sharkTargetProductId: "",
  sharkTargetLandingPageId: "",
  orderCleanWindowHours: "24",
  orderCleanMaxOrders: "1",
  orderCleanAction: "review",
  thankYouMessage:
    "تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت. شكرًا لثقتك بنا.",
  thankYouButtonText: "خروج",
  thankYouButtonUrl: "/",
  contactPhoneEnabled: false,
  contactPhoneNumber: "",
  contactPhoneSticky: true,
  contactWhatsappEnabled: false,
  contactWhatsappNumber: "",
  contactWhatsappSticky: true,
  contactShowOnStore: true,
  contactShowOnProduct: true,
  contactShowOnLanding: true,
  guardProtectImages: true,
  guardBlockRightClick: true,
  guardPreventSelection: true,
  guardWatermarkEnabled: false,
  guardWatermarkText: "Abdou Store",
  guardBlockHotlink: false,
  guardBlockAdReferrers: false,
  guardBlockMetaAdsLibrary: false,
  guardBlockedMessage: "هذا المحتوى غير متاح من هذا المصدر.",
  trackNumbers: [{ label: "رقم الدعم", number: "", active: true }],
  trackTitle: "تتبع طلبك عبر واتساب",
  trackHint: "أرسل رقم طلبك وسنرد عليك مباشرة بمتابعة طلبك لحظة بلحظة.",
  trackCta: "تتبع طلبك الآن",
  trackMessage: "مرحبًا، أريد تتبع طلبية رقم {orderNumber}",
  trackStatusEnabled: true,
  trackStatusMessage:
    "مرحبًا {customerName} 👋\nطلبك رقم {orderNumber} أصبح بحالة:\n{status}\n\nشكرًا لثقتك بنا 💚",
  retargetEnabled: false,
  retargetType: "product",
  retargetProductId: "",
  retargetLandingPageId: "",
  retargetLandingUrl: "",
  retargetDiscount: "10",
  retargetDelay: "3",
  retargetMessage:
    "أهلًا {customerName} 🌟\nوصل طلبك {orderNumber} ونتمنى إنه عجبك 😍\nكعربون شكر منا إليك تخفيض {discount}% على:\n{productTitle}\n\n{productLink}\n\nالعرض لفترة محدودة، استفيد قبل ما يفوتك 💚",
  messageOrderTitle: "الطلب عبر الرسالة",
  messageOrderWelcome:
    "مرحبًا! يمكنك إرسال طلبك الآن عبر هذه النافذة. املأ بياناتك واكتب رسالة بالمنتج الذي تريد وسن respond في أسرع وقت.",
  messageOrderInstructions:
    "أدخل اسمك ورقم هاتفك وعنوانك، ثم اكتب رسالة تحتوي على المنتجات المطلوبة والكميات. سنقوم بالرد عليك وتأكيد الطلب في أقرب وقت.",
  messageOrderButtonText: "إرسال الطلب الآن",
  negotiatorAutoNegotiate: false,
});
const emptyForms = (): Record<Kind, Form> => ({
  meta_capi: emptyForm(),
  tiktok_capi: emptyForm(),
  snapchat_capi: emptyForm(),
  facebook_domain: emptyForm(),
  cloudflare_turnstile: emptyForm(),
  google_sheets: emptyForm(),
  abandoned_orders: emptyForm(),
  notifications: emptyForm(),
  shark_cod: emptyForm(),
  order_clean: emptyForm(),
  thank_you: emptyForm(),
  contact_bar: emptyForm(),
  content_guard: emptyForm(),
  ad_shield: emptyForm(),
  tracking_retarget: emptyForm(),
  message_order: emptyForm(),
  negotiator: emptyForm(),
});

type NegotiatorRuleForm = {
  productId: number;
  title: string;
  enabled: boolean;
  maxDiscountAmount: string;
  maxDiscountPercent: string;
  minPrice: string;
  minProfitMarginPercent: string;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinQuantity: string;
  freeDeliveryMaxFee: string;
  customRules: string;
};

export default function Connecteurs() {
  const { data, isLoading } = trpc.connecteurs.list.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.connecteurs.save.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعداد التطبيق");
      await utils.connecteurs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const savePixels = trpc.connecteurs.savePixels.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ البكسلات");
      await utils.connecteurs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.connecteurs.remove.useMutation({
    onSuccess: async () => {
      toast.success("تم فصل التطبيق");
      await utils.connecteurs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncSheets = trpc.connecteurs.syncGoogleSheets.useMutation({
    onSuccess: result => toast.success(`تمت مزامنة ${result.synced} طلبًا`),
    onError: error => toast.error(error.message),
  });
  const sharkSettings = trpc.sharkCod.settings.useQuery();
  const orderCleanSettings = trpc.orderClean.settings.useQuery();
  const orderCleanAnalytics = trpc.orderClean.analytics.useQuery();
  const orderCleanEvents = trpc.orderClean.events.useQuery();
  const thankYouSettings = trpc.thankYou.settings.useQuery();
  const contactBarSettings = trpc.contactBar.settings.useQuery();
  const contentGuardSettings = trpc.contentGuard.settings.useQuery();
  const sharkAnalytics = trpc.sharkCod.analytics.useQuery();
  const generalRecMutation =
    trpc.sharkCod.generateRecommendations.useMutation();
  const saveShark = trpc.sharkCod.save.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات SHARK COD");
      await Promise.all([
        utils.sharkCod.settings.invalidate(),
        utils.sharkCod.analytics.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const saveOrderClean = trpc.orderClean.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات OrderClean");
      await Promise.all([
        utils.orderClean.settings.invalidate(),
        utils.orderClean.analytics.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const saveThankYou = trpc.thankYou.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات Thank You Popup");
      await utils.thankYou.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveContactBar = trpc.contactBar.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات Contact Bar");
      await utils.contactBar.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveContentGuard = trpc.contentGuard.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات الحماية");
      await utils.contentGuard.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const trackingSettingsQuery = trpc.trackingRetarget.settings.useQuery();
  const trackingAnalytics = trpc.trackingRetarget.analytics.useQuery();
  const productsQuery = trpc.products.list.useQuery();
  const landingsQuery = trpc.landings.list.useQuery();
  const saveTracking = trpc.trackingRetarget.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات Tracking & Retargeting");
      await Promise.all([
        utils.trackingRetarget.settings.invalidate(),
        utils.trackingRetarget.analytics.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const runDue = trpc.trackingRetarget.runDueNow.useMutation({
    onSuccess: async result => {
      toast.success(
        `تمت معالجة رسائل الاسترجاع: ${result.sent} مُرسلة · ${result.skipped} متخطاة`
      );
      await Promise.all([
        utils.trackingRetarget.analytics.invalidate(),
        utils.trackingRetarget.settings.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const messageOrderSettingsQuery = trpc.messageOrder.settings.useQuery();
  const saveMessageOrder = trpc.messageOrder.saveSettings.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات الطلب عبر الرسالة");
      await utils.messageOrder.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const negotiatorSettingsQuery = trpc.negotiator.settings.useQuery();
  const negotiatorRulesQuery = trpc.negotiator.productRules.useQuery();
  const saveNegotiator = trpc.negotiator.save.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات Negotiator AI");
      await Promise.all([
        utils.negotiator.settings.invalidate(),
        utils.negotiator.productRules.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const [open, setOpen] = useState<Kind | null>(null);
  const [forms, setForms] = useState<Record<Kind, Form>>(emptyForms);
  const [negotiatorRules, setNegotiatorRules] = useState<NegotiatorRuleForm[]>(
    []
  );
  const [selectedNegotiatorProductId, setSelectedNegotiatorProductId] =
    useState<number | null>(null);
  const negotiatorInitialized = useRef(false);

  useEffect(() => {
    if (!data) return;
    setForms(previous => {
      const next = { ...previous };
      for (const item of data) {
        const base = next[item.kind];
        next[item.kind] = {
          ...base,
          label: item.label,
          identifier: item.identifier ?? "",
          domain: item.domain ?? "",
          verificationCode: item.verificationCode ?? "",
          enabled: item.enabled,
          secret: "",
          pixels: item.pixels?.length
            ? item.pixels.map(pixel => ({
                id: pixel.id,
                label: pixel.label,
                pixelId: pixel.pixelId,
                enabled: pixel.enabled,
              }))
            : base.pixels,
        };
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    const settings = orderCleanSettings.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      order_clean: {
        ...previous.order_clean,
        label: "OrderClean",
        enabled: settings.enabled,
        orderCleanWindowHours: String(settings.duplicateWindowHours),
        orderCleanMaxOrders: String(settings.maxOrdersPerPhone),
        orderCleanAction: settings.action,
      },
    }));
  }, [orderCleanSettings.data]);

  useEffect(() => {
    const settings = thankYouSettings.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      thank_you: {
        ...previous.thank_you,
        label: "Thank You Popup",
        enabled: settings.enabled,
        thankYouMessage: settings.message,
        thankYouButtonText: settings.buttonText,
        thankYouButtonUrl: settings.buttonUrl,
      },
    }));
  }, [thankYouSettings.data]);

  useEffect(() => {
    const settings = contactBarSettings.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      contact_bar: {
        ...previous.contact_bar,
        label: "Contact Bar",
        enabled: settings.enabled,
        contactPhoneEnabled: settings.phoneEnabled,
        contactPhoneNumber: settings.phoneNumber,
        contactPhoneSticky: settings.phoneSticky,
        contactWhatsappEnabled: settings.whatsappEnabled,
        contactWhatsappNumber: settings.whatsappNumber,
        contactWhatsappSticky: settings.whatsappSticky,
        contactShowOnStore: settings.showOnStore,
        contactShowOnProduct: settings.showOnProduct,
        contactShowOnLanding: settings.showOnLanding,
      },
    }));
  }, [contactBarSettings.data]);

  useEffect(() => {
    const settings = contentGuardSettings.data;
    if (!settings) return;
    const patch = {
      label: "ContentGuard",
      enabled: settings.enabled,
      guardProtectImages: settings.protectImages,
      guardBlockRightClick: settings.blockRightClick,
      guardPreventSelection: settings.preventSelection,
      guardWatermarkEnabled: settings.watermarkEnabled,
      guardWatermarkText: settings.watermarkText,
      guardBlockHotlink: settings.blockHotlink,
      guardBlockAdReferrers: settings.blockAdReferrers,
      guardBlockMetaAdsLibrary: settings.blockMetaAdsLibrary,
      guardBlockedMessage: settings.blockedMessage,
    };
    setForms(previous => ({
      ...previous,
      content_guard: { ...previous.content_guard, ...patch },
      ad_shield: { ...previous.ad_shield, ...patch, label: "AdShield" },
    }));
  }, [contentGuardSettings.data]);

  useEffect(() => {
    const settings = sharkSettings.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      shark_cod: {
        ...previous.shark_cod,
        label: "SHARK COD",
        enabled: settings.enabled,
        sharkTitle: settings.title,
        sharkDescriptionBefore: settings.descriptionBefore,
        sharkDescriptionAfter: settings.descriptionAfter,
        sharkButtonText: settings.buttonText,
        sharkDiscountPercent: String(settings.discountPercent),
        sharkTargetMode: settings.targetMode,
        sharkTargetProductId: settings.targetProductId
          ? String(settings.targetProductId)
          : "",
        sharkTargetLandingPageId: settings.targetLandingPageId
          ? String(settings.targetLandingPageId)
          : "",
      },
    }));
  }, [sharkSettings.data]);

  useEffect(() => {
    const settings = trackingSettingsQuery.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      tracking_retarget: {
        ...previous.tracking_retarget,
        label: "Tracking & Retargeting",
        enabled: settings.enabled,
        whatsappPhoneId: settings.whatsappPhoneId,
        whatsappToken: "",
        trackNumbers: settings.supportNumbers.length
          ? settings.supportNumbers
          : previous.tracking_retarget.trackNumbers,
        trackTitle: settings.trackTitle,
        trackHint: settings.trackHint,
        trackCta: settings.trackCta,
        trackMessage: settings.trackMessage,
        trackStatusEnabled: settings.statusEnabled,
        trackStatusMessage: settings.statusMessage,
        retargetEnabled: settings.retargetEnabled,
        retargetType: settings.retargetTargetType,
        retargetProductId: settings.retargetProductId
          ? String(settings.retargetProductId)
          : "",
        retargetLandingPageId: settings.retargetLandingPageId
          ? String(settings.retargetLandingPageId)
          : "",
        retargetLandingUrl: settings.retargetLandingUrl ?? "",
        retargetDiscount: String(settings.retargetDiscountPercent ?? 10),
        retargetDelay: String(settings.retargetDelayDays ?? 3),
        retargetMessage: settings.retargetMessage,
      },
    }));
  }, [trackingSettingsQuery.data]);

  useEffect(() => {
    const settings = messageOrderSettingsQuery.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      message_order: {
        ...previous.message_order,
        label: settings.title,
        enabled: settings.enabled,
        messageOrderTitle: settings.title,
        messageOrderWelcome: settings.welcomeMessage,
        messageOrderInstructions: settings.instructions,
        messageOrderButtonText: settings.buttonText,
      },
    }));
  }, [messageOrderSettingsQuery.data]);

  useEffect(() => {
    const settings = negotiatorSettingsQuery.data;
    if (!settings) return;
    setForms(previous => ({
      ...previous,
      negotiator: {
        ...previous.negotiator,
        label: "Negotiator AI",
        enabled: settings.enabled,
        negotiatorAutoNegotiate: settings.autoNegotiate,
      },
    }));
  }, [negotiatorSettingsQuery.data]);

  useEffect(() => {
    if (negotiatorInitialized.current) return;
    const products = productsQuery.data;
    if (!products || !negotiatorRulesQuery.isSuccess) return;
    const productById = new Map(
      products
        .filter((product): product is NonNullable<typeof product> =>
          Boolean(product)
        )
        .map(product => [product.id, product])
    );
    const existing = negotiatorRulesQuery.data ?? [];
    negotiatorInitialized.current = true;
    setNegotiatorRules(
      existing
        .filter(rule => productById.has(rule.productId))
        .map(rule => ({
          productId: rule.productId,
          title: productById.get(rule.productId)?.title ?? "",
          enabled: rule.enabled,
          maxDiscountAmount: rule.maxDiscountAmount,
          maxDiscountPercent: String(rule.maxDiscountPercent),
          minPrice: rule.minPrice ?? "",
          minProfitMarginPercent: String(rule.minProfitMarginPercent),
          freeDeliveryEnabled: rule.freeDeliveryEnabled,
          freeDeliveryMinQuantity: String(rule.freeDeliveryMinQuantity),
          freeDeliveryMaxFee: rule.freeDeliveryMaxFee,
          customRules: rule.customRules ?? "",
        }))
    );
  }, [
    productsQuery.data,
    negotiatorRulesQuery.isSuccess,
    negotiatorRulesQuery.data,
  ]);

  useEffect(() => {
    if (selectedNegotiatorProductId === null && negotiatorRules.length > 0) {
      setSelectedNegotiatorProductId(negotiatorRules[0].productId);
    }
  }, [negotiatorRules, selectedNegotiatorProductId]);

  const availableNegotiatorProducts = (productsQuery.data ?? [])
    .filter((product): product is NonNullable<typeof product> =>
      Boolean(product)
    )
    .filter(
      product => !negotiatorRules.some(rule => rule.productId === product.id)
    );

  const addNegotiatorRule = (productId: number) => {
    const product = (productsQuery.data ?? []).find(
      item => item && item.id === productId
    );
    if (!product) return;
    setNegotiatorRules(previous =>
      previous.some(rule => rule.productId === productId)
        ? previous
        : [
            ...previous,
            {
              productId,
              title: product.title,
              enabled: true,
              maxDiscountAmount: "0.00",
              maxDiscountPercent: "0",
              minPrice: "",
              minProfitMarginPercent: "0",
              freeDeliveryEnabled: false,
              freeDeliveryMinQuantity: "2",
              freeDeliveryMaxFee: "0.00",
              customRules: "",
            },
          ]
    );
    setSelectedNegotiatorProductId(productId);
  };

  const removeNegotiatorRule = (productId: number) => {
    setNegotiatorRules(previous =>
      previous.filter(rule => rule.productId !== productId)
    );
    setSelectedNegotiatorProductId(current =>
      current === productId ? null : current
    );
  };

  const update = (kind: Kind, patch: Partial<Form>) =>
    setForms(previous => ({
      ...previous,
      [kind]: { ...previous[kind], ...patch },
    }));
  const updateNegotiatorRule = (
    productId: number,
    patch: Partial<NegotiatorRuleForm>
  ) =>
    setNegotiatorRules(previous =>
      previous.map(rule =>
        rule.productId === productId ? { ...rule, ...patch } : rule
      )
    );
  const submit = (card: Card) => {
    const form = forms[card.kind];
    if (card.kind === "shark_cod") {
      saveShark.mutate({
        enabled: form.enabled,
        title: form.sharkTitle,
        descriptionBefore: form.sharkDescriptionBefore,
        descriptionAfter: form.sharkDescriptionAfter,
        buttonText: form.sharkButtonText,
        discountPercent: Number(form.sharkDiscountPercent) || 0,
        targetMode: form.sharkTargetMode,
        targetProductId:
          form.sharkTargetMode === "product" && form.sharkTargetProductId
            ? Number(form.sharkTargetProductId)
            : null,
        targetLandingPageId:
          form.sharkTargetMode === "landing" && form.sharkTargetLandingPageId
            ? Number(form.sharkTargetLandingPageId)
            : null,
      });
      return;
    }
    if (card.kind === "order_clean") {
      saveOrderClean.mutate({
        enabled: form.enabled,
        duplicateWindowHours: Number(form.orderCleanWindowHours) || 24,
        maxOrdersPerPhone: Number(form.orderCleanMaxOrders) || 1,
        action: form.orderCleanAction,
      });
      return;
    }
    if (card.kind === "thank_you") {
      saveThankYou.mutate({
        enabled: form.enabled,
        message: form.thankYouMessage,
        buttonText: form.thankYouButtonText,
        buttonUrl: form.thankYouButtonUrl,
      });
      return;
    }
    if (card.kind === "contact_bar") {
      saveContactBar.mutate({
        enabled: form.enabled,
        phoneEnabled: form.contactPhoneEnabled,
        phoneNumber: form.contactPhoneNumber,
        phoneSticky: form.contactPhoneSticky,
        whatsappEnabled: form.contactWhatsappEnabled,
        whatsappNumber: form.contactWhatsappNumber,
        whatsappSticky: form.contactWhatsappSticky,
        showOnStore: form.contactShowOnStore,
        showOnProduct: form.contactShowOnProduct,
        showOnLanding: form.contactShowOnLanding,
      });
      return;
    }
    if (card.kind === "content_guard" || card.kind === "ad_shield") {
      saveContentGuard.mutate({
        enabled: form.enabled,
        protectImages: form.guardProtectImages,
        blockRightClick: form.guardBlockRightClick,
        preventSelection: form.guardPreventSelection,
        watermarkEnabled: form.guardWatermarkEnabled,
        watermarkText: form.guardWatermarkText,
        blockHotlink:
          card.kind === "ad_shield" ? form.guardBlockHotlink : false,
        blockAdReferrers:
          card.kind === "ad_shield" ? form.guardBlockAdReferrers : false,
        blockMetaAdsLibrary:
          card.kind === "ad_shield" ? form.guardBlockMetaAdsLibrary : false,
        blockedMessage: form.guardBlockedMessage,
      });
      return;
    }
    if (card.kind === "tracking_retarget") {
      const productId =
        form.retargetEnabled && form.retargetProductId
          ? Number(form.retargetProductId) || null
          : null;
      const landingId =
        form.retargetEnabled &&
        form.retargetType === "landing" &&
        form.retargetLandingPageId
          ? Number(form.retargetLandingPageId) || null
          : null;
      saveTracking.mutate({
        enabled: form.enabled,
        whatsappPhoneId: form.whatsappPhoneId,
        whatsappToken: form.whatsappToken.trim() || undefined,
        clearWhatsappToken: !form.whatsappPhoneId.trim(),
        supportNumbers: form.trackNumbers,
        trackTitle: form.trackTitle,
        trackHint: form.trackHint,
        trackCta: form.trackCta,
        trackMessage: form.trackMessage,
        statusEnabled: form.trackStatusEnabled,
        statusMessage: form.trackStatusMessage,
        retargetEnabled: form.retargetEnabled,
        retargetTargetType: form.retargetType,
        retargetProductId: productId,
        retargetLandingPageId: landingId,
        retargetLandingUrl: form.retargetLandingUrl,
        retargetDiscountPercent: Number(form.retargetDiscount) || 0,
        retargetDelayDays: Number(form.retargetDelay) || 0,
        retargetMessage: form.retargetMessage,
      });
      return;
    }
    if (card.kind === "message_order") {
      saveMessageOrder.mutate({
        enabled: form.enabled,
        title: form.messageOrderTitle || card.title,
        welcomeMessage: form.messageOrderWelcome,
        instructions: form.messageOrderInstructions,
        buttonText: form.messageOrderButtonText,
      });
      return;
    }
    if (card.kind === "negotiator") {
      saveNegotiator.mutate({
        enabled: form.enabled,
        autoNegotiate: form.negotiatorAutoNegotiate,
        rules: negotiatorRules.map(rule => ({
          productId: rule.productId,
          enabled: rule.enabled,
          maxDiscountAmount: rule.maxDiscountAmount || "0.00",
          maxDiscountPercent: Number(rule.maxDiscountPercent) || 0,
          minPrice: rule.minPrice.trim() || null,
          minProfitMarginPercent: Number(rule.minProfitMarginPercent) || 0,
          freeDeliveryEnabled: rule.freeDeliveryEnabled,
          freeDeliveryMinQuantity: Number(rule.freeDeliveryMinQuantity) || 1,
          freeDeliveryMaxFee: rule.freeDeliveryMaxFee || "0.00",
          customRules: rule.customRules.trim() || null,
        })),
      });
      return;
    }
    save.mutate(
      {
        kind: genericKind(card.kind),
        label: form.label || card.title,
        identifier:
          card.mode === "domain" || card.mode === "toggle"
            ? undefined
            : card.mode === "notifications"
              ? "multi_channel"
              : form.identifier || undefined,
        secret:
          card.mode === "domain" ||
          card.mode === "toggle" ||
          card.kind === "google_sheets"
            ? undefined
            : card.mode === "notifications"
              ? JSON.stringify({
                  whatsappPhoneId: form.whatsappPhoneId,
                  whatsappToken: form.whatsappToken,
                  whatsappRecipient: form.whatsappRecipient,
                  telegramBotToken: form.telegramBotToken,
                  telegramChatId: form.telegramChatId,
                  smsProvider: form.smsProvider,
                  smsApiUrl: form.smsApiUrl,
                  smsApiKey: form.smsApiKey,
                  smsRecipient: form.smsRecipient,
                })
              : form.secret || undefined,
        domain: card.mode === "domain" ? form.domain || undefined : undefined,
        verificationCode:
          card.mode === "domain"
            ? form.verificationCode || undefined
            : undefined,
        enabled: form.enabled,
      },
      {
        onSuccess: () => {
          if (card.mode === "pixel")
            savePixels.mutate({
              kind: card.kind as "meta_capi" | "tiktok_capi" | "snapchat_capi",
              pixels: form.pixels,
            });
        },
      }
    );
  };
  const addPixel = (kind: Kind) => {
    const form = forms[kind];
    if (form.pixels.length >= 7)
      return toast.info("الحد الأقصى هو 7 بكسلات لكل تطبيق.");
    update(kind, {
      pixels: [
        ...form.pixels,
        {
          label: `Pixel ${form.pixels.length + 1}`,
          pixelId: "",
          enabled: true,
        },
      ],
    });
  };
  const updatePixel = (kind: Kind, index: number, patch: Partial<Pixel>) =>
    update(kind, {
      pixels: forms[kind].pixels.map((pixel, current) =>
        current === index ? { ...pixel, ...patch } : pixel
      ),
    });
  const addTrackNumber = (kind: Kind) => {
    const rows = forms[kind].trackNumbers;
    if (rows.length >= 12) return toast.info("الحد الأقصى هو 12 رقم دعم.");
    update(kind, {
      trackNumbers: [
        ...rows,
        {
          label: `رقم الدعم ${rows.length + 1}`,
          number: "",
          active: rows.length === 0,
        },
      ],
    });
  };
  const updateTrackNumber = (
    kind: Kind,
    index: number,
    patch: Partial<SupportNumberRow>
  ) =>
    update(kind, {
      trackNumbers: forms[kind].trackNumbers.map((row, current) =>
        current === index ? { ...row, ...patch } : row
      ),
    });
  const activateTrackNumber = (kind: Kind, index: number) =>
    update(kind, {
      trackNumbers: forms[kind].trackNumbers.map((row, current) => ({
        ...row,
        active: current === index,
      })),
    });
  const removeTrackNumber = (kind: Kind, index: number) =>
    update(kind, {
      trackNumbers: forms[kind].trackNumbers.filter(
        (_, current) => current !== index
      ),
    });
  const connectedKinds = new Set((data ?? []).map(item => item.kind));
  const genericKind = (kind: Kind) =>
    kind as
      | "meta_capi"
      | "tiktok_capi"
      | "snapchat_capi"
      | "facebook_domain"
      | "cloudflare_turnstile"
      | "google_sheets"
      | "abandoned_orders"
      | "notifications"
      | "message_order";
  const sharkConnected = Boolean(sharkSettings.data);
  const orderCleanConnected = Boolean(orderCleanSettings.data);
  const thankYouConnected = Boolean(thankYouSettings.data);
  const contactBarConnected = Boolean(contactBarSettings.data);
  const contentGuardConnected = Boolean(contentGuardSettings.data);
  const trackingConnected = Boolean(trackingSettingsQuery.data);
  const messageOrderConnected = Boolean(messageOrderSettingsQuery.data);
  const negotiatorConnected = Boolean(negotiatorSettingsQuery.data);

  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-9" dir="rtl">
      <PageIntro
        eyebrow="APPS & CONNECTEURS"
        title="التطبيقات"
        description="اربط أدوات الحماية والمزامنة والإشعارات بمتجرك. اضغط على «ربط» لفتح التفاصيل."
        action={
          <div className="flex items-center gap-2 rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] px-4 py-3 text-xs font-bold text-[var(--brand)]">
            <ShieldCheck className="size-4" />
            التوكنات مشفرة
          </div>
        }
      />

      <div className="mb-6 flex gap-3 rounded-[20px] border border-[#F0E3CF] bg-[var(--warm-soft)] p-4 text-sm leading-7 text-[#7A5B34] shadow-soft">
        <Info className="mt-1 size-5 shrink-0 text-[var(--warm)]" />
        <p>
          معلومات الربط لا تظهر إلا بعد فتح التطبيق، والتوكنات السرية لا تُعاد
          عرضها.
        </p>
      </div>

      <div className="space-y-4">
        {cards.map((card, cardIndex) => {
          const Icon = card.icon;
          const form = forms[card.kind];
          const connected =
            card.kind === "shark_cod"
              ? sharkConnected
              : card.kind === "order_clean"
                ? orderCleanConnected
                : card.kind === "thank_you"
                  ? thankYouConnected
                  : card.kind === "contact_bar"
                    ? contactBarConnected
                    : card.kind === "content_guard" || card.kind === "ad_shield"
                      ? contentGuardConnected
                      : card.kind === "tracking_retarget"
                        ? trackingConnected
                        : card.kind === "message_order"
                          ? messageOrderConnected
                          : card.kind === "negotiator"
                            ? negotiatorConnected
                            : connectedKinds.has(genericKind(card.kind));
          const isOpen = open === card.kind;
          return (
            <section
              key={card.kind}
              className={`animate-fade-up overflow-hidden rounded-[24px] border bg-white shadow-soft transition hover:shadow-lift ${isOpen ? "border-[var(--brand)]/40" : "border-[#E7E9E2]"}`}
              style={{ animationDelay: `${Math.min(cardIndex, 8) * 45}ms` }}
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div
                    className="grid size-12 shrink-0 place-items-center rounded-2xl"
                    style={{
                      backgroundColor: `${card.accent}14`,
                      color: card.accent,
                    }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-[#1F2A25]">
                        {card.title}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${connected && form.enabled ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F1F3EE] text-[#79837D]"}`}
                      >
                        {connected && form.enabled ? "متصل" : "غير متصل"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8A938D]">
                      {card.short}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : card.kind)}
                  className="btn-press flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] sm:self-auto"
                >
                  {isOpen ? (
                    <>
                      <X className="size-4" />
                      إغلاق
                    </>
                  ) : (
                    <>
                      <Cable className="size-4" />
                      {connected ? "إدارة" : "ربط"}
                    </>
                  )}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-[#ECEDE6] bg-[var(--paper)] p-5 sm:p-7">
                  <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                        <Info className="size-4 text-[var(--brand)]" /> لماذا
                        هذا التطبيق؟
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#79837D]">
                        {card.importance}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                      <h3 className="text-sm font-extrabold text-[#1F2A25]">
                        طريقة الربط
                      </h3>
                      <ol className="mt-3 space-y-2 text-sm leading-6 text-[#79837D]">
                        {card.steps.map((step, index) => (
                          <li key={step} className="flex gap-2">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[10px] font-extrabold text-[var(--brand)]">
                              {index + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <Field
                    label="اسم الإعداد"
                    value={form.label}
                    onChange={value => update(card.kind, { label: value })}
                    placeholder={card.title}
                  />

                  {card.mode === "domain" && (
                    <>
                      <Field
                        label="النطاق"
                        value={form.domain}
                        onChange={value => update(card.kind, { domain: value })}
                        placeholder="example.com"
                        dir="ltr"
                      />
                      <Field
                        label="رمز التحقق أو Meta tag"
                        value={form.verificationCode}
                        onChange={value =>
                          update(card.kind, { verificationCode: value })
                        }
                        placeholder="الصق القيمة من Facebook Business"
                        dir="ltr"
                      />
                    </>
                  )}

                  {card.mode === "standard" && (
                    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                      <Field
                        label={card.identifier}
                        value={form.identifier}
                        onChange={value =>
                          update(card.kind, { identifier: value })
                        }
                        placeholder={`أدخل ${card.identifier}`}
                        dir="ltr"
                      />
                      {card.kind !== "google_sheets" && (
                        <Field
                          label={card.secret}
                          value={form.secret}
                          onChange={value =>
                            update(card.kind, { secret: value })
                          }
                          placeholder={
                            connected
                              ? "اتركه فارغًا للإبقاء على القيمة الحالية"
                              : `أدخل ${card.secret}`
                          }
                          hint={
                            card.kind === "cloudflare_turnstile"
                              ? "Secret Key يبقى في الخادم للتحقق من رمز Turnstile قبل إنشاء الطلب."
                              : "يُستخدم هذا الحقل لإعداد الربط الآمن."
                          }
                          type="password"
                          dir="ltr"
                        />
                      )}
                      {card.kind === "google_sheets" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!form.identifier)
                                return toast.error(
                                  "أدخل Spreadsheet ID أولًا حتى نفتح لك ربط Google."
                                );
                              window.location.href = `/api/google/oauth/start?spreadsheetId=${encodeURIComponent(form.identifier)}`;
                            }}
                            className="btn-press flex items-center gap-2 rounded-xl bg-[#34A853] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#2D9348]"
                          >
                            <Globe2 className="size-4" />
                            {connected ? "إعادة ربط Google" : "ربط Google"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              syncSheets.mutate({
                                spreadsheetId: form.identifier,
                              })
                            }
                            disabled={
                              !connected ||
                              !form.identifier ||
                              syncSheets.isPending
                            }
                            className="btn-press flex items-center gap-2 rounded-xl border border-[#D8E6DD] bg-white px-4 py-2.5 text-xs font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Zap className="size-4" />
                            {syncSheets.isPending
                              ? "جارٍ المزامنة..."
                              : "مزامنة الطلبات الآن"}
                          </button>
                          <p className="basis-full text-xs leading-6 text-[#79837D]">
                            سيتم فتح Google للموافقة، ثم يُستخدم التفويض للوصول
                            إلى ملف Sheets المحدد.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {card.mode === "toggle" && (
                    <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 text-sm leading-7 text-[#79837D] shadow-soft">
                      عند تفعيل هذا التطبيق ستبدأ الطلبات المتروكة الجديدة
                      بالظهور في قسم «الطلبات المتروكة». عند إطفائه يتوقف
                      الاستقبال فقط، وتبقى البيانات السابقة محفوظة.
                    </div>
                  )}

                  {card.mode === "notifications" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4">
                        <h3 className="mb-3 text-sm font-extrabold text-[var(--brand-strong)]">
                          WhatsApp Cloud API
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SmallField
                            label="Phone Number ID"
                            value={form.whatsappPhoneId}
                            onChange={value =>
                              update(card.kind, { whatsappPhoneId: value })
                            }
                            dir="ltr"
                          />
                          <SmallField
                            label="رقم WhatsApp المستلم"
                            value={form.whatsappRecipient}
                            onChange={value =>
                              update(card.kind, { whatsappRecipient: value })
                            }
                            dir="ltr"
                            placeholder="2136xxxxxxxx"
                          />
                          <SmallField
                            label="Access Token"
                            value={form.whatsappToken}
                            onChange={value =>
                              update(card.kind, { whatsappToken: value })
                            }
                            type="password"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#D8E4F0] bg-[#F4F9FD] p-4">
                        <h3 className="mb-3 text-sm font-extrabold text-[#2563A5]">
                          Telegram
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SmallField
                            label="Bot Token"
                            value={form.telegramBotToken}
                            onChange={value =>
                              update(card.kind, { telegramBotToken: value })
                            }
                            type="password"
                            dir="ltr"
                          />
                          <SmallField
                            label="Chat ID"
                            value={form.telegramChatId}
                            onChange={value =>
                              update(card.kind, { telegramChatId: value })
                            }
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <h3 className="mb-3 text-sm font-extrabold text-[#1F2A25]">
                          SMS الجزائري
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SmallField
                            label="اسم المزود"
                            value={form.smsProvider}
                            onChange={value =>
                              update(card.kind, { smsProvider: value })
                            }
                            placeholder="مزود SMS"
                          />
                          <SmallField
                            label="رابط API"
                            value={form.smsApiUrl}
                            onChange={value =>
                              update(card.kind, { smsApiUrl: value })
                            }
                            dir="ltr"
                          />
                          <SmallField
                            label="API Key"
                            value={form.smsApiKey}
                            onChange={value =>
                              update(card.kind, { smsApiKey: value })
                            }
                            type="password"
                            dir="ltr"
                          />
                          <SmallField
                            label="رقم SMS المستلم"
                            value={form.smsRecipient}
                            onChange={value =>
                              update(card.kind, { smsRecipient: value })
                            }
                            dir="ltr"
                            placeholder="05xxxxxxxx"
                          />
                        </div>
                        <p className="mt-3 text-xs leading-6 text-[#8A938D]">
                          أدخل بوابة SMS التي تملك API موثقًا؛ اسم جيزي أو
                          موبيليس أو أوريدو وحده لا يكفي للربط البرمجي.
                        </p>
                      </div>
                    </div>
                  )}

                  {card.mode === "shark_cod" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="عنوان نافذة الخروج"
                            value={form.sharkTitle}
                            onChange={value =>
                              update(card.kind, { sharkTitle: value })
                            }
                            placeholder="قبل خروجك"
                          />
                          <SmallField
                            label="نسبة التخفيض %"
                            value={form.sharkDiscountPercent}
                            onChange={value =>
                              update(card.kind, {
                                sharkDiscountPercent: value
                                  .replace(/\\D/g, "")
                                  .slice(0, 2),
                              })
                            }
                            dir="ltr"
                            placeholder="10"
                          />
                        </div>
                        <Field
                          label="النص قبل التخفيض"
                          value={form.sharkDescriptionBefore}
                          onChange={value =>
                            update(card.kind, { sharkDescriptionBefore: value })
                          }
                          placeholder="يمكنك الاستفادة من تخفيض خاص"
                        />
                        <Field
                          label="النص بعد التخفيض"
                          value={form.sharkDescriptionAfter}
                          onChange={value =>
                            update(card.kind, { sharkDescriptionAfter: value })
                          }
                          placeholder="هذا التخفيض لن يظهر لك مرة أخرى"
                        />
                        <Field
                          label="نص زر الدعوة إلى الإجراء"
                          value={form.sharkButtonText}
                          onChange={value =>
                            update(card.kind, { sharkButtonText: value })
                          }
                          placeholder="الاستفادة من هذا التخفيض"
                        />
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <h3 className="text-sm font-extrabold text-[#1F2A25]">
                          استهداف التطبيق
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-[#8A938D]">
                          حدد أين يظهر Exit Popup. في وضع «كل الصفحات» سيعمل على
                          صفحات المنتج والفانل.
                        </p>
                        <select
                          value={form.sharkTargetMode}
                          onChange={event =>
                            update(card.kind, {
                              sharkTargetMode: event.target
                                .value as Form["sharkTargetMode"],
                            })
                          }
                          className="mt-3 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                        >
                          <option value="all">كل صفحات المنتج والفانل</option>
                          <option value="product">
                            منتج محدد — أدخل Product ID
                          </option>
                          <option value="landing">
                            فانل محدد — أدخل Landing Page ID
                          </option>
                        </select>
                        {form.sharkTargetMode === "product" && (
                          <SmallField
                            label="Product ID"
                            value={form.sharkTargetProductId}
                            onChange={value =>
                              update(card.kind, {
                                sharkTargetProductId: value.replace(/\\D/g, ""),
                              })
                            }
                            dir="ltr"
                            placeholder="123"
                          />
                        )}
                        {form.sharkTargetMode === "landing" && (
                          <SmallField
                            label="Landing Page ID"
                            value={form.sharkTargetLandingPageId}
                            onChange={value =>
                              update(card.kind, {
                                sharkTargetLandingPageId: value.replace(
                                  /\\D/g,
                                  ""
                                ),
                              })
                            }
                            dir="ltr"
                            placeholder="123"
                          />
                        )}
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              Tracking Analytics
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              إحصائيات حقيقية من زيارات ونقرات Exit Popup
                              والطلبات المخفضة.
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--warm-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--warm)]">
                            SHARK COD
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <Metric
                            label="Views"
                            value={sharkAnalytics.data?.views ?? 0}
                          />
                          <Metric
                            label="CTA Clicks"
                            value={sharkAnalytics.data?.ctaClicks ?? 0}
                          />
                          <Metric
                            label="CTR"
                            value={`${sharkAnalytics.data?.ctr ?? 0}%`}
                          />
                          <Metric
                            label="Discount Orders"
                            value={sharkAnalytics.data?.discountOrders ?? 0}
                          />
                          <Metric
                            label="Conversion"
                            value={`${sharkAnalytics.data?.conversionRate ?? 0}%`}
                          />
                        </div>
                        <div className="mt-4 border-t border-[#ECEDE6] pt-4">
                          <p className="text-xs font-extrabold text-[#1F2A25]">
                            أسباب رفض العرض
                          </p>
                          {sharkAnalytics.data &&
                          Object.keys(sharkAnalytics.data.rejections ?? {})
                            .length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(
                                sharkAnalytics.data.rejections
                              ).map(([key, count]) => {
                                const labels: Record<string, string> = {
                                  price: "السعر غالي",
                                  delivery: "التوصيل غالي",
                                  compare: "حبيت نقارن",
                                  hesitate: "مازلت متردد",
                                  payment: "ما لقيتش طريقة الدفع المناسبة",
                                  changed_mind: "غيرت رأيي",
                                };
                                return (
                                  <span
                                    key={key}
                                    className="rounded-full bg-[#F1F3EE] px-2.5 py-1 text-[10px] font-extrabold text-[#4A554F]"
                                  >
                                    {labels[key] ?? key}: {count}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[#8A938D]">
                              ستظهر أسباب الرفض هنا بعد جمع بيانات كافية.
                            </p>
                          )}

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => generalRecMutation.mutate()}
                              disabled={generalRecMutation.isPending}
                              className="btn-press flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2 text-[10px] font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] disabled:opacity-50"
                            >
                              {generalRecMutation.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Sparkles className="size-3" />
                              )}
                              تحليل البيانات العامة
                            </button>
                            {generalRecMutation.isPending ? (
                              <div className="mt-3 flex items-center justify-center gap-2 py-4 text-xs text-[#79837D]">
                                <Loader2 className="size-4 animate-spin" />
                                جاري تحليل البيانات…
                              </div>
                            ) : generalRecMutation.data?.recommendations
                                ?.length ? (
                              <ul className="mt-3 space-y-2">
                                {generalRecMutation.data.recommendations.map(
                                  (rec, idx) => (
                                    <li
                                      key={idx}
                                      className="flex gap-2.5 rounded-xl bg-[var(--paper)] p-3 text-xs leading-6 text-[#4A554F]"
                                    >
                                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--warm-soft)] text-[10px] font-extrabold text-[var(--warm)]">
                                        {idx + 1}
                                      </span>
                                      {rec}
                                    </li>
                                  )
                                )}
                              </ul>
                            ) : (
                              <p className="mt-3 text-xs text-[#8A938D]">
                                اضغط على زر "تحليل البيانات العامة" للحصول على
                                توصيات مبنية على أسباب رفض الزوار.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <h3 className="text-sm font-extrabold text-[#1F2A25]">
                          Live Preview
                        </h3>
                        <div className="mt-3 mx-auto max-w-sm rounded-[24px] border border-[#ECEDE6] bg-[var(--paper)] p-5 text-center shadow-soft">
                          <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
                            <Zap className="size-5" />
                          </div>
                          <h4 className="mt-3 text-xl font-extrabold text-[#1F2A25]">
                            {form.sharkTitle || "قبل خروجك"}
                          </h4>
                          <p className="mt-2 text-sm font-bold text-[#79837D]">
                            {form.sharkDescriptionBefore ||
                              "يمكنك الاستفادة من تخفيض خاص"}
                          </p>
                          <p className="mt-2 text-4xl font-extrabold text-[var(--warm)]">
                            {form.sharkDiscountPercent || 0}%
                          </p>
                          <p className="mt-2 text-xs leading-6 text-[#8A938D]">
                            {form.sharkDescriptionAfter ||
                              "هذا التخفيض لن يظهر لك مرة أخرى"}
                          </p>
                          <button
                            type="button"
                            className="btn-press mt-4 w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-cta"
                          >
                            {form.sharkButtonText || "الاستفادة من هذا التخفيض"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {card.mode === "order_clean" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4">
                        <h3 className="text-sm font-extrabold text-[#7A5B34]">
                          قواعد الحماية
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-[#8A7A5F]">
                          يتم فحص رقم الهاتف خادميًا. عند تجاوز العدد المحدد
                          خلال النافذة الزمنية، إمّا يُسجل الطلب للمراجعة أو
                          يُحجب حسب اختيارك.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <SmallField
                            label="نافذة التكرار بالساعات"
                            value={form.orderCleanWindowHours}
                            onChange={value =>
                              update(card.kind, {
                                orderCleanWindowHours: value
                                  .replace(/\\D/g, "")
                                  .slice(0, 3),
                              })
                            }
                            dir="ltr"
                            placeholder="24"
                          />
                          <SmallField
                            label="أقصى طلبات للهاتف"
                            value={form.orderCleanMaxOrders}
                            onChange={value =>
                              update(card.kind, {
                                orderCleanMaxOrders: value
                                  .replace(/\\D/g, "")
                                  .slice(0, 2),
                              })
                            }
                            dir="ltr"
                            placeholder="1"
                          />
                        </div>
                        <label className="mt-4 block text-xs font-extrabold text-[#7A5B34]">
                          إجراء الطلب المتكرر
                          <select
                            value={form.orderCleanAction}
                            onChange={event =>
                              update(card.kind, {
                                orderCleanAction: event.target
                                  .value as Form["orderCleanAction"],
                              })
                            }
                            className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          >
                            <option value="review">
                              وضع للمراجعة — لا تمنع الطلب مباشرة
                            </option>
                            <option value="block">حجب الطلب تلقائيًا</option>
                          </select>
                        </label>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-[#1F2A25]">
                            Tracking Analytics
                          </h3>
                          <span className="rounded-full bg-[var(--warm-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--warm)]">
                            OrderClean
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <Metric
                            label="مسموح"
                            value={orderCleanAnalytics.data?.allowed ?? 0}
                          />
                          <Metric
                            label="مراجعة"
                            value={orderCleanAnalytics.data?.review ?? 0}
                          />
                          <Metric
                            label="محجوب"
                            value={orderCleanAnalytics.data?.blocked ?? 0}
                          />
                        </div>
                        {orderCleanEvents.data?.length ? (
                          <div className="mt-4 space-y-2 border-t border-[#ECEDE6] pt-4">
                            <p className="text-xs font-extrabold text-[#1F2A25]">
                              آخر القرارات والأسباب
                            </p>
                            {orderCleanEvents.data.slice(0, 5).map(event => (
                              <div
                                key={event.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--paper)] px-3 py-2 text-xs"
                              >
                                <span
                                  className={`rounded-full px-2 py-1 font-extrabold ${event.verdict === "blocked" ? "bg-[#FCE8E4] text-[#A63D28]" : event.verdict === "review" ? "bg-[var(--warm-soft)] text-[#B16B22]" : "bg-[var(--brand-soft)] text-[var(--brand)]"}`}
                                >
                                  {event.verdict === "blocked"
                                    ? "محجوب"
                                    : event.verdict === "review"
                                      ? "مراجعة"
                                      : "مسموح"}
                                </span>
                                <span className="flex-1 text-[#79837D]">
                                  {event.reason}
                                </span>
                                <span className="text-[10px] text-[#8A938D]">
                                  {new Date(event.createdAt).toLocaleString(
                                    "ar-DZ"
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 border-t border-[#ECEDE6] pt-4 text-xs text-[#8A938D]">
                            ستظهر أسباب القرارات هنا بعد وصول طلبات جديدة.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {card.mode === "contact_bar" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Phone className="size-4 text-[var(--brand)]" />
                                <h3 className="text-sm font-extrabold text-[#1F2A25]">
                                  الهاتف
                                </h3>
                              </div>
                              <label className="flex items-center gap-2 text-xs font-bold text-[#79837D]">
                                <input
                                  type="checkbox"
                                  checked={form.contactPhoneEnabled}
                                  onChange={event =>
                                    update(card.kind, {
                                      contactPhoneEnabled: event.target.checked,
                                    })
                                  }
                                  className="size-4 accent-[var(--brand)]"
                                />{" "}
                                تفعيل
                              </label>
                            </div>
                            <SmallField
                              label="رقم الهاتف"
                              value={form.contactPhoneNumber}
                              onChange={value =>
                                update(card.kind, { contactPhoneNumber: value })
                              }
                              placeholder="05xxxxxxxx"
                              dir="ltr"
                            />
                            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#79837D]">
                              <input
                                type="checkbox"
                                checked={form.contactPhoneSticky}
                                onChange={event =>
                                  update(card.kind, {
                                    contactPhoneSticky: event.target.checked,
                                  })
                                }
                                className="size-4 accent-[var(--brand)]"
                              />{" "}
                              زر ثابت على الشاشة
                            </label>
                          </div>
                          <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <MessageCircle className="size-4 text-[#16A35B]" />
                                <h3 className="text-sm font-extrabold text-[#1F2A25]">
                                  WhatsApp
                                </h3>
                              </div>
                              <label className="flex items-center gap-2 text-xs font-bold text-[#79837D]">
                                <input
                                  type="checkbox"
                                  checked={form.contactWhatsappEnabled}
                                  onChange={event =>
                                    update(card.kind, {
                                      contactWhatsappEnabled:
                                        event.target.checked,
                                    })
                                  }
                                  className="size-4 accent-[#16A35B]"
                                />{" "}
                                تفعيل
                              </label>
                            </div>
                            <SmallField
                              label="رقم WhatsApp"
                              value={form.contactWhatsappNumber}
                              onChange={value =>
                                update(card.kind, {
                                  contactWhatsappNumber: value,
                                })
                              }
                              placeholder="06xxxxxxxx"
                              dir="ltr"
                            />
                            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#79837D]">
                              <input
                                type="checkbox"
                                checked={form.contactWhatsappSticky}
                                onChange={event =>
                                  update(card.kind, {
                                    contactWhatsappSticky: event.target.checked,
                                  })
                                }
                                className="size-4 accent-[#16A35B]"
                              />{" "}
                              زر ثابت على الشاشة
                            </label>
                          </div>
                        </div>
                        <p className="mt-4 text-xs leading-6 text-[#5B6B62]">
                          أدخل رقمًا جزائريًا أو دوليًا. يتم تنظيف الرقم
                          خادميًا، ثم فتح الهاتف أو WhatsApp في تطبيق العميل عند
                          الضغط.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <h3 className="text-sm font-extrabold text-[#1F2A25]">
                          أماكن الظهور
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-[#8A938D]">
                          اختر الصفحات العامة التي يظهر فيها الشريط عندما يكون
                          التطبيق مفعّلًا.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <label className="flex items-center gap-2 rounded-xl bg-[#F1F3EE] p-3 text-xs font-extrabold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.contactShowOnStore}
                              onChange={event =>
                                update(card.kind, {
                                  contactShowOnStore: event.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--brand)]"
                            />{" "}
                            واجهة المتجر
                          </label>
                          <label className="flex items-center gap-2 rounded-xl bg-[#F1F3EE] p-3 text-xs font-extrabold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.contactShowOnProduct}
                              onChange={event =>
                                update(card.kind, {
                                  contactShowOnProduct: event.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--brand)]"
                            />{" "}
                            صفحة المنتج
                          </label>
                          <label className="flex items-center gap-2 rounded-xl bg-[#F1F3EE] p-3 text-xs font-extrabold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.contactShowOnLanding}
                              onChange={event =>
                                update(card.kind, {
                                  contactShowOnLanding: event.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--brand)]"
                            />{" "}
                            صفحة الفانل
                          </label>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              معاينة Contact Bar
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              ستظهر الأزرار أسفل الشاشة في الصفحات المختارة.
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
                            CONTACT BAR
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-[#F1F3EE] p-6">
                          <div className="flex items-center gap-2 rounded-full bg-[#1F2A25] px-4 py-3 text-xs font-extrabold text-white">
                            <Phone className="size-4" /> اتصال
                          </div>
                          <div className="flex items-center gap-2 rounded-full bg-[#16A35B] px-4 py-3 text-xs font-extrabold text-white">
                            <MessageCircle className="size-4" /> WhatsApp
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {card.mode === "thank_you" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#D8E4F0] bg-[#F4F9FD] p-4">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="grid size-10 place-items-center rounded-xl bg-[#DDEEFF] text-[#4E8DDD]">
                            <CheckCircle2 className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-[#2B507B]">
                              Thank You Popup
                            </h3>
                            <p className="mt-1 text-xs leading-6 text-[#6D7F93]">
                              تظهر هذه النافذة بعد نجاح إرسال طلب الدفع عند
                              الاستلام، قبل انتقال العميل إلى الرابط المحدد.
                            </p>
                          </div>
                        </div>
                        <label className="block text-sm font-extrabold text-[#3A4D63]">
                          الرسالة بعد إتمام الطلب
                          <textarea
                            value={form.thankYouMessage}
                            onChange={event =>
                              update(card.kind, {
                                thankYouMessage: event.target.value,
                              })
                            }
                            rows={4}
                            placeholder="تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت."
                            className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          />
                        </label>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <SmallField
                            label="نص الزر"
                            value={form.thankYouButtonText}
                            onChange={value =>
                              update(card.kind, { thankYouButtonText: value })
                            }
                            placeholder="خروج"
                          />
                          <SmallField
                            label="رابط الزر"
                            value={form.thankYouButtonUrl}
                            onChange={value =>
                              update(card.kind, { thankYouButtonUrl: value })
                            }
                            placeholder="/"
                            dir="ltr"
                          />
                        </div>
                        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs leading-6 text-[#6D7F93]">
                          اترك الرابط <b dir="ltr">/</b> للعودة إلى الصفحة
                          الرئيسية. لتتبع الطلب، ضع رابطك مثل{" "}
                          <b dir="ltr">
                            https://example.com/track/{"{orderNumber}"}
                          </b>{" "}
                          وسيُستبدل المتغير برقم الطلب.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              المعاينة
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              هذه معاينة قريبة من الشكل الذي يراه المشتري.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#E8F3FF] px-3 py-1 text-[10px] font-extrabold text-[#4E8DDD]">
                            بعد الطلب
                          </span>
                        </div>
                        <div className="mx-auto max-w-sm rounded-[24px] border border-[#ECEDE6] bg-[var(--paper)] p-5 text-center shadow-soft">
                          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                            <CheckCircle2 className="size-7" />
                          </div>
                          <h4 className="mt-4 text-xl font-extrabold text-[#1F2A25]">
                            شكرًا لك
                          </h4>
                          <p className="mt-3 text-sm leading-7 text-[#79837D]">
                            {form.thankYouMessage ||
                              "تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت."}
                          </p>
                          <button
                            type="button"
                            className="btn-press mt-5 w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-cta"
                          >
                            {form.thankYouButtonText || "خروج"}
                          </button>
                          <p
                            className="mt-3 truncate text-[10px] text-[#8A938D]"
                            dir="ltr"
                          >
                            {form.thankYouButtonUrl || "/"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(card.mode === "content_guard" ||
                    card.mode === "ad_shield") && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#E7E9E2] bg-[var(--paper)] p-4">
                        <h3 className="text-sm font-extrabold text-[#1F2A25]">
                          حماية المحتوى والكشط
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-[#8A938D]">
                          هذه الحماية تقلل النسخ السطحي ولا تمنع تصوير الشاشة أو
                          أدوات المطور بشكل مطلق. لا تعطل نموذج الطلب أو التصفح
                          الطبيعي.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardProtectImages}
                              onChange={event =>
                                update(card.kind, {
                                  guardProtectImages: event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">حماية الصور</b>
                              <span className="font-normal text-[#8A938D]">
                                منع السحب المباشر والنسخ السطحي.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardBlockRightClick}
                              onChange={event =>
                                update(card.kind, {
                                  guardBlockRightClick: event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">منع الزر الأيمن</b>
                              <span className="font-normal text-[#8A938D]">
                                إيقاف قائمة السياق على صفحات المتجر.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardPreventSelection}
                              onChange={event =>
                                update(card.kind, {
                                  guardPreventSelection: event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">منع تحديد النص</b>
                              <span className="font-normal text-[#8A938D]">
                                تقليل نسخ النص بالطرق السريعة.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardWatermarkEnabled}
                              onChange={event =>
                                update(card.kind, {
                                  guardWatermarkEnabled: event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">علامة مائية</b>
                              <span className="font-normal text-[#8A938D]">
                                إظهار نص خفيف فوق صور المتجر.
                              </span>
                            </span>
                          </label>
                        </div>
                        {form.guardWatermarkEnabled && (
                          <SmallField
                            label="نص العلامة المائية"
                            value={form.guardWatermarkText}
                            onChange={value =>
                              update(card.kind, { guardWatermarkText: value })
                            }
                            placeholder="اسم متجرك"
                          />
                        )}
                      </div>
                      {card.kind === "ad_shield" && (
                        <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4">
                          <h3 className="text-sm font-extrabold text-[#7A5B34]">
                            تقييد مصادر الإعلانات
                          </h3>
                          <p className="mt-1 text-xs leading-6 text-[#8A7A5F]">
                            سيتم التحقق من الإحالة الظاهرة فقط. يمكن للزائر أو
                            المتصفح إخفاؤها، لذلك هذا ليس حجبًا مضمونًا لكل زوار
                            Meta Ads Library.
                          </p>
                          <label className="mt-4 flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardBlockAdReferrers}
                              onChange={event =>
                                update(card.kind, {
                                  guardBlockAdReferrers: event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">
                                حجب الإحالات الإعلانية المعروفة
                              </b>
                              <span className="font-normal text-[#8A938D]">
                                تقييد بعض الزيارات التي تحمل إحالة إعلانية
                                واضحة.
                              </span>
                            </span>
                          </label>
                          <label className="mt-3 flex items-start gap-2 rounded-xl border border-[#ECEDE6] bg-white p-3 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.guardBlockMetaAdsLibrary}
                              onChange={event =>
                                update(card.kind, {
                                  guardBlockMetaAdsLibrary:
                                    event.target.checked,
                                })
                              }
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                            />
                            <span>
                              <b className="block">
                                حجب إحالة Meta Ads Library
                              </b>
                              <span className="font-normal text-[#8A938D]">
                                يعمل فقط عندما يرسل المتصفح مرجعًا واضحًا من
                                نطاق Meta.
                              </span>
                            </span>
                          </label>
                          <Field
                            label="رسالة الحجب"
                            value={form.guardBlockedMessage}
                            onChange={value =>
                              update(card.kind, { guardBlockedMessage: value })
                            }
                            placeholder="هذا المحتوى غير متاح من هذا المصدر."
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {card.mode === "pixel" && (
                    <>
                      <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4">
                        <div className="mb-4 flex items-start gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-soft">
                            <Cable className="size-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              Conversions API
                            </h3>
                            <p className="mt-1 text-xs leading-6 text-[#5B6B62]">
                              Access Token واحد هنا يُستخدم لإرسال الأحداث إلى
                              جميع البكسلات المضافة والمفعلة.
                            </p>
                          </div>
                        </div>
                        <Field
                          label={card.secret}
                          value={form.secret}
                          onChange={value =>
                            update(card.kind, { secret: value })
                          }
                          placeholder={
                            connected
                              ? "اتركه فارغًا للإبقاء على التوكن الحالي"
                              : `أدخل ${card.secret}`
                          }
                          hint="هذا التوكن خاص بـ Conversions API / Events API ويخدم جميع البكسلات، وليس Pixel ID."
                          type="password"
                          dir="ltr"
                        />
                      </div>
                      <div className="mt-6 rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4">
                          <h3 className="text-sm font-extrabold text-[#1F2A25]">
                            البكسلات
                          </h3>
                          <p className="mt-1 text-xs text-[#8A938D]">
                            البكسل الأول موجود تلقائيًا. جميع البكسلات تستعمل
                            توكن التطبيق الموحد.
                          </p>
                        </div>
                        {form.pixels.map((pixel, index) => (
                          <div
                            key={`${card.kind}-${index}`}
                            className="mb-3 rounded-xl border border-[#ECEDE6] bg-[var(--paper)] p-3 last:mb-0"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-xs font-extrabold text-[#1F2A25]">
                                Pixel {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  update(card.kind, {
                                    pixels: form.pixels.filter(
                                      (_, current) => current !== index
                                    ),
                                  })
                                }
                                className="btn-press grid size-8 place-items-center rounded-lg text-[#A63D28] hover:bg-[#FCE8E4]"
                                aria-label="حذف Pixel"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <SmallField
                                label="الاسم"
                                value={pixel.label}
                                onChange={value =>
                                  updatePixel(card.kind, index, {
                                    label: value,
                                  })
                                }
                              />
                              <SmallField
                                label="Pixel ID"
                                value={pixel.pixelId}
                                onChange={value =>
                                  updatePixel(card.kind, index, {
                                    pixelId: value,
                                  })
                                }
                                dir="ltr"
                              />
                            </div>
                            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#79837D]">
                              <input
                                type="checkbox"
                                checked={pixel.enabled}
                                onChange={event =>
                                  updatePixel(card.kind, index, {
                                    enabled: event.target.checked,
                                  })
                                }
                                className="accent-[var(--brand)]"
                              />{" "}
                              تفعيل هذا Pixel
                            </label>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addPixel(card.kind)}
                          disabled={form.pixels.length >= 7}
                          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-[#E7E9E2] disabled:text-[#8A938D] disabled:shadow-none"
                        >
                          <Plus className="size-4" />
                          {form.pixels.length >= 7
                            ? "وصلت إلى الحد الأقصى (7/7)"
                            : `إضافة Pixel جديد · ${form.pixels.length}/7`}
                        </button>
                      </div>
                    </>
                  )}

                  {card.mode === "tracking_retarget" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <Send className="size-4 text-[var(--brand-strong)]" />
                          <h3 className="text-sm font-extrabold text-[var(--brand-strong)]">
                            WhatsApp Cloud API · المرسل التلقائي
                          </h3>
                        </div>
                        <p className="text-xs leading-6 text-[#5B6B62]">
                          يُستعمل هذا المرسل لإرسال تحديثات حالة الطلب من
                          ForShip ورسائل الاسترجاع مباشرة إلى واتساب الزبون.
                          أرقام الدعم في الأسفل مخصصة لاستقبال رسائل التتبع من
                          المشتري نفسه.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <SmallField
                            label="Phone Number ID"
                            value={form.whatsappPhoneId}
                            onChange={value =>
                              update(card.kind, {
                                whatsappPhoneId: value.replace(/\s/g, ""),
                              })
                            }
                            dir="ltr"
                            placeholder="أدخل معرف رقم الهاتف"
                          />
                          <SmallField
                            label="Access Token"
                            value={form.whatsappToken}
                            onChange={value =>
                              update(card.kind, { whatsappToken: value })
                            }
                            type="password"
                            dir="ltr"
                            placeholder={
                              trackingConnected
                                ? "اتركه فارغًا للإبقاء على التوكن الحالي"
                                : "أدخل Access Token"
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              أرقام استقبال رسائل التتبع من المشترين
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              يمكنك إضافة عدة أرقام، لكن يُفعَّل رقم واحد فقط
                              يستقبل رسالة تتبع الطلبية.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#E6F5EC] px-3 py-1 text-[10px] font-extrabold text-[#0D7A46]">
                            رقم مفعّل واحد
                          </span>
                        </div>
                        {form.trackNumbers.map((number, index) => (
                          <div
                            key={`${card.kind}-support-${index}`}
                            className="mt-3 rounded-xl border border-[#ECEDE6] bg-[var(--paper)] p-3"
                          >
                            <div className="flex items-start gap-3">
                              <label className="mt-2 flex items-center gap-2 text-xs font-extrabold text-[#4A554F]">
                                <input
                                  type="radio"
                                  name={`track-active-${card.kind}`}
                                  checked={number.active}
                                  onChange={() =>
                                    activateTrackNumber(card.kind, index)
                                  }
                                  className="size-4 accent-[#0D9488]"
                                />
                                تفعيل
                              </label>
                              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                                <SmallField
                                  label="التسمية"
                                  value={number.label}
                                  onChange={value =>
                                    updateTrackNumber(card.kind, index, {
                                      label: value,
                                    })
                                  }
                                  placeholder="رقم الدعم"
                                />
                                <SmallField
                                  label="رقم WhatsApp"
                                  value={number.number}
                                  onChange={value =>
                                    updateTrackNumber(card.kind, index, {
                                      number: value.replace(/[^0-9+]/g, ""),
                                    })
                                  }
                                  dir="ltr"
                                  placeholder="06xxxxxxxx"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  removeTrackNumber(card.kind, index)
                                }
                                aria-label="حذف رقم الدعم"
                                className="btn-press mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-[#A63D28] hover:bg-[#FCE8E4]"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addTrackNumber(card.kind)}
                          disabled={form.trackNumbers.length >= 12}
                          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-[#E7E9E2] disabled:text-[#8A938D] disabled:shadow-none"
                        >
                          <Plus className="size-4" />
                          {form.trackNumbers.length >= 12
                            ? "وصلت إلى الحد الأقصى (12/12)"
                            : `إضافة رقم دعم · ${form.trackNumbers.length}/12`}
                        </button>
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <h3 className="text-sm font-extrabold text-[#1F2A25]">
                          خانة «تتبع طلبك» بعد إتمام الشراء
                        </h3>
                        <p className="mt-1 text-xs text-[#8A938D]">
                          تظهر للزبون داخل رسالة نجاح الطلب وتفتح واتساب الرقم
                          المفعّل مباشرة برسالة تلقائية تتضمن رقم الطلب.
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <SmallField
                            label="العنوان"
                            value={form.trackTitle}
                            onChange={value =>
                              update(card.kind, { trackTitle: value })
                            }
                            placeholder="تتبع طلبك عبر واتساب"
                          />
                          <SmallField
                            label="نص الزر"
                            value={form.trackCta}
                            onChange={value =>
                              update(card.kind, { trackCta: value })
                            }
                            placeholder="تتبع طلبك الآن"
                          />
                        </div>
                        <Field
                          label="الوصف الجذاب"
                          value={form.trackHint}
                          onChange={value =>
                            update(card.kind, { trackHint: value })
                          }
                          placeholder="أرسل رقم طلبك وسنرد عليك مباشرة…"
                        />
                        <Field
                          label="رسالة تتبع تُرسل للرقم المفعّل"
                          value={form.trackMessage}
                          onChange={value =>
                            update(card.kind, { trackMessage: value })
                          }
                          placeholder="مرحبًا، أريد تتبع طلبية رقم {orderNumber}"
                          hint="يُستبدل {orderNumber} برقم طلب الزبون تلقائيًا."
                        />
                        <div className="mt-5 rounded-2xl bg-[#F4FBF7] p-5 text-center">
                          <div className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#D4EDE0] bg-white p-3 text-right shadow-soft">
                            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#19A463] text-white">
                              <MessageCircle className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-extrabold text-[#1F2A25]">
                                {form.trackTitle || "تتبع طلبك عبر واتساب"}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[#6B7A72]">
                                {form.trackHint ||
                                  "أرسل رقم طلبك وسنرد عليك مباشرة…"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-xl bg-[#19A463] px-3 py-2 text-[11px] font-extrabold text-white">
                              {form.trackCta || "تتبع طلبك الآن"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              إشعار الحالة التلقائي من ForShip
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              كلما تغيّرت حالة طلب في قسم ForShip تُرسل الحالة
                              الجديدة مباشرة إلى واتساب الزبون.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-bold text-[#4A554F]">
                            <input
                              type="checkbox"
                              checked={form.trackStatusEnabled}
                              onChange={event =>
                                update(card.kind, {
                                  trackStatusEnabled: event.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--brand)]"
                            />{" "}
                            تفعيل
                          </label>
                        </div>
                        <label className="mt-4 block text-xs font-extrabold text-[#4A554F]">
                          نص رسالة الحالة
                          <textarea
                            value={form.trackStatusMessage}
                            onChange={event =>
                              update(card.kind, {
                                trackStatusMessage: event.target.value,
                              })
                            }
                            rows={4}
                            placeholder="مرحبًا {customerName}… طلبك {orderNumber} أصبح بحالة: {status}"
                            className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          />
                        </label>
                        <p className="mt-2 text-[11px] leading-6 text-[#8A938D]">
                          متغيرات: <b dir="ltr">{`{customerName}`}</b> ·{" "}
                          <b dir="ltr">{`{orderNumber}`}</b> ·{" "}
                          <b dir="ltr">{`{status}`}</b>
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Send className="size-4 text-[var(--warm)]" />
                            <h3 className="text-sm font-extrabold text-[#7A5B34]">
                              Retargeting · رسالة تخفيض بعد التسليم
                            </h3>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-bold text-[#7A5B34]">
                            <input
                              type="checkbox"
                              checked={form.retargetEnabled}
                              onChange={event =>
                                update(card.kind, {
                                  retargetEnabled: event.target.checked,
                                })
                              }
                              className="size-4 accent-[#DE7C2A]"
                            />{" "}
                            تفعيل الحملة
                          </label>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-[#8A7A5F]">
                          تُرسل للزبون بعد تأكيد تسليم الطلب في ForShip + المدة
                          التي تحددها، برابط منتج وتخفيض يُطبَّق تلقائيًا عند
                          فتح الرابط.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-extrabold text-[#7A5B34]">
                            المنتج المروَّج له
                            <select
                              value={form.retargetProductId}
                              onChange={event =>
                                update(card.kind, {
                                  retargetProductId: event.target.value,
                                })
                              }
                              className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                            >
                              <option value="">اختر المنتج…</option>
                              {(productsQuery.data ?? [])
                                .filter(
                                  (
                                    product
                                  ): product is NonNullable<typeof product> =>
                                    Boolean(product)
                                )
                                .map(product => (
                                  <option key={product.id} value={product.id}>
                                    {product.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <SmallField
                              label="نسبة التخفيض %"
                              value={form.retargetDiscount}
                              onChange={value =>
                                update(card.kind, {
                                  retargetDiscount: value
                                    .replace(/\D/g, "")
                                    .slice(0, 2),
                                })
                              }
                              dir="ltr"
                              placeholder="10"
                            />
                            <SmallField
                              label="المدة بعد التسليم (يوم)"
                              value={form.retargetDelay}
                              onChange={value =>
                                update(card.kind, {
                                  retargetDelay: value
                                    .replace(/\D/g, "")
                                    .slice(0, 2),
                                })
                              }
                              dir="ltr"
                              placeholder="3"
                            />
                          </div>
                        </div>
                        <label className="mt-3 block text-xs font-extrabold text-[#7A5B34]">
                          وجهة رابط التخفيض
                          <select
                            value={form.retargetType}
                            onChange={event =>
                              update(card.kind, {
                                retargetType: event.target
                                  .value as Form["retargetType"],
                              })
                            }
                            className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          >
                            <option value="product">صفحة المنتج</option>
                            <option value="landing">صفحة الهبوط (فانل)</option>
                          </select>
                        </label>
                        {form.retargetType === "landing" && (
                          <div className="mt-3 grid gap-3">
                            <label className="block text-xs font-extrabold text-[#7A5B34]">
                              فانل المنتج
                              <select
                                value={form.retargetLandingPageId}
                                onChange={event =>
                                  update(card.kind, {
                                    retargetLandingPageId: event.target.value,
                                  })
                                }
                                className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                              >
                                <option value="">اختر الفانل…</option>
                                {(landingsQuery.data ?? [])
                                  .filter(
                                    landing =>
                                      landing.productId ===
                                      Number(form.retargetProductId)
                                  )
                                  .map(landing => (
                                    <option key={landing.id} value={landing.id}>
                                      {landing.title}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <SmallField
                              label="رابط خاص لصفحة الهبوط (اختياري)"
                              value={form.retargetLandingUrl}
                              onChange={value =>
                                update(card.kind, { retargetLandingUrl: value })
                              }
                              dir="ltr"
                              placeholder="https://…"
                            />
                          </div>
                        )}
                        <label className="mt-4 block text-xs font-extrabold text-[#7A5B34]">
                          نص الرسالة الترحيبية
                          <textarea
                            value={form.retargetMessage}
                            onChange={event =>
                              update(card.kind, {
                                retargetMessage: event.target.value,
                              })
                            }
                            rows={5}
                            placeholder="أهلًا {customerName}…"
                            className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          />
                        </label>
                        <p className="mt-2 text-[11px] leading-6 text-[#8A7A5F]">
                          متغيرات: <b dir="ltr">{`{customerName}`}</b> ·{" "}
                          <b dir="ltr">{`{orderNumber}`}</b> ·{" "}
                          <b dir="ltr">{`{discount}`}</b> ·{" "}
                          <b dir="ltr">{`{productTitle}`}</b> ·{" "}
                          <b dir="ltr">{`{productLink}`}</b>
                        </p>
                        <div className="mt-4 rounded-xl border border-[#ECEDE6] bg-white p-3">
                          <p className="text-[11px] font-extrabold text-[#7A5B34]">
                            رابط التخفيض الذي سيُرسل للزبون
                          </p>
                          <p
                            dir="ltr"
                            className="mt-1 truncate text-left text-xs font-semibold text-[#0D9488]"
                          >
                            {(() => {
                              const productId = Number(form.retargetProductId);
                              const discount =
                                Number(form.retargetDiscount) || 0;
                              if (!productId || !discount)
                                return "اختر المنتج وحدد نسبة التخفيض ليظهر الرابط.";
                              if (
                                form.retargetType === "landing" &&
                                form.retargetLandingUrl.trim()
                              ) {
                                const url = form.retargetLandingUrl
                                  .trim()
                                  .replace(/\/+$/, "");
                                return `${url}${url.includes("?") ? "&" : "?"}discount=${discount}`;
                              }
                              return `${window.location.origin}/p/${productId}?discount=${discount}`;
                            })()}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              إحصائيات Tracking & Retargeting
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              رسائل الحالة والإشعارات والاستفادة من تخفيض
                              الاسترجاع.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#E6F5EC] px-3 py-1 text-[10px] font-extrabold text-[#0D7A46]">
                            TRACKING
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Metric
                            label="رسائل الحالة"
                            value={trackingAnalytics.data?.statusSent ?? 0}
                          />
                          <Metric
                            label="رسائل Retarget"
                            value={trackingAnalytics.data?.retargetSent ?? 0}
                          />
                          <Metric
                            label="طلبات بالتخفيض"
                            value={
                              trackingAnalytics.data?.retargetRedeemed ?? 0
                            }
                          />
                          <Metric
                            label="بانتظار الإرسال"
                            value={
                              trackingAnalytics.data?.pendingRetargets ?? 0
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => runDue.mutate()}
                          disabled={runDue.isPending}
                          className="btn-press mt-4 flex items-center gap-2 rounded-xl border border-[#D8E6DD] bg-white px-4 py-2.5 text-xs font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send className="size-4" />
                          {runDue.isPending
                            ? "جارٍ إرسال المستحقات…"
                            : "إرسال رسائل الاسترجاع المستحقة الآن"}
                        </button>
                      </div>
                    </div>
                  )}

                  {card.mode === "message_order" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="عنوان النموذج"
                            value={form.messageOrderTitle}
                            onChange={value =>
                              update(card.kind, { messageOrderTitle: value })
                            }
                            placeholder="الطلب عبر الرسالة"
                          />
                          <SmallField
                            label="نص الزر"
                            value={form.messageOrderButtonText}
                            onChange={value =>
                              update(card.kind, {
                                messageOrderButtonText: value,
                              })
                            }
                            placeholder="أرسل طلبك الآن"
                          />
                        </div>
                        <label className="mt-4 block text-xs font-extrabold text-[#4A554F]">
                          الرسالة الترحيبية
                          <textarea
                            value={form.messageOrderWelcome}
                            onChange={event =>
                              update(card.kind, {
                                messageOrderWelcome: event.target.value,
                              })
                            }
                            rows={3}
                            placeholder="مرحبًا! يمكنك إرسال طلبك الآن عبر هذه النافذة..."
                            className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          />
                        </label>
                        <label className="mt-4 block text-xs font-extrabold text-[#4A554F]">
                          تعليمات للزبون
                          <textarea
                            value={form.messageOrderInstructions}
                            onChange={event =>
                              update(card.kind, {
                                messageOrderInstructions: event.target.value,
                              })
                            }
                            rows={3}
                            placeholder="أدخل اسمك ورقم هاتفك وعنوانك، ثم اكتب رسالة تحتوي على المنتجات المطلوبة..."
                            className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                          />
                        </label>
                      </div>
                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              معاينة النموذج
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              ستظهر هذه الأداة للزبون داخل المتجر عند تفعيل
                              التطبيق.
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
                            MESSAGE ORDER
                          </span>
                        </div>
                        <div className="mx-auto max-w-sm rounded-[24px] border border-[#ECEDE6] bg-[var(--paper)] p-5 shadow-soft">
                          <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                            <MessageCircle className="size-5" />
                          </div>
                          <h4 className="mt-3 text-lg font-extrabold text-[#1F2A25]">
                            {form.messageOrderTitle || "الطلب عبر الرسالة"}
                          </h4>
                          <p className="mt-2 text-sm leading-7 text-[#79837D]">
                            {form.messageOrderWelcome ||
                              "مرحبًا! يمكنك إرسال طلبك الآن عبر هذه النافذة."}
                          </p>
                          <div className="mt-4 space-y-2 rounded-xl border border-[#E7E9E2] bg-white p-3 text-xs text-[#79837D]">
                            <p>
                              <b>الاسم:</b> {"..."}
                            </p>
                            <p>
                              <b>الهاتف:</b> {"..."}
                            </p>
                            <p>
                              <b>الولاية:</b> {"..."}
                            </p>
                            <p>
                              <b>العنوان:</b> {"..."}
                            </p>
                            <p>
                              <b>الرسالة:</b> {"..."}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-press mt-4 w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-cta"
                          >
                            {form.messageOrderButtonText || "إرسال الطلب الآن"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {card.mode === "negotiator" && (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#EDE6FB] bg-[#F7F3FE] p-4">
                        <div className="flex items-center gap-3">
                          <div className="grid size-10 place-items-center rounded-xl bg-[#EDE6FB] text-[#7C3AED]">
                            <Bot className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-[#4C2A85]">
                              Negotiator AI
                            </h3>
                            <p className="mt-1 text-xs leading-6 text-[#7A6A9B]">
                              الشاتبوت الذي يراه المشتري في صفحة المنتج يتفاوض
                              معه على السعر والتوصيل، دون أن يكشف تكاليفك أو
                              حدودك.
                            </p>
                          </div>
                        </div>
                        <label className="mt-4 flex items-start gap-2 rounded-xl border border-[#E9E2F7] bg-white p-3 text-xs font-bold text-[#4A554F]">
                          <input
                            type="checkbox"
                            checked={form.negotiatorAutoNegotiate}
                            onChange={event =>
                              update(card.kind, {
                                negotiatorAutoNegotiate: event.target.checked,
                              })
                            }
                            className="mt-0.5 size-4 accent-[#7C3AED]"
                          />
                          <span>
                            <b className="block text-[#4C2A85]">
                              التفاوض الذكي (Costs &amp; Profitability)
                            </b>
                            <span className="font-normal leading-6 text-[#8A938D]">
                              يجلب الإحصائيات النهائية لتكاليف المنتج من قسم
                              Profitability Engine (تكلفة القطعة، التوصيل، الكال
                              سنتر، كوست الحملة، نسبة الإرجاع) ويقرر وحده أفضل
                              عرض دون كشف هذه الأرقام للزبون.
                            </span>
                          </span>
                        </label>
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              صلاحيات التفاوض لكل منتج
                            </h3>
                            <p className="mt-1 text-xs leading-6 text-[#8A938D]">
                              ضع الحدود التي لا يستطيع الذكاء الاصطناعي تجاوزها
                              عند التفاوض. 0 تعني بلا حد.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#EDE6FB] px-3 py-1 text-[10px] font-extrabold text-[#7C3AED]">
                            RULES
                          </span>
                        </div>
                        <div className="mb-4 rounded-2xl border border-[#EDE6FB] bg-[#F7F3FE] p-3">
                          <label className="block text-xs font-extrabold text-[#4C2A85]">
                            أضف منتجًا لتحديد صلاحياته
                            <select
                              value=""
                              onChange={event => {
                                if (event.target.value)
                                  addNegotiatorRule(Number(event.target.value));
                              }}
                              className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                            >
                              <option value="">اختر منتجًا لإضافته…</option>
                              {availableNegotiatorProducts.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="mt-2 text-[11px] leading-5 text-[#8A938D]">
                            أضف منتجًا، اضبط صلاحياته، ثم أضف منتجًا آخر.
                            المنتجات غير المُضافة لا تظهر في الصفحة.
                          </p>
                        </div>
                        {negotiatorRules.length === 0 ? (
                          <p className="text-xs text-[#8A938D]">
                            لم تُضف أي منتج بعد. اختر منتجًا من القائمة أعلاه
                            لتبدأ.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {negotiatorRules.map(rule => {
                              const expanded =
                                selectedNegotiatorProductId === rule.productId;
                              return (
                                <div
                                  key={rule.productId}
                                  className="rounded-2xl border border-[#ECEDE6] bg-[var(--paper)] p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={rule.enabled}
                                          onChange={event =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                enabled: event.target.checked,
                                              }
                                            )
                                          }
                                          className="size-4 accent-[#7C3AED]"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedNegotiatorProductId(
                                            expanded ? null : rule.productId
                                          )
                                        }
                                        className="truncate text-sm font-extrabold text-[#1F2A25]"
                                      >
                                        {rule.title}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-[#8A938D]">
                                        ID {rule.productId}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeNegotiatorRule(rule.productId)
                                        }
                                        className="rounded-lg border border-[#F3D2CB] bg-white px-2 py-1 text-[10px] font-extrabold text-[#A63D28] hover:bg-[#FCE8E4]"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  </div>
                                  {expanded && (
                                    <div>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <SmallField
                                          label="أقصى تخفيض (دج)"
                                          value={rule.maxDiscountAmount}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                maxDiscountAmount:
                                                  value.replace(/[^\d.]/g, ""),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="600"
                                        />
                                        <SmallField
                                          label="أقصى تخفيض (%)"
                                          value={rule.maxDiscountPercent}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                maxDiscountPercent: value
                                                  .replace(/\D/g, "")
                                                  .slice(0, 2),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="10"
                                        />
                                        <SmallField
                                          label="حد أدنى للسعر (دج)"
                                          value={rule.minPrice}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                minPrice: value.replace(
                                                  /[^\d.]/g,
                                                  ""
                                                ),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="اتركه فارغًا"
                                        />
                                        <SmallField
                                          label="حد أدنى لهامش الربح (%)"
                                          value={rule.minProfitMarginPercent}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                minProfitMarginPercent: value
                                                  .replace(/\D/g, "")
                                                  .slice(0, 2),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="0"
                                        />
                                        <SmallField
                                          label="أدنى كمية للتوصيل المجاني"
                                          value={rule.freeDeliveryMinQuantity}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                freeDeliveryMinQuantity: value
                                                  .replace(/\D/g, "")
                                                  .slice(0, 2),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="2"
                                        />
                                        <SmallField
                                          label="حد أجرة التوصيل المجاني (دج)"
                                          value={rule.freeDeliveryMaxFee}
                                          onChange={value =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                freeDeliveryMaxFee:
                                                  value.replace(/[^\d.]/g, ""),
                                              }
                                            )
                                          }
                                          dir="ltr"
                                          placeholder="600"
                                        />
                                      </div>
                                      <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#4A554F]">
                                        <input
                                          type="checkbox"
                                          checked={rule.freeDeliveryEnabled}
                                          onChange={event =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                freeDeliveryEnabled:
                                                  event.target.checked,
                                              }
                                            )
                                          }
                                          className="size-4 accent-[#7C3AED]"
                                        />{" "}
                                        السماح بعرض توصيل مجاني
                                      </label>
                                      <label className="mt-3 block text-xs font-extrabold text-[#4A554F]">
                                        صلاحيات مخصصة لهذا المنتج (تكتبها بنفسك)
                                        <textarea
                                          value={rule.customRules}
                                          onChange={event =>
                                            updateNegotiatorRule(
                                              rule.productId,
                                              {
                                                customRules: event.target.value,
                                              }
                                            )
                                          }
                                          rows={2}
                                          placeholder="مثال: العرض ينتهي الليلة، ولا تعرض تخفيضًا إذا اختار الزبون التوصيل للمكتب."
                                          className="mt-2 w-full resize-y rounded-xl border border-[#E3E1D8] bg-white px-3 py-3 text-sm font-semibold leading-7 text-[#1F2A25] outline-none transition focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#1F2A25]">
                              مثال على التفاوض
                            </h3>
                            <p className="mt-1 text-xs text-[#8A938D]">
                              هكذا يتصرف المفاوض ضمن الحدود التي وضعتها.
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--brand)]">
                            LIVE
                          </span>
                        </div>
                        <div className="mx-auto max-w-md space-y-2 rounded-[24px] border border-[#ECEDE6] bg-[var(--paper)] p-4">
                          <div className="rounded-2xl rounded-tr-sm bg-[#F1F3EE] px-3 py-2 text-xs leading-6 text-[#4A554F]">
                            <b>الزبون:</b> غالي شوية.
                          </div>
                          <div className="rounded-2xl rounded-tl-sm bg-[var(--brand-soft)] px-3 py-2 text-xs leading-6 text-[#1F2A25]">
                            <b>AI:</b> نقدر نوفرلك التوصيل إذا أخذت قطعتين.
                          </div>
                          <div className="rounded-2xl rounded-tr-sm bg-[#F1F3EE] px-3 py-2 text-xs leading-6 text-[#4A554F]">
                            <b>الزبون:</b> نحب غير وحدة.
                          </div>
                          <div className="rounded-2xl rounded-tl-sm bg-[var(--brand-soft)] px-3 py-2 text-xs leading-6 text-[#1F2A25]">
                            <b>AI:</b> نقدر نعطيك 300 DA discount إذا أكملت
                            الآن.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E9E2] pt-5">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#4A554F]">
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={event =>
                          update(card.kind, { enabled: event.target.checked })
                        }
                        className="size-4 accent-[var(--brand)]"
                      />{" "}
                      تفعيل التطبيق
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          remove.mutate({ kind: genericKind(card.kind) })
                        }
                        disabled={
                          card.kind === "shark_cod" ||
                          card.kind === "thank_you" ||
                          card.kind === "content_guard" ||
                          card.kind === "ad_shield" ||
                          card.kind === "tracking_retarget" ||
                          card.kind === "message_order" ||
                          card.kind === "negotiator" ||
                          !connected ||
                          remove.isPending
                        }
                        className="btn-press flex items-center gap-2 rounded-xl border border-[#F3D2CB] bg-white px-3 py-2.5 text-xs font-extrabold text-[#A63D28] hover:bg-[#FCE8E4] disabled:invisible"
                      >
                        <Trash2 className="size-4" /> فصل
                      </button>
                      <button
                        type="button"
                        onClick={() => submit(card)}
                        disabled={
                          save.isPending ||
                          savePixels.isPending ||
                          saveShark.isPending ||
                          saveOrderClean.isPending ||
                          saveContactBar.isPending ||
                          saveContentGuard.isPending ||
                          saveTracking.isPending ||
                          saveMessageOrder.isPending ||
                          saveNegotiator.isPending
                        }
                        className="btn-press flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)] disabled:opacity-60"
                      >
                        <Save className="size-4" /> حفظ الربط
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#79837D]">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل التطبيقات…
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dir,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  dir?: "ltr";
  hint?: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-extrabold text-[#4A554F]">
        {label}
      </span>
      {hint && (
        <span className="mb-2 block text-[11px] leading-5 text-[#8A938D]">
          {hint}
        </span>
      )}
      <input
        dir={dir}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition placeholder:text-[#B7BDB4] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
      />
    </label>
  );
}

function SmallField({
  label,
  value,
  onChange,
  type = "text",
  dir,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "ltr";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold text-[#79837D]">
        {label}
      </span>
      <input
        dir={dir}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#E3E1D8] bg-white px-2.5 text-xs text-[#1F2A25] outline-none transition placeholder:text-[#B7BDB4] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#E7E9E2] bg-[var(--paper)] p-3 text-center">
      <p className="text-[10px] font-bold text-[#8A938D]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--brand)]">{value}</p>
    </div>
  );
}
