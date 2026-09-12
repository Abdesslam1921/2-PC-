import { useAuth } from "@/_core/hooks/useAuth";
import { PageIntro } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  CreditCard,
  Globe2,
  LockKeyhole,
  Menu,
  Package,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type Section =
  | "profile"
  | "subscription"
  | "payments"
  | "markets"
  | "domain"
  | "notifications"
  | "security";

type Connecteur = {
  kind: string;
  label?: string | null;
  domain?: string | null;
  verificationCode?: string | null;
  enabled?: boolean | null;
};

const menu: {
  id: Section;
  title: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  {
    id: "profile",
    title: "الملف الشخصي",
    description: "بيانات الحساب والمعلومات الأساسية",
    icon: UserRound,
  },
  {
    id: "subscription",
    title: "الاشتراك والفواتير",
    description: "الخطة الحالية والفواتير",
    icon: Sparkles,
  },
  {
    id: "payments",
    title: "وسائل الدفع",
    description: "طريقة الدفع الافتراضية للمتجر",
    icon: CreditCard,
  },
  {
    id: "markets",
    title: "العملات والأسواق",
    description: "العملة والسوق المحلي",
    icon: Globe2,
  },
  {
    id: "domain",
    title: "اسم النطاق",
    description: "ربط نطاقك بصفحات المتجر",
    icon: Globe2,
  },
  {
    id: "notifications",
    title: "الإشعارات",
    description: "اختيارات التنبيهات والقنوات",
    icon: Bell,
  },
  {
    id: "security",
    title: "الحماية",
    description: "حماية الطلبات والمحتوى",
    icon: ShieldCheck,
  },
];

