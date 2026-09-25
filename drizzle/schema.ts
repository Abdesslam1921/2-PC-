import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** bcrypt hash for email/password sign-in. Nullable for OAuth-only users. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Reserved for future Google sign-in; kept separate from store Google OAuth. */
  googleId: varchar("googleId", { length: 64 }).unique(),
  avatarUrl: text("avatarUrl"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  language: varchar("language", { length: 16 }).default("dz-ar").notNull(),
  templateId: varchar("templateId", { length: 80 }),
  aiStyleConfig: text("aiStyleConfig"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

export const storeProducts = mysqlTable("store_products", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  productType: varchar("productType", { length: 160 }),
  productKind: mysqlEnum("productKind", ["physical", "digital"])
    .default("physical")
    .notNull(),
  currency: varchar("currency", { length: 8 }).default("DZD").notNull(),
  collectionName: varchar("collectionName", { length: 160 }),
  /**
   * One category per product. `collectionName` is kept as archived data but is
   * no longer edited from the product form.
   */
  categoryId: int("categoryId"),
  digitalFileName: varchar("digitalFileName", { length: 255 }),
  digitalFileStorageKey: varchar("digitalFileStorageKey", { length: 512 }),
  digitalFileUrl: varchar("digitalFileUrl", { length: 1024 }),
  digitalFileSize: int("digitalFileSize"),
  digitalFileMimeType: varchar("digitalFileMimeType", { length: 160 }),
  digitalMaxDownloads: int("digitalMaxDownloads"),
  digitalLinkValidityHours: int("digitalLinkValidityHours"),
  status: mysqlEnum("status", ["draft", "active"]).default("draft").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 12, scale: 2 }),
  costPerItem: decimal("costPerItem", { precision: 12, scale: 2 }),
  costAccountingMode: mysqlEnum("costAccountingMode", [
    "per_item",
    "stock_total",
  ])
    .default("per_item")
    .notNull(),
  costQuantity: int("costQuantity").default(1).notNull(),
  productCostTotal: decimal("productCostTotal", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  packagingCostPerItem: decimal("packagingCostPerItem", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  packagingCostTotal: decimal("packagingCostTotal", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  procurementDeliveryCostPerItem: decimal("procurementDeliveryCostPerItem", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  procurementDeliveryCostTotal: decimal("procurementDeliveryCostTotal", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  returnCostPerOrder: decimal("returnCostPerOrder", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  returnDeliveryFree: boolean("returnDeliveryFree").default(false).notNull(),
  costBatches: varchar("costBatches", { length: 8000 }).default("[]").notNull(),
  sku: varchar("sku", { length: 128 }),
  inventory: int("inventory").default(0).notNull(),
  lowStockThreshold: int("lowStockThreshold").default(5).notNull(),
  showStockThreshold: int("showStockThreshold").default(0).notNull(),
  trackInventory: boolean("trackInventory").default(true).notNull(),
  continueSelling: boolean("continueSelling").default(false).notNull(),
  deliveryPricingMode: mysqlEnum("deliveryPricingMode", [
    "fixed",
    "carrier",
    "manual",
  ])
    .default("manual")
    .notNull(),
  deliveryCarrierConnectionId: int("deliveryCarrierConnectionId"),
  /** Product-level free delivery: waives the delivery fee for this product. */
  freeDelivery: boolean("freeDelivery").default(false).notNull(),
  upsellProductId: int("upsellProductId"),
  upsellPrice: decimal("upsellPrice", { precision: 12, scale: 2 }),
  upsellDiscountAmount: decimal("upsellDiscountAmount", {
    precision: 12,
    scale: 2,
  }),
  upsellDiscountPercent: int("upsellDiscountPercent"),
  upsellViewType: mysqlEnum("upsellViewType", ["product", "landing"])
    .default("product")
    .notNull(),
  upsellLandingPageId: int("upsellLandingPageId"),
  codTrustScore: varchar("codTrustScore", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
table => ({
  categoryIdx: index("store_products_category_idx").on(table.categoryId),
  storeIdx: index("store_products_store_idx").on(table.storeId),
}));

export const storeProductImages = mysqlTable("store_product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  altText: varchar("altText", { length: 255 }),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const storeProductOffers = mysqlTable("store_product_offers", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  maxUses: int("maxUses").default(0).notNull(),
  usedCount: int("usedCount").default(0).notNull(),
  freeDelivery: boolean("freeDelivery").default(false).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const storeProductVariants = mysqlTable("store_product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  color: varchar("color", { length: 120 }),
  size: varchar("size", { length: 120 }),
  sku: varchar("sku", { length: 128 }),
  price: decimal("price", { precision: 12, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 12, scale: 2 }),
  stock: int("stock").default(0).notNull(),
  lowStockThreshold: int("lowStockThreshold").default(5).notNull(),
  showStockThreshold: int("showStockThreshold").default(0).notNull(),
  imageId: int("imageId"),
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const storeOrders = mysqlTable("store_orders", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 40 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  wilaya: varchar("wilaya", { length: 120 }).notNull(),
  wilayaCode: varchar("wilayaCode", { length: 3 }),
  municipality: varchar("municipality", { length: 160 }),
  carrierMunicipality: varchar("carrierMunicipality", { length: 160 }),
  deliveryMethod: mysqlEnum("deliveryMethod", ["office", "home"])
    .default("home")
    .notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  paymentMethod: mysqlEnum("paymentMethod", ["cod", "online"])
    .default("cod")
    .notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid"])
    .default("pending")
    .notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", [
    "new",
    "review",
    "confirmed",
    "processing",
    "at_carrier",
    "shipped",
    "delivered",
    "returned",
    "cancelled",
    "customer_unresponsive",
    "phone_cancelled",
    "fake",
  ])
    .default("new")
    .notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  deliveryFee: decimal("deliveryFee", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  deliveryCostSnapshot: decimal("deliveryCostSnapshot", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  /**
   * Snapshot of the offers applied to this order (id, name, discount, free
   * delivery) so reports keep working even if an offer is later edited.
   */
  appliedOffers: json("appliedOffers"),
  carrierTracking: varchar("carrierTracking", { length: 120 }),
  carrierStatus: varchar("carrierStatus", { length: 120 }),
  carrierStatusUpdatedAt: timestamp("carrierStatusUpdatedAt"),
  carrierConnectionId: int("carrierConnectionId"),
  orderType: mysqlEnum("orderType", ["physical", "digital"])
    .default("physical")
    .notNull(),
  shippingLabelUrl: text("shippingLabelUrl"),
  inventoryDeductedAt: timestamp("inventoryDeductedAt"),
  inventoryRestoredAt: timestamp("inventoryRestoredAt"),
  attributionSource: varchar("attributionSource", { length: 80 }),
  fbclid: varchar("fbclid", { length: 255 }),
  utmSource: varchar("utmSource", { length: 160 }),
  utmMedium: varchar("utmMedium", { length: 160 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  metaCampaignId: varchar("metaCampaignId", { length: 80 }),
  metaAdSetId: varchar("metaAdSetId", { length: 80 }),
  metaAdId: varchar("metaAdId", { length: 80 }),
  adSpendAllocatedDzd: decimal("adSpendAllocatedDzd", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  attributionStatus: mysqlEnum("attributionStatus", [
    "unattributed",
    "attributed",
    "manual",
  ])
    .default("unattributed")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const abandonedOrders = mysqlTable("abandoned_orders", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  productId: int("productId").notNull(),
  landingPageId: int("landingPageId"),
  customerName: varchar("customerName", { length: 180 }),
  customerPhone: varchar("customerPhone", { length: 40 }),
  wilaya: varchar("wilaya", { length: 120 }),
  municipality: varchar("municipality", { length: 160 }),
  quantity: int("quantity").default(1).notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["open", "converted", "archived"])
    .default("open")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const storeDigitalDownloads = mysqlTable("store_digital_downloads", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  productId: int("productId").notNull(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  maxDownloads: int("maxDownloads").notNull(),
  downloadCount: int("downloadCount").default(0).notNull(),
  lastDownloadedAt: timestamp("lastDownloadedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const profitabilitySettings = mysqlTable("profitability_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  baseCurrency: varchar("baseCurrency", { length: 8 }).default("DZD").notNull(),
  usdToDzdRate: decimal("usdToDzdRate", { precision: 12, scale: 4 })
    .default("0.00")
    .notNull(),
  attributionModel: mysqlEnum("attributionModel", [
    "last_touch",
    "first_touch",
    "equal_split",
  ])
    .default("last_touch")
    .notNull(),
  includePendingOrders: boolean("includePendingOrders")
    .default(false)
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const profitabilityCampaignLinks = mysqlTable(
  "profitability_campaign_links",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId").notNull(),
    campaignExternalId: varchar("campaignExternalId", { length: 80 }).notNull(),
    productId: int("productId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    storeCampaignUnique: uniqueIndex("profitability_store_campaign_unique").on(
      table.storeId,
      table.campaignExternalId
    ),
  })
);

export const metaAdAccounts = mysqlTable(
  "meta_ad_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    externalAccountId: varchar("externalAccountId", { length: 80 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    accessTokenEncrypted: text("accessTokenEncrypted").notNull(),
    status: mysqlEnum("status", ["connected", "error", "disconnected"])
      .default("connected")
      .notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    lastError: text("lastError"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerExternalAccountUnique: uniqueIndex(
      "meta_owner_external_account_unique"
    ).on(table.storeId, table.externalAccountId),
  })
);

export const metaOAuthStates = mysqlTable("meta_oauth_states", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  codeVerifierEncrypted: text("codeVerifierEncrypted").notNull(),
  redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const metaCampaignAuditLogs = mysqlTable("meta_campaign_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  adAccountId: int("adAccountId"),
  action: varchar("action", { length: 80 }).notNull(),
  status: mysqlEnum("status", [
    "approved",
    "started",
    "succeeded",
    "failed",
    "rejected",
  ]).notNull(),
  requestJson: text("requestJson"),
  responseJson: text("responseJson"),
  externalCampaignId: varchar("externalCampaignId", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const metaCampaigns = mysqlTable(
  "meta_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    adAccountId: int("adAccountId").notNull(),
    externalId: varchar("externalId", { length: 80 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: varchar("status", { length: 80 }),
    objective: varchar("objective", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    accountExternalUnique: uniqueIndex(
      "meta_campaign_account_external_unique"
    ).on(table.adAccountId, table.externalId),
  })
);

export const metaAdSets = mysqlTable(
  "meta_ad_sets",
  {
    id: int("id").autoincrement().primaryKey(),
    adAccountId: int("adAccountId").notNull(),
    campaignId: int("campaignId"),
    externalId: varchar("externalId", { length: 80 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: varchar("status", { length: 80 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    accountExternalUnique: uniqueIndex("meta_adset_account_external_unique").on(
      table.adAccountId,
      table.externalId
    ),
  })
);

export const metaAds = mysqlTable(
  "meta_ads",
  {
    id: int("id").autoincrement().primaryKey(),
    adAccountId: int("adAccountId").notNull(),
    campaignId: int("campaignId"),
    adSetId: int("adSetId"),
    externalId: varchar("externalId", { length: 80 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: varchar("status", { length: 80 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    accountExternalUnique: uniqueIndex("meta_ad_account_external_unique").on(
      table.adAccountId,
      table.externalId
    ),
  })
);

export const metaAdInsights = mysqlTable(
  "meta_ad_insights",
  {
    id: int("id").autoincrement().primaryKey(),
    adAccountId: int("adAccountId").notNull(),
    campaignId: int("campaignId"),
    adSetId: int("adSetId"),
    adId: int("adId"),
    externalObjectId: varchar("externalObjectId", { length: 80 }).notNull(),
    level: mysqlEnum("level", ["account", "campaign", "adset", "ad"]).notNull(),
    dateStart: varchar("dateStart", { length: 10 }).notNull(),
    dateStop: varchar("dateStop", { length: 10 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    spendOriginal: decimal("spendOriginal", { precision: 14, scale: 4 })
      .default("0.00")
      .notNull(),
    spendDzd: decimal("spendDzd", { precision: 14, scale: 2 })
      .default("0.00")
      .notNull(),
    impressions: int("impressions").default(0).notNull(),
    clicks: int("clicks").default(0).notNull(),
    leads: int("leads").default(0).notNull(),
    purchases: int("purchases").default(0).notNull(),
    rawJson: text("rawJson"),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  },
  table => ({
    insightWindowUnique: uniqueIndex("meta_insight_window_unique").on(
      table.adAccountId,
      table.level,
      table.externalObjectId,
      table.dateStart,
      table.dateStop
    ),
  })
);

export const storeOrderItems = mysqlTable("store_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  title: varchar("title", { length: 255 }).notNull(),
  variantLabel: varchar("variantLabel", { length: 255 }),
  sku: varchar("sku", { length: 128 }),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  quantity: int("quantity").notNull(),
  lineTotal: decimal("lineTotal", { precision: 12, scale: 2 }).notNull(),
  productCostSnapshot: decimal("productCostSnapshot", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  packagingCostSnapshot: decimal("packagingCostSnapshot", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  procurementDeliveryCostSnapshot: decimal("procurementDeliveryCostSnapshot", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  returnCostSnapshot: decimal("returnCostSnapshot", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  returnDeliveryFreeSnapshot: boolean("returnDeliveryFreeSnapshot")
    .default(false)
    .notNull(),
  confirmationSource: mysqlEnum("confirmationSource", ["owner", "call_center"])
    .default("owner")
    .notNull(),
  confirmationAgentId: int("confirmationAgentId"),
  normalConfirmationCostSnapshot: decimal("normalConfirmationCostSnapshot", {
    precision: 12,
    scale: 2,
  })
    .default("0.00")
    .notNull(),
  deliveredConfirmationCostSnapshot: decimal(
    "deliveredConfirmationCostSnapshot",
    { precision: 12, scale: 2 }
  )
    .default("0.00")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deliverySettings = mysqlTable("delivery_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  fixedOfficeEnabled: boolean("fixedOfficeEnabled").default(false).notNull(),
  fixedOfficeFee: decimal("fixedOfficeFee", { precision: 12, scale: 2 }),
  fixedHomeEnabled: boolean("fixedHomeEnabled").default(false).notNull(),
  fixedHomeFee: decimal("fixedHomeFee", { precision: 12, scale: 2 }),
  pricingMode: mysqlEnum("pricingMode", ["fixed", "carrier", "manual"])
    .default("manual")
    .notNull(),
  hiddenWilayaCodesJson: varchar("hiddenWilayaCodesJson", { length: 1000 })
    .default("[]")
    .notNull(),
  customerCarrierChoiceEnabled: boolean("customerCarrierChoiceEnabled")
    .default(false)
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deliveryCarrierConnections = mysqlTable(
  "delivery_carrier_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    provider: mysqlEnum("provider", [
      "yalidine",
      "zr_express",
      "noest",
      "ecotrack",
    ]).notNull(),
    accountName: varchar("accountName", { length: 160 })
      .default("الحساب الرئيسي")
      .notNull(),
    status: mysqlEnum("status", ["connected", "error", "disconnected"])
      .default("disconnected")
      .notNull(),
    userGuid: varchar("userGuid", { length: 180 }),
    apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
    apiTokenEncrypted: text("apiTokenEncrypted"),
    pricingMode: mysqlEnum("pricingMode", ["manual", "carrier"])
      .default("manual")
      .notNull(),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerProviderAccountUnique: uniqueIndex(
      "delivery_owner_provider_account_unique"
    ).on(table.storeId, table.provider, table.accountName),
  })
);

export const deliveryWilayaRates = mysqlTable(
  "delivery_wilaya_rates",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    wilayaCode: varchar("wilayaCode", { length: 8 }).notNull(),
    wilayaName: varchar("wilayaName", { length: 120 }).notNull(),
    officeEnabled: boolean("officeEnabled").default(true).notNull(),
    officeFee: decimal("officeFee", { precision: 12, scale: 2 }),
    homeEnabled: boolean("homeEnabled").default(true).notNull(),
    homeFee: decimal("homeFee", { precision: 12, scale: 2 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerWilayaUnique: uniqueIndex("delivery_owner_wilaya_unique").on(
      table.storeId,
      table.wilayaCode
    ),
  })
);

export const deliveryCarrierWilayaRates = mysqlTable(
  "delivery_carrier_wilaya_rates",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    carrierConnectionId: int("carrierConnectionId").notNull(),
    wilayaCode: varchar("wilayaCode", { length: 8 }).notNull(),
    wilayaName: varchar("wilayaName", { length: 120 }).notNull(),
    officeEnabled: boolean("officeEnabled").default(true).notNull(),
    officeFee: decimal("officeFee", { precision: 12, scale: 2 }),
    homeEnabled: boolean("homeEnabled").default(true).notNull(),
    homeFee: decimal("homeFee", { precision: 12, scale: 2 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerCarrierWilayaUnique: uniqueIndex(
      "delivery_owner_carrier_wilaya_unique"
    ).on(table.storeId, table.carrierConnectionId, table.wilayaCode),
  })
);

export const storeConnecteurs = mysqlTable(
  "store_connecteurs",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    kind: mysqlEnum("kind", [
      "meta_capi",
      "tiktok_capi",
      "snapchat_capi",
      "facebook_domain",
      "cloudflare_turnstile",
      "google_sheets",
      "abandoned_orders",
      "notifications",
      "message_order",
    ]).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    identifier: varchar("identifier", { length: 255 }),
    secretEncrypted: text("secretEncrypted"),
    domain: varchar("domain", { length: 255 }),
    verificationCode: text("verificationCode"),
    enabled: boolean("enabled").default(false).notNull(),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerKindUnique: uniqueIndex("store_connecteurs_owner_kind_unique").on(
      table.storeId,
      table.kind
    ),
  })
);

export const sharkCodSettings = mysqlTable("shark_cod_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(false).notNull(),
  title: varchar("title", { length: 180 }).default("قبل خروجك").notNull(),
  descriptionBefore: text("descriptionBefore").notNull(),
  descriptionAfter: text("descriptionAfter").notNull(),
  buttonText: varchar("buttonText", { length: 180 }).notNull(),
  discountPercent: int("discountPercent").default(10).notNull(),
  targetMode: mysqlEnum("targetMode", ["all", "product", "landing"])
    .default("all")
    .notNull(),
  targetProductId: int("targetProductId"),
  targetLandingPageId: int("targetLandingPageId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sharkCodEvents = mysqlTable("shark_cod_events", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  settingsId: int("settingsId").notNull(),
  eventType: mysqlEnum("eventType", [
    "view",
    "cta_click",
    "discount_order",
    "reject_price",
    "reject_delivery",
    "reject_compare",
    "reject_hesitate",
    "reject_payment",
    "reject_changed_mind",
  ]).notNull(),
  productId: int("productId"),
  landingPageId: int("landingPageId"),
  orderId: int("orderId"),
  sessionId: varchar("sessionId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiSettings = mysqlTable("ai_settings", {
  storeId: int("storeId").primaryKey(),
  provider: varchar("provider", { length: 60 }).default("openai").notNull(),
  apiKey: varchar("apiKey", { length: 255 }).notNull(),
  apiUrl: varchar("apiUrl", { length: 255 })
    .default("https://api.openai.com/v1")
    .notNull(),
  model: varchar("model", { length: 120 }).default("gpt-4o-mini").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contactBarSettings = mysqlTable("contact_bar_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(false).notNull(),
  phoneEnabled: boolean("phoneEnabled").default(false).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 30 }).notNull(),
  phoneSticky: boolean("phoneSticky").default(true).notNull(),
  whatsappEnabled: boolean("whatsappEnabled").default(false).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 30 }).notNull(),
  whatsappSticky: boolean("whatsappSticky").default(true).notNull(),
  showOnStore: boolean("showOnStore").default(true).notNull(),
  showOnProduct: boolean("showOnProduct").default(true).notNull(),
  showOnLanding: boolean("showOnLanding").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const thankYouPopupSettings = mysqlTable("thank_you_popup_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(true).notNull(),
  message: text("message").notNull(),
  buttonText: varchar("buttonText", { length: 180 }).notNull(),
  buttonUrl: text("buttonUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentGuardSettings = mysqlTable("content_guard_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(false).notNull(),
  protectImages: boolean("protectImages").default(true).notNull(),
  blockRightClick: boolean("blockRightClick").default(true).notNull(),
  preventSelection: boolean("preventSelection").default(true).notNull(),
  watermarkEnabled: boolean("watermarkEnabled").default(false).notNull(),
  watermarkText: varchar("watermarkText", { length: 120 })
    .default("Abdou Store")
    .notNull(),
  blockHotlink: boolean("blockHotlink").default(false).notNull(),
  blockAdReferrers: boolean("blockAdReferrers").default(false).notNull(),
  blockMetaAdsLibrary: boolean("blockMetaAdsLibrary").default(false).notNull(),
  blockedMessage: varchar("blockedMessage", { length: 255 })
    .default("هذا المحتوى غير متاح من هذا المصدر.")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trackingRetargetTargetTypes = ["product", "landing"] as const;
export type TrackingRetargetTargetType =
  (typeof trackingRetargetTargetTypes)[number];
export const retargetJobStatuses = [
  "none",
  "pending",
  "sent",
  "skipped",
] as const;
export type RetargetJobStatus = (typeof retargetJobStatuses)[number];

export const trackingRetargetSettings = mysqlTable(
  "tracking_retarget_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId").unique(),
    enabled: boolean("enabled").default(false).notNull(),
    // WhatsApp Cloud API used to push messages TO the buyer.
    whatsappPhoneId: varchar("whatsappPhoneId", { length: 80 }),
    whatsappTokenEncrypted: text("whatsappTokenEncrypted"),
    // Numbers that receive the buyer's "track my order" WhatsApp message.
    supportNumbersJson: varchar("supportNumbersJson", { length: 5000 })
      .default("[]")
      .notNull(),
    // Attractive post-purchase tracking box.
    trackTitle: varchar("trackTitle", { length: 180 })
      .default("تتبع طلبك عبر واتساب")
      .notNull(),
    trackHint: varchar("trackHint", { length: 500 })
      .default("أرسل رقم طلبك وسنرد عليك مباشرة بمتابعة طلبك لحظة بلحظة.")
      .notNull(),
    trackCta: varchar("trackCta", { length: 180 })
      .default("تتبع طلبك الآن")
      .notNull(),
    trackMessage: varchar("trackMessage", { length: 500 })
      .default("مرحبًا، أريد تتبع طلبية رقم {orderNumber}")
      .notNull(),
    // Automatic status pushes from ForShip.
    statusEnabled: boolean("statusEnabled").default(true).notNull(),
    statusMessage: text("statusMessage").notNull(),
    // Retargeting campaign after delivery.
    retargetEnabled: boolean("retargetEnabled").default(false).notNull(),
    retargetTargetType: mysqlEnum(
      "retargetTargetType",
      trackingRetargetTargetTypes
    )
      .default("product")
      .notNull(),
    retargetProductId: int("retargetProductId"),
    retargetLandingPageId: int("retargetLandingPageId"),
    retargetLandingUrl: varchar("retargetLandingUrl", { length: 2000 }),
    retargetDiscountPercent: int("retargetDiscountPercent")
      .default(10)
      .notNull(),
    retargetDelayDays: int("retargetDelayDays").default(3).notNull(),
    retargetMessage: text("retargetMessage").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);

export const trackingRetargetOrderStates = mysqlTable(
  "tracking_retarget_order_states",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    orderId: int("orderId").notNull(),
    lastStatusSent: varchar("lastStatusSent", { length: 255 }),
    deliveredAt: timestamp("deliveredAt"),
    retargetDueAt: timestamp("retargetDueAt"),
    retargetStatus: mysqlEnum("retargetStatus", retargetJobStatuses)
      .default("none")
      .notNull(),
    retargetAttempts: int("retargetAttempts").default(0).notNull(),
    retargetSentAt: timestamp("retargetSentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    orderStateUnique: uniqueIndex("tracking_retarget_order_state_unique").on(
      table.orderId
    ),
  })
);

export const trackingRetargetSendKinds = [
  "status",
  "retarget",
  "redeem",
] as const;
export type TrackingRetargetSendKind =
  (typeof trackingRetargetSendKinds)[number];

export const trackingRetargetSends = mysqlTable(
  "tracking_retarget_sends",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    orderId: int("orderId"),
    kind: mysqlEnum("kind", trackingRetargetSendKinds).notNull(),
    statusLabel: varchar("statusLabel", { length: 255 }),
    toPhone: varchar("toPhone", { length: 40 }),
    message: text("message"),
    ok: boolean("ok").default(false).notNull(),
    error: varchar("error", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    orderStateIdx: index("tracking_retarget_sends_store_idx").on(
      table.storeId,
      table.kind
    ),
  })
);

export const callCenterAgents = mysqlTable("call_center_agents", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  notifyNewOrders: boolean("notifyNewOrders").default(true).notNull(),
  notifyStatusChanges: boolean("notifyStatusChanges").default(true).notNull(),
  notifyCancelledOrders: boolean("notifyCancelledOrders")
    .default(true)
    .notNull(),
  notifyUnresponsiveOrders: boolean("notifyUnresponsiveOrders")
    .default(true)
    .notNull(),
  notifyFollowUp: boolean("notifyFollowUp").default(true).notNull(),
  compensationMode: mysqlEnum("compensationMode", [
    "all_orders",
    "completed_orders",
  ])
    .default("all_orders")
    .notNull(),
  generalOrderRate: decimal("generalOrderRate", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  completedOrderRate: decimal("completedOrderRate", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const callCenterAgentProducts = mysqlTable(
  "call_center_agent_products",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    productId: int("productId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  }
);

export const callCenterSessions = mysqlTable("call_center_sessions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── ForShip Order Tracking (Hybrid Webhook + Adaptive Polling) ──────────────

export const carrierPlatformTypes = ["ecotrack", "yalidine", "custom"] as const;
export type CarrierPlatformType = (typeof carrierPlatformTypes)[number];

export const carriers = mysqlTable("carriers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  platformType: mysqlEnum("platform_type", carrierPlatformTypes).notNull(),
  /** Set manually after verifying each carrier's API docs. Webhook carriers get push updates, others poll. */
  supportsWebhook: boolean("supports_webhook").default(false).notNull(),
  webhookEndpointPath: varchar("webhook_endpoint_path", { length: 500 }),
  /** Shared secret used to verify incoming webhook signatures (only for webhook carriers). */
  webhookSecret: varchar("webhook_secret", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const merchantCarrierCredentials = mysqlTable(
  "merchant_carrier_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    merchantId: int("merchant_id").notNull(),
    carrierId: int("carrier_id").notNull(),
    apiBaseUrl: varchar("api_base_url", { length: 500 }),
    apiTokenEncrypted: text("api_token"),
    webhookRegistered: boolean("webhook_registered").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    merchantCarrierUnique: uniqueIndex("merchant_carrier_unique").on(
      table.merchantId,
      table.carrierId
    ),
  })
);

export const carrierInternalStatuses = [
  "in_transit",
  "out_for_delivery",
  "suspended",
  "delivered",
  "returned",
  "other",
] as const;
export type CarrierInternalStatus = (typeof carrierInternalStatuses)[number];
export const carrierFinalStatuses = ["delivered", "returned"] as const;
export type CarrierFinalStatus = (typeof carrierFinalStatuses)[number];

export const carrierStatusMap = mysqlTable(
  "carrier_status_map",
  {
    id: int("id").autoincrement().primaryKey(),
    carrierId: int("carrier_id").notNull(),
    /** Exact text returned by the carrier API. */
    rawLabel: varchar("raw_label", { length: 255 }).notNull(),
    mapsTo: mysqlEnum("maps_to", carrierInternalStatuses).notNull(),
    /** True ONLY for delivered/returned. */
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    carrierRawLabelUnique: uniqueIndex(
      "carrier_status_map_carrier_raw_unique"
    ).on(table.carrierId, table.rawLabel),
  })
);

export const shipmentSyncMethods = ["webhook", "polling"] as const;
export type ShipmentSyncMethod = (typeof shipmentSyncMethods)[number];

export const orderShipments = mysqlTable(
  "order_shipments",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    merchantId: int("merchant_id").notNull(),
    carrierId: int("carrier_id").notNull(),
    trackingNumber: varchar("tracking_number", { length: 160 }).notNull(),
    /** Stored EXACTLY as received from the carrier — no translation/normalization. */
    externalStatusLabel: varchar("external_status_label", { length: 255 }),
    internalStatus: mysqlEnum("internal_status", carrierInternalStatuses),
    /** Only 'delivered' or 'returned' are final. */
    finalStatus: mysqlEnum("final_status", carrierFinalStatuses),
    resolvedAt: timestamp("resolved_at"),
    statusEnteredAt: timestamp("status_entered_at"),
    nextCheckAt: timestamp("next_check_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    checkCount: int("check_count").default(0).notNull(),
    statusHistory: text("status_history").notNull(),
    syncMethod: mysqlEnum("sync_method", shipmentSyncMethods)
      .default("polling")
      .notNull(),
    /** Flagged when a non-final status stops changing for a long time (manual review). */
    reviewFlagged: boolean("review_flagged").default(false).notNull(),
    fallbackReason: text("fallback_reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    orderCarrierUnique: uniqueIndex("order_shipments_order_carrier_unique").on(
      table.orderId,
      table.carrierId
    ),
    carrierTrackingIdx: index("order_shipments_carrier_tracking_idx").on(
      table.carrierId,
      table.trackingNumber
    ),
    // Composite index backing the polling due-shipment scan: WHERE final_status IS NULL AND next_check_at <= NOW().
    finalNextCheckIdx: index("order_shipments_final_next_idx").on(
      table.finalStatus,
      table.nextCheckAt
    ),
  })
);

export const orderProfits = mysqlTable(
  "order_profits",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    merchantId: int("merchant_id").notNull(),
    revenue: decimal("revenue", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    costOfGoods: decimal("cost_of_goods", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    deliveryCost: decimal("delivery_cost", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    netProfit: decimal("net_profit", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    orderProfitUnique: uniqueIndex("order_profits_order_unique").on(
      table.orderId
    ),
  })
);

export const orderReturns = mysqlTable(
  "order_returns",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    merchantId: int("merchant_id").notNull(),
    returnCost: decimal("return_cost", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    stockRestocked: boolean("stock_restocked").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    orderReturnUnique: uniqueIndex("order_returns_order_unique").on(
      table.orderId
    ),
  })
);

export const orderCleanSettings = mysqlTable("order_clean_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(false).notNull(),
  duplicateWindowHours: int("duplicateWindowHours").default(24).notNull(),
  maxOrdersPerPhone: int("maxOrdersPerPhone").default(1).notNull(),
  action: mysqlEnum("action", ["review", "block"]).default("review").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderCleanEvents = mysqlTable("order_clean_events", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  orderId: int("orderId"),
  productId: int("productId"),
  phoneHash: varchar("phoneHash", { length: 128 }).notNull(),
  verdict: mysqlEnum("verdict", ["allowed", "review", "blocked"]).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messageOrderSettings = mysqlTable("message_order_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  title: varchar("title", { length: 180 })
    .default("الطلب عبر الرسالة")
    .notNull(),
  welcomeMessage: text("welcomeMessage").notNull(),
  instructions: text("instructions").notNull(),
  buttonText: varchar("buttonText", { length: 180 })
    .default("أرسل طلبك الآن")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messageOrders = mysqlTable("message_orders", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 40 }).notNull(),
  wilaya: varchar("wilaya", { length: 120 }).notNull(),
  wilayaCode: varchar("wilayaCode", { length: 3 }),
  municipality: varchar("municipality", { length: 160 }),
  address: text("address").notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "review", "converted", "archived"])
    .default("new")
    .notNull(),
  source: varchar("source", { length: 80 }).default("message_order"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const negotiatorSettings = mysqlTable("negotiator_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  enabled: boolean("enabled").default(false).notNull(),
  autoNegotiate: boolean("autoNegotiate").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const negotiatorProductRules = mysqlTable(
  "negotiator_product_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId"),
    productId: int("productId").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    maxDiscountAmount: decimal("maxDiscountAmount", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    maxDiscountPercent: int("maxDiscountPercent").default(0).notNull(),
    minPrice: decimal("minPrice", { precision: 12, scale: 2 }),
    minProfitMarginPercent: int("minProfitMarginPercent").default(0).notNull(),
    freeDeliveryEnabled: boolean("freeDeliveryEnabled")
      .default(false)
      .notNull(),
    freeDeliveryMinQuantity: int("freeDeliveryMinQuantity")
      .default(2)
      .notNull(),
    freeDeliveryMaxFee: decimal("freeDeliveryMaxFee", {
      precision: 12,
      scale: 2,
    })
      .default("0.00")
      .notNull(),
    customRules: text("customRules"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    productUnique: uniqueIndex("negotiator_product_rules_product_unique").on(
      table.storeId,
      table.productId
    ),
  })
);

export const storeThemeSettings = mysqlTable("store_theme_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").unique(),
  templateKey: varchar("templateKey", { length: 80 })
    .default("nordic-market")
    .notNull(),
  customizationJson: text("customizationJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const storeConnecteurPixels = mysqlTable(
  "store_connecteur_pixels",
  {
    id: int("id").autoincrement().primaryKey(),
    connecteurId: int("connecteurId").notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    pixelId: varchar("pixelId", { length: 255 }).notNull(),
    accessTokenEncrypted: text("accessTokenEncrypted"),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    connecteurPixelUnique: uniqueIndex("store_connecteur_pixel_unique").on(
      table.connecteurId,
      table.pixelId
    ),
  })
);

export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId"),
  productId: int("productId").notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  framework: mysqlEnum("framework", ["AIDA"]).default("AIDA").notNull(),
  pageLength: mysqlEnum("pageLength", ["short", "medium", "long"]).notNull(),
  locale: varchar("locale", { length: 32 }).default("dz-ar").notNull(),
  status: mysqlEnum("status", ["generating", "ready", "failed", "published"])
    .default("generating")
    .notNull(),
  settingsJson: text("settingsJson").notNull(),
  productSnapshotJson: text("productSnapshotJson").notNull(),
  designSystemJson: text("designSystemJson"),
  generationError: text("generationError"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const landingSections = mysqlTable("landing_sections", {
  id: int("id").autoincrement().primaryKey(),
  landingPageId: int("landingPageId").notNull(),
  position: int("position").notNull(),
  aidaStage: mysqlEnum("aidaStage", [
    "attention",
    "interest",
    "desire",
    "action",
  ]).notNull(),
  sectionType: varchar("sectionType", { length: 80 }).notNull(),
  eyebrow: varchar("eyebrow", { length: 160 }),
  headline: varchar("headline", { length: 500 }).notNull(),
  body: text("body").notNull(),
  bulletsJson: text("bulletsJson").notNull(),
  ctaLabel: varchar("ctaLabel", { length: 120 }),
  microCommitmentJson: text("microCommitmentJson"),
  visualBrief: text("visualBrief").notNull(),
  productImageUrl: varchar("productImageUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const landingAssets = mysqlTable("landing_assets", {
  id: int("id").autoincrement().primaryKey(),
  landingPageId: int("landingPageId").notNull(),
  landingSectionId: int("landingSectionId"),
  kind: mysqlEnum("kind", [
    "original_product",
    "isolated_product",
    "generated_background",
    "composition",
  ]).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  prompt: text("prompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const landingGenerationJobs = mysqlTable("landing_generation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  landingPageId: int("landingPageId").notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"])
    .default("queued")
    .notNull(),
  model: varchar("model", { length: 120 }),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreProduct = typeof storeProducts.$inferSelect;
export type StoreProductImage = typeof storeProductImages.$inferSelect;
export type StoreProductVariant = typeof storeProductVariants.$inferSelect;
export type StoreProductOffer = typeof storeProductOffers.$inferSelect;
export type StoreDigitalDownload = typeof storeDigitalDownloads.$inferSelect;
export type StoreOrder = typeof storeOrders.$inferSelect;
export type StoreOrderItem = typeof storeOrderItems.$inferSelect;
export type AbandonedOrder = typeof abandonedOrders.$inferSelect;
export type DeliverySettings = typeof deliverySettings.$inferSelect;
export type DeliveryWilayaRate = typeof deliveryWilayaRates.$inferSelect;
export type StoreConnecteurPixel = typeof storeConnecteurPixels.$inferSelect;
export type LandingPage = typeof landingPages.$inferSelect;
export type LandingSection = typeof landingSections.$inferSelect;
export type LandingAsset = typeof landingAssets.$inferSelect;
export type LandingGenerationJob = typeof landingGenerationJobs.$inferSelect;
export type ContentGuardSettings = typeof contentGuardSettings.$inferSelect;
export type TrackingRetargetSettings =
  typeof trackingRetargetSettings.$inferSelect;
export type TrackingRetargetOrderState =
  typeof trackingRetargetOrderStates.$inferSelect;
export type TrackingRetargetSend = typeof trackingRetargetSends.$inferSelect;
export type CallCenterAgent = typeof callCenterAgents.$inferSelect;
export type CallCenterAgentProduct =
  typeof callCenterAgentProducts.$inferSelect;
export type CallCenterSession = typeof callCenterSessions.$inferSelect;
export type Carrier = typeof carriers.$inferSelect;
export type MerchantCarrierCredential =
  typeof merchantCarrierCredentials.$inferSelect;
export type CarrierStatusMapRow = typeof carrierStatusMap.$inferSelect;
export type OrderShipment = typeof orderShipments.$inferSelect;
export type OrderProfit = typeof orderProfits.$inferSelect;
export type OrderReturn = typeof orderReturns.$inferSelect;
export type ProfitabilityCampaignLink =
  typeof profitabilityCampaignLinks.$inferSelect;
export type AiSettings = typeof aiSettings.$inferSelect;
export type MessageOrderSettings = typeof messageOrderSettings.$inferSelect;
export type MessageOrder = typeof messageOrders.$inferSelect;
export type NegotiatorSettings = typeof negotiatorSettings.$inferSelect;
export type NegotiatorProductRule = typeof negotiatorProductRules.$inferSelect;

/* =============================================================================
 * Storefront Template System (Phase 3) — additive tables only.
 * Tenant isolation: every row is scoped by ownerId + storeId.
 * No existing table is modified.
 * ========================================================================== */

/** Unpublished working configuration (one draft per store). */
export const storefrontDrafts = mysqlTable("storefront_drafts", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").notNull().unique(),
  configJson: text("configJson").notNull(),
  concurrencyVersion: int("concurrencyVersion").default(1).notNull(),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable published snapshots (rollback creates a NEW row, never mutates). */
export const storefrontVersions = mysqlTable(
  "storefront_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId").notNull(),
    versionNumber: int("versionNumber").notNull(),
    snapshotJson: text("snapshotJson").notNull(),
    sourceDraftVersion: int("sourceDraftVersion"),
    note: varchar("note", { length: 255 }),
    publishedBy: int("publishedBy"),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    storeVersionUnique: uniqueIndex(
      "storefront_versions_store_version_unique"
    ).on(table.storeId, table.versionNumber),
    storeIdx: index("storefront_versions_store_idx").on(table.storeId),
  })
);

/** Audit trail — admin override actions on non-owned stores are always logged. */
export const storefrontAuditLogs = mysqlTable(
  "storefront_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull(),
    actorId: int("actorId").notNull(),
    actorRole: varchar("actorRole", { length: 32 }).notNull(),
    isOverride: boolean("isOverride").default(false).notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    entityType: varchar("entityType", { length: 48 }),
    entityId: int("entityId"),
    fromVersion: int("fromVersion"),
    toVersion: int("toVersion"),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("userAgent", { length: 255 }),
    metadataJson: text("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    storeIdx: index("storefront_audit_logs_store_idx").on(table.storeId),
    actionIdx: index("storefront_audit_logs_action_idx").on(table.action),
  })
);

/** Dashboard Color Customizer (color/accent only, per store). */
export const dashboardColorSettings = mysqlTable("dashboard_color_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  storeId: int("storeId").notNull().unique(),
  primaryColor: varchar("primaryColor", { length: 32 }),
  accentColor: varchar("accentColor", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StorefrontDraft = typeof storefrontDrafts.$inferSelect;
export type StorefrontVersion = typeof storefrontVersions.$inferSelect;
export type StorefrontAuditLog = typeof storefrontAuditLogs.$inferSelect;
export type DashboardColorSetting = typeof dashboardColorSettings.$inferSelect;

/**
 * Store categories (one category per product, no subcategories).
 *
 * `slug` is unique per store so the storefront URL `/store/category/<slug>`
 * resolves inside a single tenant only.
 */
export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    imageUrl: varchar("imageUrl", { length: 1024 }),
    sortOrder: int("sortOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    storeSlugUnique: uniqueIndex("categories_store_slug_unique").on(
      table.storeId,
      table.slug
    ),
    storeIdx: index("categories_store_idx").on(table.storeId),
  })
);

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Many-to-many memberships: a product can belong to several categories.
 *
 * Only ADDITIONAL memberships are stored here — `store_products.categoryId`
 * remains the product's primary category. Membership is the union of both, so
 * every existing row keeps working unchanged.
 */
export const productCategories = mysqlTable(
  "product_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull(),
    productId: int("productId").notNull(),
    categoryId: int("categoryId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    productCategoryUnique: uniqueIndex(
      "product_categories_product_category_unique"
    ).on(table.productId, table.categoryId),
    storeCategoryIdx: index("product_categories_store_category_idx").on(
      table.storeId,
      table.categoryId
    ),
    productIdx: index("product_categories_product_idx").on(table.productId),
  })
);

export type ProductCategory = typeof productCategories.$inferSelect;

/**
 * Offers / bundles: a named set of existing products (each with a quantity),
 * an optional discount (% or fixed amount) and optional free delivery.
 *
 * Many-to-many by design: a product can be in several offers and there is no
 * "primary" offer concept. The bundled price is always computed from the
 * products' prices minus the discount — never stored manually.
 */
export const offers = mysqlTable(
  "offers",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    storeId: int("storeId").notNull(),
    /** "bundle" = several products + discount, "quantity" = legacy single-product deal. */
    kind: mysqlEnum("kind", ["bundle", "quantity"]).default("bundle").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    imageUrl: varchar("imageUrl", { length: 1024 }),
    discountType: mysqlEnum("discountType", ["percent", "amount"]),
    discountValue: decimal("discountValue", { precision: 12, scale: 2 }),
    /** Quantity deals only: the fixed total price for that quantity. */
    fixedPrice: decimal("fixedPrice", { precision: 12, scale: 2 }),
    /** Quantity deals only (unchanged legacy behaviour: 0 = unlimited). */
    maxUses: int("maxUses").default(0).notNull(),
    usedCount: int("usedCount").default(0).notNull(),
    /**
     * Original `store_product_offers.id` for migrated quantity deals. The
     * storefront keeps exposing it as the offer id so carts created before the
     * migration keep working; it is NEVER compared with `offers.id` (lookups are
     * always scoped by `kind`).
     */
    legacyId: int("legacyId"),
    /** Free delivery applies to the WHOLE order once the bundle is in it. */
    freeDelivery: boolean("freeDelivery").default(false).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    storeSlugUnique: uniqueIndex("offers_store_slug_unique").on(
      table.storeId,
      table.slug
    ),
    storeActiveIdx: index("offers_store_active_idx").on(
      table.storeId,
      table.isActive
    ),
    storeKindIdx: index("offers_store_kind_idx").on(table.storeId, table.kind),
    kindLegacyIdx: index("offers_kind_legacy_idx").on(
      table.kind,
      table.legacyId
    ),
  })
);

export const offerProducts = mysqlTable(
  "offer_products",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull(),
    offerId: int("offerId").notNull(),
    productId: int("productId").notNull(),
    quantity: int("quantity").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    offerProductUnique: uniqueIndex("offer_products_offer_product_unique").on(
      table.offerId,
      table.productId
    ),
    storeOfferIdx: index("offer_products_store_offer_idx").on(
      table.storeId,
      table.offerId
    ),
    productIdx: index("offer_products_product_idx").on(table.productId),
  })
);

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;
export type OfferProduct = typeof offerProducts.$inferSelect;
