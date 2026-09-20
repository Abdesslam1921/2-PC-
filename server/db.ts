import { createHash, randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import {
  abandonedOrders,
  categories,
  orderCleanEvents,
  orderCleanSettings,
  sharkCodEvents,
  sharkCodSettings,
  thankYouPopupSettings,
  contactBarSettings,
  contentGuardSettings,
  storeConnecteurPixels,
  storeConnecteurs,
  deliveryCarrierConnections,
  deliveryCarrierWilayaRates,
  deliverySettings,
  deliveryWilayaRates,
  callCenterAgents,
  InsertUser,
  landingAssets,
  landingGenerationJobs,
  landingPages,
  landingSections,
  storeDigitalDownloads,
  storeOrderItems,
  storeOrders,
  storeProductImages,
  storeProductOffers,
  storeProducts,
  storeProductVariants,
  storeThemeSettings,
  users,
  aiSettings,
  trackingRetargetSettings,
  trackingRetargetSends,
  messageOrderSettings,
  messageOrders,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  getEcotrackProviderCatalog,
  hhdDefaultRates,
  normalizeEcotrackHostname,
} from "./ecotrack-catalog";
import { decryptSecret, encryptSecret } from "./secureSecrets";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

type ProductImageInput = {
  clientId: string;
  storageKey: string;
  url: string;
  altText: string;
  position: number;
};

type ProductVariantInput = {
  color: string | null;
  size: string | null;
  sku: string | null;
  price: string | null;
  compareAtPrice: string | null;
  stock: number;
  lowStockThreshold: number;
  showStockThreshold: number;
  mediaId?: string;
  available: boolean;
};

type StoreProductOfferInput = {
  description: string;
  quantity: number;
  price: string;
  maxUses: number;
  freeDelivery: boolean;
  enabled: boolean;
};

type StoreProductInput = {
  title: string;
  description: string;
  productType: string | null;
  productKind?: "physical" | "digital";
  currency?: string;
  collectionName: string | null;
  /** One category per product (null = uncategorised). */
  categoryId?: number | null;
  digitalFileName?: string | null;
  digitalFileStorageKey?: string | null;
  digitalFileUrl?: string | null;
  digitalFileSize?: number | null;
  digitalFileMimeType?: string | null;
  digitalMaxDownloads?: number | null;
  digitalLinkValidityHours?: number | null;
  status: "draft" | "active";
  price: string | null;
  compareAtPrice: string | null;
  costPerItem: string | null;
  costAccountingMode: "per_item" | "stock_total";
  costQuantity: number;
  productCostTotal: string;
  packagingCostPerItem: string;
  packagingCostTotal: string;
  procurementDeliveryCostPerItem: string;
  procurementDeliveryCostTotal: string;
  returnCostPerOrder: string;
  returnDeliveryFree: boolean;
  costBatches: string;
  sku: string | null;
  inventory: number;
  lowStockThreshold: number;
  showStockThreshold: number;
  trackInventory: boolean;
  continueSelling: boolean;
  deliveryPricingMode: "fixed" | "carrier" | "manual";
  deliveryCarrierConnectionId: number | null;
  upsellProductId?: number | null;
  upsellPrice?: string | null;
  upsellDiscountAmount?: string | null;
  upsellDiscountPercent?: number | null;
  upsellViewType?: "product" | "landing" | null;
  upsellLandingPageId?: number | null;
  codTrustScore?: string | null;
  media: ProductImageInput[];
  variants: ProductVariantInput[];
  offers?: StoreProductOfferInput[];
  imageIdByClientId: Map<string, number>;
};

export async function createStoreProduct(
  ownerId: number,
  storeId: number,
  input: StoreProductInput
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  const created = await db.insert(storeProducts).values({
    ownerId,
    storeId,
    title: input.title,
    description: input.description,
    productType: input.productType,
    productKind: input.productKind ?? "physical",
    currency: input.currency ?? "DZD",
    collectionName: input.collectionName,
    digitalFileName: input.digitalFileName,
    digitalFileStorageKey: input.digitalFileStorageKey,
    digitalFileUrl: input.digitalFileUrl,
    digitalFileSize: input.digitalFileSize,
    digitalFileMimeType: input.digitalFileMimeType,
    digitalMaxDownloads: input.digitalMaxDownloads,
    digitalLinkValidityHours: input.digitalLinkValidityHours,
    status: input.status,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    costPerItem: input.costPerItem,
    sku: input.sku,
    inventory: input.inventory,
    lowStockThreshold: input.lowStockThreshold,
    showStockThreshold: input.showStockThreshold,
    trackInventory: input.trackInventory,
    continueSelling: input.continueSelling,
    deliveryPricingMode: input.deliveryPricingMode,
    deliveryCarrierConnectionId: input.deliveryCarrierConnectionId ?? null,
    upsellProductId: input.upsellProductId ?? null,
    upsellPrice: input.upsellPrice ?? null,
    upsellDiscountAmount: input.upsellDiscountAmount ?? null,
    upsellDiscountPercent: input.upsellDiscountPercent ?? null,
    upsellViewType: input.upsellViewType ?? "product",
    upsellLandingPageId: input.upsellLandingPageId ?? null,
    codTrustScore: input.codTrustScore ?? null,
    costAccountingMode: input.costAccountingMode,
    costQuantity: input.costQuantity,
    productCostTotal: input.productCostTotal,
    packagingCostPerItem: input.packagingCostPerItem,
    packagingCostTotal: input.packagingCostTotal,
    procurementDeliveryCostPerItem: input.procurementDeliveryCostPerItem,
    procurementDeliveryCostTotal: input.procurementDeliveryCostTotal,
    returnCostPerOrder: input.returnCostPerOrder,
    returnDeliveryFree: input.returnDeliveryFree,
    costBatches: input.costBatches,
  });
  const productId = Number(created[0]?.insertId);
  if (!productId) throw new Error("تعذر إنشاء المنتج.");

  if (input.media.length) {
    const imageResults = await db.insert(storeProductImages).values(
      input.media.map(image => ({
        productId,
        storageKey: image.storageKey,
        url: image.url,
        altText: image.altText,
        position: image.position,
      }))
    );
    const firstImageId = Number(imageResults[0]?.insertId);
    input.media.forEach((image, index) =>
      input.imageIdByClientId.set(image.clientId, firstImageId + index)
    );
  }

  if (input.offers?.length) {
    await db.insert(storeProductOffers).values(
      input.offers.map(offer => ({
        productId,
        description: offer.description,
        quantity: offer.quantity,
        price: offer.price,
        maxUses: offer.maxUses,
        freeDelivery: offer.freeDelivery,
        enabled: offer.enabled,
      }))
    );
  }

  if (input.variants.length) {
    await db.insert(storeProductVariants).values(
      input.variants.map(variant => ({
        productId,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      showStockThreshold: variant.showStockThreshold,
      imageId: variant.mediaId
          ? (input.imageIdByClientId.get(variant.mediaId) ?? null)
          : null,
        available: variant.available,
      }))
    );
  }

  const product = await getStoreProductById(storeId, productId);
  if (!product) throw new Error("تم إنشاء المنتج لكن تعذر تحميله.");
  return product;
}

export async function getStoreProductById(storeId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [product] = await db
    .select()
    .from(storeProducts)
    .where(and(eq(storeProducts.id, id), eq(storeProducts.storeId, storeId)))
    .limit(1);
  if (!product) return undefined;
  const [images, variants, offers] = await Promise.all([
    db
      .select()
      .from(storeProductImages)
      .where(eq(storeProductImages.productId, product.id))
      .orderBy(storeProductImages.position),
    db
      .select()
      .from(storeProductVariants)
      .where(eq(storeProductVariants.productId, product.id)),
    db
      .select()
      .from(storeProductOffers)
      .where(eq(storeProductOffers.productId, product.id))
      .orderBy(asc(storeProductOffers.quantity)),
  ]);
  return { ...product, images, variants, offers };
}

export async function listStoreProducts(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const products = await db
    .select()
    .from(storeProducts)
    .where(eq(storeProducts.storeId, storeId))
    .orderBy(desc(storeProducts.createdAt));
  return Promise.all(
    products.map(product => getStoreProductById(storeId, product.id))
  );
}

export async function getPublicStoreProduct(
  id: number,
  storeId?: number | null
) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = [
    eq(storeProducts.id, id),
    eq(storeProducts.status, "active"),
  ];
  // Tenant isolation: when a store context exists, a product from another
  // store must never resolve (prevents id-enumeration across tenants).
  if (storeId != null) conditions.push(eq(storeProducts.storeId, storeId));
  const [product] = await db
    .select()
    .from(storeProducts)
    .where(and(...conditions))
    .limit(1);
  if (!product) return undefined;
  const [images, variants, offers] = await Promise.all([
    db
      .select()
      .from(storeProductImages)
      .where(eq(storeProductImages.productId, product.id))
      .orderBy(storeProductImages.position),
    db
      .select()
      .from(storeProductVariants)
      .where(eq(storeProductVariants.productId, product.id)),
    db
      .select()
      .from(storeProductOffers)
      .where(
        and(
          eq(storeProductOffers.productId, product.id),
          eq(storeProductOffers.enabled, true),
          or(
            eq(storeProductOffers.maxUses, 0),
            lt(storeProductOffers.usedCount, storeProductOffers.maxUses)
          )
        )
      )
      .orderBy(asc(storeProductOffers.quantity)),
  ]);
  const {
    costPerItem: _costPerItem,
    costAccountingMode: _costAccountingMode,
    costQuantity: _costQuantity,
    productCostTotal: _productCostTotal,
    packagingCostPerItem: _packagingCostPerItem,
    packagingCostTotal: _packagingCostTotal,
    procurementDeliveryCostPerItem: _procurementDeliveryCostPerItem,
    procurementDeliveryCostTotal: _procurementDeliveryCostTotal,
    returnCostPerOrder: _returnCostPerOrder,
    returnDeliveryFree: _returnDeliveryFree,
    ...publicProduct
  } = product;
  return {
    ...publicProduct,
    digitalFileStorageKey: null,
    digitalFileUrl: null,
    offers,
    images,
    variants,
  };
}

export async function listPublicStoreProducts(storeId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  // Tenant isolation: without a resolved store there is no safe catalog to
  // return. Never fall back to "all active products across all stores".
  if (storeId == null) return [];
  const products = await db
    .select()
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.status, "active"),
        eq(storeProducts.storeId, storeId)
      )
    )
    .orderBy(desc(storeProducts.createdAt));
  return hydratePublicProducts(products, storeId);
}

/** Shared hydration so every public listing behaves identically. */
async function hydratePublicProducts(
  products: Array<typeof storeProducts.$inferSelect>,
  storeId: number
) {
  const hydrated = await Promise.all(
    products.map(product => getPublicStoreProduct(product.id, storeId))
  );
  return hydrated.filter((product): product is NonNullable<typeof product> =>
    Boolean(product)
  );
}

/* ---------------------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------------------- */

export async function listCategories(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(categories.sortOrder, categories.name);
}

/** Categories plus how many products are linked to each one. */
export async function listCategoriesWithCounts(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: sql<number>`count(${storeProducts.id})`,
      // The storefront only lists categories with at least one PUBLISHED
      // product, so the dashboard must show both numbers to explain itself.
      activeProductCount: sql<number>`sum(case when ${storeProducts.status} = 'active' then 1 else 0 end)`,
    })
    .from(categories)
    .leftJoin(storeProducts, eq(storeProducts.categoryId, categories.id))
    .where(eq(categories.storeId, storeId))
    .groupBy(
      categories.id,
      categories.name,
      categories.slug,
      categories.imageUrl,
      categories.sortOrder,
      categories.isActive
    )
    .orderBy(categories.sortOrder, categories.name);
  return rows.map(row => ({
    ...row,
    productCount: Number(row.productCount),
    activeProductCount: Number(row.activeProductCount ?? 0),
  }));
}

export async function getCategoryById(storeId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, id)))
    .limit(1);
  return row;
}

export async function createCategory(input: {
  ownerId: number;
  storeId: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  const [{ id }] = await db
    .insert(categories)
    .values({
      ownerId: input.ownerId,
      storeId: input.storeId,
      name: input.name,
      slug: input.slug,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .$returningId();
  return id;
}

export async function updateCategory(input: {
  storeId: number;
  id: number;
  patch: Partial<{
    name: string;
    slug: string;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  await db
    .update(categories)
    .set(input.patch)
    .where(and(eq(categories.storeId, input.storeId), eq(categories.id, input.id)));
}

/** Products linked to a category (used by the delete guard). */
export async function countCategoryProducts(storeId: number, categoryId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.storeId, storeId),
        eq(storeProducts.categoryId, categoryId)
      )
    );
  return Number(row?.count ?? 0);
}

export async function deleteCategory(storeId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  await db
    .delete(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, id)));
}

export async function setCategoryOrder(
  storeId: number,
  orderedIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(categories)
        .set({ sortOrder: index })
        .where(and(eq(categories.storeId, storeId), eq(categories.id, id)))
    )
  );
}

/**
 * Public categories of one store.
 *
 * Fail-closed exactly like `listPublicStoreProducts`: without a resolved store
 * there is no safe list to return, so it returns an empty array instead of
 * leaking every store's categories.
 *
 * Only categories that actually have at least one active product are listed, so
 * the storefront never shows a tile that leads to an empty page.
 */
export async function listPublicCategories(storeId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  if (storeId == null) return [];
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(
      and(
        eq(categories.storeId, storeId),
        eq(categories.isActive, true),
        sql`EXISTS (
          SELECT 1 FROM store_products p
           WHERE p.categoryId = ${categories.id}
             AND p.storeId = ${storeId}
             AND p.status = 'active'
        )`
      )
    )
    .orderBy(categories.sortOrder, categories.name);
}

/**
 * Replace the product set of one category (bulk, store-scoped).
 *
 * Products previously linked to this category but missing from the new list are
 * unlinked; listed products are (re)assigned. Only rows of the caller's store
 * can ever be touched.
 */
export async function setCategoryProducts(input: {
  storeId: number;
  categoryId: number;
  productIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  await db.transaction(async tx => {
    await tx
      .update(storeProducts)
      .set({ categoryId: null })
      .where(
        and(
          eq(storeProducts.storeId, input.storeId),
          eq(storeProducts.categoryId, input.categoryId)
        )
      );
    if (input.productIds.length) {
      await tx
        .update(storeProducts)
        .set({ categoryId: input.categoryId })
        .where(
          and(
            eq(storeProducts.storeId, input.storeId),
            inArray(storeProducts.id, input.productIds)
          )
        );
    }
  });
}

/**
 * One active category by slug inside a single store.
 *
 * Fail-closed: no resolved store, a missing slug or an inactive category all
 * resolve to `undefined` (never to another tenant's row).
 */
export async function getPublicCategoryBySlug(
  slug: string,
  storeId?: number | null
) {
  const db = await getDb();
  if (!db) return undefined;
  if (storeId == null) return undefined;
  const [row] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.storeId, storeId),
        eq(categories.slug, slug),
        eq(categories.isActive, true)
      )
    )
    .limit(1);
  return row;
}

/** Active products of one category, same hydration as every public list. */
export async function listPublicProductsByCategory(
  categoryId: number,
  storeId?: number | null
) {
  const db = await getDb();
  if (!db) return [];
  if (storeId == null) return [];
  const products = await db
    .select()
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.status, "active"),
        eq(storeProducts.storeId, storeId),
        eq(storeProducts.categoryId, categoryId)
      )
    )
    .orderBy(desc(storeProducts.createdAt));
  return hydratePublicProducts(products, storeId);
}

export async function getTodayWilayaOrderCount(productId: number, wilaya: string) {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [result] = await db
    .select({ count: sql<number>`count(distinct ${storeOrders.id})` })
    .from(storeOrders)
    .innerJoin(storeOrderItems, eq(storeOrderItems.orderId, storeOrders.id))
    .where(
      and(
        eq(storeOrderItems.productId, productId),
        eq(storeOrders.wilaya, wilaya),
        gte(storeOrders.createdAt, today)
      )
    );
  return Number(result?.count ?? 0);
}

export type LandingSettingsInput = {
  slug: string;
  delivery: string;
  payment: "cod";
  metaPixel?: string;
  tiktokPixel?: string;
  snapchatPixel?: string;
  thankYou?: string;
};

