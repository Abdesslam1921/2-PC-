import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Eye, EyeOff, Link2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AccountDraft = {
  id?: number;
  externalAccountId: string;
  name: string;
  currency: string;
  accessToken: string;
};
const inputClass =
  "h-11 rounded-xl border border-[#E3E1D8] bg-white px-3 text-right text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

export default function Profitability() {
  const reportQuery = trpc.profitability.report.useQuery();
  const settingsQuery = trpc.profitability.settings.useQuery();
  const accountsQuery = trpc.profitability.metaAccounts.useQuery();
  const campaignLinksQuery = trpc.profitability.campaignLinks.useQuery();
  const productsQuery = trpc.products.list.useQuery(undefined, {
    enabled: (campaignLinksQuery.data?.length ?? 0) > 0,
  });
  const saveSettings = trpc.profitability.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الربحية.");
      settingsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const saveCampaignLinks = trpc.profitability.saveCampaignLinks.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ ربط الحملات بالمنتجات.");
      campaignLinksQuery.refetch();
      reportQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const saveAccount = trpc.profitability.saveMetaAccount.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ حساب Meta بأمان.");
      accountsQuery.refetch();
      setEditing(null);
    },
    onError: error => toast.error(error.message),
  });
  const removeAccount = trpc.profitability.removeMetaAccount.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الحساب.");
      accountsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const syncAccount = trpc.profitability.syncMetaAccount.useMutation({
    onSuccess: result => {
      toast.success(
        `تمت مزامنة ${result.campaigns} حملة و${result.insights} تقرير.`
      );
      accountsQuery.refetch();
      reportQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const startMetaOAuth = trpc.mediaBuying.startOAuth.useMutation({
    onSuccess: result => {
      window.location.href = result.url;
    },
    onError: error => toast.error(error.message),
  });
  const analyzeCampaigns = trpc.profitability.analyzeCampaigns.useMutation({
    onSuccess: result => {
      setAiResult(result);
      toast.success(
        result.available ? "تم إعداد تحليل الحملات." : result.reason
      );
    },
    onError: error => toast.error(error.message),
  });
  const [rate, setRate] = useState("0.00");
  const [includePendingOrders, setIncludePendingOrders] = useState(false);
  const [editing, setEditing] = useState<AccountDraft | null>(null);
  const [aiResult, setAiResult] = useState<{
    available: boolean;
    reason?: string;
    dataFreshness?: string;
    insights?: {
      summary: string;
      winners: Array<{ campaign: string; reason: string }>;
      losers: Array<{ campaign: string; reason: string }>;
      actions: string[];
    } | null;
  } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, string>>(
    {}
  );
  useEffect(() => {
    if (!settingsQuery.data) return;
    setRate(settingsQuery.data.usdToDzdRate);
    setIncludePendingOrders(settingsQuery.data.includePendingOrders);
  }, [settingsQuery.data]);
  useEffect(() => {
    if (!campaignLinksQuery.data) return;
    setCampaignDrafts(
      Object.fromEntries(
        campaignLinksQuery.data.map(row => [
          row.campaignId,
          row.productId ? String(row.productId) : "",
        ])
      )
    );
  }, [campaignLinksQuery.data]);
  const startNew = () => {
    setShowToken(false);
    setEditing({
      externalAccountId: "",
      name: "",
      currency: "USD",
      accessToken: "",
    });
  };
  const submitAccount = () => {
    if (!editing) return;
    saveAccount.mutate({
      ...editing,
      accessToken: editing.accessToken || undefined,
    });
  };
  const submitCampaignLinks = () => {
    const links = (campaignLinksQuery.data ?? []).map(row => ({
      campaignId: row.campaignId,
      productId: campaignDrafts[row.campaignId]
        ? Number(campaignDrafts[row.campaignId])
        : null,
    }));
    saveCampaignLinks.mutate({ links });
  };

  return (
    <div dir="rtl" className="max-w-6xl">
      <PageIntro
        eyebrow="التحليل المالي · الربحية"
        title="Profitability Engine"
        description="احسب الربح الحقيقي من الطلبات المُسلّمة بعد خصم جميع التكاليف، ثم اربطه بإنفاق Meta عند توفر بيانات الحساب."
        action={
          <Button
            type="button"
            onClick={() => startMetaOAuth.mutate()}
            disabled={startMetaOAuth.isPending}
            className="btn-press rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            {startMetaOAuth.isPending
              ? "جارٍ فتح Facebook…"
              : "ربط حساب Meta عبر Facebook"}
          </Button>
        }
      />

      <section className="relative mb-5 overflow-hidden rounded-[24px] bg-gradient-to-bl from-[var(--brand-strong)] to-[var(--brand)] p-5 text-white shadow-soft sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[#BFE3D2]">
              النتيجة الفعلية
            </p>
            <p className="mt-1 text-xs text-white/60">
              تُحتسب الأرباح من الطلبات المُسلّمة فقط، مع فصل المرتجعات والطلبات
              غير النهائية.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
            {reportQuery.isLoading
              ? "جارٍ الحساب…"
              : `${reportQuery.data?.counts.deliveredOrders ?? 0} طلب مُسلّم`}
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "True Profit",
              reportQuery.data?.totals.trueProfit ?? "0.00",
              "text-[#A8F0C3]",
            ],
            [
              "Revenue",
              reportQuery.data?.totals.revenue ?? "0.00",
              "text-white",
            ],
            [
              "Total Cost",
              reportQuery.data?.totals.totalCost ?? "0.00",
              "text-[#FFD1D1]",
            ],
            [
              "Profit Margin",
              reportQuery.data?.totals.profitMargin ?? "0.00%",
              "text-[#BFE3D2]",
            ],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-bold text-white/60">{label}</p>
              <p className={`mt-2 text-xl font-black ${color}`}>
                {value} {label !== "Profit Margin" ? "دج" : ""}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-xs font-bold text-white/75">
            Ad Spend:{" "}
            <span className="text-white">
              {reportQuery.data?.totals.adSpend ?? "0.00"} دج
            </span>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-xs font-bold text-white/75">
            CPA:{" "}
            <span className="text-white">
              {reportQuery.data?.totals.cpa ?? "0.00"} دج
            </span>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-xs font-bold text-white/75">
            ROAS:{" "}
            <span className="text-white">
              {reportQuery.data?.totals.roas ?? "0.00"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
            <p className="text-base font-extrabold text-[#1F2A25]">
              إعدادات الربحية
            </p>
            <p className="mt-1 text-xs leading-6 text-[#79837D]">
              كل النتائج بالدينار الجزائري، وسعر البيع يُقرأ تلقائيًا من الطلب.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-extrabold text-[#2E3B35]">
                سعر صرف عملة الإعلان → دج
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={rate}
                  onChange={event => setRate(event.target.value)}
                  placeholder="مثال: 135.00"
                />
                <span className="text-[11px] font-medium text-[#8A938D]">
                  يحوّل إنفاق Meta من أي عملة أجنبية (USD، EUR…) إلى عملة المتجر
                  (دج) ولا يغيّر أسعار المنتجات.
                </span>
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-[#D8E6DD] bg-[var(--brand-soft)] p-4 text-xs leading-6 text-[#4A5F53]">
              <p className="font-extrabold text-[var(--brand-strong)]">تنويه</p>
              <p className="mt-1">
                كل النتائج بالدينار الجزائري. يتم استيراد بيانات الإعلانات
                وتصنيفها تلقائياً.
              </p>
            </div>
            <div className="mt-5 rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#1F2A25]">
                    ربط الحملة الإعلانية بالمنتج
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#79837D]">
                    اختر لكل حملة Meta المنتج الذي تروّجه؛ يُحتسب إنفاقها
                    الحقيقي ضمن تكلفة ذلك المنتج لحساب الربح النهائي.
                  </p>
                </div>
                <Button
                  onClick={submitCampaignLinks}
                  disabled={
                    saveCampaignLinks.isPending ||
                    !campaignLinksQuery.data?.length
                  }
                  className="btn-press rounded-lg bg-[var(--brand)] px-4 py-2 text-xs text-white hover:bg-[var(--brand-strong)]"
                >
                  <Save className="ml-1 size-3.5" />
                  {saveCampaignLinks.isPending ? "جارٍ الحفظ…" : "حفظ الربط"}
                </Button>
              </div>
              {campaignLinksQuery.isLoading ? (
                <p className="mt-4 text-xs text-[#8A938D]">
                  جارٍ تحميل الحملات…
                </p>
              ) : campaignLinksQuery.data?.length ? (
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pe-1">
                  {campaignLinksQuery.data.map(row => (
                    <div
                      key={row.campaignId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E7E9E2] bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-[#2E3B35]">
                          {row.campaignName}
                        </p>
                        <p
                          className="mt-0.5 text-[10px] text-[#8A938D]"
                          dir="ltr"
                        >
                          {row.campaignId}
                        </p>
                      </div>
                      <select
                        aria-label={`المنتج المرتبط بالحملة ${row.campaignName}`}
                        className="h-9 w-full max-w-[240px] rounded-lg border border-[#E3E1D8] bg-white px-2 text-xs outline-none transition focus:border-[var(--brand)] sm:w-auto"
                        value={campaignDrafts[row.campaignId] ?? ""}
                        onChange={event =>
                          setCampaignDrafts(previous => ({
                            ...previous,
                            [row.campaignId]: event.target.value,
                          }))
                        }
                      >
                        <option value="">— بدون ربط —</option>
                        {(productsQuery.data ?? [])
                          .filter(
                            (product): product is NonNullable<typeof product> =>
                              Boolean(product)
                          )
                          .map(product => (
                            <option key={product.id} value={String(product.id)}>
                              {product.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-[#CFD8CF] bg-white p-4 text-center text-[11px] text-[#8A938D]">
                  لا توجد حملات بعد. اربط حساب Meta ثم اضغط «مزامنة» لتظهر
                  الحملات هنا وتتمكن من ربطها بمنتجاتك.
                </p>
              )}
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-4 text-sm font-bold text-[#2E3B35]">
              <input
                type="checkbox"
                checked={includePendingOrders}
                onChange={event =>
                  setIncludePendingOrders(event.target.checked)
                }
                className="mt-1 accent-[var(--brand)]"
              />
              <span>
                إظهار الطلبات غير المُسلّمة بشكل منفصل
                <span className="mt-1 block text-[11px] font-medium text-[#8A938D]">
                  لا تُعتبر ربحًا محققًا في نظام الدفع عند الاستلام.
                </span>
              </span>
            </label>
            <Button
              onClick={() =>
                saveSettings.mutate({
                  usdToDzdRate: rate || "0.00",
                  includePendingOrders,
                })
              }
              disabled={saveSettings.isPending}
              className="btn-press mt-5 rounded-xl bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]"
            >
              <Save className="ml-2 size-4" />
              حفظ إعدادات الربحية
            </Button>
          </div>

          <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-extrabold text-[#1F2A25]">
                  حسابات Meta Ads
                </p>
                <p className="mt-1 text-xs leading-6 text-[#79837D]">
                  يمكن ربط حسابات متعددة. Access Token يُخزن مشفرًا ولا يظهر مرة
                  أخرى.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => startMetaOAuth.mutate()}
                  disabled={startMetaOAuth.isPending}
                  className="btn-press rounded-xl"
                >
                  {startMetaOAuth.isPending
                    ? "جارٍ فتح Facebook…"
                    : "ربط عبر Facebook"}
                </Button>
                <Button
                  variant="outline"
                  onClick={startNew}
                  className="btn-press rounded-xl"
                >
                  <Plus className="ml-1 size-4" />
                  إضافة يدويًا
                </Button>
              </div>
            </div>
            {accountsQuery.isLoading ? (
              <p className="mt-5 text-sm text-[#79837D]">جارٍ التحميل…</p>
            ) : accountsQuery.data?.length ? (
              <div className="mt-5 space-y-3">
                {accountsQuery.data.map(account => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E9E2] p-4 transition duration-200 hover:border-[#D8E6DD] hover:shadow-soft"
                  >
                    <div>
                      <p className="font-extrabold text-[#1F2A25]">
                        {account.name}
                      </p>
                      <p className="mt-1 text-xs text-[#79837D]">
                        {account.externalAccountId} · {account.currency} ·{" "}
                        {account.hasToken ? "Token محفوظ" : "بدون Token"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#8A938D]">
                        {account.lastSyncedAt
                          ? `آخر مزامنة: ${new Date(account.lastSyncedAt).toLocaleString("ar-DZ")}`
                          : "لم تتم المزامنة بعد"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          syncAccount.mutate({
                            id: account.id,
                            dateStart: new Date(Date.now() - 30 * 86400000)
                              .toISOString()
                              .slice(0, 10),
                            dateStop: new Date().toISOString().slice(0, 10),
                          })
                        }
                        disabled={syncAccount.isPending}
                        className="btn-press rounded-lg"
                      >
                        مزامنة
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowToken(false);
                          setEditing({
                            id: account.id,
                            externalAccountId: account.externalAccountId,
                            name: account.name,
                            currency: account.currency,
                            accessToken: "",
                          });
                        }}
                        className="btn-press rounded-lg"
                      >
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAccount.mutate({ id: account.id })}
                        className="btn-press rounded-lg text-[#A63D28]"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  icon={Link2}
                  title="لم يتم ربط حساب Meta بعد"
                  description="بعد الربط ستظهر الحملات وAd Sets وAds والإنفاق الفعلي."
                  action={
                    <Button
                      onClick={() => startMetaOAuth.mutate()}
                      disabled={startMetaOAuth.isPending}
                      className="btn-press rounded-xl bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]"
                    >
                      {startMetaOAuth.isPending
                        ? "جارٍ فتح Facebook…"
                        : "ربط عبر Facebook"}
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[24px] border border-[#D8E6DD] bg-[var(--brand-soft)] p-5 shadow-soft">
            <p className="text-sm font-extrabold text-[var(--brand-strong)]">
              مكونات الربح الحقيقي
            </p>
            <div className="mt-4 space-y-3 text-xs leading-6 text-[#4A5F53]">
              <p>
                <strong>Revenue:</strong> سعر البيع المحفوظ داخل الطلب.
              </p>
              <p>
                <strong>التكاليف:</strong> المنتج والتغليف والتوريد والتوصيل
                والتأكيد والروتور والإعلان.
              </p>
              <p>
                <strong>True Profit:</strong> الإيراد من الطلبات المُسلّمة ناقص
                التكلفة النهائية.
              </p>
            </div>
          </div>
          <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
            <p className="text-sm font-extrabold text-[#1F2A25]">حالة الربط</p>
            <p className="mt-4 text-xs font-bold text-[#79837D]">
              {accountsQuery.data?.length
                ? `${accountsQuery.data.length} حساب مرتبط`
                : "بانتظار ربط حساب Meta"}
            </p>
            <p className="mt-3 text-[11px] leading-5 text-[#8A938D]">
              لن تُستخدم أرقام افتراضية؛ تبدأ التقارير بعد نجاح الاتصال
              والمزامنة.
            </p>
            <p className="mt-3 text-[11px] font-bold text-[var(--brand)]">
              {reportQuery.data?.meta?.syncedCampaigns ?? 0} حملة ·{" "}
              {reportQuery.data?.meta?.syncedInsights ?? 0} تقرير Insights محفوظ
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
          <p className="text-base font-extrabold text-[#1F2A25]">
            الربحية حسب المنتج
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-right text-xs">
              <thead className="border-b border-[#ECEEE6] text-[#8A938D]">
                <tr>
                  <th className="pb-3 font-bold">المنتج</th>
                  <th className="pb-3 font-bold">الكمية</th>
                  <th className="pb-3 font-bold">الإيراد</th>
                  <th className="pb-3 font-bold">Ad Spend</th>
                  <th className="pb-3 font-bold">التكلفة</th>
                  <th className="pb-3 font-bold">الربح</th>
                </tr>
              </thead>
              <tbody>
                {(reportQuery.data?.byProduct ?? []).map(row => (
                  <tr
                    key={row.productId}
                    className="border-b border-[#F1F2EC] transition-colors duration-200 hover:bg-[#FAF9F5]"
                  >
                    <td className="py-3 font-bold text-[#2E3B35]">
                      {row.title}
                    </td>
                    <td className="py-3 text-[#79837D]">{row.quantity}</td>
                    <td className="py-3 text-[#79837D]">{row.revenue} دج</td>
                    <td className="py-3 text-[#79837D]">
                      {row.adSpend ?? "0.00"} دج
                    </td>
                    <td className="py-3 text-[#79837D]">{row.totalCost} دج</td>
                    <td
                      className={`py-3 font-extrabold ${Number(row.trueProfit) >= 0 ? "text-[var(--brand)]" : "text-[#A63D28]"}`}
                    >
                      {row.trueProfit} دج
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reportQuery.data?.byProduct?.length && (
              <p className="py-8 text-center text-xs text-[#8A938D]">
                لا توجد طلبات مُسلّمة بعد.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
          <p className="text-base font-extrabold text-[#1F2A25]">
            الربحية حسب الحملة
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-right text-xs">
              <thead className="border-b border-[#ECEEE6] text-[#8A938D]">
                <tr>
                  <th className="pb-3 font-bold">الحملة / المصدر</th>
                  <th className="pb-3 font-bold">الطلبات</th>
                  <th className="pb-3 font-bold">الإنفاق</th>
                  <th className="pb-3 font-bold">النتائج</th>
                  <th className="pb-3 font-bold">الربح</th>
                  <th className="pb-3 font-bold">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {(reportQuery.data?.byCampaign ?? []).map(row => (
                  <tr
                    key={row.campaignId}
                    className="border-b border-[#F1F2EC] transition-colors duration-200 hover:bg-[#FAF9F5]"
                  >
                    <td className="py-3 font-bold text-[#2E3B35]">
                      <span className="block">{row.campaignName}</span>
                      <span className="text-[10px] font-medium text-[#8A938D]">
                        {row.campaignId} ·{" "}
                        {row.source === "meta"
                          ? "Meta فقط"
                          : row.source === "order+meta"
                            ? "Meta + طلبات"
                            : "مصدر الطلب"}
                      </span>
                    </td>
                    <td className="py-3 text-[#79837D]">{row.orders}</td>
                    <td className="py-3 text-[#79837D]">{row.adSpend} دج</td>
                    <td className="py-3 text-[#79837D]">
                      {row.purchases || row.orders}
                    </td>
                    <td
                      className={`py-3 font-extrabold ${Number(row.trueProfit) >= 0 ? "text-[var(--brand)]" : "text-[#A63D28]"}`}
                    >
                      {row.trueProfit} دج
                    </td>
                    <td className="py-3 font-extrabold text-[var(--brand)]">
                      {row.roas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reportQuery.data?.byCampaign?.length && (
              <p className="py-8 text-center text-xs text-[#8A938D]">
                لا توجد طلبات مرتبطة بحملة بعد.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-[#D8E6DD] bg-[var(--brand-soft)] p-5 shadow-soft sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold text-[var(--brand-strong)]">
              تحليل AI للربح الحقيقي
            </p>
            <p className="mt-1 text-xs text-[#4A5F53]">
              يحلل الحملات حسب True Profit بعد التكاليف، وليس حسب الطلبات أو
              ROAS وحدهما.
            </p>
          </div>
          <Button
            onClick={() => analyzeCampaigns.mutate()}
            disabled={analyzeCampaigns.isPending}
            className="btn-press rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            {analyzeCampaigns.isPending ? "جارٍ التحليل…" : "حلّل الحملات"}
          </Button>
        </div>
        {aiResult?.available && aiResult.insights ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4 lg:col-span-3">
              <p className="text-sm font-extrabold text-[#1F2A25]">الخلاصة</p>
              <p className="mt-2 text-sm leading-7 text-[#4A5F53]">
                {aiResult.insights.summary}
              </p>
              <p className="mt-2 text-[11px] text-[#8A938D]">
                {aiResult.dataFreshness}
              </p>
            </div>
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4">
              <p className="text-sm font-extrabold text-[var(--brand)]">
                حملات رابحة
              </p>
              {aiResult.insights.winners.map(item => (
                <p
                  key={item.campaign}
                  className="mt-3 text-xs leading-6 text-[#4A5F53]"
                >
                  <b>{item.campaign}:</b> {item.reason}
                </p>
              ))}
            </div>
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4">
              <p className="text-sm font-extrabold text-[#A63D28]">
                حملات خاسرة
              </p>
              {aiResult.insights.losers.map(item => (
                <p
                  key={item.campaign}
                  className="mt-3 text-xs leading-6 text-[#4A5F53]"
                >
                  <b>{item.campaign}:</b> {item.reason}
                </p>
              ))}
            </div>
            <div className="rounded-2xl border border-[#E7E9E2] bg-white p-4">
              <p className="text-sm font-extrabold text-[#1F2A25]">
                إجراءات مقترحة
              </p>
              {aiResult.insights.actions.map(action => (
                <p
                  key={action}
                  className="mt-3 text-xs leading-6 text-[#4A5F53]"
                >
                  {action}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-[#CFD8CF] bg-white p-5 text-center text-xs text-[#8A938D]">
            {aiResult?.reason ||
              "شغّل التحليل بعد ربط Meta ومزامنة حملات مرتبطة بطلبات حقيقية."}
          </p>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold text-[#1F2A25]">
              تفصيل الطلبات
            </p>
            <p className="mt-1 text-xs text-[#8A938D]">
              الطلب المُسلّم فقط يضيف Revenue؛ الحالات الأخرى تبقى ظاهرة
              للمراجعة ولا تُعد ربحًا محققًا.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-bold text-[#79837D]">
            <span className="rounded-full bg-[#F5F6F2] px-3 py-1">
              مرتجع: {reportQuery.data?.counts.returnedOrders ?? 0}
            </span>
            <span className="rounded-full bg-[#F5F6F2] px-3 py-1">
              معلّق: {reportQuery.data?.counts.pendingOrders ?? 0}
            </span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-right text-xs">
            <thead className="border-b border-[#ECEEE6] text-[#8A938D]">
              <tr>
                <th className="pb-3 font-bold">رقم الطلب</th>
                <th className="pb-3 font-bold">الحالة</th>
                <th className="pb-3 font-bold">الحملة</th>
                <th className="pb-3 font-bold">الإيراد</th>
                <th className="pb-3 font-bold">التكلفة</th>
                <th className="pb-3 font-bold">الربح الحقيقي</th>
              </tr>
            </thead>
            <tbody>
              {(reportQuery.data?.byOrder ?? []).slice(0, 50).map(row => (
                <tr
                  key={row.orderId}
                  className="border-b border-[#F1F2EC] transition-colors duration-200 hover:bg-[#FAF9F5]"
                >
                  <td className="py-3 font-bold text-[#2E3B35]">
                    {row.orderNumber}
                  </td>
                  <td className="py-3 text-[#79837D]">{row.status}</td>
                  <td className="py-3 text-[#79837D]">
                    {row.campaign || "مباشر"}
                  </td>
                  <td className="py-3 text-[#79837D]">{row.revenue} دج</td>
                  <td className="py-3 text-[#79837D]">{row.totalCost} دج</td>
                  <td
                    className={`py-3 font-extrabold ${Number(row.trueProfit) >= 0 ? "text-[var(--brand)]" : "text-[#A63D28]"}`}
                  >
                    {row.trueProfit} دج
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reportQuery.data?.byOrder?.length && (
            <p className="py-8 text-center text-xs text-[#8A938D]">
              لا توجد طلبات بعد.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
