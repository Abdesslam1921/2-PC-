CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`imageUrl` varchar(1024),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_store_slug_unique` UNIQUE(`storeId`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `store_products` ADD `categoryId` int;--> statement-breakpoint
CREATE INDEX `categories_store_idx` ON `categories` (`storeId`);--> statement-breakpoint
CREATE INDEX `store_products_category_idx` ON `store_products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `store_products_store_idx` ON `store_products` (`storeId`);