export type GeneratedSectionInput = {
  aidaStage: "attention" | "interest" | "desire" | "action";
  sectionType: string;
  eyebrow: string | null;
  headline: string;
  body: string;
  bullets: string[];
  ctaLabel: string | null;
  microCommitment: {
    question: string;
    options: string[];
    ctaLabel: string | null;
  } | null;
  visualBrief: string;
};

export type GeneratedSceneInput = {
  position: number;
  url: string;
  prompt: string;
};

export async function createLandingGeneration(
  storeId: number,
  product: NonNullable<Awaited<ReturnType<typeof getStoreProductById>>>,
  input: {
    pageLength: "short" | "medium" | "long";
    locale: string;
    settings: LandingSettingsInput;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const snapshot = {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images.map(image => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
    })),
    variants: product.variants.map(variant => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      price: variant.price,
      available: variant.available,
    })),
  };
  try {
    return await db.transaction(async tx => {
      const created = await tx.insert(landingPages).values({
        ownerId: product.ownerId,
        storeId,
        productId: product.id,
        slug: input.settings.slug,
        title: product.title,
        framework: "AIDA",
        pageLength: input.pageLength,
        locale: input.locale,
        status: "generating",
        settingsJson: JSON.stringify(input.settings),
        productSnapshotJson: JSON.stringify(snapshot),
      });
      const landingPageId = Number(created[0]?.insertId);
      if (!landingPageId) throw new Error("تعذر إنشاء مسودة صفحة الهبوط.");
      await tx.insert(landingGenerationJobs).values({
        landingPageId,
        status: "running",
        model: "gemini-3-flash-preview",
      });
      if (product.images.length)
        await tx.insert(landingAssets).values(
          product.images.map(image => ({
            landingPageId,
            kind: "original_product" as const,
            sourceUrl: image.url,
            storageKey: image.storageKey,
            prompt: "صورة المنتج الأصلية — لا تُغيّر",
          }))
        );
      return landingPageId;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate"))
      throw new Error("مسار الرابط مستخدم بالفعل. اختر مسارًا آخر.");
    throw error;
  }
}

export async function completeLandingGeneration(
  storeId: number,
  landingPageId: number,
  designSystem: Record<string, string>,
  sections: GeneratedSectionInput[],
  scenes: GeneratedSceneInput[],
  productImageUrl?: string
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.transaction(async tx => {
    const [page] = await tx
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId)
        )
      )
      .limit(1);
    if (!page) throw new Error("مسودة صفحة الهبوط غير موجودة.");
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const created = await tx.insert(landingSections).values({
        landingPageId,
        position: index,
        aidaStage: section.aidaStage,
        sectionType: section.sectionType,
        eyebrow: section.eyebrow,
        headline: section.headline,
        body: section.body,
        bulletsJson: JSON.stringify(section.bullets),
        ctaLabel: section.ctaLabel,
        microCommitmentJson: section.microCommitment
          ? JSON.stringify(section.microCommitment)
          : null,
        visualBrief: section.visualBrief,
        productImageUrl,
      });
      const landingSectionId = Number(created[0]?.insertId);
      const scene = scenes.find(asset => asset.position === index);
      if (landingSectionId && scene)
        await tx.insert(landingAssets).values({
          landingPageId,
          landingSectionId,
          kind: "composition",
          sourceUrl: scene.url,
          prompt: scene.prompt,
        });
    }
    await tx
      .update(landingPages)
      .set({
        status: "ready",
        designSystemJson: JSON.stringify(designSystem),
        generationError: null,
      })
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId)
        )
      );
    await tx
      .update(landingGenerationJobs)
      .set({ status: "completed", error: null })
      .where(eq(landingGenerationJobs.landingPageId, landingPageId));
  });
  return getLandingPageForOwner(storeId, landingPageId);
}

export async function replaceLandingScenes(
  storeId: number,
  landingPageId: number,
  scenes: GeneratedSceneInput[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.transaction(async tx => {
    const [page] = await tx
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId)
        )
      )
      .limit(1);
    if (!page) throw new Error("مسودة صفحة الهبوط غير موجودة.");
    const sections = await tx
      .select()
      .from(landingSections)
      .where(eq(landingSections.landingPageId, landingPageId))
      .orderBy(asc(landingSections.position));
    await tx
      .delete(landingAssets)
      .where(
        and(
          eq(landingAssets.landingPageId, landingPageId),
          eq(landingAssets.kind, "composition")
        )
      );
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const scene = scenes.find(asset => asset.position === index);
      if (scene)
        await tx.insert(landingAssets).values({
          landingPageId,
          landingSectionId: section.id,
          kind: "composition",
          sourceUrl: scene.url,
          prompt: scene.prompt,
        });
    }
    await tx
      .update(landingPages)
      .set({ status: "ready", generationError: null })
      .where(eq(landingPages.id, landingPageId));
  });
  return getLandingPageForOwner(storeId, landingPageId);
}

export async function failLandingGeneration(
  storeId: number,
  landingPageId: number,
  error: string
) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    const [page] = await tx
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId)
        )
      )
      .limit(1);
    if (!page) return;
    await tx
      .update(landingPages)
      .set({ status: "failed", generationError: error })
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId)
        )
      );
    await tx
      .update(landingGenerationJobs)
      .set({ status: "failed", error })
      .where(eq(landingGenerationJobs.landingPageId, landingPageId));
  });
}

export async function getLandingPageForOwner(
  storeId: number,
  landingPageId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const [page] = await db
    .select()
    .from(landingPages)
    .where(
      and(eq(landingPages.id, landingPageId), eq(landingPages.storeId, storeId))
    )
    .limit(1);
  if (!page) return undefined;
  const [sections, assets] = await Promise.all([
    db
      .select()
      .from(landingSections)
      .where(eq(landingSections.landingPageId, page.id))
      .orderBy(asc(landingSections.position)),
    db
      .select()
      .from(landingAssets)
      .where(eq(landingAssets.landingPageId, page.id)),
  ]);
  return { ...page, sections, assets };
}

export async function getLandingPagePublicPreview(landingPageId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [page] = await db
    .select()
    .from(landingPages)
    .where(
      and(
        eq(landingPages.id, landingPageId),
        isNotNull(landingPages.approvedAt)
      )
    )
    .limit(1);
  if (!page) return undefined;
  const [sections, assets] = await Promise.all([
    db
      .select()
      .from(landingSections)
      .where(eq(landingSections.landingPageId, page.id))
      .orderBy(asc(landingSections.position)),
    db
      .select()
      .from(landingAssets)
      .where(eq(landingAssets.landingPageId, page.id)),
  ]);
  return { ...page, sections, assets };
}

export async function discardLandingGeneration(
  storeId: number,
  landingPageId: number
) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    const [page] = await tx
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.storeId, storeId),
          isNull(landingPages.approvedAt)
        )
      )
      .limit(1);
    if (!page) return;
    await tx
      .delete(landingAssets)
      .where(eq(landingAssets.landingPageId, landingPageId));
    await tx
      .delete(landingSections)
      .where(eq(landingSections.landingPageId, landingPageId));
    await tx
      .delete(landingGenerationJobs)
      .where(eq(landingGenerationJobs.landingPageId, landingPageId));
    await tx.delete(landingPages).where(eq(landingPages.id, landingPageId));
  });
}

export async function listLandingPagesForOwner(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(landingPages)
    .where(
      and(eq(landingPages.storeId, storeId), isNotNull(landingPages.approvedAt))
    )
    .orderBy(desc(landingPages.approvedAt));
}

export async function approveLandingPage(
  storeId: number,
  landingPageId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  await db
    .update(landingPages)
    .set({ approvedAt: new Date() })
    .where(
      and(
        eq(landingPages.id, landingPageId),
        eq(landingPages.storeId, storeId),
        eq(landingPages.status, "ready")
      )
    );
  return getLandingPageForOwner(storeId, landingPageId);
}

type CodOrderLineInput = {
  productId: number;
  variantId?: number;
  offerId?: number;
  quantity: number;
  priceOverride?: string;
};

type CodOrderCustomerInput = {
  customerName: string;
  customerPhone: string;
  wilaya: string;
  wilayaCode?: string;
  municipality?: string;
  carrierMunicipality?: string;
  carrierConnectionId?: number;
  sessionId?: string;
  deliveryMethod: "office" | "home";
  address: string;
  notes?: string;
  landingPageId?: number;
  sharkCodDiscountPercent?: number;
  retargetDiscountPercent?: number;
  attributionSource?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaAdId?: string;
};

function toCents(value: string | null) {
  if (!value) return 0;
  const [whole, decimal = ""] = value.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
}

function fromCents(value: number) {
  return (value / 100).toFixed(2);
}

type CostSnapshot = {
  productCost: string;
  packagingCost: string;
  procurementDeliveryCost: string;
  returnCost: string;
  returnDeliveryFree: boolean;
};

