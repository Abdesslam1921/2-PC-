import { trpc } from "@/lib/trpc";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CART_STORAGE_KEY = "abdou-store:cart";
const BUNDLES_STORAGE_KEY = "abdou-store:cart-bundles";

/**
 * An offer (bundle) applied in the cart.
 *
 * `unitAmount` is the discount of ONE bundle (computed by the server from the
 * products' prices) and `times` is how many times the bundle was added — the
 * discount is applied once per added bundle. The server recomputes everything
 * at checkout, so these values are display-only.
 */
export type StoreCartBundle = {
  offerId: number;
  name: string;
  unitAmount: number;
  freeDelivery: boolean;
  /** The bundle's products + quantities, used to detect an incomplete bundle. */
  items: Array<{ productId: number; quantity: number }>;
  times: number;
};

export type StoreCartItem = {
  lineId: string;
  productId: number;
  productKind?: "physical" | "digital";
  variantId?: number;
  title: string;
  imageUrl?: string;
  price: string;
  compareAtPrice?: string;
  offerId?: number;
  offerDescription?: string;
  offerQuantity?: number;
  offerMaxUses?: number;
  offerUsedCount?: number;
  freeDelivery?: boolean;
  maxQuantity?: number;
  quantity: number;
};

export type AddStoreCartItem = Omit<StoreCartItem, "lineId" | "quantity">;

function readStoredCart(): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCart(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  if (items.length)
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  else window.localStorage.removeItem(CART_STORAGE_KEY);
}

