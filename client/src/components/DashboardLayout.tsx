import { useAuth } from "@/_core/hooks/useAuth";
import { BrandLockup } from "@/components/BrandLockup";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { StoreSwitcher } from "@/components/StoreSwitcher";
import FloatingChatbot from "@/components/FloatingChatbot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  ChevronLeft,
  CircleHelp,
  CircleDollarSign,
  Cable,
  Truck,
  LayoutDashboard,
  BadgePercent,
  LayoutTemplate,
  LogIn,
  LogOut,
  Menu,
  FolderTree,
  Package,
  PhoneCall,
  PanelsTopLeft,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  WandSparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";

type NavSubItem = {
  label: string;
  to: string;
  /** Whether this sub-item is the active one for the current query. */
  match: (params: URLSearchParams) => boolean;
};

type NavSubEntry = NavSubItem | { label: string; section: true };

type DashboardNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  subs?: NavSubEntry[];
};

const kindOf = (params: URLSearchParams) => params.get("kind");

export const dashboardNavigation: DashboardNavItem[] = [
  { icon: LayoutDashboard, label: "نظرة عامة", path: "/dashboard" },
  {
    icon: Package,
    label: "المنتجات",
    path: "/products",
    subs: [
      {
        label: "المنتجات العامة",
        to: "/products",
        match: params => {
          const kind = kindOf(params);
          return kind !== "physical" && kind !== "digital";
        },
      },
      {
        label: "المنتجات المادية",
        to: "/products?kind=physical",
        match: params => kindOf(params) === "physical",
      },
      {
        label: "المنتجات الرقمية",
        to: "/products?kind=digital",
        match: params => kindOf(params) === "digital",
      },
      { label: "إنشاء منتج", section: true },
      {
        label: "إنشاء منتج مادي",
        to: "/products/create",
        match: params => kindOf(params) !== "digital",
      },
      {
        label: "إنشاء منتج رقمي",
        to: "/products/create?kind=digital",
        match: params => kindOf(params) === "digital",
      },
    ],
  },
  { icon: FolderTree, label: "الفئات", path: "/categories" },
  {
    icon: BadgePercent,
    label: "العروض",
    path: "/offers",
    subs: [
      {
        label: "العروض العامة",
        to: "/offers",
        match: params => {
          const tab = params.get("tab");
          return !tab || tab === "all";
        },
      },
      {
        label: "الباقات",
        to: "/offers?tab=bundle",
        match: params => params.get("tab") === "bundle",
      },
      {
        label: "خصم الكمية",
        to: "/offers?tab=quantity",
        match: params => params.get("tab") === "quantity",
      },
      {
        label: "Upsell",
        to: "/offers?tab=upsell",
        match: params => params.get("tab") === "upsell",
      },
    ],
  },
  { icon: Truck, label: "التوصيل", path: "/delivery" },
  { icon: Cable, label: "Connecteurs", path: "/connecteurs" },
  { icon: PhoneCall, label: "Call Center", path: "/call-center" },
  { icon: PanelsTopLeft, label: "الفانل", path: "/funnels" },
  { icon: LayoutTemplate, label: "القوالب", path: "/templates" },
  {
    icon: ShoppingBag,
    label: "الطلبات",
    path: "/orders",
    subs: [
      {
        label: "الطلبات العامة",
        to: "/orders",
        match: params => {
          const scope = params.get("scope");
          return scope !== "mine" && scope !== "abandoned";
        },
      },
      {
        label: "طلباتي",
        to: "/orders?scope=mine",
        match: params => params.get("scope") === "mine",
      },
      {
        label: "الطلبات المتروكة",
        to: "/orders?scope=abandoned",
        match: params => params.get("scope") === "abandoned",
      },
    ],
  },
  { icon: Truck, label: "ProShip · تتبع الشحن", path: "/for-ship" },
  {
    icon: CircleDollarSign,
    label: "Profitability Engine",
    path: "/profitability",
  },
  { icon: WandSparkles, label: "AI Media Buying", path: "/media-buying" },
  { icon: Sparkles, label: "التحليل بالذكاء الاصطناعي", path: "/ai-analytics" },
  { icon: Users, label: "العملاء", path: "/customers" },
];