function resolveCostSnapshot(
  product: typeof storeProducts.$inferSelect
): CostSnapshot {
  const parse = (value: unknown) => Number(value ?? 0) || 0;
  const baseQuantity = Math.max(1, product.costQuantity || 1);
  const batches = (() => {
    try {
      const parsed = JSON.parse(product.costBatches || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() as Array<{
    quantity?: number;
    productCostTotal?: string;
    packagingCostTotal?: string;
    procurementDeliveryCostTotal?: string;
  }>;
  const baseProductTotal =
    product.costAccountingMode === "stock_total"
      ? parse(product.productCostTotal)
      : parse(product.costPerItem) * baseQuantity;
  const basePackagingTotal =
    product.costAccountingMode === "stock_total"
      ? parse(product.packagingCostTotal)
      : parse(product.packagingCostPerItem) * baseQuantity;
  const baseProcurementTotal =
    product.costAccountingMode === "stock_total"
      ? parse(product.procurementDeliveryCostTotal)
      : parse(product.procurementDeliveryCostPerItem) * baseQuantity;
  const totals = batches.reduce<{
    quantity: number;
    product: number;
    packaging: number;
    procurement: number;
  }>(
    (acc, batch) => {
      const quantity = Math.max(1, Number(batch.quantity) || 1);
      acc.quantity += quantity;
      acc.product += parse(batch.productCostTotal);
      acc.packaging += parse(batch.packagingCostTotal);
      acc.procurement += parse(batch.procurementDeliveryCostTotal);
      return acc;
    },
    {
      quantity: baseQuantity,
      product: baseProductTotal,
      packaging: basePackagingTotal,
      procurement: baseProcurementTotal,
    }
  );
  return {
    productCost: (totals.product / totals.quantity).toFixed(2),
    packagingCost: (totals.packaging / totals.quantity).toFixed(2),
    procurementDeliveryCost: (totals.procurement / totals.quantity).toFixed(2),
    returnCost: product.returnCostPerOrder ?? "0.00",
    returnDeliveryFree: Boolean(product.returnDeliveryFree),
  };
}

export async function createCodOrder(
  customer: CodOrderCustomerInput,
  lines: CodOrderLineInput[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  return db.transaction(async tx => {
    let ownerId: number | undefined;
    let storeId: number | null | undefined;
    let subtotalCents = 0;
    const resolvedLines: Array<{
      product: typeof storeProducts.$inferSelect;
      variant?: typeof storeProductVariants.$inferSelect;
      quantity: number;
      unitPrice: string;
      variantLabel: string | null;
      offer?: typeof storeProductOffers.$inferSelect;
      inventoryQuantity: number;
      costSnapshot: CostSnapshot;
    }> = [];

    for (const line of lines) {
      const [product] = await tx
        .select()
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.id, line.productId),
            eq(storeProducts.status, "active")
          )
        )
        .limit(1);
      if (!product) throw new Error("أحد المنتجات لم يعد متاحًا للطلب.");
      if (ownerId === undefined) ownerId = product.ownerId;
      if (ownerId !== product.ownerId)
        throw new Error("لا يمكن جمع منتجات من متاجر مختلفة في طلب واحد.");
      if (storeId === undefined) storeId = product.storeId ?? null;
      if ((storeId ?? null) !== (product.storeId ?? null))
        throw new Error("لا يمكن جمع منتجات من متاجر مختلفة في طلب واحد.");

      let variant: typeof storeProductVariants.$inferSelect | undefined;
      let offer: typeof storeProductOffers.$inferSelect | undefined;
      if (line.offerId) {
        const [foundOffer] = await tx
          .select()
          .from(storeProductOffers)
          .where(
            and(
              eq(storeProductOffers.id, line.offerId),
              eq(storeProductOffers.productId, product.id),
              eq(storeProductOffers.enabled, true),
              or(
                eq(storeProductOffers.maxUses, 0),
                lt(storeProductOffers.usedCount, storeProductOffers.maxUses)
              )
            )
          )
          .limit(1);
        if (!foundOffer)
          throw new Error(
            `العرض المختار للمنتج «${product.title}» لم يعد متاحًا.`
          );
        offer = foundOffer;
      }
      if (line.variantId) {
        const [foundVariant] = await tx
          .select()
          .from(storeProductVariants)
          .where(
            and(
              eq(storeProductVariants.id, line.variantId),
              eq(storeProductVariants.productId, product.id)
            )
          )
          .limit(1);
        if (!foundVariant || !foundVariant.available)
          throw new Error(`الخيار المحدد للمنتج «${product.title}» غير متاح.`);
        variant = foundVariant;
      } else {
        const productVariants = await tx
          .select({ id: storeProductVariants.id })
          .from(storeProductVariants)
          .where(eq(storeProductVariants.productId, product.id));
        if (productVariants.length && !line.priceOverride)
          throw new Error(`اختر خيارًا متاحًا للمنتج «${product.title}».`);
      }

      const inventoryQuantity = offer
        ? offer.quantity * line.quantity
        : line.quantity;
      if (product.trackInventory && !product.continueSelling) {
        const remaining = variant ? variant.stock : product.inventory;
        if (remaining < inventoryQuantity)
          throw new Error(
            `الكمية المطلوبة من «${product.title}» غير متوفرة حاليًا.`
          );
      }

      const unitPrice =
        line.priceOverride ?? offer?.price ?? variant?.price ?? product.price;
      if (!unitPrice)
        throw new Error(`سعر المنتج «${product.title}» غير محدد.`);
      subtotalCents += toCents(unitPrice) * line.quantity;
      resolvedLines.push({
        product,
        variant,
        offer,
        quantity: line.quantity,
        inventoryQuantity,
        unitPrice,
        costSnapshot: resolveCostSnapshot(product),
        variantLabel: offer
          ? `العرض: ${offer.description}`
          : variant
            ? [variant.color, variant.size].filter(Boolean).join(" · ") || null
            : null,
      });
    }

    if (!ownerId || !resolvedLines.length)
      throw new Error("لا يمكن إنشاء طلب فارغ.");
    const pricingModes = new Set(
      resolvedLines.map(line => line.product.deliveryPricingMode)
    );
    if (pricingModes.size > 1)
      throw new Error(
        "لا يمكن جمع منتجات بمصادر أسعار توصيل مختلفة في طلب واحد."
      );
    if (customer.carrierConnectionId) {
      const [connection] = await tx
        .select({
          id: deliveryCarrierConnections.id,
          ownerId: deliveryCarrierConnections.ownerId,
          provider: deliveryCarrierConnections.provider,
          status: deliveryCarrierConnections.status,
        })
        .from(deliveryCarrierConnections)
        .where(eq(deliveryCarrierConnections.id, customer.carrierConnectionId))
        .limit(1);
      if (
        !connection ||
        connection.ownerId !== ownerId ||
        connection.provider !== "ecotrack" ||
        connection.status !== "connected"
      )
        throw new Error("شركة التوصيل المختارة غير متاحة.");
    }
    let sharkCodDiscountPercent = 0;
    if (
      customer.sharkCodDiscountPercent &&
      customer.sharkCodDiscountPercent > 0
    ) {
      const [shark] = await tx
        .select()
        .from(sharkCodSettings)
        .where(
          and(
            eq(sharkCodSettings.ownerId, ownerId),
            eq(sharkCodSettings.enabled, true)
          )
        )
        .limit(1);
      const targetMatches =
        shark &&
        (shark.targetMode === "all" ||
          (shark.targetMode === "product" &&
            shark.targetProductId === resolvedLines[0].product.id) ||
          (shark.targetMode === "landing" &&
            shark.targetLandingPageId === customer.landingPageId));
      if (
        targetMatches &&
        shark.discountPercent === customer.sharkCodDiscountPercent
      )
        sharkCodDiscountPercent = shark.discountPercent;
    }
    let retargetDiscountPercent = 0;
    if (
      customer.retargetDiscountPercent &&
      customer.retargetDiscountPercent > 0
    ) {
      const [retarget] = await tx
        .select()
        .from(trackingRetargetSettings)
        .where(
          and(
            eq(trackingRetargetSettings.ownerId, ownerId),
            eq(trackingRetargetSettings.enabled, true),
            eq(trackingRetargetSettings.retargetEnabled, true)
          )
        )
        .limit(1);
      const productMatch =
        retarget && retarget.retargetProductId === resolvedLines[0].product.id;
      const landingMatch =
        retarget &&
        (retarget.retargetTargetType !== "landing" ||
          retarget.retargetLandingPageId === customer.landingPageId ||
          !retarget.retargetLandingPageId);
      if (
        retarget &&
        productMatch &&
        landingMatch &&
        retarget.retargetDiscountPercent === customer.retargetDiscountPercent
      ) {
        retargetDiscountPercent = retarget.retargetDiscountPercent;
      }
    }
    const activeDiscountPercent = Math.max(
      sharkCodDiscountPercent,
      retargetDiscountPercent
    );
    const [settings] = await tx
      .select()
      .from(deliverySettings)
      .where(eq(deliverySettings.ownerId, ownerId))
      .limit(1);
    const [wilayaRate] = await tx
      .select()
      .from(deliveryWilayaRates)
      .where(
        and(
          eq(deliveryWilayaRates.ownerId, ownerId),
          eq(deliveryWilayaRates.wilayaName, customer.wilaya)
        )
      )
      .limit(1);
    const rateFee =
      customer.deliveryMethod === "office"
        ? wilayaRate?.officeEnabled
          ? wilayaRate.officeFee
          : null
        : wilayaRate?.homeEnabled
          ? wilayaRate.homeFee
          : null;
    const fixedFee =
      customer.deliveryMethod === "office"
        ? settings?.fixedOfficeEnabled
          ? settings.fixedOfficeFee
          : null
        : settings?.fixedHomeEnabled
          ? settings.fixedHomeFee
          : null;
    const freeDelivery =
      resolvedLines.length > 0 &&
      resolvedLines.every(line => Boolean(line.offer?.freeDelivery));
    const deliveryFee = freeDelivery ? "0.00" : (rateFee ?? fixedFee ?? "0.00");
    const temporaryNumber = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const discountCents = Math.round(
      (subtotalCents * activeDiscountPercent) / 100
    );
    const subtotal = fromCents(subtotalCents);
    const discountAmount = fromCents(discountCents);
    const total = fromCents(
      subtotalCents - discountCents + toCents(deliveryFee)
    );
    const created = await tx.insert(storeOrders).values({
      ownerId,
      storeId: storeId ?? null,
      orderNumber: temporaryNumber,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      wilaya: customer.wilaya,
      wilayaCode: customer.wilayaCode?.trim() || null,
      municipality: customer.municipality?.trim() || null,
      carrierMunicipality: customer.carrierMunicipality?.trim() || null,
      carrierConnectionId: customer.carrierConnectionId ?? null,
      deliveryMethod: customer.deliveryMethod,
      address: customer.address,
      notes: customer.notes?.trim() || null,
      paymentMethod: "cod",
      paymentStatus: "pending",
      fulfillmentStatus: "new",
      subtotal,
      discountAmount,
      deliveryFee,
      deliveryCostSnapshot: deliveryFee,
      total,
      attributionSource: customer.attributionSource?.trim() || null,
      fbclid: customer.fbclid?.trim() || null,
      utmSource: customer.utmSource?.trim() || null,
      utmMedium: customer.utmMedium?.trim() || null,
      utmCampaign: customer.utmCampaign?.trim() || null,
      utmContent: customer.utmContent?.trim() || null,
      utmTerm: customer.utmTerm?.trim() || null,
      metaCampaignId: customer.metaCampaignId?.trim() || null,
      metaAdSetId: customer.metaAdSetId?.trim() || null,
      metaAdId: customer.metaAdId?.trim() || null,
    });
    const orderId = Number(created[0]?.insertId);
    if (!orderId) throw new Error("تعذر حفظ الطلب.");
    const orderNumber = `ABD-${String(orderId).padStart(6, "0")}`;

    await tx
      .update(storeOrders)
      .set({ orderNumber })
      .where(eq(storeOrders.id, orderId));
    if (customer.sessionId && storeId != null)
      await tx
        .update(abandonedOrders)
        .set({ status: "converted" })
        .where(
          and(
            eq(abandonedOrders.storeId, storeId),
            eq(abandonedOrders.sessionId, customer.sessionId),
            eq(abandonedOrders.status, "open")
          )
        );
    if (retargetDiscountPercent > 0) {
      await tx.insert(trackingRetargetSends).values({
        ownerId,
        storeId: storeId ?? null,
        orderId,
        kind: "redeem",
        statusLabel: `${resolvedLines[0].product.title} · ${retargetDiscountPercent}%`,
        toPhone: customer.customerPhone,
        ok: true,
      });
    }

    await tx.insert(storeOrderItems).values(
      resolvedLines.map(line => ({
        orderId,
        productId: line.product.id,
        variantId: line.variant?.id ?? null,
        title: line.product.title,
        variantLabel: line.variantLabel,
        sku: line.variant?.sku ?? line.product.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: fromCents(toCents(line.unitPrice) * line.quantity),
        productCostSnapshot: line.costSnapshot.productCost,
        packagingCostSnapshot: line.costSnapshot.packagingCost,
        procurementDeliveryCostSnapshot:
          line.costSnapshot.procurementDeliveryCost,
        returnCostSnapshot: line.costSnapshot.returnCost,
        returnDeliveryFreeSnapshot: line.costSnapshot.returnDeliveryFree,
        confirmationSource: "owner" as const,
        normalConfirmationCostSnapshot: "0.00",
        deliveredConfirmationCostSnapshot: "0.00",
      }))
    );

    for (const line of resolvedLines) {
      if (line.offer) {
        const update = await tx
          .update(storeProductOffers)
          .set({ usedCount: line.offer.usedCount + line.quantity })
          .where(
            and(
              eq(storeProductOffers.id, line.offer.id),
              eq(storeProductOffers.usedCount, line.offer.usedCount),
              or(
                eq(storeProductOffers.maxUses, 0),
                lt(storeProductOffers.usedCount, storeProductOffers.maxUses)
              )
            )
          );
        if (
          Number(
            (update as unknown as Array<{ affectedRows?: number }>)[0]
              ?.affectedRows ?? 0
          ) !== 1
        )
          throw new Error(
            `انتهت حصص العرض «${line.offer.description}»؛ أعد المحاولة.`
          );
      }
    }

    return {
      id: orderId,
      orderNumber,
      subtotal,
      discountAmount,
      deliveryFee,
      total,
      paymentMethod: "cod" as const,
      sharkCodDiscountPercent,
      retargetDiscountPercent,
    };
  });
}

type DigitalOrderLineInput = { productId: number; quantity: number };

type DigitalOrderCustomerInput = {
  customerName: string;
  customerEmail: string;
  notes?: string;
};

export async function createDigitalOrder(
  customer: DigitalOrderCustomerInput,
  lines: DigitalOrderLineInput[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    let ownerId: number | undefined;
    let storeId: number | null | undefined;
    let subtotalCents = 0;
    const resolved: Array<{
      product: typeof storeProducts.$inferSelect;
      quantity: number;
      unitPrice: string;
    }> = [];
    for (const line of lines) {
      const [product] = await tx
        .select()
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.id, line.productId),
            eq(storeProducts.status, "active"),
            eq(storeProducts.productKind, "digital")
          )
        )
        .limit(1);
      if (!product || !product.digitalFileStorageKey)
        throw new Error("المنتج الرقمي غير متاح حاليًا.");
      if (line.quantity < 1 || line.quantity > 10)
        throw new Error("كمية المنتج الرقمي غير صالحة.");
      if (ownerId === undefined) ownerId = product.ownerId;
      if (ownerId !== product.ownerId)
        throw new Error("لا يمكن جمع منتجات من متاجر مختلفة في طلب واحد.");
      if (storeId === undefined) storeId = product.storeId ?? null;
      if ((storeId ?? null) !== (product.storeId ?? null))
        throw new Error("لا يمكن جمع منتجات من متاجر مختلفة في طلب واحد.");
      if (!product.price)
        throw new Error(`سعر المنتج «${product.title}» غير محدد.`);
      subtotalCents += toCents(product.price) * line.quantity;
      resolved.push({
        product,
        quantity: line.quantity,
        unitPrice: product.price,
      });
    }
    if (!ownerId || !resolved.length)
      throw new Error("لا يمكن إنشاء طلب رقمي فارغ.");
    const temporaryNumber = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const subtotal = fromCents(subtotalCents);
    const created = await tx.insert(storeOrders).values({
      ownerId,
      storeId: storeId ?? null,
      orderNumber: temporaryNumber,
      customerName: customer.customerName,
      customerPhone: "",
      customerEmail: customer.customerEmail,
      wilaya: "",
      municipality: null,
      carrierMunicipality: null,
      deliveryMethod: "home",
      address: "",
      notes: customer.notes?.trim() || null,
      paymentMethod: "online",
      paymentStatus: "pending",
      fulfillmentStatus: "new",
      orderType: "digital",
      subtotal,
      discountAmount: "0.00",
      deliveryFee: "0.00",
      deliveryCostSnapshot: "0.00",
      total: subtotal,
    });
    const orderId = Number(created[0]?.insertId);
    if (!orderId) throw new Error("تعذر حفظ الطلب الرقمي.");
    const orderNumber = `ABD-${String(orderId).padStart(6, "0")}`;
    await tx
      .update(storeOrders)
      .set({ orderNumber })
      .where(eq(storeOrders.id, orderId));
    const items = await tx.insert(storeOrderItems).values(
      resolved.map(line => ({
        orderId,
        productId: line.product.id,
        variantId: null,
        title: line.product.title,
        variantLabel: null,
        sku: line.product.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: fromCents(toCents(line.unitPrice) * line.quantity),
      }))
    );
    const firstItemId = Number(items[0]?.insertId);
    return {
      id: orderId,
      orderNumber,
      total: subtotal,
      paymentStatus: "pending" as const,
      orderType: "digital" as const,
      itemId: firstItemId,
    };
  });
}

export async function confirmDigitalOrderPayment(
  storeId: number,
  orderId: number,
  forceNewLink = false
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [order] = await tx
      .select()
      .from(storeOrders)
      .where(
        and(
          eq(storeOrders.id, orderId),
          eq(storeOrders.storeId, storeId),
          eq(storeOrders.orderType, "digital")
        )
      )
      .limit(1);
    if (!order) throw new Error("الطلب الرقمي غير موجود.");
    if (order.paymentStatus !== "paid")
      await tx
        .update(storeOrders)
        .set({ paymentStatus: "paid", fulfillmentStatus: "confirmed" })
        .where(eq(storeOrders.id, orderId));
    const items = await tx
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, orderId));
    const links: Array<{
      itemId: number;
      productId: number;
      title: string;
      url: string;
      expiresAt: Date;
      maxDownloads: number;
    }> = [];
    for (const item of items) {
      const [existing] = await tx
        .select()
        .from(storeDigitalDownloads)
        .where(
          and(
            eq(storeDigitalDownloads.orderId, orderId),
            eq(storeDigitalDownloads.orderItemId, item.id)
          )
        )
        .limit(1);
      if (existing && !forceNewLink) continue;
      const [product] = await tx
        .select()
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.id, item.productId),
            eq(storeProducts.storeId, storeId),
            eq(storeProducts.productKind, "digital")
          )
        )
        .limit(1);
      if (!product?.digitalFileStorageKey) continue;
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + (product.digitalLinkValidityHours ?? 72) * 60 * 60 * 1000
      );
      const maxDownloads = product.digitalMaxDownloads ?? 5;
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await tx.insert(storeDigitalDownloads).values({
        orderId,
        orderItemId: item.id,
        productId: product.id,
        ownerId: order.ownerId,
        storeId,
        tokenHash,
        expiresAt,
        maxDownloads,
      });
      links.push({
        itemId: item.id,
        productId: item.productId,
        title: item.title,
        url: `/api/downloads/${token}`,
        expiresAt,
        maxDownloads,
      });
    }
    return {
      orderId,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      links,
    };
  });
}

export async function listDigitalOrders(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select()
    .from(storeOrders)
    .where(
      and(
        eq(storeOrders.storeId, storeId),
        eq(storeOrders.orderType, "digital")
      )
    )
    .orderBy(desc(storeOrders.createdAt));
  return Promise.all(
    orders.map(async order => {
      const [item] = await db
        .select({ productId: storeOrderItems.productId })
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, order.id))
        .limit(1);
      const [product] = item
        ? await db
            .select({ currency: storeProducts.currency })
            .from(storeProducts)
            .where(eq(storeProducts.id, item.productId))
            .limit(1)
        : [];
      return { ...order, currency: product?.currency ?? "DZD" };
    })
  );
}

export async function getDigitalDownloadStats(storeId: number) {
  const db = await getDb();
  if (!db) return { downloads: 0, activeLinks: 0 };
  const downloads = await db
    .select()
    .from(storeDigitalDownloads)
    .where(eq(storeDigitalDownloads.storeId, storeId));
  return {
    downloads: downloads.reduce((total, item) => total + item.downloadCount, 0),
    activeLinks: downloads.filter(
      item =>
        item.expiresAt.getTime() > Date.now() &&
        item.downloadCount < item.maxDownloads
    ).length,
  };
}

export async function consumeDigitalDownload(token: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [download] = await db
    .select()
    .from(storeDigitalDownloads)
    .where(eq(storeDigitalDownloads.tokenHash, tokenHash))
    .limit(1);
  if (!download || download.expiresAt.getTime() < Date.now())
    throw new Error("رابط التنزيل منتهي أو غير صالح.");
  if (download.downloadCount >= download.maxDownloads)
    throw new Error("تم بلوغ الحد الأقصى لمرات التنزيل.");
  const update = await db
    .update(storeDigitalDownloads)
    .set({
      downloadCount: download.downloadCount + 1,
      lastDownloadedAt: new Date(),
    })
    .where(
      and(
        eq(storeDigitalDownloads.id, download.id),
        eq(storeDigitalDownloads.downloadCount, download.downloadCount)
      )
    );
  if (
    Number(
      (update as unknown as Array<{ affectedRows?: number }>)[0]
        ?.affectedRows ?? 0
    ) !== 1
  )
    throw new Error("تعذر حجز عملية التنزيل، أعد المحاولة.");
  const [product] = await db
    .select({
      digitalFileStorageKey: storeProducts.digitalFileStorageKey,
      digitalFileName: storeProducts.digitalFileName,
      digitalFileMimeType: storeProducts.digitalFileMimeType,
    })
    .from(storeProducts)
    .where(eq(storeProducts.id, download.productId))
    .limit(1);
  if (!product?.digitalFileStorageKey)
    throw new Error("الملف الرقمي غير متاح.");
  return {
    storageKey: product.digitalFileStorageKey,
    fileName: product.digitalFileName ?? "download",
    mimeType: product.digitalFileMimeType ?? "application/octet-stream",
    expiresAt: download.expiresAt,
    remainingDownloads: download.maxDownloads - download.downloadCount - 1,
  };
}

export type OrderCleanDecision = {
  enabled: boolean;
  verdict: "allowed" | "review" | "blocked";
  reason: string;
  storeId: number;
  productId: number;
  phoneHash: string;
  settingsId?: number;
};

