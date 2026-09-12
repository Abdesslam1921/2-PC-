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

type CartContextValue = {
  items: StoreCartItem[];
  isOpen: boolean;
  loading: boolean;
  itemCount: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: AddStoreCartItem, quantity?: number) => void;
  updateQuantity: (
    lineId: string,
    quantity: number,
    maxQuantity?: number
  ) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StoreCartItem[]>(() => readStoredCart());
  const [isOpen, setIsOpen] = useState(false);
  const liveProducts = trpc.products.publicList.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  );
  const persist = useCallback((next: StoreCartItem[]) => {
    setItems(next);
    writeStoredCart(next);
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

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isOpen,
      loading: liveProducts.isFetching,
      itemCount,
      subtotal,
      openCart,
      closeCart,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      items,
      isOpen,
      liveProducts.isFetching,
      itemCount,
      subtotal,
      openCart,
      closeCart,
      addItem,
      updateQuantity,
      removeItem,
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
