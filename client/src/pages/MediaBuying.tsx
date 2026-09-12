import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  LockKeyhole,
  RefreshCw,
  WandSparkles,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const starter: Message[] = [
  { role: "system", content: "AI Media Buying" },
  {
    role: "assistant",
    content:
      "مرحبًا. أنا مساعد Media Buying متخصص في Meta Ads. أستطيع مساعدتك في تحليل الربحية، بناء استراتيجية اختبار، وتكوين brief لحملة قابل للمراجعة. لن أنشئ أو أعدّل أو أنشر أي حملة دون موافقة صريحة. أستطيع إعداد مسودة منظمة، ثم تنتقل فقط إلى التنفيذ بعد مراجعتك. ابدأ بوصف المنتج والهدف والميزانية والسوق المستهدف.",
  },
];

export default function MediaBuying() {
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>(starter);
  const [executionApproved, setExecutionApproved] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const accountsQuery = trpc.profitability.metaAccounts.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const preview = trpc.mediaBuying.preview.useMutation({
    onSuccess: setDraft,
    onError: error => toast.error(error.message),
  });
  const startOAuth = trpc.mediaBuying.startOAuth.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: error => {
      toast.error(
        auth.isAuthenticated
          ? error.message
          : "انتهت جلسة الدخول. سجّل الدخول ثم أعد ربط Meta."
      );
      if (!auth.isAuthenticated) window.location.href = "/login";
    },
  });
  const handleMetaConnect = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      toast.error(
        "يجب تسجيل الدخول إلى Abdou Store أولًا، ثم إعادة ربط حساب Meta."
      );
      window.location.href = "/login";
      return;
    }
    if (hasConnectedMetaAccount)
      toast.info("سنفتح Facebook لإعادة المصادقة وتحديث الحسابات المرتبطة.");
    startOAuth.mutate();
  };
  const [executionDetails, setExecutionDetails] = useState({
    pageId: "",
    imageHash: "",
    destinationUrl: "",
    targetingJson: '{"geo_locations":{"countries":["DZ"]}}',
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
    confirmationPhrase: "",
  });
  const execute = trpc.mediaBuying.execute.useMutation({
    onSuccess: result =>
      toast.success(`تم إنشاء الحملة بحالة ${result.deliveryStatus} فقط.`),
    onError: error => toast.error(error.message),
  });
  const ask = trpc.mediaBuying.ask.useMutation({
    onSuccess: content =>
      setMessages(current => [...current, { role: "assistant", content }]),
    onError: error => toast.error(error.message),
  });
  const handleSend = (content: string) => {
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    ask.mutate({
      messages: next
        .filter(message => message.role !== "system")
        .map(message => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    });
  };
  const handlePreview = () =>
    preview.mutate({
      messages: messages
        .filter(message => message.role !== "system")
        .map(message => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    });
  const selectedAccountId = accountsQuery.data?.[0]?.id;
  const hasConnectedMetaAccount = Boolean(accountsQuery.data?.length);
  const canExecute = Boolean(
    executionApproved &&
    draft &&
    selectedAccountId &&
    executionDetails.pageId &&
    executionDetails.imageHash &&
    executionDetails.destinationUrl &&
    executionDetails.confirmationPhrase === "أوافق على إنشاء الحملة"
  );
  const handleExecute = () => {
    if (!draft || !selectedAccountId) return;
    execute.mutate({
      accountId: selectedAccountId,
      draft,
      ...executionDetails,
    });
  };
  return (
    <div dir="rtl" className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold tracking-wide text-[var(--brand)]">
            الاستراتيجية · Meta Ads
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#1F2A25]">
            AI Media Buying
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#79837D]">
            مساعد شراء إعلامي احترافي يحول أهداف متجرك وتكاليفه الحقيقية إلى خطة
            قابلة للمراجعة، مع فصل واضح بين التحليل والتنفيذ.
          </p>
        </div>
        <Badge className="rounded-full border border-[#D8E6DD] bg-[var(--brand-soft)] px-4 py-2 text-[var(--brand)] hover:bg-[var(--brand-soft)]">
          <WandSparkles className="ml-2 size-4" />
          مساعد متخصص في Meta
        </Badge>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--brand-strong)]">
            <ShieldCheck className="size-4 text-[var(--brand)]" />
            موافقة صريحة
          </div>
          <p className="mt-2 text-xs leading-6 text-[#4A5F53]">
            لا يوجد نشر أو تعديل تلقائي. كل خطة تظهر للمراجعة قبل أي خطوة
            تنفيذية.
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft transition-shadow duration-200 hover:shadow-lift">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
            <LockKeyhole className="size-4 text-[var(--brand)]" />
            Meta MCP
          </div>
          <p className="mt-2 text-xs leading-6 text-[#79837D]">
            الموصل متصل. تتوفر أدوات قراءة وإنشاء Campaign وAd Set وCreative
            وAd، مع بقاء التنفيذ خلف موافقة صريحة وصلاحية ads_management.
          </p>
          <Button
            type="button"
            variant="link"
            className="btn-press mt-1 h-auto p-0 text-xs font-bold text-[var(--brand)]"
            onClick={handleMetaConnect}
            disabled={startOAuth.isPending || auth.loading}
          >
            {auth.loading
              ? "جارٍ التحقق من تسجيل الدخول…"
              : startOAuth.isPending
                ? "جارٍ فتح Facebook…"
                : hasConnectedMetaAccount
                  ? "إعادة ربط حساب Meta"
                  : auth.isAuthenticated
                    ? "ربط حساب Meta عبر Facebook"
                    : "سجّل الدخول لربط Meta"}
          </Button>
        </div>
        <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 shadow-soft transition-shadow duration-200 hover:shadow-lift">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
            <RefreshCw className="size-4 text-[var(--brand)]" />
            الحسابات المرتبطة
          </div>
          <p className="mt-2 text-xs leading-6 text-[#79837D]">
            {accountsQuery.data?.length
              ? `${accountsQuery.data.length} حساب Meta محفوظ في المتجر: ${accountsQuery.data.map(account => account.name).join("، ")}.`
              : "لم تربط حسابًا إعلانيًا داخل المتجر بعد."}
          </p>
          <Button
            variant="link"
            className="btn-press mt-1 h-auto p-0 text-xs font-bold text-[var(--brand)]"
            onClick={() => (window.location.href = "/profitability")}
          >
            إدارة الحسابات
          </Button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-[#F3DFC4] bg-[var(--warm-soft)] p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[#8A5A1E]">
              بوابة التنفيذ الآمن
            </p>
            <p className="mt-1 text-xs leading-6 text-[#9A7440]">
              بعد إعداد الخطة، راجع الميزانية والجمهور والـCreative ووافق
              صراحةً. زر الإنشاء سيبقى محجوبًا حتى تتوفر أداة كتابة Meta وصلاحية
              ads_management.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#8A5A1E]">
            <input
              type="checkbox"
              checked={executionApproved}
              onChange={event => setExecutionApproved(event.target.checked)}
              className="accent-[var(--warm)]"
            />
            أوافق على مراجعة خطة التنفيذ
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={
              !executionApproved || preview.isPending || messages.length < 2
            }
            variant="outline"
            className="btn-press rounded-xl"
            onClick={handlePreview}
          >
            <Eye className="ml-2 size-4" />
            {preview.isPending ? "جارٍ إعداد المعاينة…" : "معاينة الحملة"}
          </Button>
          <Button
            disabled
            className="rounded-xl bg-[var(--warm)] text-white shadow-warm"
          >
            إنشاء الحملة عبر Meta (بعد اكتمال الربط)
          </Button>
        </div>
      </div>

      {draft && (
        <div
          className="mb-5 animate-fade-up rounded-[24px] border border-[#D8E6DD] bg-white p-5 shadow-soft"
          data-testid="campaign-preview"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--brand-strong)]">
                <CheckCircle2 className="size-4 text-[var(--brand)]" />
                معاينة مقترح الحملة
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-[#1F2A25]">
                {draft.name || "حملة بلا اسم"}
              </h2>
            </div>
            <Badge className="rounded-full bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)]">
              {draft.objective || "N/A"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-[#F5F6F2] p-3">
              <p className="text-[11px] text-[#8A938D]">نوع الشراء</p>
              <p className="mt-1 font-bold text-[#1F2A25]">
                {draft.buyingType || "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-[#F5F6F2] p-3">
              <p className="text-[11px] text-[#8A938D]">الميزانية اليومية</p>
              <p className="mt-1 font-bold text-[#1F2A25]">
                {draft.dailyBudgetDzd == null
                  ? "N/A"
                  : `${draft.dailyBudgetDzd.toLocaleString("ar-DZ")} دج`}
              </p>
            </div>
            <div className="rounded-xl bg-[#F5F6F2] p-3">
              <p className="text-[11px] text-[#8A938D]">نمط الميزانية</p>
              <p className="mt-1 font-bold text-[#1F2A25]">
                {draft.budgetMode || "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-[#F5F6F2] p-3">
              <p className="text-[11px] text-[#8A938D]">عدد Ad Sets</p>
              <p className="mt-1 font-bold text-[#1F2A25]">
                {draft.adSets?.length ?? 0}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold text-[#2E3B35]">الجمهور</p>
              <p className="mt-1 text-sm leading-6 text-[#79837D]">
                {draft.audience || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#2E3B35]">
                ما ينقص قبل التنفيذ
              </p>
              {draft.missingInputs?.length ? (
                <ul className="mt-1 space-y-1 text-sm text-[#9A7440]">
                  {draft.missingInputs.map((item: string) => (
                    <li key={item} className="flex gap-2">
                      <AlertTriangle className="mt-1 size-3 shrink-0 text-[var(--warm)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[var(--brand)]">
                  لا توجد مدخلات ناقصة في المسودة.
                </p>
              )}
            </div>
            <div className="mt-5 border-t border-[#ECEEE6] pt-5 lg:col-span-2">
              <p className="text-sm font-extrabold text-[#1F2A25]">
                بيانات Meta المطلوبة قبل الإنشاء
              </p>
              <p className="mt-1 text-xs leading-6 text-[#79837D]">
                هذه القيم تخص الحساب والمواد الإعلانية، ولا يخمّنها المساعد.
                ستُنشأ الحملة بحالة PAUSED ولن تُنشر تلقائيًا.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Page ID"
                  placeholder="Page ID"
                  value={executionDetails.pageId}
                  onChange={event =>
                    setExecutionDetails(current => ({
                      ...current,
                      pageId: event.target.value,
                    }))
                  }
                />
                <Input
                  aria-label="Image Hash"
                  placeholder="Image Hash"
                  value={executionDetails.imageHash}
                  onChange={event =>
                    setExecutionDetails(current => ({
                      ...current,
                      imageHash: event.target.value,
                    }))
                  }
                />
                <Input
                  aria-label="رابط الوجهة"
                  placeholder="https://example.com/product"
                  value={executionDetails.destinationUrl}
                  onChange={event =>
                    setExecutionDetails(current => ({
                      ...current,
                      destinationUrl: event.target.value,
                    }))
                  }
                />
                <Input
                  aria-label="Optimization goal"
                  placeholder="Optimization goal"
                  value={executionDetails.optimizationGoal}
                  onChange={event =>
                    setExecutionDetails(current => ({
                      ...current,
                      optimizationGoal: event.target.value,
                    }))
                  }
                />
              </div>
              <textarea
                aria-label="Targeting JSON"
                className="mt-3 min-h-24 w-full rounded-xl border border-[#E3E1D8] bg-white p-3 text-left text-xs outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                value={executionDetails.targetingJson}
                onChange={event =>
                  setExecutionDetails(current => ({
                    ...current,
                    targetingJson: event.target.value,
                  }))
                }
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  aria-label="عبارة الموافقة"
                  placeholder="اكتب: أوافق على إنشاء الحملة"
                  value={executionDetails.confirmationPhrase}
                  onChange={event =>
                    setExecutionDetails(current => ({
                      ...current,
                      confirmationPhrase: event.target.value,
                    }))
                  }
                />
                <Button
                  disabled={!canExecute || execute.isPending}
                  onClick={handleExecute}
                  className="btn-press shrink-0 rounded-xl bg-[var(--warm)] text-white shadow-warm"
                >
                  {execute.isPending
                    ? "جارٍ الإنشاء…"
                    : "أوافق وأنشئ الحملة بحالة PAUSED"}
                </Button>
              </div>
              {!selectedAccountId && (
                <p className="mt-2 text-xs font-bold text-[#8A5A1E]">
                  اربط حساب Meta أولًا، ثم ستظهر هنا إمكانية الإنشاء.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-3 shadow-soft sm:p-5">
        <AIChatBox
          messages={messages}
          onSendMessage={handleSend}
          isLoading={ask.isPending}
          height="min(68vh, 720px)"
          placeholder="اكتب هدف الحملة أو اسأل عن الميزانية والجمهور والـCreative…"
          emptyStateMessage="ابدأ جلسة Media Buying مع المساعد"
          suggestedPrompts={[
            "حلّل لي خطة اختبار لمنتج COD جديد",
            "كيف أبني هيكل Campaign وAd Set وAd؟",
            "ما المعلومات المطلوبة لتقدير Break-even CPA؟",
          ]}
        />
      </div>
    </div>
  );
}
