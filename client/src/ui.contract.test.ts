import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8"
  );
}

describe("dashboard route contracts", () => {
  it("registers the Arabic management screens and the future storefront flow", () => {
    const app = source("./App.tsx");
    [
      "/",
      "/products",
      "/funnels",
      "/orders",
      "/customers",
      "/settings",
      "/store",
      "/store/cart",
      "/store/checkout",
    ].forEach(path => {
      expect(app).toContain(`path=\"${path}\"`);
    });
  });

  it("registers the product creation route and the required catalog form sections", () => {
    expect(source("./App.tsx")).toContain('path="/products/create"');
    const productCreate = source("./pages/ProductCreate.tsx");
    [
      "معلومات المنتج",
      "صور المنتج والمتغيرات",
      "التسعير",
      "المتغيرات",
      "المخزون",
      "السعر قبل التخفيض",
      "السعر بعد التخفيض",
      "تنبيه عند انخفاض الكمية",
    ].forEach(label => {
      expect(productCreate).toContain(label);
    });
  });

  it("registers the AI funnel setup route and its required configuration sections", () => {
    expect(source("./App.tsx")).toContain('path="/funnels/ai"');
    const setup = source("./pages/FunnelAiSetup.tsx");
    [
      "اختر المنتج",
      "اختر إطار العمل",
      "اختر طول الصفحة",
      "اختر اللغة واللهجة",
      "مواصفات الكتابة المخصصة",
    ].forEach(label => {
      expect(setup).toContain(label);
    });
  });

  it("registers the imported-design funnel route and its multistep setup sections", () => {
    expect(source("./App.tsx")).toContain('path="/funnels/import"');
    const setup = source("./pages/FunnelImportSetup.tsx");
    [
      "استيراد تصميمك",
      "اختر المنتج",
      "الإعدادات الافتراضية",
      "العملة وطريقة الدفع",
      "تفاصيل صفحة الهبوط",
    ].forEach(label => {
      expect(setup).toContain(label);
    });
  });

  it("keeps the required Arabic navigation labels in the shared dashboard layout", () => {
    const layout = source("./components/DashboardLayout.tsx");
    [
      "نظرة عامة",
      "المنتجات",
      "الفانل",
      "الطلبات",
      "العملاء",
      "الإعدادات",
      "تسجيل الدخول",
      "تسجيل الخروج",
    ].forEach(label => {
      expect(layout).toContain(label);
    });
  });

  it("keeps the mobile navigation open and close controls keyboard-accessible", () => {
    const layout = source("./components/DashboardLayout.tsx");
    expect(layout).toContain(
      "<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>"
    );
    expect(layout).toContain("<SheetTrigger asChild>");
    expect(layout).toContain('<SheetContent side="right"');
    expect(layout).toContain("<SheetClose asChild>");
    expect(layout).toContain("onNavigate={() => setMobileOpen(false)}");
    expect(layout).toContain('aria-label="فتح القائمة"');
    expect(layout).toContain('aria-label="إغلاق القائمة"');
  });

  it("keeps the dashboard sections inside an independently scrollable container", () => {
    const layout = source("./components/DashboardLayout.tsx");
    expect(layout).toContain(
      "dashboard-nav-scrollbar min-h-0 flex-1 overflow-y-auto"
    );
  });
});

describe("AI Media Buying contracts", () => {
  it("exposes Meta OAuth connection and guarded campaign execution", () => {
    const page = source("./pages/MediaBuying.tsx");
    [
      "ربط حساب Meta عبر Facebook",
      "أوافق على مراجعة خطة التنفيذ",
      "Page ID",
      "Image Hash",
      "أوافق على إنشاء الحملة",
    ].forEach(label => expect(page).toContain(label));
    expect(page).toContain("startOAuth.mutate()");
    expect(page).toContain("execute.mutate");
    expect(page).toContain("enabled: auth.isAuthenticated");
    expect(page).toContain("سجّل الدخول لربط Meta");
  });
});

describe("presentation-state contracts", () => {
  it("keeps the management empty states explicit without وصف الكتالوج بأنه تجريبي", () => {
    expect(source("./pages/Products.tsx")).toContain("لا توجد منتجات بعد");
    expect(source("./pages/Orders.tsx")).toContain("لا توجد طلبات بعد");
    expect(source("./pages/Customers.tsx")).toContain(
      "لا يوجد عملاء مسجّلون حتى الآن"
    );
    expect(source("./config/store.ts")).toContain("الكتالوج الخاص بالموقع");
  });

  it("keeps the catalog, cart, and checkout connected to the independent storefront journey", () => {
    const storefront = source("./pages/Storefront.tsx");
    [
      "products.publicList",
      "منتجات متوفرة الآن",
      "سلتك فارغة",
      "مراجعة الطلب",
    ].forEach(label => {
      expect(storefront).toContain(label);
    });
  });
});

describe("storefront entry contract", () => {
  it("opens the storefront preview in a new tab from the sidebar", () => {
    const layout = source("./components/DashboardLayout.tsx");
    expect(layout).toContain('window.open("/store"');
    expect(layout).toContain("افتح المتجر الحي");
  });
});