const navigationGroups: Array<{ title: string; paths: string[] }> = [
  { title: "الرئيسية", paths: ["/dashboard"] },
  {
    title: "المبيعات",
    paths: ["/orders"],
  },
  {
    title: "الكتالوج والتوصيل",
    paths: [
      "/products",
      "/categories",
      "/offers",
      "/call-center",
      "/profitability",
      "/connecteurs",
    ],
  },
  {
    title: "النمو والتسويق",
    paths: [
      "/customers",
      "/delivery",
      "/for-ship",
      "/funnels",
      "/templates",
      "/media-buying",
      "/ai-analytics",
    ],
  },
];

const dashboardTabs = [
  { label: "الطلبات", path: "/orders" },
  { label: "المنتجات", path: "/products" },
  { label: "إنشاء منتج", path: "/products/create" },
  { label: "الفئات", path: "/categories" },
  { label: "العروض", path: "/offers" },
  { label: "Call Center", path: "/call-center" },
  { label: "Profitability", path: "/profitability" },
  { label: "التطبيقات", path: "/connecteurs" },
  { label: "الرئيسية", path: "/dashboard" },
] as const;

function DashboardTabs({
  location,
  setLocation,
}: {
  location: string;
  setLocation: (path: string) => void;
}) {
  return (
    <nav aria-label="تبويبات الأقسام" className="dash-tabs">
      {dashboardTabs.map(tab => {
        const active =
          tab.path === "/products"
            ? location === "/products"
            : tab.path === "/products/create"
              ? location === "/products/create"
              : tab.path === "/connecteurs"
                ? location === "/connecteurs" ||
                  location.startsWith("/connecteurs/")
                : location === tab.path;
        return (
          <button
            key={`${tab.label}-${tab.path}`}
            type="button"
            onClick={() => setLocation(tab.path)}
            className={`dash-tab ${active ? "is-active" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function UserAccount({ mobile = false }: { mobile?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="h-11 w-full animate-pulse rounded-2xl bg-[#EDEEE8]" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => setLocation("/login")}
        className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-strong)] px-4 py-3 text-sm font-bold text-white hover:bg-[#063528]"
      >
        <LogIn className="size-4" />
        تسجيل الدخول
      </button>
    );
  }

  const initial = user.name?.trim().charAt(0) || "ع";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white p-2 text-right transition duration-200 hover:border-[#DCE7E0] hover:bg-[#F6FAF7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${mobile ? "shadow-soft" : ""}`}
        >
          <Avatar className="size-9 rounded-xl border border-[#E3EDE7]">
            <AvatarFallback className="rounded-xl bg-[var(--brand-soft)] text-xs font-extrabold text-[var(--brand)]">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#1F2A25]">
              {user.name || "حساب المدير"}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-[#8A938D]">
              {user.email || "حساب المتجر"}
            </span>
          </span>
          <ChevronLeft className="size-4 shrink-0 text-[#A7AFA9]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-60 rounded-2xl border-[#E7E9E2] p-2 shadow-lift"
      >
        <DropdownMenuLabel className="px-2 py-2 text-xs font-bold text-[#8A938D]">
          الحساب
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setLocation("/settings")}
          className="cursor-pointer rounded-xl py-2.5 text-sm font-medium"
        >
          <Settings className="ml-2 size-4 text-[var(--brand)]" />
          الملف الشخصي والإعدادات
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer rounded-xl py-2.5 text-sm font-medium text-[#C0492F] focus:text-[#C0492F]"
        >
          <LogOut className="ml-2 size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(useSearch());
  const go = (to: string) => {
    setLocation(to);
    onNavigate?.();
  };
  const renderItem = (item: DashboardNavItem) => {
    const active =
      item.path === "/connecteurs"
        ? location === "/connecteurs" || location.startsWith("/connecteurs/")
        : location === item.path;
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => go(item.path)}
        aria-current={active ? "page" : undefined}
        className={`group relative flex w-full items-center justify-end gap-2 rounded-xl px-2.5 py-1.5 text-right text-[12.5px] font-bold transition duration-200 active:scale-[0.98] ${active ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5D6862] hover:bg-[#F2F4EF] hover:text-[#1F2A25]"}`}
      >
        {active && (
          <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-[var(--brand)]" />
        )}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Icon
          className={`size-3.5 shrink-0 transition ${active ? "text-[var(--brand)]" : "text-[#9AA49E] group-hover:text-[var(--brand)]"}`}
        />
      </button>
    );
  };
  /**
   * Sub-navigation stays collapsed until its main section is opened, so the
   * section's sub-tabs only appear once you are on (or click) its main tab.
   */
  const isSectionOpen = (item: DashboardNavItem) =>
    location === item.path || location.startsWith(`${item.path}/`);
  const renderSubs = (item: DashboardNavItem) => {
    if (!item.subs?.length || !isSectionOpen(item)) return null;
    return (
      <div className="dash-subnav">
        {item.subs.map(sub => {
          if ("section" in sub) {
            return (
              <p key={sub.label} className="dash-subnav-heading">
                {sub.label}
              </p>
            );
          }
          const subPath = sub.to.split("?")[0];
          const active = location === subPath && sub.match(params);
          return (
            <button
              key={sub.to}
              type="button"
              onClick={() => go(sub.to)}
              aria-current={active ? "page" : undefined}
              className={`dash-subnav-link ${active ? "is-active" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">{sub.label}</span>
            </button>
          );
        })}
      </div>
    );
  };
  return (
    <nav aria-label="التنقل الرئيسي" className="space-y-1">
      {navigationGroups.map(group => (
        <div key={group.title}>
          <p
            className={`px-3 pb-2 text-[10px] font-extrabold tracking-[0.12em] text-[#A7AFA9] ${group.title === "النمو والتسويق" ? "dash-rest-label" : ""}`}
          >
            {group.title === "النمو والتسويق" ? "بقية الأقسام" : group.title}
          </p>
          <div className="space-y-0.5">
            {group.paths.map(path => {
              const item = dashboardNavigation.find(
                entry => entry.path === path
              );
              if (!item) return null;
              return (
                <div key={item.path}>
                  {renderItem(item)}
                  {renderSubs(item)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="border-t border-[#EDEEE8] pt-4">
        <button
          onClick={() => go("/settings")}
          aria-current={location === "/settings" ? "page" : undefined}
          className={`group relative flex w-full items-center justify-end gap-2 rounded-xl px-2.5 py-1.5 text-right text-[12.5px] font-bold transition duration-200 active:scale-[0.98] ${location === "/settings" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5D6862] hover:bg-[#F2F4EF] hover:text-[#1F2A25]"}`}
        >
          {location === "/settings" && (
            <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-[var(--brand)]" />
          )}
          <span className="min-w-0 flex-1 truncate">الإعدادات</span>
          <Settings
            className={`size-3.5 shrink-0 transition ${location === "/settings" ? "text-[var(--brand)]" : "text-[#9AA49E] group-hover:text-[var(--brand)]"}`}
          />
        </button>
      </div>
    </nav>
  );
}

function SidebarContent({
  onNavigate,
  mobile = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="dash-side-pills">
        <button type="button" className="dash-side-pill is-active">
          المتاجر
        </button>
        <button
          type="button"
          className="dash-side-pill"
          title="افتح المتجر الحي"
          onClick={() => {
            window.open("/store", "_blank", "noopener,noreferrer");
            onNavigate?.();
          }}
        >
          <Store className="size-3" />
          عبدو
        </button>
      </div>
      <div className="dashboard-nav-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <NavigationLinks onNavigate={onNavigate} />
      </div>
      <div className="dash-pro">
        <p>ترقية إلى Pro</p>
        <button type="button">Pro</button>
      </div>
      {mobile && (
        <div className="border-t border-[#EDEEE8] p-3">
          <UserAccount mobile={mobile} />
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const pageName =
    dashboardNavigation.find(item => item.path === location)?.label ??
    (location === "/settings" ? "الإعدادات" : "لوحة التحكم");

  if (auth.loading) return <DashboardLayoutSkeleton />;
  if (!auth.user) return null;

  return (
    <div className="dash-identity min-h-screen text-[#1F2A25]" dir="rtl">
      <div className="dash-aurora" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[232px] border-l border-[#E7E9E2] bg-white lg:block">
        <SidebarContent />
      </aside>

      <div className="relative z-10 min-h-screen lg:mr-[232px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[rgba(15,118,110,0.14)] bg-[rgba(243,245,244,0.92)] px-4 backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="btn-press grid size-10 place-items-center rounded-xl border border-[#E5E6DE] bg-white text-[#5D6862] shadow-soft hover:border-[#C6D8CC] hover:text-[var(--brand)] lg:hidden"
                  aria-label="فتح القائمة"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right"
                dir="rtl"
                className="w-[min(88vw,340px)] max-w-none gap-0 border-l-0 p-0 [&>button]:hidden"
              >
                <SheetTitle className="sr-only">قائمة إدارة المتجر</SheetTitle>
                <SheetDescription className="sr-only">
                  التنقل بين أقسام لوحة عبدو ستور
                </SheetDescription>
                <SheetClose asChild>
                  <button
                    className="absolute left-4 top-4 z-10 grid size-9 place-items-center rounded-xl bg-[#F2F4EF] text-[#5D6862] transition hover:bg-[#E8EAE2]"
                    aria-label="إغلاق القائمة"
                  >
                    <X className="size-4" />
                  </button>
                </SheetClose>
                <SidebarContent
                  onNavigate={() => setMobileOpen(false)}
                  mobile
                />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <BrandLockup compact />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-bold text-[#9AA49E]">إدارة المتجر</p>
              <p className="mt-1 text-sm font-extrabold text-[#1F2A25]">
                {pageName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <StoreSwitcher />
            <button
              onClick={() => setLocation("/stores/new")}
              className="brand-shine cta-gradient flex items-center gap-2 rounded-full px-3 py-2.5 text-[11px] font-extrabold text-white shadow-cta sm:px-4 sm:text-xs"
            >
              <Store className="size-4" />
              إنشاء متجر
            </button>
            <button
              onClick={() =>
                toast.info("سيظهر مركز المساعدة مع أدوات المتجر في تحديث لاحق.")
              }
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#66716B] transition hover:bg-white hover:text-[#1F2A25] sm:flex"
            >
              <CircleHelp className="size-4" />
              مساعدة
            </button>
            <button
              onClick={() =>
                toast.info("لا توجد تنبيهات جديدة في الوقت الحالي.")
              }
              className="btn-press relative grid size-10 place-items-center rounded-xl border border-[#E5E6DE] bg-white text-[#5D6862] shadow-soft hover:border-[#C6D8CC] hover:text-[var(--brand)]"
              aria-label="التنبيهات"
            >
              <Bell className="size-[18px]" />
              <span className="notif-ping absolute left-2 top-2 size-1.5 rounded-full bg-[var(--warm)]" />
            </button>
            <div className="hidden w-48 sm:block">
              <UserAccount />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-none overflow-x-hidden px-4 py-4 sm:px-5 lg:px-6">
          <DashboardTabs location={location} setLocation={setLocation} />
          {children}
        </main>
      </div>
      <FloatingChatbot audience="owner" />
    </div>
  );
}