export async function evaluateOrderClean(
  storeId: number,
  customerPhone: string,
  productId: number
): Promise<OrderCleanDecision> {
  const db = await getDb();
  const phoneHash = createHash("sha256")
    .update(customerPhone.trim())
    .digest("hex");
  if (!db)
    return {
      enabled: false,
      verdict: "allowed",
      reason: "قاعدة البيانات غير متاحة؛ لم يطبق OrderClean.",
      storeId,
      productId,
      phoneHash,
    };
  const [settings] = await db
    .select()
    .from(orderCleanSettings)
    .where(eq(orderCleanSettings.storeId, storeId))
    .limit(1);
  if (!settings?.enabled)
    return {
      enabled: false,
      verdict: "allowed",
      reason: "OrderClean غير مفعل.",
      storeId,
      productId,
      phoneHash,
    };
  const since = new Date(
    Date.now() - settings.duplicateWindowHours * 60 * 60 * 1000
  );
  const previous = await db
    .select({ createdAt: storeOrders.createdAt })
    .from(storeOrders)
    .where(
      and(
        eq(storeOrders.storeId, storeId),
        eq(storeOrders.customerPhone, customerPhone)
      )
    );
  const recentCount = previous.filter(order => order.createdAt >= since).length;
  if (recentCount >= settings.maxOrdersPerPhone)
    return {
      enabled: true,
      verdict: settings.action === "block" ? "blocked" : "review",
      reason: `تم العثور على ${recentCount} طلب سابق لنفس الهاتف خلال ${settings.duplicateWindowHours} ساعة.`,
      storeId,
      productId,
      phoneHash,
      settingsId: settings.id,
    };
  return {
    enabled: true,
    verdict: "allowed",
    reason: "لم يتم العثور على تكرار ضمن الفترة المحددة.",
    storeId,
    productId,
    phoneHash,
    settingsId: settings.id,
  };
}

export async function recordOrderCleanEvent(input: {
  ownerId: number;
  storeId?: number | null;
  orderId?: number;
  productId?: number;
  phoneHash: string;
  verdict: "allowed" | "review" | "blocked";
  reason: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(orderCleanEvents).values({
    ownerId: input.ownerId,
    storeId: input.storeId ?? null,
    orderId: input.orderId ?? null,
    productId: input.productId ?? null,
    phoneHash: input.phoneHash,
    verdict: input.verdict,
    reason: input.reason,
  });
}

export async function getOrderCleanSettings(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(orderCleanSettings)
    .where(eq(orderCleanSettings.storeId, storeId))
    .limit(1);
  return row;
}

export async function saveOrderCleanSettings(
  ownerId: number,
  storeId: number,
  input: {
    enabled: boolean;
    duplicateWindowHours: number;
    maxOrdersPerPhone: number;
    action: "review" | "block";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    duplicateWindowHours: Math.max(
      1,
      Math.min(720, Math.round(input.duplicateWindowHours))
    ),
    maxOrdersPerPhone: Math.max(
      1,
      Math.min(10, Math.round(input.maxOrdersPerPhone))
    ),
    action: input.action,
  };
  await db
    .insert(orderCleanSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        duplicateWindowHours: values.duplicateWindowHours,
        maxOrdersPerPhone: values.maxOrdersPerPhone,
        action: values.action,
      },
    });
  return getOrderCleanSettings(storeId);
}

export const DEFAULT_THEME_CUSTOMIZATION = {
  primaryColor: "#6257e8",
  accentColor: "#f4b84a",
  fontFamily: "Cairo",
  showCountdown: true,
  showTrustBadges: true,
  showNewsletter: true,
} as const;

export async function getStoreThemeSettings(storeId: number) {
  const db = await getDb();
  if (!db)
    return {
      storeId,
      templateKey: "nordic-market",
      customizationJson: JSON.stringify(DEFAULT_THEME_CUSTOMIZATION),
    };
  const [row] = await db
    .select()
    .from(storeThemeSettings)
    .where(eq(storeThemeSettings.storeId, storeId))
    .limit(1);
  return (
    row ?? {
      storeId,
      templateKey: "nordic-market",
      customizationJson: JSON.stringify(DEFAULT_THEME_CUSTOMIZATION),
    }
  );
}

export async function saveStoreThemeSettings(
  ownerId: number,
  storeId: number,
  input: { templateKey: string; customization: Record<string, unknown> }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const templateKey = input.templateKey.trim().slice(0, 80) || "nordic-market";
  const customizationJson = JSON.stringify(input.customization);
  await db
    .insert(storeThemeSettings)
    .values({ ownerId, storeId, templateKey, customizationJson })
    .onDuplicateKeyUpdate({ set: { templateKey, customizationJson } });
  return getStoreThemeSettings(storeId);
}

export const DEFAULT_CONTACT_BAR = {
  enabled: false,
  phoneEnabled: false,
  phoneNumber: "",
  phoneSticky: true,
  whatsappEnabled: false,
  whatsappNumber: "",
  whatsappSticky: true,
  showOnStore: true,
  showOnProduct: true,
  showOnLanding: true,
} as const;

function cleanContactNumber(value: string | undefined) {
  return (value ?? "").replace(/[^0-9+]/g, "").slice(0, 30);
}

export async function getContactBarSettings(storeId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_CONTACT_BAR };
  const [row] = await db
    .select()
    .from(contactBarSettings)
    .where(eq(contactBarSettings.storeId, storeId))
    .limit(1);
  return row ?? { ...DEFAULT_CONTACT_BAR };
}

export async function saveContactBarSettings(
  ownerId: number,
  storeId: number,
  input: {
    enabled: boolean;
    phoneEnabled: boolean;
    phoneNumber: string;
    phoneSticky: boolean;
    whatsappEnabled: boolean;
    whatsappNumber: string;
    whatsappSticky: boolean;
    showOnStore: boolean;
    showOnProduct: boolean;
    showOnLanding: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    phoneEnabled: input.phoneEnabled,
    phoneNumber: cleanContactNumber(input.phoneNumber),
    phoneSticky: input.phoneSticky,
    whatsappEnabled: input.whatsappEnabled,
    whatsappNumber: cleanContactNumber(input.whatsappNumber),
    whatsappSticky: input.whatsappSticky,
    showOnStore: input.showOnStore,
    showOnProduct: input.showOnProduct,
    showOnLanding: input.showOnLanding,
  };
  await db
    .insert(contactBarSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        phoneEnabled: values.phoneEnabled,
        phoneNumber: values.phoneNumber,
        phoneSticky: values.phoneSticky,
        whatsappEnabled: values.whatsappEnabled,
        whatsappNumber: values.whatsappNumber,
        whatsappSticky: values.whatsappSticky,
        showOnStore: values.showOnStore,
        showOnProduct: values.showOnProduct,
        showOnLanding: values.showOnLanding,
      },
    });
  return getContactBarSettings(storeId);
}

export async function getPublicContactBarForProduct(productId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_CONTACT_BAR };
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(eq(storeProducts.id, productId))
    .limit(1);
  return product?.storeId
    ? getContactBarSettings(product.storeId)
    : { ...DEFAULT_CONTACT_BAR };
}

export const DEFAULT_CONTENT_GUARD = {
  enabled: false,
  protectImages: true,
  blockRightClick: true,
  preventSelection: true,
  watermarkEnabled: false,
  watermarkText: "Abdou Store",
  blockHotlink: false,
  blockAdReferrers: false,
  blockMetaAdsLibrary: false,
  blockedMessage: "هذا المحتوى غير متاح من هذا المصدر.",
} as const;

function cleanContentGuardText(
  value: string | undefined,
  fallback: string,
  max: number
) {
  return (value?.trim() || fallback).slice(0, max);
}

export async function getContentGuardSettings(storeId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_CONTENT_GUARD };
  const [row] = await db
    .select()
    .from(contentGuardSettings)
    .where(eq(contentGuardSettings.storeId, storeId))
    .limit(1);
  return row ?? { ...DEFAULT_CONTENT_GUARD };
}

export async function saveContentGuardSettings(
  ownerId: number,
  storeId: number,
  input: {
    enabled: boolean;
    protectImages: boolean;
    blockRightClick: boolean;
    preventSelection: boolean;
    watermarkEnabled: boolean;
    watermarkText: string;
    blockHotlink: boolean;
    blockAdReferrers: boolean;
    blockMetaAdsLibrary: boolean;
    blockedMessage: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    protectImages: input.protectImages,
    blockRightClick: input.blockRightClick,
    preventSelection: input.preventSelection,
    watermarkEnabled: input.watermarkEnabled,
    watermarkText: cleanContentGuardText(
      input.watermarkText,
      DEFAULT_CONTENT_GUARD.watermarkText,
      120
    ),
    blockHotlink: input.blockHotlink,
    blockAdReferrers: input.blockAdReferrers,
    blockMetaAdsLibrary: input.blockMetaAdsLibrary,
    blockedMessage: cleanContentGuardText(
      input.blockedMessage,
      DEFAULT_CONTENT_GUARD.blockedMessage,
      255
    ),
  };
  await db
    .insert(contentGuardSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        protectImages: values.protectImages,
        blockRightClick: values.blockRightClick,
        preventSelection: values.preventSelection,
        watermarkEnabled: values.watermarkEnabled,
        watermarkText: values.watermarkText,
        blockHotlink: values.blockHotlink,
        blockAdReferrers: values.blockAdReferrers,
        blockMetaAdsLibrary: values.blockMetaAdsLibrary,
        blockedMessage: values.blockedMessage,
      },
    });
  return getContentGuardSettings(storeId);
}

export async function getPublicContentGuardForProduct(productId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_CONTENT_GUARD };
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(eq(storeProducts.id, productId))
    .limit(1);
  return product?.storeId
    ? getContentGuardSettings(product.storeId)
    : { ...DEFAULT_CONTENT_GUARD };
}

export const DEFAULT_THANK_YOU_POPUP = {
  enabled: true,
  message: "تم إرسال طلبك بنجاح، سنتصل بك في أقرب وقت. شكرًا لثقتك بنا.",
  buttonText: "خروج",
  buttonUrl: "/",
} as const;

function safeThankYouUrl(value: string | undefined) {
  const url = value?.trim() || DEFAULT_THANK_YOU_POPUP.buttonUrl;
  if (url.startsWith("/") || /^https?:\/\//i.test(url))
    return url.slice(0, 2000);
  return DEFAULT_THANK_YOU_POPUP.buttonUrl;
}

export async function getThankYouPopupSettings(storeId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_THANK_YOU_POPUP };
  const [row] = await db
    .select()
    .from(thankYouPopupSettings)
    .where(eq(thankYouPopupSettings.storeId, storeId))
    .limit(1);
  return row ?? { ...DEFAULT_THANK_YOU_POPUP };
}

export async function saveThankYouPopupSettings(
  ownerId: number,
  storeId: number,
  input: {
    enabled: boolean;
    message: string;
    buttonText: string;
    buttonUrl: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    message:
      input.message.trim().slice(0, 2000) || DEFAULT_THANK_YOU_POPUP.message,
    buttonText:
      input.buttonText.trim().slice(0, 180) ||
      DEFAULT_THANK_YOU_POPUP.buttonText,
    buttonUrl: safeThankYouUrl(input.buttonUrl),
  };
  await db
    .insert(thankYouPopupSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        message: values.message,
        buttonText: values.buttonText,
        buttonUrl: values.buttonUrl,
      },
    });
  return getThankYouPopupSettings(storeId);
}

export async function getPublicThankYouPopup(productId: number) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_THANK_YOU_POPUP };
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(eq(storeProducts.id, productId))
    .limit(1);
  return product?.storeId
    ? getThankYouPopupSettings(product.storeId)
    : { ...DEFAULT_THANK_YOU_POPUP };
}

export async function getOrderCleanEvents(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: orderCleanEvents.id,
      orderId: orderCleanEvents.orderId,
      verdict: orderCleanEvents.verdict,
      reason: orderCleanEvents.reason,
      createdAt: orderCleanEvents.createdAt,
    })
    .from(orderCleanEvents)
    .where(eq(orderCleanEvents.storeId, storeId))
    .orderBy(desc(orderCleanEvents.createdAt))
    .limit(20);
}

export async function getOrderCleanAnalytics(storeId: number) {
  const db = await getDb();
  if (!db) return { allowed: 0, review: 0, blocked: 0 };
  const rows = await db
    .select({ verdict: orderCleanEvents.verdict })
    .from(orderCleanEvents)
    .where(eq(orderCleanEvents.storeId, storeId));
  return {
    allowed: rows.filter(row => row.verdict === "allowed").length,
    review: rows.filter(row => row.verdict === "review").length,
    blocked: rows.filter(row => row.verdict === "blocked").length,
  };
}

export type AbandonedOrderInput = {
  productId: number;
  landingPageId?: number;
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  wilaya?: string;
  municipality?: string;
  quantity: number;
};

export async function upsertAbandonedOrder(input: AbandonedOrderInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [product] = await db
    .select({
      id: storeProducts.id,
      ownerId: storeProducts.ownerId,
      storeId: storeProducts.storeId,
    })
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.id, input.productId),
        eq(storeProducts.status, "active")
      )
    )
    .limit(1);
  if (!product) throw new Error("المنتج غير متاح.");
  const [abandonedSetting] = await db
    .select({ enabled: storeConnecteurs.enabled })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.ownerId, product.ownerId),
        eq(storeConnecteurs.kind, "abandoned_orders")
      )
    )
    .limit(1);
  if (abandonedSetting && !abandonedSetting.enabled)
    return { saved: false, disabled: true } as const;
  const [existing] = await db
    .select({ id: abandonedOrders.id })
    .from(abandonedOrders)
    .where(
      and(
        eq(abandonedOrders.ownerId, product.ownerId),
        eq(abandonedOrders.productId, input.productId),
        eq(abandonedOrders.sessionId, input.sessionId),
        eq(abandonedOrders.status, "open")
      )
    )
    .limit(1);
  const values = {
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    wilaya: input.wilaya?.trim() || null,
    municipality: input.municipality?.trim() || null,
    quantity: input.quantity,
    landingPageId: input.landingPageId ?? null,
  };
  if (existing)
    await db
      .update(abandonedOrders)
      .set(values)
      .where(eq(abandonedOrders.id, existing.id));
  else
    await db.insert(abandonedOrders).values({
      ownerId: product.ownerId,
      storeId: product.storeId ?? null,
      productId: product.id,
      sessionId: input.sessionId,
      status: "open",
      ...values,
    });
  return { saved: true } as const;
}

export async function markAbandonedOrderConverted(
  storeId: number,
  sessionId: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(abandonedOrders)
    .set({ status: "converted" })
    .where(
      and(
        eq(abandonedOrders.storeId, storeId),
        eq(abandonedOrders.sessionId, sessionId),
        eq(abandonedOrders.status, "open")
      )
    );
}

export async function markAbandonedOrderConvertedForProduct(
  productId: number,
  sessionId: string
) {
  const db = await getDb();
  if (!db) return;
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(eq(storeProducts.id, productId))
    .limit(1);
  if (product?.storeId)
    await markAbandonedOrderConverted(product.storeId, sessionId);
}

export async function listAbandonedOrders(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(abandonedOrders)
    .where(
      and(
        eq(abandonedOrders.storeId, storeId),
        eq(abandonedOrders.status, "open")
      )
    )
    .orderBy(desc(abandonedOrders.createdAt));
}

export async function listStoreOrders(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.storeId, storeId))
    .orderBy(desc(storeOrders.createdAt));
  return Promise.all(
    orders.map(async order => ({
      ...order,
      items: await db
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, order.id)),
    }))
  );
}

export async function listStoreOrdersByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.ownerId, ownerId))
    .orderBy(desc(storeOrders.createdAt));
  return Promise.all(
    orders.map(async order => ({
      ...order,
      items: await db
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, order.id)),
    }))
  );
}

export async function setOrderConfirmationAttribution(
  storeId: number,
  orderId: number,
  source: "owner" | "call_center",
  agentId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [order] = await db
    .select({ id: storeOrders.id })
    .from(storeOrders)
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
    .limit(1);
  if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية تعديله.");
  if (source === "owner") {
    await db
      .update(storeOrderItems)
      .set({
        confirmationSource: "owner",
        confirmationAgentId: null,
        normalConfirmationCostSnapshot: "0.00",
        deliveredConfirmationCostSnapshot: "0.00",
      })
      .where(eq(storeOrderItems.orderId, orderId));
    return { success: true, source, agentId: null } as const;
  }
  if (!agentId) throw new Error("حدد عميل Call Center لتسجيل تكلفة التأكيد.");
  const [agent] = await db
    .select({
      id: callCenterAgents.id,
      generalOrderRate: callCenterAgents.generalOrderRate,
      completedOrderRate: callCenterAgents.completedOrderRate,
      ownerId: callCenterAgents.ownerId,
    })
    .from(callCenterAgents)
    .where(
      and(
        eq(callCenterAgents.id, agentId),
        eq(callCenterAgents.storeId, storeId),
        eq(callCenterAgents.enabled, true)
      )
    )
    .limit(1);
  if (!agent) throw new Error("عميل Call Center غير موجود أو غير مفعل.");
  await db
    .update(storeOrderItems)
    .set({
      confirmationSource: "call_center",
      confirmationAgentId: agent.id,
      normalConfirmationCostSnapshot: agent.generalOrderRate,
      deliveredConfirmationCostSnapshot: agent.completedOrderRate,
    })
    .where(eq(storeOrderItems.orderId, orderId));
  return { success: true, source, agentId: agent.id } as const;
}

