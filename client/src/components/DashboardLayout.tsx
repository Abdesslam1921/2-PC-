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
  ClipboardList,
  CircleDollarSign,
  Cable,
  FileDown,
  Truck,
  LayoutDashboard,
  LayoutTemplate,
  LogIn,
  LogOut,
  Menu,
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
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export const dashboardNavigation = [
  { icon: LayoutDashboard, label: "نظرة عامة", path: "/dashboard" },
  { icon: Package, label: "المنتجات", path: "/products" },
  { icon: FileDown, label: "المنتجات الرقمية", path: "/digital-products" },
  { icon: Truck, label: "التوصيل", path: "/delivery" },
  { icon: Cable, label: "Connecteurs", path: "/connecteurs" },
  { icon: PhoneCall, label: "Call Center", path: "/call-center" },
  { icon: PanelsTopLeft, label: "الفانل", path: "/funnels" },
  { icon: LayoutTemplate, label: "القوالب", path: "/templates" },
  { icon: ShoppingBag, label: "الطلبات", path: "/orders" },
  { icon: Truck, label: "ForShip · تتبع الشحن", path: "/for-ship" },
  { icon: ClipboardList, label: "الطلبات المتروكة", path: "/abandoned-orders" },
  {
    icon: CircleDollarSign,
    label: "Profitability Engine",
    path: "/profitability",
  },
  { icon: WandSparkles, label: "AI Media Buying", path: "/media-buying" },
  { icon: Sparkles, label: "التحليل بالذكاء الاصطناعي", path: "/ai-analytics" },
  { icon: Users, label: "العملاء", path: "/customers" },
] as const;

const navigationGroups: Array<{ title: string; paths: string[] }> = [
  { title: "الرئيسية", paths: ["/dashboard"] },
  {
    title: "المبيعات",
    paths: ["/orders", "/abandoned-orders", "/customers", "/call-center"],
  },
  {
    title: "الكتالوج والتوصيل",
    paths: ["/products", "/digital-products", "/delivery", "/for-ship"],
  },
  {
    title: "النمو والتسويق",
    paths: [
      "/funnels",
      "/templates",
      "/profitability",
      "/media-buying",
      "/ai-analytics",
    ],
  },
  { title: "النظام", paths: ["/connecteurs"] },
];

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

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location, setLocation] = useLocation();
  const renderItem = (item: (typeof dashboardNavigation)[number]) => {
    const active = location === item.path;
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => {
          setLocation(item.path);
          onNavigate?.();
        }}
        aria-current={active ? "page" : undefined}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-[13px] font-bold transition duration-200 active:scale-[0.98] ${active ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5D6862] hover:bg-[#F2F4EF] hover:text-[#1F2A25]"}`}
      >
        {active && (
          <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-[var(--brand)]" />
        )}
        <Icon
          className={`size-[18px] shrink-0 transition ${active ? "text-[var(--brand)]" : "text-[#9AA49E] group-hover:text-[var(--brand)]"}`}
        />
        {item.label}
      </button>
    );
  };
  return (
    <nav aria-label="التنقل الرئيسي" className="space-y-5">
      {navigationGroups.map(group => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[10px] font-extrabold tracking-[0.12em] text-[#A7AFA9]">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.paths.map(path => {
              const item = dashboardNavigation.find(
                entry => entry.path === path
              );
              return item ? renderItem(item) : null;
            })}
          </div>
        </div>
      ))}
      <div className="border-t border-[#EDEEE8] pt-4">
        <button
          onClick={() => {
            setLocation("/settings");
            onNavigate?.();
          }}
          aria-current={location === "/settings" ? "page" : undefined}
          className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-[13px] font-bold transition duration-200 active:scale-[0.98] ${location === "/settings" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[#5D6862] hover:bg-[#F2F4EF] hover:text-[#1F2A25]"}`}
        >
          {location === "/settings" && (
            <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-[var(--brand)]" />
          )}
          <Settings
            className={`size-[18px] shrink-0 transition ${location === "/settings" ? "text-[var(--brand)]" : "text-[#9AA49E] group-hover:text-[var(--brand)]"}`}
          />
          الإعدادات
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
  const [, setLocation] = useLocation();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#EDEEE8] px-5 py-5">
        <BrandLockup />
      </div>
      <div className="dashboard-nav-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <NavigationLinks onNavigate={onNavigate} />
      </div>
      <button
        onClick={() => {
          window.open("/store", "_blank", "noopener,noreferrer");
          onNavigate?.();
        }}
        className="btn-press group mx-4 mb-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--brand-strong),#14663F)] p-4 text-right text-white shadow-cta"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
            <Store className="size-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold">واجهة المتجر</p>
            <p className="mt-1 text-[11px] leading-5 text-white/70">
              افتح المتجر الحي وتصفّح الكتالوج والسلة.
            </p>
          </div>
        </div>
      </button>
      <div className="border-t border-[#EDEEE8] p-4">
        <UserAccount mobile={mobile} />
      </div>
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
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[278px] border-l border-[#E7E9E2] bg-white lg:block">
        <SidebarContent />
      </aside>

      <div className="min-h-screen lg:mr-[278px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[rgba(15,118,110,0.14)] bg-[rgba(253,247,238,0.85)] px-4 backdrop-blur-xl sm:px-6 lg:px-9">
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
              <SheetContent
                side="right"
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
              className="brand-shine flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0F766E,#0B5D57)] px-3 py-2.5 text-[11px] font-extrabold text-white shadow-cta sm:px-4 sm:text-xs"
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
        <main className="mx-auto w-full max-w-[1500px] overflow-x-hidden px-4 py-7 sm:px-6 sm:py-9 lg:px-9">
          {children}
        </main>
      </div>
      <FloatingChatbot audience="owner" />
    </div>
  );
}
