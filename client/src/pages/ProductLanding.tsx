import { BrandLockup } from "@/components/BrandLockup";
import FloatingChatbot from "@/components/FloatingChatbot";
import { ContactBar } from "@/components/ContactBar";
import { ContentGuard } from "@/components/ContentGuard";
import { MessageOrderWidget } from "@/components/MessageOrderWidget";
import {
  CheckoutUpsellPopup,
  useUpsellOffer,
} from "@/components/CheckoutUpsellPopup";
import {
  DirectCodOrderForm,
  StickyCodCta,
} from "@/components/DirectCodOrderForm";
import { DigitalOrderForm } from "@/components/DigitalOrderForm";
import { SharkCodExitPopup } from "@/components/SharkCodExitPopup";
import { trpc } from "@/lib/trpc";
import { useOptionalCart } from "@/contexts/CartContext";
import {
  ArrowRight,
  Banknote,
  ChevronDown,
  Download,
  Loader2,
  PhoneCall,
  Quote,
  RotateCcw,
  ShoppingBag,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import type { SharkCodExitPopupHandle } from "@/components/SharkCodExitPopup";

const formatPrice = (value: string | null | undefined, currency = "DZD") =>
  value
    ? `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(Number(value))} ${currency === "EUR" ? "€" : currency === "USD" ? "$" : "دج"}`
    : "السعر غير محدد";

export default function ProductLanding() {
  const [, params] = useRoute("/p/:id");
  const [, setLocation] = useLocation();
  const cart = useOptionalCart();
  const addItem = cart?.addItem ?? (() => undefined);
  const id = Number(params?.id);
  const productQuery = trpc.products.publicGet.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<
    number | undefined
  >();
  const [selectedOfferId, setSelectedOfferId] = useState<number | undefined>();
  const [sharkDiscount, setSharkDiscount] = useState(0);
  const [showUpsellPopup, setShowUpsellPopup] = useState(false);
  const [acceptedUpsell, setAcceptedUpsell] = useState<boolean | null>(null);
  const upsellResumeRef = useRef(false);
  const [resumeSubmitToken, setResumeSubmitToken] = useState(0);
  const exitPopupRef = useRef<SharkCodExitPopupHandle | null>(null);
  const product = productQuery.data;
  const upsellProductQuery = trpc.products.publicGet.useQuery(
    { id: product?.upsellProductId ?? 0 },
    { enabled: Boolean(product?.upsellProductId) }
  );
  const upsellProduct = upsellProductQuery.data;
  const availableVariants = useMemo(
    () =>
      product?.variants.filter(
        variant =>
          variant.available &&
          (variant.stock > 0 ||
            product.continueSelling ||
            !product.trackInventory)
      ) ?? [],
    [product]
  );
  const selectedVariant =
    availableVariants.find(variant => variant.id === selectedVariantId) ??
    availableVariants[0];
  const price = product ? (selectedVariant?.price ?? product.price) : null;
  const activeOffers = useMemo(
    () =>
      product?.offers?.filter(
        offer =>
          offer.enabled &&
          (offer.maxUses === 0 || offer.usedCount < offer.maxUses)
      ) ?? [],
    [product]
  );
  // Same pieces without the offer → the struck-through price + the saving.
  const offerTiers = useMemo(
    () =>
      activeOffers.map(offer => ({
        ...offer,
        compareAtPrice:
          price != null ? String(Number(price) * offer.quantity) : null,
      })),
    [activeOffers, price]
  );
  const selectedOffer = activeOffers.find(
    offer => offer.id === selectedOfferId
  );
  const purchasePrice = selectedOffer?.price ?? price;
  const offerRemaining = selectedOffer
    ? selectedOffer.maxUses === 0
      ? 50
      : Math.max(1, selectedOffer.maxUses - selectedOffer.usedCount)
    : undefined;
  const compareAtPrice = product
    ? (selectedVariant?.compareAtPrice ?? product.compareAtPrice)
    : null;
  const available = product
    ? product.continueSelling ||
      !product.trackInventory ||
      (product.variants.length
        ? availableVariants.length > 0
        : product.inventory > 0)
    : false;
  const selectedImage = product
    ? (product.images[imageIndex] ?? product.images[0])
    : undefined;
  const discount =
    compareAtPrice && price && Number(compareAtPrice) > Number(price)
      ? Math.round(
          ((Number(compareAtPrice) - Number(price)) / Number(compareAtPrice)) *
            100
        )
      : null;
  const maxQuantity =
    product && product.trackInventory && !product.continueSelling
      ? (selectedVariant?.stock ?? product.inventory)
      : 50;
  const isDigital = product?.productKind === "digital";
  const addSelectedToCart = () => {
    if (!product || !purchasePrice) return;
    addItem({
      productId: product.id,
      productKind: product.productKind,
      variantId: selectedVariant?.id,
      title: product.title,
      imageUrl: selectedImage?.url ?? product.images[0]?.url,
      price: purchasePrice,
      compareAtPrice: selectedOffer
        ? (product.price ?? undefined)
        : (compareAtPrice ?? undefined),
      offerId: selectedOffer?.id,
      offerDescription: selectedOffer?.description,
      offerQuantity: selectedOffer?.quantity,
      offerMaxUses: selectedOffer?.maxUses,
      offerUsedCount: selectedOffer?.usedCount,
      freeDelivery: selectedOffer?.freeDelivery,
      maxQuantity: offerRemaining ?? maxQuantity,
    });
  };
  const upsellOffer = useUpsellOffer(
    upsellProduct ?? null,
    product?.upsellPrice,
    product?.upsellDiscountAmount,
    product?.upsellDiscountPercent
  );
  const hasUpsell =
    Boolean(product?.upsellProductId) &&
    Boolean(upsellOffer) &&
    product?.productKind !== "digital";
  const upsellLine =
    acceptedUpsell === true && upsellProduct && upsellOffer
      ? {
          productId: product!.upsellProductId!,
          priceOverride: upsellOffer.priceOverride,
          title: upsellProduct.title,
          imageUrl: upsellProduct.images?.[0]?.url,
        }
      : undefined;
  const handleOrderNowClick = () => {
    if (hasUpsell && acceptedUpsell === null) {
      setShowUpsellPopup(true);
      return;
    }
    document
      .getElementById("product-order-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (productQuery.isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--paper)]">
        <Loader2 className="size-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  if (!product)
    return (
      <div
        dir="rtl"
        className="grid min-h-screen place-items-center bg-[var(--paper)] p-6 text-center"
      >
        <div className="animate-fade-up">
          <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--brand-soft)] text-[var(--brand)]">
            <ShoppingBag className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-[var(--ink)]">
            هذا المنتج لم يعد متاحًا
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#6F7A74]">
            ربما حُذف من الكتالوج أو توقف بيعه. تصفح بقية منتجات المتجر.
          </p>
          <button
            onClick={() => setLocation("/store")}
            className="btn-press mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white shadow-cta"
          >
            تصفح المتجر
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--paper)] pb-24 text-[var(--ink)]"
    >
      <div className="bg-[var(--brand-strong)] px-4 py-2.5 text-center text-[11px] font-bold tracking-wide text-white sm:text-xs">
        {isDigital
          ? "منتج رقمي · رابط تنزيل آمن بعد تأكيد الدفع"
          : "الدفع عند الاستلام · أكمل بياناتك لتأكيد الطلب"}
      </div>
      <header className="sticky top-0 z-30 border-b border-[#EAE8E0] bg-[color-mix(in_oklab,white_84%,transparent)] px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button onClick={() => setLocation("/store")} className="shrink-0">
            <BrandLockup />
          </button>
          <button
            onClick={() => setLocation("/store")}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold text-[#5B6660] hover:bg-[#F1EFE8]"
          >
            <ArrowRight className="size-4" />
            العودة للمتجر
          </button>
        </div>
      </header>
      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_8%,rgba(11,91,67,.09),transparent_30%),radial-gradient(circle_at_6%_78%,rgba(222,124,42,.10),transparent_28%)]" />
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,.98fr)] lg:gap-12">
            <div>
              <div className="relative overflow-hidden rounded-[28px] bg-[#EFEDE5] shadow-soft">
                {selectedImage ? (
                  <img
                    src={selectedImage.url}
                    alt={product.title}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square place-items-center text-[#9DB4A9]">
                    <ShoppingBag className="size-16" />
                  </div>
                )}
                {discount && (
                  <span className="absolute right-4 top-4 rounded-full bg-[var(--warm)] px-3 py-1.5 text-xs font-extrabold text-white shadow-warm">
                    خصم {discount}%
                  </span>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="sections-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
                  {product.images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setImageIndex(index)}
                      className={`size-18 shrink-0 overflow-hidden rounded-2xl border-2 transition duration-200 ${index === imageIndex ? "border-[var(--brand)]" : "border-transparent opacity-70 hover:opacity-100"}`}
                    >
                      <img
                        src={image.url}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="lg:pt-2">
              {(product.collectionName || product.productType) && (
                <p className="text-xs font-extrabold tracking-[.1em] text-[var(--warm)]">
                  {product.collectionName || product.productType}
                </p>
              )}
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-.03em] text-[var(--ink)] sm:text-4xl">
                {product.title}
              </h1>
              <div className="mt-5 flex items-end gap-3">
                <p className="text-3xl font-extrabold text-[var(--brand)]">
                  {formatPrice(purchasePrice, product.currency)}
                </p>
                {compareAtPrice && Number(compareAtPrice) > Number(price) && (
                  <p className="pb-1 text-base font-bold text-[#9AA49E] line-through">
                    {formatPrice(
                      selectedOffer ? price : compareAtPrice,
                      product.currency
                    )}
                  </p>
                )}
              </div>
              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${available ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F1EFE9] text-[#8A938D]"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${available ? "bg-[#1FA36B]" : "bg-[#AEB7B1]"}`}
                />
                {available ? "متوفر — اطلبه الآن" : "غير متوفر حاليًا"}
              </div>
              {(() => {
                const remaining = selectedVariant
                  ? selectedVariant.stock
                  : product.inventory;
                const threshold = selectedVariant
                  ? selectedVariant.showStockThreshold
                  : product.showStockThreshold;
                const shouldShow =
                  remaining > 0 &&
                  threshold > 0 &&
                  remaining <= threshold;
                if (!shouldShow) return null;
                return (
                  <p className="mt-2 text-xs font-bold text-[var(--warm)]">
                    الكمية المتبقية: {remaining}
                  </p>
                );
              })()}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {(isDigital
                  ? [
                      { icon: Download, label: "تسليم رقمي آمن" },
                      { icon: ShieldCheck, label: "دفع مؤكد من المتجر" },
                      { icon: PhoneCall, label: "دعم بعد الشراء" },
                    ]
                  : [
                      { icon: Banknote, label: "الدفع عند الاستلام" },
                      { icon: Truck, label: "توصيل لـ 58 ولاية" },
                      { icon: RotateCcw, label: "ضمان الاسترجاع" },
                    ]
                ).map(item => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-[#E8E6DD] bg-white px-2 py-3 text-center shadow-soft"
                  >
                    <item.icon className="size-5 text-[var(--brand)]" />
                    <span className="text-[11px] font-extrabold leading-4 text-[#3D4742]">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              {available && purchasePrice && (
                <button
                  type="button"
                  onClick={handleOrderNowClick}
                  className="btn-press animate-cta-pulse mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-white lg:hidden"
                >
                  <Banknote className="size-4" />
                  اطلب الآن — الدفع عند الاستلام
                </button>
              )}
              {availableVariants.length > 0 && (
                <div className="mt-7">
                  <p className="text-sm font-extrabold text-[#2E3833]">
                    الخيارات المتاحة
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableVariants.map(variant => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`btn-press rounded-xl border px-3.5 py-2 text-xs font-extrabold ${selectedVariant?.id === variant.id ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[#E5E3DA] bg-white text-[#5B6660] hover:border-[#B9CFC3]"}`}
                      >
                        {[variant.color, variant.size]
                          .filter(Boolean)
                          .join(" · ") || "الخيار الأساسي"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-8">
                {" "}
                {available && purchasePrice ? (
                  <>
                    {!isDigital && (
                      <button
                        type="button"
                        onClick={addSelectedToCart}
                        className="btn-press mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#C9DCCF] bg-[var(--brand-soft)] text-sm font-extrabold text-[var(--brand)] hover:bg-[#DFEEE5]"
                      >
                        <ShoppingCart className="size-4" />
                        {selectedOffer
                          ? `إضافة ${selectedOffer.description} إلى السلة`
                          : "إضافة إلى السلة"}
                      </button>
                    )}
                    {isDigital ? (
                      <DigitalOrderForm
                        productId={product.id}
                        productTitle={product.title}
                        price={formatPrice(purchasePrice, product.currency)}
                        productImageUrl={
                          selectedImage?.url ?? product.images[0]?.url
                        }
                        onOrderSuccess={() =>
                          exitPopupRef.current?.deactivate()
                        }
                      />
                    ) : (
                      <DirectCodOrderForm
                        formId="product-order-form"
                        productId={product.id}
                        variantId={selectedVariant?.id}
                        offerId={selectedOffer?.id}
                        productTitle={product.title}
                        price={purchasePrice}
                        productImageUrl={
                          selectedImage?.url ?? product.images[0]?.url
                        }
                        maxQuantity={offerRemaining ?? maxQuantity}
                        offerTiers={offerTiers}
                        onSelectOffer={setSelectedOfferId}
                        productFreeDelivery={Boolean(product.freeDelivery)}
                        discountPercent={sharkDiscount || undefined}
                        upsellLine={upsellLine}
                        onOrderSuccess={() =>
                          exitPopupRef.current?.deactivate()
                        }
                        upsellDecisionRequired={
                          hasUpsell && acceptedUpsell === null
                        }
                        onRequestUpsellDecision={() => {
                          upsellResumeRef.current = true;
                          setShowUpsellPopup(true);
                        }}
                        resumeSubmitToken={resumeSubmitToken}
                      />
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl bg-[#F1EFE9] p-5 text-sm font-bold text-[#8A938D]">
                    هذا المنتج غير متاح للطلب حاليًا.
                  </div>
                )}
              </div>
              <div className="mt-8 grid gap-3 border-t border-[#E9E7DE] pt-6 sm:grid-cols-2">
                <div className="flex gap-3 rounded-2xl bg-[#F4F3EC] p-3 text-xs leading-5 text-[#66716B]">
                  <ShieldCheck className="size-4 shrink-0 text-[var(--brand)]" />
                  السعر والتوفر مرتبطان بكتالوج المتجر.
                </div>
                <div className="flex gap-3 rounded-2xl bg-[#F4F3EC] p-3 text-xs leading-5 text-[#66716B]">
                  {isDigital ? (
                    <>
                      <Download className="size-4 shrink-0 text-[var(--brand)]" />
                      لا يحتاج المنتج الرقمي إلى عنوان أو معلومات توصيل.
                    </>
                  ) : (
                    <>
                      <Truck className="size-4 shrink-0 text-[var(--brand)]" />
                      سيتم تأكيد التوصيل عبر رقم الهاتف المسجل.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {product.description && (
          <section className="mx-auto max-w-7xl px-4 pb-2 sm:px-6">
            <div className="rounded-[24px] border border-[#E9E7DE] bg-white p-5 shadow-soft sm:p-7">
              <h2 className="text-base font-extrabold text-[var(--ink)]">
                عن المنتج
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-[#66716B]">
                {product.description}
              </p>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-extrabold tracking-[.12em] text-[var(--warm)]">
              لماذا تطلب من عبدو ستور؟
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
              اطلب وأنت مرتاح
            </h2>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(isDigital
              ? [
                  {
                    icon: Download,
                    title: "تسليم رقمي آمن",
                    text: "رابط تنزيل مؤقت ومشفر يُرسل بعد تأكيد الدفع من المتجر.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "طلب موثّق",
                    text: "كل طلب يُسجل برقم تتبع ويُراجع من فريق المتجر قبل التفعيل.",
                  },
                  {
                    icon: PhoneCall,
                    title: "دعم بعد الشراء",
                    text: "فريقنا متاح للإجابة عن استفساراتك حول الملف والتنزيل.",
                  },
                  {
                    icon: RotateCcw,
                    title: "مراجعة عادلة",
                    text: "إن واجهت مشكلة في الملف، تواصل معنا وسنعالج الأمر معك.",
                  },
                ]
              : [
                  {
                    icon: Banknote,
                    title: "الدفع عند الاستلام",
                    text: "لا تحتاج بطاقة بنكية — افحص طلبك وادفع نقدًا عند التسليم.",
                  },
                  {
                    icon: Truck,
                    title: "توصيل لـ 58 ولاية",
                    text: "نوصل لجميع ولايات الوطن، مع تأكيد هاتفي قبل إرسال الطلب.",
                  },
                  {
                    icon: RotateCcw,
                    title: "ضمان الاسترجاع",
                    text: "إن وصلك منتج مخالف للوصف، تواصل معنا ونضمن حقك.",
                  },
                  {
                    icon: PhoneCall,
                    title: "تأكيد ومتابعة",
                    text: "نتصل بك لتأكيد الطلب ونبقيك على اطلاع حتى التسليم.",
                  },
                ]
            ).map(item => (
              <div
                key={item.title}
                className="rounded-[22px] border border-[#E9E7DE] bg-white p-4 shadow-soft sm:p-5"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <item.icon className="size-5" />
                </div>
                <p className="mt-3 text-sm font-extrabold text-[var(--ink)]">
                  {item.title}
                </p>
                <p className="mt-1.5 text-xs leading-6 text-[#66716B]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <TestimonialsSection isDigital={isDigital} />
      <FaqSection isDigital={isDigital} />
      <footer className="border-t border-[#E7E5DC] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
          <BrandLockup />
          <p className="max-w-md text-xs leading-6 text-[#79837D]">
            متجر عربي مستقل — الدفع عند الاستلام، وتوصيل لكل ولايات الوطن.
          </p>
          <p className="text-[11px] font-medium text-[#9AA49E]">
            © {new Date().getFullYear()} عبدو ستور. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
      <ContentGuard productId={product.id} />
      {available && price && !isDigital && (
        <StickyCodCta
          targetId="product-order-form"
          onClick={handleOrderNowClick}
        />
      )}
      <ContactBar productId={product.id} surface="product" />
      <MessageOrderWidget productId={product.id} />
      <SharkCodExitPopup
        ref={exitPopupRef}
        productId={product.id}
        onApplyDiscount={setSharkDiscount}
      />
      {showUpsellPopup && (
        <CheckoutUpsellPopup
          product={
            upsellProduct
              ? {
                  id: upsellProduct.id,
                  title: upsellProduct.title,
                  price: upsellProduct.price ?? null,
                  compareAtPrice: upsellProduct.compareAtPrice ?? null,
                  description: upsellProduct.description ?? null,
                  images:
                    upsellProduct.images?.map(image => ({
                      id: image.id,
                      url: image.url,
                      altText: image.altText ?? null,
                    })) ?? [],
                }
              : null
          }
          upsellPrice={product?.upsellPrice ?? null}
          upsellDiscountAmount={product?.upsellDiscountAmount ?? null}
          upsellDiscountPercent={product?.upsellDiscountPercent ?? null}
          viewType={product?.upsellViewType ?? "product"}
          landingPageId={product?.upsellLandingPageId ?? null}
          currency={product?.currency ?? "DZD"}
          onAccept={() => {
            setAcceptedUpsell(true);
            setShowUpsellPopup(false);
            addItem({
              productId: product!.upsellProductId!,
              productKind: "physical",
              title: upsellProduct?.title ?? "",
              imageUrl: upsellProduct?.images?.[0]?.url,
              price: upsellOffer?.priceOverride ?? "0.00",
              maxQuantity: 1,
            });
            if (upsellResumeRef.current) {
              upsellResumeRef.current = false;
              setResumeSubmitToken(token => token + 1);
            } else {
              document
                .getElementById("product-order-form")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          onDecline={() => {
            setAcceptedUpsell(false);
            setShowUpsellPopup(false);
            if (upsellResumeRef.current) {
              upsellResumeRef.current = false;
              setResumeSubmitToken(token => token + 1);
            } else {
              document
                .getElementById("product-order-form")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />
      )}
      <FloatingChatbot audience="buyer" />
    </div>
  );
}

function TestimonialsSection({ isDigital }: { isDigital: boolean }) {
  const testimonials = isDigital
    ? [
        {
          name: "أمينة ب.",
          place: "الجزائر العاصمة",
          text: "وصلني رابط التنزيل بعد تأكيد الدفع مباشرة، والملف كامل كما في الوصف.",
          initial: "أ",
        },
        {
          name: "يوسف م.",
          place: "وهران",
          text: "تواصلوا معي قبل تفعيل الرابط للتأكد من بريدي. تعامل محترف وواضح.",
          initial: "ي",
        },
        {
          name: "خديجة س.",
          place: "قسنطينة",
          text: "أول تجربة شراء رقمي لي، والخطوات كانت بسيطة ومفهومة من أول مرة.",
          initial: "خ",
        },
      ]
    : [
        {
          name: "أمينة ب.",
          place: "الجزائر العاصمة",
          text: "وصلني الطلب خلال يومين، ودفعت نقدًا عند الاستلام كما هو مكتوب تمامًا.",
          initial: "أ",
        },
        {
          name: "يوسف م.",
          place: "وهران",
          text: "اتصلوا بي للتأكيد قبل الإرسال، والمنتج مطابق للوصف والصور.",
          initial: "ي",
        },
        {
          name: "خديجة س.",
          place: "قسنطينة",
          text: "أول مرة أطلب أونلاين بدون بطاقة بنكية. العملية بسيطة والتوصيل سريع.",
          initial: "خ",
        },
      ];
  return (
    <section className="border-y border-[#EDEBE3] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-extrabold tracking-[.12em] text-[var(--warm)]">
            آراء حقيقية
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
            ماذا قال عملاؤنا؟
          </h2>
        </div>
        <div className="mt-8 grid gap-3 sm:gap-4 md:grid-cols-3">
          {testimonials.map(item => (
            <figure
              key={item.name}
              className="relative rounded-[22px] border border-[#E9E7DE] bg-[var(--paper)] p-5 shadow-soft"
            >
              <Quote className="absolute left-4 top-4 size-5 text-[#DDE7E0]" />
              <div className="flex gap-0.5 text-[var(--warm)]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-7 text-[#4A554F]">
                {item.text}
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-[#EAE8E0] pt-4">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-soft)] text-sm font-extrabold text-[var(--brand)]">
                  {item.initial}
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-[var(--ink)]">
                    {item.name}
                  </span>
                  <span className="block text-xs font-semibold text-[#8A938D]">
                    {item.place}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ isDigital }: { isDigital: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqs = isDigital
    ? [
        {
          q: "كيف أستلم المنتج الرقمي؟",
          a: "بعد تسجيل طلبك وتأكيد الدفع من المتجر، يُنشأ رابط تنزيل آمن ومؤقت ويُرسل إلى بريدك الإلكتروني المسجل في الطلب.",
        },
        {
          q: "متى يُفعّل رابط التنزيل؟",
          a: "يُفعّل الرابط بعد مراجعة طلبك وتأكيد الدفع من فريق المتجر، وعادة خلال ساعات قليلة في أوقات العمل.",
        },
        {
          q: "هل رابط التنزيل دائم؟",
          a: "الرابط مؤقت وله عدد مرات تنزيل محددة يضبطها صاحب المتجر حمايةً للمحتوى، لذا احفظ الملف بعد تنزيله.",
        },
        {
          q: "ماذا أفعل إذا واجهت مشكلة في الملف؟",
          a: "تواصل معنا عبر زر المحادثة أو رقم المتجر مع ذكر رقم طلبك، وسنعالج المشكلة معك مباشرة.",
        },
      ]
    : [
        {
          q: "كيف أدفع قيمة الطلب؟",
          a: "الدفع نقدًا عند الاستلام — تفحص طلبك أمام عامل التوصيل ثم تدفع. لا نطلب أي بطاقة بنكية أو دفعًا مسبقًا.",
        },
        {
          q: "كم تستغرق مدة التوصيل؟",
          a: "عادة من 24 إلى 72 ساعة حسب ولايتك وطريقة التوصيل (للمنزل أو للمكتب). نؤكد الطلب هاتفيًا قبل الإرسال.",
        },
        {
          q: "هل يمكنني إرجاع المنتج؟",
          a: "نعم — إن وصلك منتج مخالف للوصف أو به عيب، تواصل معنا مع رقم الطلب ونضمن حقك في الاسترجاع وفق سياسة المتجر.",
        },
        {
          q: "هل تؤكدون الطلب قبل إرساله؟",
          a: "نعم، يتصل بك فريقنا على الرقم الذي سجلته في النموذج لتأكيد الطلب والعنوان، لذا تأكد من كتابة رقم صحيح.",
        },
        {
          q: "ما الفرق بين التوصيل للمنزل وللمكتب؟",
          a: "التوصيل للمنزل يصلك حتى عنوانك، بينما التوصيل للمكتب يكون عادة أسرع وأرخص — تستلم طلبك من أقرب مكتب لشركة التوصيل في ولايتك.",
        },
      ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-extrabold tracking-[.12em] text-[var(--warm)]">
          كل ما تحتاج معرفته
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-[var(--ink)]">
          أسئلة شائعة قبل الطلب
        </h2>
      </div>
      <div className="mt-8 space-y-2.5">
        {faqs.map((item, index) => {
          const open = openIndex === index;
          return (
            <div
              key={item.q}
              className={`overflow-hidden rounded-2xl border transition duration-200 ${open ? "border-[#CBDFD3] bg-white shadow-soft" : "border-[#E9E7DE] bg-white"}`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
              >
                <span className="text-sm font-extrabold text-[var(--ink)]">
                  {item.q}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-[var(--brand)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <p className="animate-fade-up border-t border-[#EFEDE6] px-5 py-4 text-sm leading-7 text-[#66716B]">
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-[#79837D]">
        <span className="inline-flex items-center gap-1.5">
          <Banknote className="size-4 text-[var(--brand)]" />
          الدفع عند الاستلام
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Truck className="size-4 text-[var(--brand)]" />
          توصيل لـ 58 ولاية
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-[var(--brand)]" />
          ضمان الاسترجاع
        </span>
      </div>
    </section>
  );
}