function affectedRows(result: unknown) {
  return Number(
    (result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0
  );
}

export async function applyOrderInventoryLifecycle(
  storeId: number,
  orderId: number,
  event: "at_carrier" | "returned"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [order] = await tx
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
      .limit(1);
    if (!order)
      throw new Error("الطلب غير موجود أو لا تملك صلاحية الوصول إليه.");
    if (event === "at_carrier") {
      if (order.inventoryDeductedAt) return order;
      const claimed = await tx
        .update(storeOrders)
        .set({ inventoryDeductedAt: new Date() })
        .where(
          and(
            eq(storeOrders.id, orderId),
            eq(storeOrders.storeId, storeId),
            isNull(storeOrders.inventoryDeductedAt)
          )
        );
      if (affectedRows(claimed) !== 1) return order;
      const items = await tx
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, orderId));
      for (const item of items) {
        const [variant] = item.variantId
          ? await tx
              .select()
              .from(storeProductVariants)
              .where(
                and(
                  eq(storeProductVariants.id, item.variantId),
                  eq(storeProductVariants.productId, item.productId)
                )
              )
              .limit(1)
          : [];
        const [product] = await tx
          .select()
          .from(storeProducts)
          .where(
            and(
              eq(storeProducts.id, item.productId),
              eq(storeProducts.storeId, storeId)
            )
          )
          .limit(1);
        if (!product || !product.trackInventory || product.continueSelling)
          continue;
        const update = variant
          ? await tx
              .update(storeProductVariants)
              .set({ stock: variant.stock - item.quantity })
              .where(
                and(
                  eq(storeProductVariants.id, variant.id),
                  eq(storeProductVariants.stock, variant.stock)
                )
              )
          : await tx
              .update(storeProducts)
              .set({ inventory: product.inventory - item.quantity })
              .where(
                and(
                  eq(storeProducts.id, product.id),
                  eq(storeProducts.inventory, product.inventory)
                )
              );
        if (affectedRows(update) !== 1)
          throw new Error(
            `تعذر خصم مخزون «${item.title}» عند رفع الطلب لشركة الشحن.`
          );
      }
      return { ...order, inventoryDeductedAt: new Date() };
    }
    if (!order.inventoryDeductedAt || order.inventoryRestoredAt) return order;
    const claimed = await tx
      .update(storeOrders)
      .set({ inventoryRestoredAt: new Date() })
      .where(
        and(
          eq(storeOrders.id, orderId),
          eq(storeOrders.storeId, storeId),
          isNotNull(storeOrders.inventoryDeductedAt),
          isNull(storeOrders.inventoryRestoredAt)
        )
      );
    if (affectedRows(claimed) !== 1) return order;
    const items = await tx
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, orderId));
    for (const item of items) {
      const [variant] = item.variantId
        ? await tx
            .select()
            .from(storeProductVariants)
            .where(
              and(
                eq(storeProductVariants.id, item.variantId),
                eq(storeProductVariants.productId, item.productId)
              )
            )
            .limit(1)
        : [];
      const [product] = await tx
        .select()
        .from(storeProducts)
        .where(
          and(
            eq(storeProducts.id, item.productId),
            eq(storeProducts.storeId, storeId)
          )
        )
        .limit(1);
      if (!product || !product.trackInventory || product.continueSelling)
        continue;
      if (variant)
        await tx
          .update(storeProductVariants)
          .set({ stock: variant.stock + item.quantity })
          .where(eq(storeProductVariants.id, variant.id));
      else
        await tx
          .update(storeProducts)
          .set({ inventory: product.inventory + item.quantity })
          .where(eq(storeProducts.id, product.id));
    }
    return { ...order, inventoryRestoredAt: new Date() };
  });
}

export async function updateStoreOrderStatus(
  storeId: number,
  orderId: number,
  fulfillmentStatus:
    | "review"
    | "confirmed"
    | "processing"
    | "at_carrier"
    | "shipped"
    | "returned"
    | "cancelled"
    | "customer_unresponsive"
    | "phone_cancelled"
    | "fake"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (fulfillmentStatus === "at_carrier")
    await applyOrderInventoryLifecycle(storeId, orderId, "at_carrier");
  if (fulfillmentStatus === "returned")
    await applyOrderInventoryLifecycle(storeId, orderId, "returned");
  await db
    .update(storeOrders)
    .set({ fulfillmentStatus })
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)));
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
    .limit(1);
  if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية تعديله.");
  return order;
}

export async function deleteArchivedOrder(storeId: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [order] = await tx
      .select({
        id: storeOrders.id,
        fulfillmentStatus: storeOrders.fulfillmentStatus,
      })
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
      .limit(1);
    if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية حذفه.");
    if (
      ![
        "delivered",
        "returned",
        "cancelled",
        "customer_unresponsive",
        "phone_cancelled",
        "fake",
      ].includes(order.fulfillmentStatus)
    )
      throw new Error("لا يمكن حذف طلب غير نهائي من الأرشيف.");
    await tx
      .delete(storeOrderItems)
      .where(eq(storeOrderItems.orderId, orderId));
    await tx
      .delete(storeOrders)
      .where(
        and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId))
      );
    return { success: true, orderId } as const;
  });
}

export async function updateStoreOrder(
  storeId: number,
  orderId: number,
  data: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
    .limit(1);
  if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية تعديله.");

  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== "") {
      cleanData[key] = value;
    }
  }

  if (Object.keys(cleanData).length === 0) return order;

  await db
    .update(storeOrders)
    .set({ ...cleanData, updatedAt: new Date() })
    .where(eq(storeOrders.id, orderId));

  const [updated] = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.id, orderId))
    .limit(1);
  return updated;
}

export async function deleteStoreOrder(storeId: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [order] = await tx
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)))
      .limit(1);
    if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية حذفه.");
    await tx
      .delete(storeOrderItems)
      .where(eq(storeOrderItems.orderId, orderId));
    await tx
      .delete(storeOrders)
      .where(
        and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId))
      );
    return { success: true, orderId } as const;
  });
}

export async function deleteStoreOrdersBulk(
  storeId: number,
  orderIds: number[]
) {
  if (!orderIds.length) return { success: true, deleted: 0 } as const;
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const uniqueIds = Array.from(
    new Set(orderIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (!uniqueIds.length) return { success: true, deleted: 0 } as const;
  return db.transaction(async tx => {
    const existing = await tx
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(
        and(
          eq(storeOrders.storeId, storeId),
          inArray(storeOrders.id, uniqueIds)
        )
      );
    const existingIds = existing.map(row => row.id);
    if (!existingIds.length) return { success: true, deleted: 0 } as const;
    await tx
      .delete(storeOrderItems)
      .where(inArray(storeOrderItems.orderId, existingIds));
    await tx.delete(storeOrders).where(inArray(storeOrders.id, existingIds));
    return { success: true, deleted: existingIds.length } as const;
  });
}

export type DeliveryWilayaRateInput = {
  wilayaCode: string;
  wilayaName: string;
  officeEnabled: boolean;
  officeFee: string | null;
  homeEnabled: boolean;
  homeFee: string | null;
};

export type DeliverySettingsInput = {
  fixedOfficeEnabled: boolean;
  fixedOfficeFee: string | null;
  fixedHomeEnabled: boolean;
  fixedHomeFee: string | null;
  pricingMode: "fixed" | "carrier" | "manual";
  hiddenWilayaCodes: string[];
  customerCarrierChoiceEnabled: boolean;
  wilayaRates: DeliveryWilayaRateInput[];
};

export async function listConnecteurs(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: storeConnecteurs.id,
      kind: storeConnecteurs.kind,
      label: storeConnecteurs.label,
      identifier: storeConnecteurs.identifier,
      domain: storeConnecteurs.domain,
      verificationCode: storeConnecteurs.verificationCode,
      enabled: storeConnecteurs.enabled,
      lastError: storeConnecteurs.lastError,
      updatedAt: storeConnecteurs.updatedAt,
    })
    .from(storeConnecteurs)
    .where(eq(storeConnecteurs.storeId, storeId));
  return Promise.all(
    rows.map(async row => ({
      ...row,
      pixels: await db
        .select({
          id: storeConnecteurPixels.id,
          label: storeConnecteurPixels.label,
          pixelId: storeConnecteurPixels.pixelId,
          enabled: storeConnecteurPixels.enabled,
          updatedAt: storeConnecteurPixels.updatedAt,
        })
        .from(storeConnecteurPixels)
        .where(eq(storeConnecteurPixels.connecteurId, row.id)),
    }))
  );
}

export async function saveConnecteurPixels(
  storeId: number,
  kind: "meta_capi" | "tiktok_capi" | "snapchat_capi",
  pixels: Array<{
    id?: number;
    label: string;
    pixelId: string;
    enabled: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (pixels.length > 7) throw new Error("يمكن إضافة 7 بكسلات فقط لكل تطبيق.");
  const [connecteur] = await db
    .select({ id: storeConnecteurs.id })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, kind)
      )
    )
    .limit(1);
  if (!connecteur) throw new Error("اربط التطبيق أولًا ثم أضف البكسلات.");
  await db
    .delete(storeConnecteurPixels)
    .where(eq(storeConnecteurPixels.connecteurId, connecteur.id));
  if (pixels.length)
    await db.insert(storeConnecteurPixels).values(
      pixels.map(pixel => ({
        connecteurId: connecteur.id,
        label: pixel.label.trim(),
        pixelId: pixel.pixelId.trim(),
        accessTokenEncrypted: null,
        enabled: pixel.enabled,
      }))
    );
  return { success: true } as const;
}

export async function saveConnecteur(
  ownerId: number,
  storeId: number,
  input: {
    kind:
      | "meta_capi"
      | "tiktok_capi"
      | "snapchat_capi"
      | "facebook_domain"
      | "cloudflare_turnstile"
      | "google_sheets"
      | "abandoned_orders"
      | "notifications"
      | "message_order";
    label: string;
    identifier?: string;
    secret?: string;
    domain?: string;
    verificationCode?: string;
    enabled: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const secretEncrypted = input.secret?.trim()
    ? encryptSecret(input.secret.trim())
    : undefined;
  await db
    .insert(storeConnecteurs)
    .values({
      ownerId,
      storeId,
      kind: input.kind,
      label: input.label.trim(),
      identifier: input.identifier?.trim() || null,
      secretEncrypted: secretEncrypted ?? null,
      domain: input.domain?.trim() || null,
      verificationCode: input.verificationCode?.trim() || null,
      enabled: input.enabled,
      lastError: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        label: input.label.trim(),
        identifier: input.identifier?.trim() || null,
        ...(secretEncrypted ? { secretEncrypted } : {}),
        domain: input.domain?.trim() || null,
        verificationCode: input.verificationCode?.trim() || null,
        enabled: input.enabled,
        lastError: null,
      },
    });
  return { success: true } as const;
}

export async function getPublicTurnstileSiteKey(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(
      and(eq(storeProducts.id, productId), eq(storeProducts.status, "active"))
    )
    .limit(1);
  if (!product?.storeId) return undefined;
  const [setting] = await db
    .select({
      identifier: storeConnecteurs.identifier,
      enabled: storeConnecteurs.enabled,
    })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, product.storeId),
        eq(storeConnecteurs.kind, "cloudflare_turnstile")
      )
    )
    .limit(1);
  return setting?.enabled && setting.identifier
    ? setting.identifier
    : undefined;
}

export type SharkCodSettingsInput = {
  enabled: boolean;
  title: string;
  descriptionBefore: string;
  descriptionAfter: string;
  buttonText: string;
  discountPercent: number;
  targetMode: "all" | "product" | "landing";
  targetProductId?: number | null;
  targetLandingPageId?: number | null;
};

export async function getSharkCodSettings(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(sharkCodSettings)
    .where(eq(sharkCodSettings.storeId, storeId))
    .limit(1);
  return row;
}

export async function saveSharkCodSettings(
  ownerId: number,
  storeId: number,
  input: SharkCodSettingsInput
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    ownerId,
    storeId,
    enabled: input.enabled,
    title: input.title.trim(),
    descriptionBefore: input.descriptionBefore.trim(),
    descriptionAfter: input.descriptionAfter.trim(),
    buttonText: input.buttonText.trim(),
    discountPercent: Math.max(
      0,
      Math.min(90, Math.round(input.discountPercent))
    ),
    targetMode: input.targetMode,
    targetProductId: input.targetProductId ?? null,
    targetLandingPageId: input.targetLandingPageId ?? null,
  };
  await db
    .insert(sharkCodSettings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        enabled: values.enabled,
        title: values.title,
        descriptionBefore: values.descriptionBefore,
        descriptionAfter: values.descriptionAfter,
        buttonText: values.buttonText,
        discountPercent: values.discountPercent,
        targetMode: values.targetMode,
        targetProductId: values.targetProductId,
        targetLandingPageId: values.targetLandingPageId,
      },
    });
  return getSharkCodSettings(storeId);
}

export async function getPublicSharkCodSettings(
  productId: number,
  landingPageId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(
      and(eq(storeProducts.id, productId), eq(storeProducts.status, "active"))
    )
    .limit(1);
  if (!product?.storeId) return undefined;
  const [row] = await db
    .select()
    .from(sharkCodSettings)
    .where(
      and(
        eq(sharkCodSettings.storeId, product.storeId),
        eq(sharkCodSettings.enabled, true)
      )
    )
    .limit(1);
  if (!row) return undefined;
  if (row.targetMode === "product" && row.targetProductId !== productId)
    return undefined;
  if (
    row.targetMode === "landing" &&
    (!landingPageId || row.targetLandingPageId !== landingPageId)
  )
    return undefined;
  return row;
}