function readStoredBundles(): StoreCartBundle[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(BUNDLES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredBundles(bundles: StoreCartBundle[]) {
  if (typeof window === "undefined") return;
  if (bundles.length)
    window.localStorage.setItem(BUNDLES_STORAGE_KEY, JSON.stringify(bundles));
  else window.localStorage.removeItem(BUNDLES_STORAGE_KEY);
}

type CartContextValue = {
  items: StoreCartItem[];
  bundles: StoreCartBundle[];
  isOpen: boolean;
  loading: boolean;
  itemCount: number;
  subtotal: number;
  /** Discount of every applied bundle (display only; the server recomputes). */
  bundleDiscount: number;
  /** subtotal − bundleDiscount (delivery is added at checkout). */
  total: number;
  /** True when a bundle's products are no longer fully in the cart. */
  incompleteBundles: StoreCartBundle[];
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: AddStoreCartItem, quantity?: number) => void;
  updateQuantity: (
    lineId: string,
    quantity: number,
    maxQuantity?: number
  ) => void;
  removeItem: (lineId: string) => void;
  /** Applies a bundle (repeat calls increase `times`). */
  applyBundle: (bundle: Omit<StoreCartBundle, "times">) => void;
  removeBundle: (offerId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StoreCartItem[]>(() => readStoredCart());
  const [bundles, setBundles] = useState<StoreCartBundle[]>(() =>
    readStoredBundles()
  );
  const [isOpen, setIsOpen] = useState(false);
  const liveProducts = trpc.products.publicList.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  );
  const bundleDiscount = bundles.reduce(
    (total, bundle) => total + bundle.unitAmount * bundle.times,
    0
  );
  const total = Math.max(0, subtotal - bundleDiscount);
  /**
   * A bundle is incomplete when the cart no longer holds its products in the
   * required quantities. It is kept (never silently dropped) so the merchant's
   * message at checkout stays truthful.
   */
  const incompleteBundles = bundles.filter(bundle =>
    bundle.items.some(item => {
      const inCart = items
        .filter(line => line.productId === item.productId)
        .reduce((sum, line) => sum + line.quantity, 0);
      return inCart < item.quantity * bundle.times;
    })
  );
  const persist = useCallback((next: StoreCartItem[]) => {
    setItems(next);
    writeStoredCart(next);
  }, []);
  const persistBundles = useCallback((next: StoreCartBundle[]) => {
    setBundles(next);
    writeStoredBundles(next);
  }, []);

  useEffect(() => {
    if (!liveProducts.data) return;
    setItems(current => {
      const next = current.flatMap(item => {
        const product = liveProducts.data.find(
          candidate => candidate.id === item.productId
        );
        if (!product) return [];
        const variant = item.variantId
          ? product.variants.find(candidate => candidate.id === item.variantId)
          : undefined;
        const available =
          product.continueSelling ||
          !product.trackInventory ||
          (product.variants.length
            ? Boolean(variant?.available && variant.stock > 0)
            : product.inventory > 0);
        if (!available) return [];
        const selectedOffer = item.offerId
          ? product.offers?.find(candidate => candidate.id === item.offerId)
          : undefined;
        const offerAvailable =
          selectedOffer &&
          selectedOffer.enabled &&
          (selectedOffer.maxUses === 0 ||
            selectedOffer.usedCount < selectedOffer.maxUses);
        const maxQuantity = offerAvailable
          ? selectedOffer.maxUses === 0
            ? 50
            : Math.max(1, selectedOffer.maxUses - selectedOffer.usedCount)
          : product.trackInventory && !product.continueSelling
            ? (variant?.stock ?? product.inventory)
            : undefined;
        const price = offerAvailable
          ? selectedOffer.price
          : (variant?.price ?? product.price ?? item.price);
        const compareAtPrice = offerAvailable
          ? (product.price ?? item.compareAtPrice)
          : (variant?.compareAtPrice ??
            product.compareAtPrice ??
            item.compareAtPrice);
        return [
          {
            ...item,
            title: product.title,
            productKind: product.productKind,
            imageUrl: product.images[0]?.url ?? item.imageUrl,
            price,
            compareAtPrice: compareAtPrice ?? undefined,
            offerId: offerAvailable ? selectedOffer.id : undefined,
            offerDescription: offerAvailable
              ? selectedOffer.description
              : undefined,
            offerQuantity: offerAvailable ? selectedOffer.quantity : undefined,
            offerMaxUses: offerAvailable ? selectedOffer.maxUses : undefined,
            offerUsedCount: offerAvailable
              ? selectedOffer.usedCount
              : undefined,
            freeDelivery: offerAvailable
              ? selectedOffer.freeDelivery
              : undefined,
            maxQuantity,
            quantity: Math.min(item.quantity, maxQuantity ?? item.quantity),
          },
        ];
      });
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      writeStoredCart(next);
      return next;
    });
  }, [liveProducts.data]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (item: AddStoreCartItem, quantity: number = 1) => {
      setItems(current => {
        const existing = current.find(
          line =>
            line.productId === item.productId &&
            line.variantId === item.variantId &&
            line.offerId === item.offerId
        );
        const cap = item.maxQuantity ?? Number.POSITIVE_INFINITY;
        const next = existing
          ? current.map(line =>
              line.lineId === existing.lineId
                ? {
                    ...line,
                    ...item,
                    quantity: Math.min(line.quantity + quantity, cap),
                  }
                : line
            )
          : [
              ...current,
              {
                ...item,
                lineId: `${item.productId}-${item.variantId ?? "base"}${item.offerId ? `-${item.offerId}` : ""}`,
                quantity: Math.min(quantity, cap),
              },
            ];
        writeStoredCart(next);
        return next;
      });
      setIsOpen(true);
    },
    []
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number, maxQuantity?: number) => {
      const next =
        quantity <= 0
          ? items.filter(item => item.lineId !== lineId)
          : items.map(item => {
              if (item.lineId !== lineId) return item;
              const cap =
                maxQuantity ?? item.maxQuantity ?? Number.POSITIVE_INFINITY;
              return {
                ...item,
                maxQuantity: Number.isFinite(cap) ? cap : undefined,
                quantity: Math.min(quantity, cap),
              };
            });
      persist(next);
    },
    [items, persist]
  );

  const removeItem = useCallback(
    (lineId: string) => persist(items.filter(item => item.lineId !== lineId)),
    [items, persist]
  );

  /** Applying the same bundle again increases its `times` (discount × times). */
  const applyBundle = useCallback(
    (bundle: Omit<StoreCartBundle, "times">) => {
      setBundles(current => {
        const existing = current.find(item => item.offerId === bundle.offerId);
        const next = existing
          ? current.map(item =>
              item.offerId === bundle.offerId
                ? { ...item, ...bundle, times: item.times + 1 }
                : item
            )
          : [...current, { ...bundle, times: 1 }];
        writeStoredBundles(next);
        return next;
      });
      setIsOpen(true);
    },
    []
  );

  const removeBundle = useCallback(
    (offerId: number) =>
      persistBundles(bundles.filter(bundle => bundle.offerId !== offerId)),
    [bundles, persistBundles]
  );

  const clearCart = useCallback(() => {
    persist([]);
    persistBundles([]);
  }, [persist, persistBundles]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      bundles,
      isOpen,
      loading: liveProducts.isFetching,
      itemCount,
      subtotal,
      bundleDiscount,
      total,
      incompleteBundles,
      openCart,
      closeCart,
      addItem,
      updateQuantity,
      removeItem,
      applyBundle,
      removeBundle,
      clearCart,
    }),
    [
      items,
      bundles,
      isOpen,
      liveProducts.isFetching,
      itemCount,
      subtotal,
      bundleDiscount,
      total,
      incompleteBundles,
      openCart,
      closeCart,
      addItem,
      updateQuantity,
      removeItem,
      applyBundle,
      removeBundle,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function useOptionalCart() {
  return useContext(CartContext);
}
