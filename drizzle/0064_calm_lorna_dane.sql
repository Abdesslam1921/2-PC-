CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`categoryId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_product_category_unique` UNIQUE(`productId`,`categoryId`)
);
--> statement-breakpoint
CREATE INDEX `product_categories_store_category_idx` ON `product_categories` (`storeId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `product_categories_product_idx` ON `product_categories` (`productId`);--> statement-breakpoint
-- Backfill: every product's current primary category becomes a membership row
-- (idempotent thanks to the unique (productId, categoryId) index).
INSERT IGNORE INTO `product_categories` (`storeId`, `productId`, `categoryId`)
  SELECT `storeId`, `id`, `categoryId` FROM `store_products` WHERE `categoryId` IS NOT NULL;