export async function recordSharkCodEvent(input: {
  ownerId: number;
  storeId?: number | null;
  settingsId: number;
  eventType:
    | "view"
    | "cta_click"
    | "discount_order"
    | "reject_price"
    | "reject_delivery"
    | "reject_compare"
    | "reject_hesitate"
    | "reject_payment"
    | "reject_changed_mind";
  productId?: number;
  landingPageId?: number;
  orderId?: number;
  sessionId?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(sharkCodEvents).values({
    ownerId: input.ownerId,
    storeId: input.storeId ?? null,
    settingsId: input.settingsId,
    eventType: input.eventType,
    productId: input.productId ?? null,
    landingPageId: input.landingPageId ?? null,
    orderId: input.orderId ?? null,
    sessionId: input.sessionId ?? null,
  });
}

export async function getSharkCodAnalytics(storeId: number) {
  const db = await getDb();
  if (!db)
    return {
      views: 0,
      ctaClicks: 0,
      discountOrders: 0,
      ctr: 0,
      conversionRate: 0,
      rejections: {},
    };
  const rows = await db
    .select({ eventType: sharkCodEvents.eventType })
    .from(sharkCodEvents)
    .where(eq(sharkCodEvents.storeId, storeId));
  const views = rows.filter(row => row.eventType === "view").length;
  const ctaClicks = rows.filter(row => row.eventType === "cta_click").length;
  const discountOrders = rows.filter(
    row => row.eventType === "discount_order"
  ).length;
  const rejections = rows
    .filter(row => row.eventType.startsWith("reject_"))
    .reduce(
      (acc, row) => {
        const key = row.eventType.replace("reject_", "") as keyof typeof acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  return {
    views,
    ctaClicks,
    discountOrders,
    ctr: views ? Math.round((ctaClicks / views) * 1000) / 10 : 0,
    conversionRate: views
      ? Math.round((discountOrders / views) * 1000) / 10
      : 0,
    rejections,
  };
}

export async function getSharkCodProductAnalytics(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      eventType: sharkCodEvents.eventType,
      productId: sharkCodEvents.productId,
      orderId: sharkCodEvents.orderId,
      createdAt: sharkCodEvents.createdAt,
    })
    .from(sharkCodEvents)
    .where(eq(sharkCodEvents.storeId, storeId));
  const byProduct = new Map<
    number,
    Array<{
      eventType: string;
      createdAt: Date | string | null;
      orderId: number | null;
    }>
  >();
  for (const row of rows) {
    if (!row.productId) continue;
    const arr = byProduct.get(row.productId) ?? [];
    arr.push({
      eventType: row.eventType,
      createdAt: row.createdAt,
      orderId: row.orderId,
    });
    byProduct.set(row.productId, arr);
  }
  const products = await db
    .select()
    .from(storeProducts)
    .where(eq(storeProducts.storeId, storeId))
    .orderBy(desc(storeProducts.createdAt));
  const productImageMap = new Map<number, string | null>();
  const imageRows = await db
    .select({
      productId: storeProductImages.productId,
      url: storeProductImages.url,
      position: storeProductImages.position,
    })
    .from(storeProductImages)
    .where(
      inArray(
        storeProductImages.productId,
        products.map(p => p.id)
      )
    );
  for (const product of products) productImageMap.set(product.id, null);
  for (const image of imageRows) {
    const current = productImageMap.get(image.productId);
    if (!current || (image.position ?? 0) < 0)
      productImageMap.set(image.productId, image.url);
  }
  const firstImages = imageRows.sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  for (const image of firstImages) {
    if (productImageMap.get(image.productId) === null)
      productImageMap.set(image.productId, image.url);
  }
  return products
    .filter(product => {
      const events = byProduct.get(product.id) ?? [];
      return events.some(
        e =>
          e.eventType === "view" ||
          e.eventType === "cta_click" ||
          e.eventType === "discount_order" ||
          e.eventType.startsWith("reject_")
      );
    })
    .map(product => {
      const events = byProduct.get(product.id) ?? [];
      const views = events.filter(e => e.eventType === "view").length;
      const ctaClicks = events.filter(e => e.eventType === "cta_click").length;
      const discountOrders = events.filter(
        e => e.eventType === "discount_order"
      ).length;
      const rejections = events
        .filter(e => e.eventType.startsWith("reject_"))
        .reduce(
          (acc, e) => {
            const key = e.eventType.replace("reject_", "");
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
      return {
        id: product.id,
        title: product.title,
        price: product.price,
        image: productImageMap.get(product.id) ?? null,
        views,
        ctaClicks,
        discountOrders,
        ctr: views ? Math.round((ctaClicks / views) * 1000) / 10 : 0,
        conversionRate: views
          ? Math.round((discountOrders / views) * 1000) / 10
          : 0,
rejections,
        eventCount: events.length,
      };
    });
  }

export async function getWilayaConversionIntelligence(
  storeId: number,
  productId?: number | null
) {
  const db = await getDb();
  if (!db) return [];

  const orders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.storeId, storeId))
    .orderBy(desc(storeOrders.createdAt));

  const allItems = orders.length
    ? await Promise.all(
        orders.map(order =>
          db
            .select()
            .from(storeOrderItems)
            .where(eq(storeOrderItems.orderId, order.id))
        )
      )
    : [];
  const flatItems = allItems.flat();

  let filteredOrders = orders;
  if (productId) {
    const productOrderIds = new Set(
      flatItems
        .filter(item => item?.productId === productId)
        .map(item => item.orderId)
    );
    filteredOrders = orders.filter(order => productOrderIds.has(order.id));
  }

  const wilayaMap = new Map<
    string,
    {
      wilaya: string;
      wilayaCode: string | null;
      totalOrders: number;
      confirmedOrders: number;
      deliveredOrders: number;
      refusedOrders: number;
      totalRevenue: number;
      totalAdSpend: number;
      totalCost: number;
      totalDeliveryDays: number;
      deliveryCount: number;
    }
  >();

  for (const order of filteredOrders) {
    const wilayaKey = order.wilayaCode
      ? `${order.wilayaCode}-${order.wilaya}`
      : order.wilaya;
    const current = wilayaMap.get(wilayaKey) ?? {
      wilaya: order.wilaya,
      wilayaCode: order.wilayaCode ?? null,
      totalOrders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      refusedOrders: 0,
      totalRevenue: 0,
      totalAdSpend: 0,
      totalCost: 0,
      totalDeliveryDays: 0,
      deliveryCount: 0,
    };

    current.totalOrders += 1;

    const isDelivered = order.fulfillmentStatus === "delivered";
    const isConfirmed = [
      "confirmed",
      "processing",
      "at_carrier",
      "shipped",
      "delivered",
    ].includes(order.fulfillmentStatus);
    const isRefused = [
      "cancelled",
      "customer_unresponsive",
      "phone_cancelled",
      "fake",
    ].includes(order.fulfillmentStatus);

    if (isConfirmed) current.confirmedOrders += 1;
    if (isDelivered) current.deliveredOrders += 1;
    if (isRefused) current.refusedOrders += 1;

    const adSpend = Math.round((Number(order.adSpendAllocatedDzd ?? 0) || 0) * 100);
    current.totalAdSpend += adSpend;

    const orderItems = flatItems.filter(item => item.orderId === order.id);
    const itemRevenue = isDelivered
      ? orderItems.reduce((sum, item) => sum + Math.round((Number(item.lineTotal ?? 0) || 0) * 100), 0)
      : 0;
    current.totalRevenue += itemRevenue;

    const productCost = orderItems.reduce(
      (sum, item) => sum + Math.round((Number(item.productCostSnapshot ?? 0) || 0) * 100) * item.quantity,
      0
    );
    const packagingCost = orderItems.reduce(
      (sum, item) => sum + Math.round((Number(item.packagingCostSnapshot ?? 0) || 0) * 100) * item.quantity,
      0
    );
    const procurementDeliveryCost = orderItems.reduce(
      (sum, item) => sum + Math.round((Number(item.procurementDeliveryCostSnapshot ?? 0) || 0) * 100) * item.quantity,
      0
    );
    const deliveryCost = Math.round((Number(order.deliveryCostSnapshot ?? 0) || 0) * 100);
    const confirmationCost = orderItems.reduce(
      (sum, item) =>
        sum +
        (item.confirmationSource === "call_center"
          ? Math.round(
              (isDelivered
                ? Number(item.deliveredConfirmationCostSnapshot ?? 0)
                : Number(item.normalConfirmationCostSnapshot ?? 0)) * 100
            )
          : 0),
      0
    );
    const returnCost = order.fulfillmentStatus === "returned"
      ? orderItems.reduce(
          (sum, item) =>
            sum +
            (item.returnDeliveryFreeSnapshot
              ? 0
              : Math.round((Number(item.returnCostSnapshot ?? 0) || 0) * 100)),
          0
        )
      : 0;

    const totalCost =
      productCost +
      packagingCost +
      procurementDeliveryCost +
      deliveryCost +
      confirmationCost +
      returnCost +
      adSpend;
    current.totalCost += totalCost;

    if (isDelivered && order.carrierStatusUpdatedAt && order.createdAt) {
      const deliveryDays =
        (new Date(order.carrierStatusUpdatedAt).getTime() -
          new Date(order.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (deliveryDays > 0 && deliveryDays < 30) {
        current.totalDeliveryDays += deliveryDays;
        current.deliveryCount += 1;
      }
    }

    wilayaMap.set(wilayaKey, current);
  }

  return Array.from(wilayaMap.values())
    .filter(w => w.totalOrders > 0)
    .map(w => {
      const conversionRate = w.totalOrders
        ? Math.round((w.deliveredOrders / w.totalOrders) * 1000) / 10
        : 0;
      const confirmationRate = w.totalOrders
        ? Math.round((w.confirmedOrders / w.totalOrders) * 1000) / 10
        : 0;
      const refusalRate = w.totalOrders
        ? Math.round((w.refusedOrders / w.totalOrders) * 1000) / 10
        : 0;
      const avgDeliveryTime = w.deliveryCount
        ? Math.round((w.totalDeliveryDays / w.deliveryCount) * 10) / 10
        : 0;
      const aov = w.deliveredOrders
        ? Math.round((w.totalRevenue / w.deliveredOrders) / 100)
        : 0;
      const cac = w.deliveredOrders
        ? Math.round((w.totalAdSpend / w.deliveredOrders) / 100)
        : 0;
      const profitPerDelivered = w.deliveredOrders
        ? Math.round(((w.totalRevenue - w.totalCost) / w.deliveredOrders) / 100)
        : 0;

      return {
        wilaya: w.wilaya,
        wilayaCode: w.wilayaCode,
        totalOrders: w.totalOrders,
        conversionRate,
        confirmationRate,
        deliveryTime: avgDeliveryTime,
        refusalRate,
        averageOrderValue: aov,
        cac,
        profitPerDeliveredOrder: profitPerDelivered,
      };
    })
    .sort((a, b) => b.totalOrders - a.totalOrders);
}

export async function getAiSettings(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.storeId, storeId))
    .limit(1);
  return row;
}

export async function saveAiSettings(
  storeId: number,
  input: { provider: string; apiKey: string; apiUrl: string; model: string }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .insert(aiSettings)
    .values({
      storeId,
      provider: input.provider.trim(),
      apiKey: input.apiKey.trim(),
      apiUrl: input.apiUrl.trim() || "https://api.openai.com/v1",
      model: input.model.trim() || "gpt-4o-mini",
    })
    .onDuplicateKeyUpdate({
      set: {
        provider: input.provider.trim(),
        apiKey: input.apiKey.trim(),
        apiUrl: input.apiUrl.trim() || "https://api.openai.com/v1",
        model: input.model.trim() || "gpt-4o-mini",
      },
    });
  return getAiSettings(storeId);
}

export async function saveGoogleOAuthConnection(
  ownerId: number,
  storeId: number,
  input: {
    spreadsheetId: string;
    refreshToken: string;
    accessToken?: string;
    email?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const secret = JSON.stringify({
    refreshToken: input.refreshToken,
    accessToken: input.accessToken,
    email: input.email,
  });
  await db
    .insert(storeConnecteurs)
    .values({
      ownerId,
      storeId,
      kind: "google_sheets",
      label: "Google Sheets — ربط Google OAuth",
      identifier: input.spreadsheetId.trim(),
      secretEncrypted: encryptSecret(secret),
      enabled: true,
      lastError: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        identifier: input.spreadsheetId.trim(),
        secretEncrypted: encryptSecret(secret),
        enabled: true,
        lastError: null,
      },
    });
  return { success: true } as const;
}

export async function getGoogleOAuthConnection(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({
      identifier: storeConnecteurs.identifier,
      secretEncrypted: storeConnecteurs.secretEncrypted,
      enabled: storeConnecteurs.enabled,
    })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, "google_sheets")
      )
    )
    .limit(1);
  if (!row?.enabled || !row.identifier || !row.secretEncrypted)
    return undefined;
  try {
    return {
      spreadsheetId: row.identifier,
      ...(JSON.parse(decryptSecret(row.secretEncrypted)) as {
        refreshToken: string;
        accessToken?: string;
        email?: string;
      }),
    };
  } catch {
    return undefined;
  }
}

export async function getConnecteurSecret(
  storeId: number,
  kind: "google_sheets" | "notifications" | "cloudflare_turnstile"
) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({ secretEncrypted: storeConnecteurs.secretEncrypted })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, kind)
      )
    )
    .limit(1);
  return row?.secretEncrypted ? decryptSecret(row.secretEncrypted) : undefined;
}

export async function getNotificationSettings(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({
      enabled: storeConnecteurs.enabled,
      secretEncrypted: storeConnecteurs.secretEncrypted,
    })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, "notifications")
      )
    )
    .limit(1);
  if (!row?.enabled || !row.secretEncrypted) return undefined;
  try {
    return JSON.parse(decryptSecret(row.secretEncrypted)) as {
      whatsappPhoneId?: string;
      whatsappToken?: string;
      telegramBotToken?: string;
      telegramChatId?: string;
      smsProvider?: string;
      smsApiUrl?: string;
      smsApiKey?: string;
      whatsappRecipient?: string;
      smsRecipient?: string;
    };
  } catch {
    return undefined;
  }
}

export async function deleteConnecteur(
  storeId: number,
  kind:
    | "meta_capi"
    | "tiktok_capi"
    | "snapchat_capi"
    | "facebook_domain"
    | "cloudflare_turnstile"
    | "google_sheets"
    | "abandoned_orders"
    | "notifications"
    | "message_order"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .delete(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, kind)
      )
    );
  return { success: true } as const;
}

export async function getConnecteurPixelCredentials(
  storeId: number,
  kind: "meta_capi" | "tiktok_capi" | "snapchat_capi"
) {
  const db = await getDb();
  if (!db) return [];
  const [connecteur] = await db
    .select({
      id: storeConnecteurs.id,
      identifier: storeConnecteurs.identifier,
      secretEncrypted: storeConnecteurs.secretEncrypted,
      enabled: storeConnecteurs.enabled,
    })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, kind)
      )
    )
    .limit(1);
  if (!connecteur?.enabled) return [];
  if (!connecteur.identifier || !connecteur.secretEncrypted) return [];
  const secret = decryptSecret(connecteur.secretEncrypted);
  const pixels = await db
    .select({
      pixelId: storeConnecteurPixels.pixelId,
      enabled: storeConnecteurPixels.enabled,
    })
    .from(storeConnecteurPixels)
    .where(eq(storeConnecteurPixels.connecteurId, connecteur.id));
  if (pixels.length)
    return pixels
      .filter(pixel => pixel.enabled)
      .map(pixel => ({ identifier: pixel.pixelId, secret }));
  return [{ identifier: connecteur.identifier, secret }];
}

export async function getConnecteurCredentials(
  storeId: number,
  kind: "meta_capi" | "tiktok_capi" | "snapchat_capi"
) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({
      identifier: storeConnecteurs.identifier,
      secretEncrypted: storeConnecteurs.secretEncrypted,
      enabled: storeConnecteurs.enabled,
    })
    .from(storeConnecteurs)
    .where(
      and(
        eq(storeConnecteurs.storeId, storeId),
        eq(storeConnecteurs.kind, kind)
      )
    )
    .limit(1);
  if (!row?.enabled || !row.identifier || !row.secretEncrypted)
    return undefined;
  return {
    identifier: row.identifier,
    secret: decryptSecret(row.secretEncrypted),
  };
}

export async function listCarrierConnections(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: deliveryCarrierConnections.id,
      provider: deliveryCarrierConnections.provider,
      accountName: deliveryCarrierConnections.accountName,
      status: deliveryCarrierConnections.status,
      userGuid: deliveryCarrierConnections.userGuid,
      apiBaseUrl: deliveryCarrierConnections.apiBaseUrl,
      pricingMode: deliveryCarrierConnections.pricingMode,
      lastError: deliveryCarrierConnections.lastError,
      updatedAt: deliveryCarrierConnections.updatedAt,
    })
    .from(deliveryCarrierConnections)
    .where(eq(deliveryCarrierConnections.storeId, storeId))
    .orderBy(asc(deliveryCarrierConnections.provider));
}

export async function saveCarrierConnection(
  ownerId: number,
  storeId: number,
  input: {
    provider: "yalidine" | "zr_express" | "noest" | "ecotrack";
    accountName?: string;
    userGuid?: string;
    apiBaseUrl?: string;
    apiToken: string;
    pricingMode: "manual" | "carrier";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const encrypted = encryptSecret(input.apiToken);
  const accountName = input.accountName?.trim() || "الحساب الرئيسي";
  await db
    .insert(deliveryCarrierConnections)
    .values({
      ownerId,
      storeId,
      provider: input.provider,
      accountName,
      userGuid:
        input.provider === "ecotrack" ? null : input.userGuid?.trim() || null,
      apiBaseUrl: input.apiBaseUrl?.trim() || null,
      apiTokenEncrypted: encrypted,
      pricingMode: input.pricingMode,
      status: "connected",
      lastError: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        userGuid:
          input.provider === "ecotrack" ? null : input.userGuid?.trim() || null,
        apiBaseUrl: input.apiBaseUrl?.trim() || null,
        apiTokenEncrypted: encrypted,
        pricingMode: input.pricingMode,
        status: "connected",
        lastError: null,
      },
    });
  return { success: true } as const;
}

