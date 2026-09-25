ALTER TABLE `offers` ADD `kind` enum('bundle','quantity') DEFAULT 'bundle' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `fixedPrice` decimal(12,2);--> statement-breakpoint
ALTER TABLE `offers` ADD `maxUses` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `usedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `legacyId` int;--> statement-breakpoint
CREATE INDEX `offers_store_kind_idx` ON `offers` (`storeId`,`kind`);--> statement-breakpoint
CREATE INDEX `offers_kind_legacy_idx` ON `offers` (`kind`,`legacyId`);--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Move the legacy per-product quantity deals into the unified offers table.
--
-- ID SPACES (no collision by construction):
--   * every migrated row gets an explicit PK = 1000000 + legacy id, i.e. above
--     a reserved base that is far beyond any legacy id,
--   * that also pushes `offers.AUTO_INCREMENT` past the base, so every FUTURE
--     bundle row gets an id > 1000000 too,
--   * the storefront keeps exposing `legacyId` as the offer id for quantity
--     deals (so carts created before the migration keep working), and every
--     lookup is scoped by `kind` - `legacyId` is never compared with `offers.id`.
-- The legacy table is kept as an archive; nothing is dropped.
-- Both inserts are idempotent (safe to re-run).
-- ---------------------------------------------------------------------------
INSERT INTO `offers` (
  `id`, `ownerId`, `storeId`, `kind`, `name`, `slug`, `fixedPrice`,
  `maxUses`, `usedCount`, `freeDelivery`, `isActive`, `sortOrder`, `legacyId`,
  `createdAt`, `updatedAt`
)
SELECT
  1000000 + o.`id`,
  s.`ownerId`,
  p.`storeId`,
  'quantity',
  LEFT(o.`description`, 160),
  CONCAT('q-', p.`storeId`, '-', o.`id`),
  o.`price`,
  o.`maxUses`,
  o.`usedCount`,
  o.`freeDelivery`,
  o.`enabled`,
  0,
  o.`id`,
  o.`createdAt`,
  o.`updatedAt`
FROM `store_product_offers` o
JOIN `store_products` p ON p.`id` = o.`productId`
JOIN `stores` s ON s.`id` = p.`storeId`
WHERE NOT EXISTS (
  SELECT 1 FROM `offers` x
   WHERE x.`kind` = 'quantity' AND x.`legacyId` = o.`id`
);--> statement-breakpoint
INSERT INTO `offer_products` (`storeId`, `offerId`, `productId`, `quantity`, `createdAt`)
SELECT
  p.`storeId`,
  1000000 + o.`id`,
  o.`productId`,
  o.`quantity`,
  o.`createdAt`
FROM `store_product_offers` o
JOIN `store_products` p ON p.`id` = o.`productId`
WHERE NOT EXISTS (
  SELECT 1 FROM `offer_products` op
   WHERE op.`offerId` = 1000000 + o.`id` AND op.`productId` = o.`productId`
);
-- Optional belt and braces: force the counter well above the reserved base.
-- It is not required (the explicit ids above already push it there) and it is
-- harmless on MySQL/TiDB, so it is left commented for review.
-- ALTER TABLE `offers` AUTO_INCREMENT = 2000000;