function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="home-card animate-fade-up overflow-hidden">
      <div className="border-b border-[#EEF0E8] bg-[rgba(255,255,255,0.6)] px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--brand)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#1F2A25] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#79837D]">
            {description}
          </p>
        )}
      </div>
      <div className="p-5 sm:p-8">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#EEF0E8] bg-white p-4 transition duration-200 hover:border-[#DCE5DD] hover:shadow-soft">
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-[#1F2A25]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#8A938D]">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [active, setActive] = useState<Section>("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [domainEnabled, setDomainEnabled] = useState(false);
  const connecteurs = trpc.connecteurs.list.useQuery();
  const saveDomain = trpc.connecteurs.save.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات النطاق");
      await connecteurs.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const domainConnector = (connecteurs.data as Connecteur[] | undefined)?.find(
    item => item.kind === "facebook_domain"
  );
  const selected = menu.find(item => item.id === active) ?? menu[0];

  const openSection = (id: Section) => {
    setActive(id);
    setMenuOpen(false);
    if (id === "domain" && domainConnector) {
      setDomain(domainConnector.domain ?? "");
      setVerificationCode(domainConnector.verificationCode ?? "");
      setDomainEnabled(Boolean(domainConnector.enabled));
    }
  };

  return (
    <div dir="rtl" className="home-scope mx-auto max-w-[1080px] pb-10">
      <div className="home-aurora" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>
      <PageIntro
        eyebrow="مركز الحساب"
        title="الإعدادات"
        description="كل إعدادات المتجر والحساب في مكان واحد."
        action={
          <Button
            variant="outline"
            onClick={() => setMenuOpen(true)}
            className="btn-press rounded-2xl border-[#E3E1D8] bg-white px-4 font-extrabold text-[#46524C] shadow-soft lg:hidden"
          >
            <Menu className="ml-2 size-4" />
            القائمة
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="home-card hidden h-fit p-3 lg:block">
          <div className="mb-3 rounded-2xl bg-[var(--brand-soft)] p-4">
            <p className="text-xs font-bold text-[#5E7268]">حساب المتجر</p>
            <p className="mt-1 truncate font-extrabold text-[#1F2A25]">
              {user?.name || "حساب المدير"}
            </p>
            <p className="mt-1 truncate text-xs text-[#79837D]">
              {user?.email || "غير متصل"}
            </p>
          </div>
          <nav className="space-y-1" aria-label="قائمة الإعدادات">
            {menu.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => openSection(item.id)}
                  className={`btn-press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition duration-200 ${active === item.id ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5C665F] hover:bg-[#F4F5F0]"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] opacity-70">
                      {item.description}
                    </span>
                  </span>
                  <ChevronLeft className="size-3.5 opacity-50" />
                </button>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-[#EEF0E8] pt-3">
            <button
              onClick={() => setLocation("/dashboard")}
              className="btn-press flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm font-extrabold text-[var(--brand)] transition duration-200 hover:bg-[var(--brand-soft)]"
            >
              <ArrowRight className="size-4" />
              العودة إلى لوحة التحكم
            </button>
          </div>
        </aside>
        {menuOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#182420]/45 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <aside
              onClick={event => event.stopPropagation()}
              className="absolute inset-y-0 right-0 w-[min(88vw,360px)] overflow-y-auto bg-white p-4 shadow-lift"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#79837D]">
                    إعدادات المتجر
                  </p>
                  <p className="mt-1 font-extrabold text-[#1F2A25]">
                    {user?.name || "حساب المدير"}
                  </p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="btn-press grid size-10 place-items-center rounded-xl bg-[#F4F5F0] text-[#5C665F]"
                  aria-label="إغلاق القائمة"
                >
                  <X className="size-5" />
                </button>
              </div>
              {menu.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => openSection(item.id)}
                    className={`btn-press mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-right transition duration-200 ${active === item.id ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5C665F] hover:bg-[#F4F5F0]"}`}
                  >
                    <Icon className="size-5" />
                    <span className="flex-1">
                      <span className="block font-extrabold">{item.title}</span>
                      <span className="mt-1 block text-xs opacity-70">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>
          </div>
        )}
        <main>
          {active === "profile" && (
            <Panel
              eyebrow="الحساب"
              title="الملف الشخصي"
              description="بياناتك الأساسية المرتبطة بحساب Abdou Store. يتم جلب الاسم والبريد من جلسة الدخول الرسمية."
            >
              <div className="space-y-3">
                {loading ? (
                  <div className="h-48 animate-pulse rounded-2xl bg-[#F1F2EC]" />
                ) : (
                  <>
                    <div className="flex items-center gap-4 rounded-2xl bg-[var(--brand-soft)] p-4">
                      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--brand)] text-xl font-black text-white">
                        {user?.name?.charAt(0) || "ع"}
                      </div>
                      <div>
                        <p className="font-extrabold text-[#1F2A25]">
                          {user?.name || "حساب المدير"}
                        </p>
                        <p className="mt-1 text-sm text-[#79837D]">
                          {user?.email || "لا يوجد بريد إلكتروني"}
                        </p>
                      </div>
                    </div>
                    <label className="block rounded-2xl border border-[#EEF0E8] p-4">
                      <span className="text-xs font-extrabold text-[#5C665F]">
                        الاسم الكامل
                      </span>
                      <input
                        value={user?.name || ""}
                        readOnly
                        className="mt-2 h-11 w-full rounded-xl bg-[#F6F7F2] px-3 text-sm font-bold text-[#3D4A43] outline-none"
                      />
                    </label>
                    <label className="block rounded-2xl border border-[#EEF0E8] p-4">
                      <span className="text-xs font-extrabold text-[#5C665F]">
                        البريد الإلكتروني
                      </span>
                      <input
                        value={user?.email || ""}
                        readOnly
                        className="mt-2 h-11 w-full rounded-xl bg-[#F6F7F2] px-3 text-sm font-bold text-[#3D4A43] outline-none"
                      />
                    </label>
                    <label className="block rounded-2xl border border-[#EEF0E8] p-4">
                      <span className="text-xs font-extrabold text-[#5C665F]">
                        رقم الهاتف
                      </span>
                      <input
                        placeholder="سنضيف رقم الهاتف قريبًا"
                        disabled
                        className="mt-2 h-11 w-full rounded-xl bg-[#F6F7F2] px-3 text-sm text-[#9AA39C] outline-none"
                      />
                    </label>
                    <Button
                      variant="outline"
                      onClick={logout}
                      className="btn-press w-full rounded-xl border-[#F3D2CB] font-extrabold text-[#A63D28] transition duration-200 hover:bg-[#FCE8E4]"
                    >
                      تسجيل الخروج
                    </Button>
                  </>
                )}
              </div>
            </Panel>
          )}
          {active === "subscription" && (
            <Panel
              eyebrow="الخطة"
              title="الاشتراك والفواتير"
              description="تظهر هنا خطتك الحالية والفواتير عند تفعيل نظام الاشتراكات. هذه الصفحة جاهزة لإضافة الخطط لاحقًا دون تغيير بنية المتجر."
            >
              <div className="rounded-3xl border border-[#DCE7DF] bg-gradient-to-br from-[var(--brand-soft)] to-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-[var(--brand)]">
                      الخطة الحالية
                    </p>
                    <h2 className="mt-2 text-3xl font-black text-[#1F2A25]">
                      Earth
                    </h2>
                    <p className="mt-2 text-sm text-[#79837D]">
                      الخطة الأساسية النشطة حاليًا
                    </p>
                  </div>
                  <div className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--brand)] shadow-soft">
                    <Sparkles className="size-6" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#EEF0E8] bg-white p-4">
                    <p className="text-xs text-[#8A938D]">الحالة</p>
                    <p className="mt-2 font-black text-[var(--brand)]">نشطة</p>
                  </div>
                  <div className="rounded-2xl border border-[#EEF0E8] bg-white p-4">
                    <p className="text-xs text-[#8A938D]">تاريخ الانتهاء</p>
                    <p className="mt-2 font-black text-[#1F2A25]">لا يوجد</p>
                  </div>
                  <div className="rounded-2xl border border-[#EEF0E8] bg-white p-4">
                    <p className="text-xs text-[#8A938D]">الفواتير</p>
                    <p className="mt-2 font-black text-[#1F2A25]">لا توجد</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-[#8A938D]">
                سيتم تفعيل اختيار الخطط والدفع عند إطلاق باقات Abdou Store.
              </p>
            </Panel>
          )}
          {active === "payments" && (
            <Panel
              eyebrow="المتجر"
              title="وسائل الدفع"
              description="إعدادات الدفع التي تظهر في رحلة الشراء. الدفع عند الاستلام هو الخيار الافتراضي للمتجر حاليًا."
            >
              <div className="space-y-3">
                <Row
                  icon={Package}
                  title="الدفع عند الاستلام"
                  description="الخيار الافتراضي المتاح لطلبات المتجر."
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
                    <Check className="size-3.5" />
                    افتراضي
                  </span>
                </Row>
                <Row
                  icon={CreditCard}
                  title="الدفع الإلكتروني"
                  description="ستتم إضافة بوابات الدفع الإلكتروني وربط الحساب لاحقًا."
                >
                  <span className="rounded-full bg-[#F3F4EE] px-3 py-1.5 text-xs font-bold text-[#8A938D]">
                    قريبًا
                  </span>
                </Row>
              </div>
            </Panel>
          )}
          {active === "markets" && (
            <Panel
              eyebrow="البيع"
              title="العملات والأسواق"
              description="حدد السوق والعملة التي يستعملها متجرك في الأسعار والتقارير. الإعدادات الحالية مناسبة للسوق الجزائري."
            >
              <div className="space-y-3">
                <Row
                  icon={Globe2}
                  title="السوق الجزائري"
                  description="الدولة الافتراضية للمتجر والطلبات."
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
                    <Check className="size-3.5" />
                    مفعّل
                  </span>
                </Row>
                <Row
                  icon={CreditCard}
                  title="الدينار الجزائري · DZD"
                  description="العملة المستخدمة في الأسعار والتوصيل وProfitability Engine."
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
                    <Check className="size-3.5" />
                    العملة الحالية
                  </span>
                </Row>
                <p className="pt-3 text-center text-xs text-[#8A938D]">
                  إضافة عملات وأسواق أخرى ستتوفر ضمن تحديث قادم.
                </p>
              </div>
            </Panel>
          )}
          {active === "domain" && (
            <Panel
              eyebrow="الربط"
              title="اسم النطاق"
              description="اربط نطاقك المخصص بصفحات المتجر. يتم حفظ بيانات التحقق في إعدادات النطاق الخاصة بحسابك فقط."
            >
              <div className="rounded-2xl bg-[var(--brand-soft)] p-4 text-sm leading-6 text-[#3F5A4D]">
                أضف النطاق بدون `https://`، ثم أنشئ سجل DNS المطلوب لدى مزود
                النطاق. بعد انتشار السجل يمكن متابعة التحقق من هنا.
              </div>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    النطاق المخصص
                  </span>
                  <input
                    value={domain}
                    onChange={event => setDomain(event.target.value)}
                    placeholder="store.example.com"
                    className="h-12 w-full rounded-xl border border-[#E3E1D8] px-4 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    رمز التحقق من Meta
                  </span>
                  <input
                    value={verificationCode}
                    onChange={event => setVerificationCode(event.target.value)}
                    placeholder="اختياري"
                    className="h-12 w-full rounded-xl border border-[#E3E1D8] px-4 text-sm font-bold text-[#1F2A25] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[#0B5B43]/10"
                  />
                </label>
                <div className="flex items-center justify-between rounded-2xl border border-[#EEF0E8] p-4">
                  <div>
                    <p className="font-extrabold text-[#1F2A25]">
                      تفعيل النطاق
                    </p>
                    <p className="mt-1 text-xs text-[#8A938D]">
                      يظهر النطاق في صفحات المتجر بعد ربط DNS بنجاح.
                    </p>
                  </div>
                  <Switch
                    checked={domainEnabled}
                    onCheckedChange={setDomainEnabled}
                  />
                </div>
                <Button
                  disabled={!domain.trim() || saveDomain.isPending}
                  onClick={() =>
                    saveDomain.mutate({
                      kind: "facebook_domain",
                      label: "التحقق من نطاق المتجر",
                      domain: domain.trim(),
                      verificationCode: verificationCode.trim(),
                      enabled: domainEnabled,
                    })
                  }
                  className="brand-shine cta-gradient btn-press w-full rounded-xl font-extrabold shadow-cta transition duration-200"
                >
                  <Save className="ml-2 size-4" />
                  حفظ إعدادات النطاق
                </Button>
              </div>
            </Panel>
          )}
          {active === "notifications" && (
            <Panel
              eyebrow="التنبيهات"
              title="الإشعارات"
              description="فعّل القنوات وأنواع التنبيهات التي تحتاجها. إعدادات WhatsApp وTelegram وSMS المتقدمة محفوظة في مركز Connecteurs."
            >
              <div className="space-y-3">
                <Row
                  icon={Bell}
                  title="إشعارات الطلبات"
                  description="إدارة إشعارات الطلبات الجديدة وتغيّر حالتها."
                >
                  <Switch defaultChecked />
                </Row>
                <Row
                  icon={Bell}
                  title="تحديثات المتجر"
                  description="إشعارات التحديثات والميزات الجديدة."
                >
                  <Switch defaultChecked />
                </Row>
                <Row
                  icon={Bell}
                  title="تنبيهات النظام"
                  description="تنبيهات الحماية والأخطاء المهمة."
                >
                  <Switch defaultChecked />
                </Row>
                <Button
                  onClick={() => setLocation("/connecteurs")}
                  variant="outline"
                  className="btn-press mt-3 w-full rounded-xl border-[#DCE5DD] font-extrabold text-[var(--brand)] transition duration-200 hover:bg-[var(--brand-soft)]"
                >
                  فتح إعدادات القنوات المتقدمة
                </Button>
              </div>
            </Panel>
          )}
          {active === "security" && (
            <Panel
              eyebrow="الأمان"
              title="الحماية"
              description="إعدادات حماية الطلبات والمحتوى من مركز واحد. لا توجد حماية مطلقة، لكن هذه الطبقات تقلل الطلبات الوهمية والنسخ السطحي للمحتوى."
            >
              <div className="space-y-3">
                <Row
                  icon={LockKeyhole}
                  title="OrderClean"
                  description="حماية الطلبات من التكرار والأنماط المشبوهة."
                >
                  <span className="text-xs font-extrabold text-[var(--brand)]">
                    إدارة
                  </span>
                </Row>
                <Row
                  icon={ShieldCheck}
                  title="ContentGuard"
                  description="حماية الصور والمحتوى مع العلامة المائية والإعدادات المتدرجة."
                >
                  <span className="text-xs font-extrabold text-[var(--brand)]">
                    إدارة
                  </span>
                </Row>
                <Row
                  icon={ShieldCheck}
                  title="Cloudflare Turnstile"
                  description="التحقق من نماذج الطلب ضد البوتات."
                >
                  <span className="text-xs font-extrabold text-[var(--brand)]">
                    إدارة
                  </span>
                </Row>
                <Button
                  onClick={() => setLocation("/connecteurs")}
                  className="brand-shine cta-gradient btn-press mt-3 w-full rounded-xl font-extrabold shadow-cta transition duration-200"
                >
                  <ShieldCheck className="ml-2 size-4" />
                  فتح مركز الحماية
                </Button>
              </div>
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
}
