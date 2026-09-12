CREATE TABLE `negotiator_product_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`productId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`maxDiscountAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`maxDiscountPercent` int NOT NULL DEFAULT 0,
	`minPrice` decimal(12,2),
	`minProfitMarginPercent` int NOT NULL DEFAULT 0,
	`freeDeliveryEnabled` boolean NOT NULL DEFAULT false,
	`freeDeliveryMinQuantity` int NOT NULL DEFAULT 2,
	`freeDeliveryMaxFee` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `negotiator_product_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `negotiator_product_rules_product_unique` UNIQUE(`storeId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `negotiator_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`enabled` boolean NOT NULL DEFAULT false,
	`autoNegotiate` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `negotiator_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `negotiator_settings_storeId_unique` UNIQUE(`storeId`)
);
--> statement-breakpoint
ALTER TABLE `store_products` ADD `codTrustScore` varchar(255);