import { BrandLockup } from "@/components/BrandLockup";
import FloatingChatbot from "@/components/FloatingChatbot";
import { ContactBar } from "@/components/ContactBar";
import { ContentGuard } from "@/components/ContentGuard";
import { MessageOrderWidget } from "@/components/MessageOrderWidget";
import Checkout from "@/pages/Checkout";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ChevronLeft,
  Heart,
  Loader2,
  Minus,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
  Clock,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import { useLocation, type RouteComponentProps } from "wouter";

type StorefrontView = "catalog" | "cart" | "checkout";

type CatalogProduct = {
  id: number;
  title: string;
  description: string;
  productType: string | null;
  productKind: "physical" | "digital";
  currency: string;
  collectionName: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventory: number;
  lowStockThreshold: number;
  showStockThreshold: number;
  trackInventory: boolean;
  continueSelling: boolean;
  images: Array<{ id: number; url: string; altText: string | null }>;
  variants: Array<{
    id: number;
    price: string | null;
    compareAtPrice: string | null;
    stock: number;
    lowStockThreshold: number;
    showStockThreshold: number;
    available: boolean;
  }>;
};

const formatPrice = (value: string | null | undefined) =>
  value
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} دج`
    : "السعر غير محدد";

function getPrice(product: CatalogProduct) {
  const variant =
    product.variants.find(item => item.price !== null) ?? product.variants[0];
  return {
    price: product.price ?? variant?.price ?? null,
    compareAtPrice: product.compareAtPrice ?? variant?.compareAtPrice ?? null,
  };
}

function isAvailable(product: CatalogProduct) {
  if (product.continueSelling || !product.trackInventory) return true;
  if (product.variants.length)
    return product.variants.some(
      variant => variant.available && variant.stock > 0
    );
  return product.inventory > 0;
}

function discountPercent(product: CatalogProduct) {
  const { price, compareAtPrice } = getPrice(product);
  const base = Number(compareAtPrice);
  const current = Number(price);
  return compareAtPrice && price && base > current
    ? Math.round(((base - current) / base) * 100)
    : null;
}

function StoreHeader({
  search,
  onSearch,
}: {
  search?: string;
  onSearch?: (value: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { itemCount } = useCart();
  return (
    <>
      <div className="bg-[var(--brand-strong)] px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-white sm:text-xs">
        الدفع عند الاستلام · توصيل سريع لكل ولايات الوطن
      </div>
      <header className="sticky top-0 z-40 border-b border-[#EAE8E0] bg-[color-mix(in_oklab,white_86%,transparent)] px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button
            onClick={() => setLocation("/store")}
            className="shrink-0"
            aria-label="الصفحة الرئيسية للمتجر"
          >
            <BrandLockup />
          </button>
          <nav className="hidden items-center gap-6 text-sm font-extrabold text-[#55605A] lg:flex">
            <button
              onClick={() => setLocation("/store")}
              className="transition hover:text-[var(--brand)]"
            >
              الرئيسية
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="transition hover:text-[var(--brand)]"
            >
              المنتجات
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("categories")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="transition hover:text-[var(--brand)]"
            >
              التصنيفات
            </button>
          </nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {onSearch && (
              <label className="hidden w-[min(26vw,280px)] items-center gap-2 rounded-2xl border border-[#E5E3DA] bg-[#F7F6F1] px-3 py-2.5 text-[#8A938D] transition focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0B5B43]/8 md:flex">
                <Search className="size-4 shrink-0" />
                <input
                  value={search}
                  onChange={event => onSearch(event.target.value)}
                  placeholder="ابحث في المنتجات"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#2E3833] outline-none placeholder:text-[#A7AFA9]"
                />
              </label>
            )}
            <button
              onClick={() =>
                toast.info("حسابات العملاء ستظهر هنا عند تفعيل نظام الحسابات.")
              }
              className="hidden grid size-10 place-items-center rounded-xl text-[#66716B] transition hover:bg-[#F1EFE8] sm:grid"
              aria-label="حساب العميل"
            >
              <UserRound className="size-[19px]" />
            </button>
            <button
              onClick={() => setLocation("/store/cart")}
              className="btn-press relative grid size-10 place-items-center rounded-xl border border-[#D9E5DD] bg-[var(--brand-soft)] text-[var(--brand)] hover:-translate-y-0.5 hover:bg-[#E1EEE6]"
              aria-label="سلة المشتريات"
            >
              <ShoppingCart className="size-[19px]" />
              {itemCount > 0 && (
                <span className="absolute -left-1.5 -top-1.5 grid min-w-5 h-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-extrabold text-white">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setLocation("/dashboard")}
              className="hidden items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-extrabold text-[#66716B] transition hover:bg-[#F1EFE8] xl:inline-flex"
            >
              إدارة المتجر
              <ArrowLeft className="size-3.5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: CatalogProduct;
  onAdd: (product: CatalogProduct) => void;
}) {
  const [, setLocation] = useLocation();
  const available = isAvailable(product);
  const { price, compareAtPrice } = getPrice(product);
  const discount = discountPercent(product);
  const image = product.images[0];
  const category = product.collectionName || product.productType;
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#EAE8E0] bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:border-[#CBDFD3] hover:shadow-lift">
      <div className="relative overflow-hidden bg-[#F2F1EA]">
        <button
          onClick={() => setLocation(`/p/${product.id}`)}
          className="block w-full text-right"
          aria-label={`عرض ${product.title}`}
        >
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="aspect-[4/4.25] w-full object-cover transition duration-500 group-hover:scale-[1.045]"
            />
          ) : (
            <div className="grid aspect-[4/4.25] place-items-center bg-[radial-gradient(circle_at_50%_25%,#E4EFE8,transparent_44%),#F4F3ED] text-[#9DB4A9]">
              <ShoppingBag className="size-11" />
            </div>
          )}
        </button>
        <div className="absolute right-3 top-3 flex flex-wrap gap-1.5">
          {discount && (
            <span className="rounded-full bg-[var(--warm)] px-2.5 py-1 text-[10px] font-extrabold text-white shadow-warm">
              خصم {discount}%
            </span>
          )}
          {!available && (
            <span className="rounded-full bg-[#3A423E] px-2.5 py-1 text-[10px] font-extrabold text-white">
              نفد المخزون
            </span>
          )}
          </div>
          {(() => {
            const remaining = product.variants.length
              ? product.variants.find(variant => variant.available)?.stock ?? 0
              : product.inventory;
            const shouldShow =
              remaining > 0 &&
              product.showStockThreshold > 0 &&
              remaining <= product.showStockThreshold;
            if (!shouldShow) return null;
            return (
              <p className="mt-1 text-xs font-bold text-[var(--warm)]">
                الكمية المتبقية: {remaining}
              </p>
            );
          })()}
          <button
          onClick={() =>
            toast.info("سيُتاح حفظ المفضلة عند تفعيل حسابات العملاء.")
          }
          className="absolute left-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-[#79837D] opacity-0 shadow-sm transition hover:text-[#D8556B] group-hover:opacity-100 focus:opacity-100"
          aria-label={`حفظ ${product.title} في المفضلة`}
        >
          <Heart className="size-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5">
        {category && (
          <p className="text-[10px] font-extrabold tracking-[0.08em] text-[var(--warm)]">
            {category}
          </p>
        )}
        <button
          onClick={() => setLocation(`/p/${product.id}`)}
          className="mt-1.5 block text-right text-[15px] font-extrabold leading-6 text-[var(--ink)] transition hover:text-[var(--brand)]"
        >
          {product.title}
        </button>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-[var(--brand-strong)]">
              {formatPrice(price)}
            </p>
            {compareAtPrice && Number(compareAtPrice) > Number(price) && (
              <p className="mt-0.5 text-xs font-bold text-[#9AA49E] line-through">
                {formatPrice(compareAtPrice)}
              </p>
            )}
          </div>
          <button
            onClick={() => onAdd(product)}
            disabled={!available || !price}
            className="btn-press grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-cta transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShoppingCart className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function StoreFooter() {
  return (
    <footer className="border-t border-[#EAE8E0] bg-white px-4 py-10 text-center text-xs text-[#8A938D] sm:px-6">
      © {new Date().getFullYear()} متجرك — الدفع عند الاستلام · توصيل 58 ولاية
    </footer>
  );
}

// ===== قوالب برو حقيقية مع بيانات حقيقية =====

function MarketProTemplate({
  products,
  customization,
  search,
  setSearch,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  addProduct,
  heroProduct,
}: any) {
  const primary = customization?.primaryColor ?? "#6257e8";
  return (
    <div dir="rtl" className="min-h-screen bg-white">
      <div className="bg-black text-white text-center text-[11px] py-2.5 px-4 font-bold">
        🔥 توصيل مجاني للـ 58 ولاية{" "}
        <span className="bg-white text-black px-2 py-0.5 rounded-full text-[10px] ml-2">
          اليوم فقط
        </span>
      </div>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <label className="hidden md:flex items-center gap-2 rounded-full border bg-zinc-50 px-3 py-2">
              <Search className="size-4" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث..."
                className="bg-transparent outline-none text-xs w-40"
              />
            </label>
            <div className="size-9 rounded-full bg-zinc-900 text-white grid place-items-center">
              <ShoppingBag className="size-4" />
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 bg-[#FFF8E8] rounded-2xl p-3 border border-orange-100">
          <div className="size-12 rounded-full bg-white shadow-sm grid place-items-center">
            ⭐
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black">مورد متميز ومعتمد</p>
            <p className="text-[11px] text-zinc-500">
              تقييم 4.9 • 1240 طلب • توصيل سريع
            </p>
          </div>
          <span className="text-[10px] bg-green-500 text-white px-2.5 py-1 rounded-full">
            موثوق
          </span>
        </div>
      </div>

      <div className="px-4 max-w-7xl mx-auto">
        <div
          className="rounded-[1.8rem] p-6 md:p-8 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, #9f96ff 100%)`,
          }}
        >
          <div className="relative z-10 max-w-[70%]">
            <p className="text-xs opacity-80 font-bold tracking-widest">
              تشكيلة الموسم
            </p>
            <h1 className="text-2xl md:text-3xl font-black mt-2 leading-tight">
              هذا بانر بسيط
              <br />
              يمكنك تغييره
            </h1>
            <p className="text-[13px] opacity-80 mt-2">
              ADD ANYTHING HERE OR JUST REMOVE IT
            </p>
            <button
              onClick={() =>
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="mt-5 bg-white text-black px-6 py-2.5 rounded-full text-sm font-black"
            >
              SHOP NOW
            </button>
          </div>
        </div>
      </div>

      {customization?.showCountdown !== false && (
        <div className="px-4 mt-4 max-w-7xl mx-auto">
          <div className="bg-[#FFF3CD] border border-[#FFD24D] rounded-2xl p-3 flex items-center justify-between">
            <span className="text-[12px] font-bold flex items-center gap-2">
              <Clock className="size-4" /> عرض ينتهي بعد
            </span>
            <span className="flex gap-1">
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                02
              </span>
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                14
              </span>
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                35
              </span>
            </span>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="mt-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="font-black">الفئات</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {["الكل", ...categories].map((cat: string) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border ${selectedCategory === cat ? "bg-black text-white" : "bg-zinc-50"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <section id="products" className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-xl">منتجات مميزة</h2>
          <span className="text-xs bg-zinc-100 px-3 py-1 rounded-full">
            {filteredProducts.length} منتج
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {filteredProducts.map((product: CatalogProduct) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addProduct}
            />
          ))}
        </div>
      </section>

      <div className="mt-8 max-w-7xl mx-auto px-4 pb-10">
        <h2 className="font-black text-center mb-4">كيف يعمل؟</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: "1", t: "اختر المنتج" },
            { n: "2", t: "اطلب الآن" },
            { n: "3", t: "استلم" },
          ].map(s => (
            <div key={s.n} className="bg-zinc-50 rounded-2xl p-3 text-center">
              <div className="size-8 mx-auto rounded-full bg-white shadow grid place-items-center font-black text-sm">
                {s.n}
              </div>
              <p className="text-[11px] font-bold mt-2">{s.t}</p>
            </div>
          ))}
        </div>
      </div>

      {customization?.showTrustBadges !== false && (
        <div className="border-t bg-zinc-50/50 p-4 flex justify-center gap-6 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <Truck className="size-3" /> توصيل 58 ولاية
          </span>
          <span className="flex items-center gap-1">
            <Shield className="size-3" /> دفع عند الاستلام
          </span>
        </div>
      )}
    </div>
  );
}

