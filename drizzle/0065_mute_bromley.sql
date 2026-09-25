CREATE TABLE `offer_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`offerId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offer_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `offer_products_offer_product_unique` UNIQUE(`offerId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`imageUrl` varchar(1024),
	`discountType` enum('percent','amount'),
	`discountValue` decimal(12,2),
	`freeDelivery` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `offers_store_slug_unique` UNIQUE(`storeId`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `store_orders` ADD `appliedOffers` json;--> statement-breakpoint
CREATE INDEX `offer_products_store_offer_idx` ON `offer_products` (`storeId`,`offerId`);--> statement-breakpoint
CREATE INDEX `offer_products_product_idx` ON `offer_products` (`productId`);--> statement-breakpoint
CREATE INDEX `offers_store_active_idx` ON `offers` (`storeId`,`isActive`);