export async function updateCarrierConnection(
  storeId: number,
  connectionId: number,
  input: { accountName: string; apiBaseUrl: string; apiToken?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = {
    accountName: input.accountName.trim(),
    apiBaseUrl: input.apiBaseUrl.trim(),
    ...(input.apiToken?.trim()
      ? { apiTokenEncrypted: encryptSecret(input.apiToken.trim()) }
      : {}),
  };
  await db
    .update(deliveryCarrierConnections)
    .set(values)
    .where(
      and(
        eq(deliveryCarrierConnections.id, connectionId),
        eq(deliveryCarrierConnections.storeId, storeId),
        eq(deliveryCarrierConnections.provider, "ecotrack")
      )
    );
  return { success: true } as const;
}

export async function deleteCarrierConnection(
  storeId: number,
  connectionId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .delete(deliveryCarrierConnections)
    .where(
      and(
        eq(deliveryCarrierConnections.id, connectionId),
        eq(deliveryCarrierConnections.storeId, storeId),
        eq(deliveryCarrierConnections.provider, "ecotrack")
      )
    );
  return { success: true } as const;
}

export async function getCarrierCredentials(
  storeId: number,
  provider: "ecotrack",
  connectionId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const [connection] = await db
    .select({
      id: deliveryCarrierConnections.id,
      accountName: deliveryCarrierConnections.accountName,
      apiBaseUrl: deliveryCarrierConnections.apiBaseUrl,
      userGuid: deliveryCarrierConnections.userGuid,
      apiTokenEncrypted: deliveryCarrierConnections.apiTokenEncrypted,
      status: deliveryCarrierConnections.status,
    })
    .from(deliveryCarrierConnections)
    .where(
      and(
        eq(deliveryCarrierConnections.storeId, storeId),
        eq(deliveryCarrierConnections.provider, provider),
        ...(connectionId
          ? [eq(deliveryCarrierConnections.id, connectionId)]
          : [])
      )
    )
    .limit(1);
  if (
    !connection?.apiBaseUrl ||
    !connection.apiTokenEncrypted ||
    connection.status !== "connected"
  )
    return undefined;
  let token: string;
  try {
    token = decryptSecret(connection.apiTokenEncrypted);
  } catch {
    throw new Error(
      `بيانات اعتماد حساب «${connection.accountName}» غير قابلة للقراءة. أعد فتح الحساب وأدخل التوكن من جديد في حقل «تغيير API Token».`
    );
  }
  return {
    id: connection.id,
    accountName: connection.accountName,
    baseUrl: connection.apiBaseUrl,
    token,
  };
}

export async function updateOrderCarrierData(
  storeId: number,
  orderId: number,
  data: {
    carrierTracking?: string;
    carrierStatus?: string;
    carrierStatusUpdatedAt?: Date;
    shippingLabelUrl?: string;
    carrierMunicipality?: string;
    carrierConnectionId?: number;
    fulfillmentStatus?: "at_carrier" | "delivered" | "returned" | "cancelled";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (data.fulfillmentStatus === "at_carrier")
    await applyOrderInventoryLifecycle(storeId, orderId, "at_carrier");
  if (data.fulfillmentStatus === "returned")
    await applyOrderInventoryLifecycle(storeId, orderId, "returned");
  await db
    .update(storeOrders)
    .set(data)
    .where(and(eq(storeOrders.storeId, storeId), eq(storeOrders.id, orderId)));
  const [order] = await db
    .select()
    .from(storeOrders)
    .where(and(eq(storeOrders.storeId, storeId), eq(storeOrders.id, orderId)))
    .limit(1);
  if (!order) throw new Error("الطلب غير موجود أو لا تملك صلاحية تعديله.");
  if (data.carrierStatus) {
    import("./trackingRetarget")
      .then(module =>
        module.notifyOrderTrackingStatus(orderId, {
          raw: String(order.carrierStatus ?? ""),
          fulfillmentStatus: String(order.fulfillmentStatus ?? ""),
        })
      )
      .catch(error =>
        console.warn(
          `[Tracking] legacy sync notify skipped for order ${orderId}:`,
          error instanceof Error ? error.message : error
        )
      );
  }
  return order;
}

export async function getCarrierWilayaRates(
  storeId: number,
  carrierConnectionId: number
) {
  const db = await getDb();
  if (!db) return [];
  const stored = await db
    .select()
    .from(deliveryCarrierWilayaRates)
    .where(
      and(
        eq(deliveryCarrierWilayaRates.storeId, storeId),
        eq(deliveryCarrierWilayaRates.carrierConnectionId, carrierConnectionId)
      )
    )
    .orderBy(asc(deliveryCarrierWilayaRates.wilayaCode));
  if (
    stored.length &&
    stored.some(
      rate => Number(rate.homeFee ?? 0) > 0 || Number(rate.officeFee ?? 0) > 0
    )
  )
    return stored;
  const [account] = await db
    .select({ apiBaseUrl: deliveryCarrierConnections.apiBaseUrl })
    .from(deliveryCarrierConnections)
    .where(
      and(
        eq(deliveryCarrierConnections.id, carrierConnectionId),
        eq(deliveryCarrierConnections.storeId, storeId)
      )
    )
    .limit(1);
  const catalog = getEcotrackProviderCatalog(account?.apiBaseUrl);
  if (!catalog) return [];
  const defaults = catalog.providerKey === "hhd-express" ? hhdDefaultRates : [];
  return defaults.map(rate => ({
    id: 0,
    ownerId: 0,
    storeId,
    carrierConnectionId,
    ...rate,
    homeEnabled: rate.homeEnabled ?? true,
    officeEnabled: rate.officeEnabled ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

export async function saveCarrierWilayaRates(
  ownerId: number,
  storeId: number,
  carrierConnectionId: number,
  rates: Array<{
    wilayaCode: string;
    wilayaName: string;
    officeEnabled: boolean;
    officeFee: string | null;
    homeEnabled: boolean;
    homeFee: string | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [connection] = await db
    .select({ id: deliveryCarrierConnections.id })
    .from(deliveryCarrierConnections)
    .where(
      and(
        eq(deliveryCarrierConnections.id, carrierConnectionId),
        eq(deliveryCarrierConnections.storeId, storeId),
        eq(deliveryCarrierConnections.status, "connected")
      )
    )
    .limit(1);
  if (!connection) throw new Error("شركة التوصيل غير مرتبطة أو غير متاحة.");
  await db.transaction(async tx => {
    await tx
      .delete(deliveryCarrierWilayaRates)
      .where(
        and(
          eq(deliveryCarrierWilayaRates.storeId, storeId),
          eq(
            deliveryCarrierWilayaRates.carrierConnectionId,
            carrierConnectionId
          )
        )
      );
    if (rates.length)
      await tx.insert(deliveryCarrierWilayaRates).values(
        rates.map(rate => ({
          ownerId,
          storeId,
          carrierConnectionId,
          ...rate,
        }))
      );
  });
  return getCarrierWilayaRates(storeId, carrierConnectionId);
}

export async function getDeliverySettings(storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [settings] = await db
    .select()
    .from(deliverySettings)
    .where(eq(deliverySettings.storeId, storeId))
    .limit(1);
  const wilayaRates = await db
    .select()
    .from(deliveryWilayaRates)
    .where(eq(deliveryWilayaRates.storeId, storeId))
    .orderBy(asc(deliveryWilayaRates.wilayaCode));
  return {
    settings: settings
      ? {
          ...settings,
          hiddenWilayaCodes: JSON.parse(
            settings.hiddenWilayaCodesJson || "[]"
          ) as string[],
        }
      : {
          fixedOfficeEnabled: false,
          fixedOfficeFee: null,
          fixedHomeEnabled: false,
          fixedHomeFee: null,
          pricingMode: "manual" as const,
          customerCarrierChoiceEnabled: false,
          hiddenWilayaCodes: [] as string[],
        },
    wilayaRates,
  };
}

export async function saveDeliverySettings(
  ownerId: number,
  storeId: number,
  input: DeliverySettingsInput
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.transaction(async tx => {
    await tx
      .insert(deliverySettings)
      .values({
        ownerId,
        storeId,
        fixedOfficeEnabled: input.fixedOfficeEnabled,
        fixedOfficeFee: input.fixedOfficeEnabled ? input.fixedOfficeFee : null,
        fixedHomeEnabled: input.fixedHomeEnabled,
        fixedHomeFee: input.fixedHomeEnabled ? input.fixedHomeFee : null,
        pricingMode: input.pricingMode,
        hiddenWilayaCodesJson: JSON.stringify(input.hiddenWilayaCodes),
        customerCarrierChoiceEnabled: input.customerCarrierChoiceEnabled,
      })
      .onDuplicateKeyUpdate({
        set: {
          fixedOfficeEnabled: input.fixedOfficeEnabled,
          fixedOfficeFee: input.fixedOfficeEnabled
            ? input.fixedOfficeFee
            : null,
          fixedHomeEnabled: input.fixedHomeEnabled,
          fixedHomeFee: input.fixedHomeEnabled ? input.fixedHomeFee : null,
          pricingMode: input.pricingMode,
          hiddenWilayaCodesJson: JSON.stringify(input.hiddenWilayaCodes),
          customerCarrierChoiceEnabled: input.customerCarrierChoiceEnabled,
        },
      });
    await tx
      .delete(deliveryWilayaRates)
      .where(eq(deliveryWilayaRates.storeId, storeId));
    if (input.wilayaRates.length)
      await tx.insert(deliveryWilayaRates).values(
        input.wilayaRates.map(rate => ({
          ownerId,
          storeId,
          wilayaCode: rate.wilayaCode,
          wilayaName: rate.wilayaName,
          officeEnabled: rate.officeEnabled,
          officeFee: rate.officeEnabled ? rate.officeFee : null,
          homeEnabled: rate.homeEnabled,
          homeFee: rate.homeEnabled ? rate.homeFee : null,
        }))
      );
  });
  return getDeliverySettings(storeId);
}

export async function listPublicCarrierConnectionsForProduct(
  productId: number
) {
  const db = await getDb();
  if (!db) return { allowCustomerChoice: false, accounts: [] };
  const [product] = await db
    .select({ storeId: storeProducts.storeId })
    .from(storeProducts)
    .where(
      and(eq(storeProducts.id, productId), eq(storeProducts.status, "active"))
    )
    .limit(1);
  if (!product?.storeId) return { allowCustomerChoice: false, accounts: [] };
  const [settings] = await db
    .select({
      customerCarrierChoiceEnabled:
        deliverySettings.customerCarrierChoiceEnabled,
    })
    .from(deliverySettings)
    .where(eq(deliverySettings.storeId, product.storeId))
    .limit(1);
  const accounts = await db
    .select({
      id: deliveryCarrierConnections.id,
      accountName: deliveryCarrierConnections.accountName,
      apiBaseUrl: deliveryCarrierConnections.apiBaseUrl,
      provider: deliveryCarrierConnections.provider,
    })
    .from(deliveryCarrierConnections)
    .where(
      and(
        eq(deliveryCarrierConnections.storeId, product.storeId),
        eq(deliveryCarrierConnections.provider, "ecotrack"),
        eq(deliveryCarrierConnections.status, "connected")
      )
    )
    .orderBy(asc(deliveryCarrierConnections.id));
  const uniqueCompanies = Array.from(
    new Map(
      accounts.map(account => [
        normalizeEcotrackHostname(account.apiBaseUrl),
        account,
      ])
    ).values()
  );
  return {
    allowCustomerChoice: Boolean(
      settings?.customerCarrierChoiceEnabled && uniqueCompanies.length > 1
    ),
    accounts: uniqueCompanies.map(account => ({
      ...account,
      accountName:
        getEcotrackProviderCatalog(account.apiBaseUrl)?.displayName ??
        account.accountName,
      catalog: getEcotrackProviderCatalog(account.apiBaseUrl),
    })),
  };
}

export async function getDashboardStats(storeId: number) {
  const db = await getDb();
  if (!db)
    return {
      salesThisMonth: "0.00",
      ordersCount: 0,
      customersCount: 0,
      publishedProducts: 0,
      abandonedCount: 0,
      recentOrders: [],
      salesByDay: [],
      statusCounts: {},
    };
  const [orders, products, abandoned] = await Promise.all([
    db
      .select()
      .from(storeOrders)
      .where(eq(storeOrders.storeId, storeId))
      .orderBy(desc(storeOrders.createdAt)),
    db
      .select({ id: storeProducts.id, status: storeProducts.status })
      .from(storeProducts)
      .where(eq(storeProducts.storeId, storeId)),
    db
      .select({ id: abandonedOrders.id })
      .from(abandonedOrders)
      .where(
        and(
          eq(abandonedOrders.storeId, storeId),
          eq(abandonedOrders.status, "open")
        )
      ),
  ]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const salesThisMonth = orders
    .filter(
      order =>
        new Date(order.createdAt).getTime() >= monthStart &&
        order.fulfillmentStatus !== "cancelled" &&
        order.fulfillmentStatus !== "fake"
    )
    .reduce((sum, order) => sum + toCents(order.total), 0);
  const uniqueCustomers = new Set(orders.map(order => order.customerPhone))
    .size;
  const statusCounts = orders.reduce<Record<string, number>>(
    (counts, order) => {
      counts[order.fulfillmentStatus] =
        (counts[order.fulfillmentStatus] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const cents = orders
      .filter(order => {
        const created = new Date(order.createdAt).getTime();
        return (
          created >= date.getTime() &&
          created < next.getTime() &&
          order.fulfillmentStatus !== "cancelled" &&
          order.fulfillmentStatus !== "fake"
        );
      })
      .reduce((sum, order) => sum + toCents(order.total), 0);
    return { date: date.toISOString().slice(0, 10), value: fromCents(cents) };
  });
  return {
    salesThisMonth: fromCents(salesThisMonth),
    ordersCount: orders.length,
    customersCount: uniqueCustomers,
    publishedProducts: products.filter(product => product.status === "active")
      .length,
    abandonedCount: abandoned.length,
    statusCounts,
    recentOrders: orders.slice(0, 5),
    salesByDay,
  };
}

export type CroAuditSnapshot = {
  catalog: {
    products: number;
    activeProducts: number;
    productsWithoutImages: number;
    avgImagesPerActiveProduct: number;
    activeWithCompareAtPrice: number;
    activeWithShortDescription: number;
    freeDeliveryOffers: number;
    digitalProducts: number;
    productVideoSupported: boolean;
    reviewsSupported: boolean;
  };
  delivery: {
    pricingMode: string;
    feesConfigured: boolean;
    officeFee: number | null;
    homeFee: number | null;
    wilayaRates: number;
    carrierConnected: boolean;
  };
  storefront: {
    showTrustBadges: boolean;
    showCountdown: boolean;
    showNewsletter: boolean;
    contactBarActive: boolean;
    whatsappConfigured: boolean;
    phoneConfigured: boolean;
  };
  conversion: {
    views: number;
    ctaClicks: number;
    discountOrders: number;
    ctr: number;
    conversionRate: number;
    rejections: Record<string, number>;
  };
  orders: {
    totalOrders: number;
    customers: number;
    publishedProducts: number;
    abandonedOpen: number;
    abandonedTrackingEnabled: boolean;
    statusCounts: Record<string, number>;
  };
  funnels: {
    total: number;
    published: number;
  };
  sharkCod: {
    enabled: boolean;
    discountPercent: number;
  };
};

export async function getCroAuditSnapshot(
  storeId: number
): Promise<CroAuditSnapshot> {
  const blank = (): CroAuditSnapshot => ({
    catalog: {
      products: 0,
      activeProducts: 0,
      productsWithoutImages: 0,
      avgImagesPerActiveProduct: 0,
      activeWithCompareAtPrice: 0,
      activeWithShortDescription: 0,
      freeDeliveryOffers: 0,
      digitalProducts: 0,
      productVideoSupported: false,
      reviewsSupported: false,
    },
    delivery: {
      pricingMode: "manual",
      feesConfigured: false,
      officeFee: null,
      homeFee: null,
      wilayaRates: 0,
      carrierConnected: false,
    },
    storefront: {
      showTrustBadges: true,
      showCountdown: true,
      showNewsletter: true,
      contactBarActive: false,
      whatsappConfigured: false,
      phoneConfigured: false,
    },
    conversion: {
      views: 0,
      ctaClicks: 0,
      discountOrders: 0,
      ctr: 0,
      conversionRate: 0,
      rejections: {},
    },
    orders: {
      totalOrders: 0,
      customers: 0,
      publishedProducts: 0,
      abandonedOpen: 0,
      abandonedTrackingEnabled: false,
      statusCounts: {},
    },
    funnels: { total: 0, published: 0 },
    sharkCod: { enabled: false, discountPercent: 0 },
  });
  const db = await getDb();
  if (!db) return blank();

  const [
    productRows,
    connecteurRows,
    landingRows,
    abandonedRows,
    deliveryRows,
    wilayaRateRows,
    carrierRows,
  ] = await Promise.all([
    db
      .select({
        id: storeProducts.id,
        status: storeProducts.status,
        productKind: storeProducts.productKind,
        compareAtPrice: storeProducts.compareAtPrice,
        description: storeProducts.description,
      })
      .from(storeProducts)
      .where(eq(storeProducts.storeId, storeId)),
    db
      .select({ kind: storeConnecteurs.kind, enabled: storeConnecteurs.enabled })
      .from(storeConnecteurs)
      .where(eq(storeConnecteurs.storeId, storeId)),
    db
      .select({ status: landingPages.status })
      .from(landingPages)
      .where(eq(landingPages.storeId, storeId)),
    db
      .select({ id: abandonedOrders.id })
      .from(abandonedOrders)
      .where(
        and(
          eq(abandonedOrders.storeId, storeId),
          eq(abandonedOrders.status, "open")
        )
      ),
    db
      .select()
      .from(deliverySettings)
      .where(eq(deliverySettings.storeId, storeId))
      .limit(1),
    db
      .select({ id: deliveryWilayaRates.id })
      .from(deliveryWilayaRates)
      .where(eq(deliveryWilayaRates.storeId, storeId)),
    db
      .select({ id: deliveryCarrierConnections.id })
      .from(deliveryCarrierConnections)
      .where(eq(deliveryCarrierConnections.storeId, storeId)),
  ]);

  const deliveryRow = deliveryRows[0];
  const activeProducts = productRows.filter(p => p.status === "active");
  const activeIds = activeProducts.map(p => p.id);

  const imageCountMap: Record<number, number> = {};
  const freeDeliveryOffers = new Set<number>();
  if (activeIds.length) {
    const [imageRows, offerRows] = await Promise.all([
      db
        .select({ productId: storeProductImages.productId })
        .from(storeProductImages)
        .where(inArray(storeProductImages.productId, activeIds)),
      db
        .select({
          productId: storeProductOffers.productId,
          enabled: storeProductOffers.enabled,
          freeDelivery: storeProductOffers.freeDelivery,
        })
        .from(storeProductOffers)
        .where(inArray(storeProductOffers.productId, activeIds)),
    ]);
    for (const image of imageRows) {
      imageCountMap[image.productId] = (imageCountMap[image.productId] ?? 0) + 1;
    }
    for (const offer of offerRows) {
      if (offer.enabled && offer.freeDelivery)
        freeDeliveryOffers.add(offer.productId);
    }
  }

  const productsWithoutImages = activeProducts.filter(
    product => !(imageCountMap[product.id] ?? 0)
  ).length;
  const activeWithCompareAtPrice = activeProducts.filter(
    product => product.compareAtPrice !== null
  ).length;
  const activeWithShortDescription = activeProducts.filter(
    product => (product.description?.trim().length ?? 0) < 80
  ).length;
  const totalImages = activeProducts.reduce(
    (sum, product) => sum + (imageCountMap[product.id] ?? 0),
    0
  );

  const [theme, contact, sharkSettings, sharkAnalytics, orderRows] =
    await Promise.all([
      getStoreThemeSettings(storeId),
      getContactBarSettings(storeId),
      getSharkCodSettings(storeId),
      getSharkCodAnalytics(storeId),
      db
        .select({
          fulfillmentStatus: storeOrders.fulfillmentStatus,
          customerPhone: storeOrders.customerPhone,
        })
        .from(storeOrders)
        .where(eq(storeOrders.storeId, storeId)),
    ]);

  let customization: Record<string, unknown> = {};
  try {
    customization = JSON.parse(theme.customizationJson);
  } catch {
    customization = {};
  }
  const abandonedConnecteur = connecteurRows.find(
    row => row.kind === "abandoned_orders"
  );
  const statusCounts: Record<string, number> = {};
  const customers = new Set<string>();
  for (const order of orderRows) {
    statusCounts[order.fulfillmentStatus] =
      (statusCounts[order.fulfillmentStatus] ?? 0) + 1;
    if (order.customerPhone) customers.add(order.customerPhone);
  }

  const snapshot: CroAuditSnapshot = {
    catalog: {
      products: productRows.length,
      activeProducts: activeProducts.length,
      productsWithoutImages,
      avgImagesPerActiveProduct:
        activeProducts.length > 0
          ? Math.round((totalImages / activeProducts.length) * 10) / 10
          : 0,
      activeWithCompareAtPrice,
      activeWithShortDescription,
      freeDeliveryOffers: freeDeliveryOffers.size,
      digitalProducts: productRows.filter(
        product => product.productKind === "digital"
      ).length,
      productVideoSupported: false,
      reviewsSupported: false,
    },
    delivery: {
      pricingMode: deliveryRow?.pricingMode ?? "manual",
      feesConfigured: Boolean(
        deliveryRow &&
          (deliveryRow.fixedOfficeEnabled ||
            deliveryRow.fixedHomeEnabled ||
            deliveryRow.pricingMode !== "manual")
      ),
      officeFee: deliveryRow?.fixedOfficeFee
        ? Number(deliveryRow.fixedOfficeFee)
        : null,
      homeFee: deliveryRow?.fixedHomeFee
        ? Number(deliveryRow.fixedHomeFee)
        : null,
      wilayaRates: wilayaRateRows.length,
      carrierConnected: carrierRows.length > 0,
    },
    storefront: {
      showTrustBadges: customization.showTrustBadges !== false,
      showCountdown: customization.showCountdown !== false,
      showNewsletter: customization.showNewsletter !== false,
      contactBarActive: Boolean(
        contact.enabled && (contact.phoneEnabled || contact.whatsappEnabled)
      ),
      whatsappConfigured: Boolean(contact.whatsappNumber),
      phoneConfigured: Boolean(contact.phoneNumber),
    },
    conversion: {
      views: sharkAnalytics.views,
      ctaClicks: sharkAnalytics.ctaClicks,
      discountOrders: sharkAnalytics.discountOrders,
      ctr: sharkAnalytics.ctr,
      conversionRate: sharkAnalytics.conversionRate,
      rejections: sharkAnalytics.rejections,
    },
    orders: {
      totalOrders: orderRows.length,
      customers: customers.size,
      publishedProducts: activeProducts.length,
      abandonedOpen: abandonedRows.length,
      abandonedTrackingEnabled: Boolean(abandonedConnecteur?.enabled),
      statusCounts,
    },
    funnels: {
      total: landingRows.length,
      published: landingRows.filter(row => row.status === "published").length,
    },
    sharkCod: {
      enabled: Boolean(sharkSettings?.enabled),
      discountPercent: sharkSettings?.discountPercent ?? 0,
    },
  };

  // fee fallback: manual per-wilaya rates or carrier fees also count as "configured".
  snapshot.delivery.feesConfigured = Boolean(
    snapshot.delivery.feesConfigured ||
      snapshot.delivery.wilayaRates > 0 ||
      snapshot.delivery.carrierConnected
  );
  return snapshot;
}

export async function updateStoreProduct(
  storeId: number,
  id: number,
  input: Omit<StoreProductInput, "media" | "variants" | "imageIdByClientId">
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const current = await getStoreProductById(storeId, id);
  if (!current) throw new Error("المنتج غير موجود أو لا تملك صلاحية تعديله.");
  await db
    .update(storeProducts)
    .set({
      title: input.title,
      description: input.description,
      productType: input.productType,
      productKind: input.productKind ?? current.productKind,
      currency: input.currency ?? current.currency,
      collectionName: input.collectionName,
      digitalFileName: input.digitalFileName ?? current.digitalFileName,
      digitalFileStorageKey:
        input.digitalFileStorageKey ?? current.digitalFileStorageKey,
      digitalFileUrl: input.digitalFileUrl ?? current.digitalFileUrl,
      digitalFileSize: input.digitalFileSize ?? current.digitalFileSize,
      digitalFileMimeType:
        input.digitalFileMimeType ?? current.digitalFileMimeType,
      digitalMaxDownloads:
        input.digitalMaxDownloads ?? current.digitalMaxDownloads,
      digitalLinkValidityHours:
        input.digitalLinkValidityHours ?? current.digitalLinkValidityHours,
      status: input.status,
      price: input.price,
      compareAtPrice: input.compareAtPrice,
      costPerItem: input.costPerItem,
      sku: input.sku,
      inventory: input.inventory,
      lowStockThreshold: input.lowStockThreshold,
      showStockThreshold: input.showStockThreshold,
      trackInventory: input.trackInventory,
      continueSelling: input.continueSelling,
      deliveryPricingMode: input.deliveryPricingMode,
      deliveryCarrierConnectionId: input.deliveryCarrierConnectionId ?? null,
      upsellProductId: input.upsellProductId ?? null,
      upsellPrice: input.upsellPrice ?? null,
      upsellDiscountAmount: input.upsellDiscountAmount ?? null,
      upsellDiscountPercent: input.upsellDiscountPercent ?? null,
      upsellViewType: input.upsellViewType ?? "product",
      upsellLandingPageId: input.upsellLandingPageId ?? null,
      codTrustScore: input.codTrustScore ?? null,
      costAccountingMode: input.costAccountingMode,
      costQuantity: input.costQuantity,
      productCostTotal: input.productCostTotal,
      packagingCostPerItem: input.packagingCostPerItem,
      packagingCostTotal: input.packagingCostTotal,
      procurementDeliveryCostPerItem: input.procurementDeliveryCostPerItem,
      procurementDeliveryCostTotal: input.procurementDeliveryCostTotal,
      returnCostPerOrder: input.returnCostPerOrder,
      returnDeliveryFree: input.returnDeliveryFree,
      costBatches: input.costBatches,
    })
    .where(eq(storeProducts.id, id));
  if (input.offers) {
    await db
      .delete(storeProductOffers)
      .where(eq(storeProductOffers.productId, id));
    if (input.offers.length)
      await db.insert(storeProductOffers).values(
        input.offers.map(offer => ({
          productId: id,
          description: offer.description,
          quantity: offer.quantity,
          price: offer.price,
          maxUses: offer.maxUses,
          freeDelivery: offer.freeDelivery,
          enabled: offer.enabled,
        }))
      );
  }
  const product = await getStoreProductById(storeId, id);
  if (!product) throw new Error("تعذر تحميل المنتج بعد التعديل.");
  return product;
}

export async function duplicateStoreProduct(storeId: number, id: number) {
  const source = await getStoreProductById(storeId, id);
  if (!source) throw new Error("المنتج غير موجود أو لا تملك صلاحية تكراره.");
  const imageClientIdByImageId = new Map(
    source.images.map(image => [image.id, `copy-${image.id}`])
  );
  return createStoreProduct(source.ownerId, storeId, {
    title: `${source.title} — نسخة`,
    description: source.description,
    productType: source.productType,
    productKind: source.productKind,
    currency: source.currency,
    collectionName: source.collectionName,
    digitalFileName: source.digitalFileName,
    digitalFileStorageKey: source.digitalFileStorageKey,
    digitalFileUrl: source.digitalFileUrl,
    digitalFileSize: source.digitalFileSize,
    digitalFileMimeType: source.digitalFileMimeType,
    digitalMaxDownloads: source.digitalMaxDownloads,
    digitalLinkValidityHours: source.digitalLinkValidityHours,
    status: "draft",
    price: source.price,
    compareAtPrice: source.compareAtPrice,
    costPerItem: source.costPerItem,
    costAccountingMode: source.costAccountingMode,
    costQuantity: source.costQuantity,
    productCostTotal: source.productCostTotal,
    packagingCostPerItem: source.packagingCostPerItem,
    packagingCostTotal: source.packagingCostTotal,
    procurementDeliveryCostPerItem: source.procurementDeliveryCostPerItem,
    procurementDeliveryCostTotal: source.procurementDeliveryCostTotal,
    returnCostPerOrder: source.returnCostPerOrder,
    returnDeliveryFree: source.returnDeliveryFree,
    costBatches: source.costBatches,
    sku: null,
    inventory: source.inventory,
    lowStockThreshold: source.lowStockThreshold,
    showStockThreshold: source.showStockThreshold,
    trackInventory: source.trackInventory,
    continueSelling: source.continueSelling,
    deliveryPricingMode: source.deliveryPricingMode,
    deliveryCarrierConnectionId: source.deliveryCarrierConnectionId,
    upsellProductId: source.upsellProductId ?? null,
    upsellPrice: source.upsellPrice ?? null,
    upsellDiscountAmount: source.upsellDiscountAmount ?? null,
    upsellDiscountPercent: source.upsellDiscountPercent ?? null,
    upsellViewType: source.upsellViewType ?? "product",
    upsellLandingPageId: source.upsellLandingPageId ?? null,
    media: source.images.map(image => ({
      clientId: imageClientIdByImageId.get(image.id) ?? `copy-${image.id}`,
      storageKey: image.storageKey,
      url: image.url,
      altText: image.altText ?? source.title,
      position: image.position,
    })),
    offers: source.offers.map(offer => ({
      description: offer.description,
      quantity: offer.quantity,
      price: offer.price,
      maxUses: offer.maxUses,
      freeDelivery: offer.freeDelivery,
      enabled: offer.enabled,
    })),
    variants: source.variants.map(variant => ({
      color: variant.color,
      size: variant.size,
      sku: null,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      showStockThreshold: variant.showStockThreshold,
      mediaId: variant.imageId
        ? imageClientIdByImageId.get(variant.imageId)
        : undefined,
      available: variant.available,
    })),
    imageIdByClientId: new Map(),
  });
}

export async function deleteStoreProduct(storeId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const current = await getStoreProductById(storeId, id);
  if (!current) throw new Error("المنتج غير موجود أو لا تملك صلاحية حذفه.");
  await db
    .delete(storeProductVariants)
    .where(eq(storeProductVariants.productId, id));
  await db
    .delete(storeProductImages)
    .where(eq(storeProductImages.productId, id));
  await db.delete(storeProducts).where(eq(storeProducts.id, id));
  return { success: true } as const;
}

export async function getMessageOrderSettings(storeId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(messageOrderSettings)
    .where(eq(messageOrderSettings.storeId, storeId))
    .limit(1);
  return row ?? null;
}

export async function saveMessageOrderSettings(
  ownerId: number,
  storeId: number,
  input: {
    enabled: boolean;
    title: string;
    welcomeMessage: string;
    instructions: string;
    buttonText: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const existing = await getMessageOrderSettings(storeId);
  if (existing) {
    await db
      .update(messageOrderSettings)
      .set({
        enabled: input.enabled,
        title: input.title,
        welcomeMessage: input.welcomeMessage,
        instructions: input.instructions,
        buttonText: input.buttonText,
        updatedAt: new Date(),
      })
      .where(eq(messageOrderSettings.storeId, storeId));
    return getMessageOrderSettings(storeId);
  }
  await db.insert(messageOrderSettings).values({
    ownerId,
    storeId,
    enabled: input.enabled,
    title: input.title,
    welcomeMessage: input.welcomeMessage,
    instructions: input.instructions,
    buttonText: input.buttonText,
  });
  return getMessageOrderSettings(storeId);
}

export async function getPublicMessageOrderSettings(productId: number) {
  const db = await getDb();
  if (!db) return null;
  const product = await getPublicStoreProduct(productId);
  if (!product?.storeId) return null;
  return getMessageOrderSettings(product.storeId);
}

export async function createMessageOrder(input: {
  ownerId: number;
  storeId: number;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  wilayaCode?: string;
  municipality?: string;
  address: string;
  message: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(messageOrders).values({
    ownerId: input.ownerId,
    storeId: input.storeId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    wilaya: input.wilaya,
    wilayaCode: input.wilayaCode ?? null,
    municipality: input.municipality ?? null,
    address: input.address,
    message: input.message,
    status: "new",
    source: "message_order",
  });
  const [row] = await db
    .select()
    .from(messageOrders)
    .where(
      and(
        eq(messageOrders.storeId, input.storeId),
        eq(messageOrders.customerPhone, input.customerPhone),
        eq(messageOrders.message, input.message)
      )
    )
    .limit(1);
  return row!;
}

export async function listMessageOrders(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messageOrders)
    .where(eq(messageOrders.storeId, storeId))
    .orderBy(desc(messageOrders.createdAt));
}

export async function updateMessageOrderStatus(
  storeId: number,
  id: number,
  status: "new" | "review" | "converted" | "archived"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .update(messageOrders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(messageOrders.storeId, storeId), eq(messageOrders.id, id)));
  return { success: true } as const;
}