function FashionLuxeTemplate({
  products,
  filteredProducts,
  addProduct,
  customization,
}: any) {
  const primary = customization?.primaryColor ?? "#0E0E0E";
  return (
    <div dir="rtl" className="min-h-screen bg-white text-black">
      <div className="text-center py-2 text-[11px] tracking-[0.2em] border-b">
        FREE SHIPPING WORLDWIDE
      </div>
      <header className="flex justify-between p-6 border-b max-w-7xl mx-auto">
        <span className="font-black tracking-[0.3em]">LUXE</span>
        <span className="text-xs">السلة • الحساب</span>
      </header>
      <div className="relative h-[68vh] bg-black text-white flex items-end p-8 max-w-7xl mx-auto">
        <div>
          <p className="text-xs tracking-[0.3em]">NEW COLLECTION 2026</p>
          <h1 className="text-5xl font-black mt-3">
            LUXE
            <br />
            MINIMAL
          </h1>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-zinc-100 max-w-7xl mx-auto mt-px">
        {filteredProducts.slice(0, 4).map((p: CatalogProduct) => (
          <div key={p.id} className="bg-white p-4">
            <img
              src={p.images[0]?.url}
              className="aspect-[3/4] object-cover w-full"
            />
            <p className="font-bold mt-3 text-sm">{p.title}</p>
            <p className="text-xs mt-1">{formatPrice(getPrice(p).price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElectroHubTemplate({
  filteredProducts,
  addProduct,
  customization,
  categories,
  selectedCategory,
  setSelectedCategory,
}: any) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f7ff]">
      <div className="bg-[#FFD60A] text-black text-center py-2 text-xs font-black">
        ⚡ عروض فلاش - خصم حتى 60% - ينتهي اليوم
      </div>
      <header className="bg-white p-3 border-b flex gap-3 max-w-6xl mx-auto">
        <div className="size-9 rounded-xl bg-[#0055FF] text-white grid place-items-center font-black">
          E
        </div>
        <input
          placeholder="ابحث عن هاتف، لابتوب..."
          className="flex-1 bg-zinc-100 rounded-full px-4 text-xs"
        />
        <button className="bg-black text-white px-4 rounded-full text-xs">
          بحث
        </button>
      </header>
      <div className="max-w-6xl mx-auto p-3">
        <div
          className="rounded-3xl p-6 text-white flex justify-between"
          style={{ background: "linear-gradient(135deg,#0055FF,black)" }}
        >
          <div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              TOP DEAL
            </span>
            <h2 className="text-2xl font-black mt-3">
              iPhone 15 Pro بأفضل سعر
            </h2>
          </div>
          <div className="size-24 bg-white/10 rounded-2xl" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {filteredProducts.map((p: CatalogProduct) => (
          <div key={p.id} className="bg-white rounded-xl p-2 border">
            <img
              src={p.images[0]?.url}
              className="h-24 w-full object-cover rounded-lg bg-zinc-50"
            />
            <p className="text-xs font-bold mt-2">{p.title}</p>
            <p className="text-sm font-black" style={{ color: "#0055FF" }}>
              {formatPrice(getPrice(p).price)}
            </p>
            <button
              onClick={() => addProduct(p)}
              className="w-full mt-2 bg-black text-white text-xs py-2 rounded-full"
            >
              أضف
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BeautyGlowTemplate({
  filteredProducts,
  addProduct,
  customization,
}: any) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#fff5f8]">
      <div className="bg-black text-white text-center py-2 text-[11px]">
        ✨ توصيل مجاني + هدية مع كل طلبية فوق 5000 دج
      </div>
      <header className="flex justify-between p-4 bg-white/80 backdrop-blur sticky top-0">
        <span className="font-black tracking-widest">GLOW</span>
        <span className="text-xs">السلة • الحساب</span>
      </header>
      <div
        className="m-3 rounded-[2.5rem] h-[50vh] p-7 text-white flex items-end"
        style={{ background: "linear-gradient(135deg,#FF4D8E,#ff99bb)" }}
      >
        <div>
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur">
            NEW • CLEAN BEAUTY
          </span>
          <h1 className="text-3xl font-black mt-4">جمالك الطبيعي يبدأ هنا</h1>
        </div>
      </div>
      <div className="px-4 grid grid-cols-2 gap-3 max-w-6xl mx-auto">
        {filteredProducts.map((p: CatalogProduct) => (
          <div key={p.id} className="bg-white rounded-[1.3rem] p-3 border">
            <img
              src={p.images[0]?.url}
              className="h-24 w-full object-cover rounded-xl bg-pink-50"
            />
            <p className="text-xs font-bold mt-2">{p.title}</p>
            <p className="text-sm font-black mt-1" style={{ color: "#FF4D8E" }}>
              {formatPrice(getPrice(p).price)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogView() {
  const [, setLocation] = useLocation();
  const themeQuery =
    trpc.templates?.settings?.useQuery?.() ?? ({ data: undefined } as any);
  const { addItem } = useCart();
  const productsQuery = trpc.products.publicList.useQuery();
  const [search, setSearch] = useState("");
  const customization = (themeQuery.data?.customization ?? {}) as any;
  const templateKey = themeQuery.data?.templateKey ?? "market-pro";
  const themeStyle = {
    "--store-primary": customization.primaryColor ?? "#0B5B43",
    "--store-accent": customization.accentColor ?? "#EEF3EC",
    fontFamily: customization.fontFamily || undefined,
  } as CSSProperties;
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const products = (productsQuery.data ?? []) as CatalogProduct[];
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map(product => product.collectionName || product.productType)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [products]
  );
  const availableProducts = useMemo(
    () => products.filter(isAvailable),
    [products]
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(product => {
        const category = product.collectionName || product.productType;
        const matchesCategory =
          selectedCategory === "الكل" || category === selectedCategory;
        const term = search.trim().toLocaleLowerCase("ar");
        return (
          matchesCategory &&
          (!term ||
            product.title.toLocaleLowerCase("ar").includes(term) ||
            product.description.toLocaleLowerCase("ar").includes(term))
        );
      }),
    [products, search, selectedCategory]
  );
  const heroProduct = availableProducts[0] ?? products[0];
  const featuredProducts = availableProducts.slice(0, 4);
  const addProduct = (product: CatalogProduct) => {
    if (!isAvailable(product)) return;
    const variant = product.variants.find(
      item =>
        item.available &&
        (item.stock > 0 || product.continueSelling || !product.trackInventory)
    );
    const { price, compareAtPrice } = getPrice(product);
    if (!price) return;
    addItem({
      productId: product.id,
      productKind: product.productKind,
      variantId: variant?.id,
      title: product.title,
      imageUrl: product.images[0]?.url,
      price,
      compareAtPrice: compareAtPrice ?? undefined,
      maxQuantity:
        product.trackInventory && !product.continueSelling
          ? (variant?.stock ?? product.inventory)
          : undefined,
    });
    toast.success(`أُضيف «${product.title}» إلى السلة.`);
  };

  if (productsQuery.isLoading) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center bg-white">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  // Render based on templateKey - market-pro is MAIN DEFAULT
  if (templateKey === "fashion-luxe") {
    return (
      <>
        <FashionLuxeTemplate
          products={products}
          filteredProducts={filteredProducts}
          addProduct={addProduct}
          customization={customization}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
        <ContentGuard productId={heroProduct?.id} />
        <ContactBar productId={heroProduct?.id} surface="store" />
        <MessageOrderWidget productId={heroProduct?.id} />
        <StoreFooter />
        <FloatingChatbot audience="buyer" />
      </>
    );
  }
  if (templateKey === "electro-hub") {
    return (
      <>
        <ElectroHubTemplate
          products={products}
          filteredProducts={filteredProducts}
          addProduct={addProduct}
          customization={customization}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
        <ContentGuard productId={heroProduct?.id} />
        <ContactBar productId={heroProduct?.id} surface="store" />
        <MessageOrderWidget productId={heroProduct?.id} />
        <StoreFooter />
        <FloatingChatbot audience="buyer" />
      </>
    );
  }
  if (templateKey === "beauty-glow") {
    return (
      <>
        <BeautyGlowTemplate
          products={products}
          filteredProducts={filteredProducts}
          addProduct={addProduct}
          customization={customization}
        />
        <ContentGuard productId={heroProduct?.id} />
        <ContactBar productId={heroProduct?.id} surface="store" />
        <MessageOrderWidget productId={heroProduct?.id} />
        <StoreFooter />
        <FloatingChatbot audience="buyer" />
      </>
    );
  }

  // DEFAULT MAIN TEMPLATE - market-pro
  return (
    <>
      <MarketProTemplate
        products={products}
        customization={customization}
        search={search}
        setSearch={setSearch}
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        filteredProducts={filteredProducts}
        addProduct={addProduct}
        heroProduct={heroProduct}
        featuredProducts={featuredProducts}
      />
      <ContentGuard productId={heroProduct?.id} />
      <ContactBar productId={heroProduct?.id} surface="store" />
      <MessageOrderWidget productId={heroProduct?.id} />
      <StoreFooter />
      <FloatingChatbot audience="buyer" />
    </>
  );
}

function CartView() {
  const [, setLocation] = useLocation();
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useCart();
  return (
    <div dir="rtl" className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-[.12em] text-[var(--warm)]">
              سلة المشتريات
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
              مشترياتك المختارة
            </h1>
          </div>
          <button
            onClick={() => setLocation("/store")}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand)]"
          >
            <ArrowRight className="size-4" />
            متابعة التسوق
          </button>
        </div>
        {items.length ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_350px]">
            <section className="overflow-hidden rounded-[26px] border border-[#E9E7DE] bg-white shadow-soft">
              {items.map((item, index) => (
                <div
                  key={item.lineId}
                  className={`flex gap-4 p-4 sm:gap-5 sm:p-5 ${index ? "border-t border-[#EFEDE6]" : ""}`}
                >
                  <div className="size-22 shrink-0 overflow-hidden rounded-2xl bg-[#F2F1EA]">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-[#9DB4A9]">
                        <ShoppingBag className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[var(--ink)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-[var(--brand)]">
                      {formatPrice(item.price)}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-xl border border-[#E5E3DA] bg-[#FAF9F5]">
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity - 1)
                          }
                          className="grid size-9 place-items-center text-[#66716B] transition hover:text-[var(--brand)]"
                          aria-label={`تقليل كمية ${item.title}`}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-extrabold text-[#2E3833]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.lineId, item.quantity + 1)
                          }
                          className="grid size-9 place-items-center text-[#66716B] transition hover:text-[var(--brand)]"
                          aria-label={`زيادة كمية ${item.title}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.lineId)}
                        className="grid size-9 place-items-center rounded-lg text-[#9AA49E] transition hover:bg-[#FCE8E4] hover:text-[#C0492F]"
                        aria-label={`حذف ${item.title}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
            <aside className="h-fit rounded-[26px] border border-[#DDE8E1] bg-[var(--brand-soft)] p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-[var(--ink)]">
                ملخص السلة
              </h2>
              <div className="mt-6 flex justify-between border-b border-[#D3E2D9] pb-4 text-sm font-semibold text-[#55605A]">
                <span>المنتجات ({itemCount})</span>
                <span>{formatPrice(String(subtotal))}</span>
              </div>
              <div className="mt-4 flex justify-between text-base font-extrabold text-[var(--brand-strong)]">
                <span>المجموع</span>
                <span>{formatPrice(String(subtotal))}</span>
              </div>
              <button
                onClick={() => setLocation("/store/checkout")}
                className="btn-press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-white shadow-cta"
              >
                مراجعة الطلب
                <ArrowLeft className="size-4" />
              </button>
              <p className="mt-4 flex gap-2 text-xs leading-5 text-[#66716B]">
                <Banknote className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" />
                الدفع عند الاستلام — لا تدفع شيئًا الآن، فقط أكمل بياناتك في
                الخطوة التالية.
              </p>
            </aside>
          </div>
        ) : (
          <section className="mt-8 grid min-h-80 place-items-center rounded-[28px] border border-dashed border-[#D8D5C9] bg-white p-8 text-center">
            <div className="animate-fade-up">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <ShoppingCart className="size-7" />
              </div>
              <h2 className="mt-5 text-xl font-extrabold text-[var(--ink)]">
                سلتك فارغة
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#79837D]">
                ابدأ بتصفح المنتجات وأضف ما يناسبك — الدفع عند الاستلام.
              </p>
              <button
                onClick={() => setLocation("/store")}
                className="btn-press mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white shadow-cta"
              >
                اكتشف المنتجات
                <ArrowLeft className="size-4" />
              </button>
            </div>
          </section>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}

export default function Storefront({
  view = "catalog",
}: {
  view?: StorefrontView;
}) {
  if (view === "cart")
    return (
      <>
        <CartView />
        <FloatingChatbot audience="buyer" />
      </>
    );
  if (view === "checkout")
    return (
      <>
        <Checkout />
        <FloatingChatbot audience="buyer" />
      </>
    );
  return (
    <>
      <CatalogView />
    </>
  );
}
