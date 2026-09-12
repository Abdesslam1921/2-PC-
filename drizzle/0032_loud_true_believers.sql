CREATE TABLE `store_digital_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`productId` int NOT NULL,
	`ownerId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`maxDownloads` int NOT NULL,
	`downloadCount` int NOT NULL DEFAULT 0,
	`lastDownloadedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_digital_downloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_digital_downloads_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `store_product_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL,
	`price` decimal(12,2) NOT NULL,
	`maxUses` int NOT NULL DEFAULT 0,
	`usedCount` int NOT NULL DEFAULT 0,
	`freeDelivery` boolean NOT NULL DEFAULT false,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_product_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `store_orders` ADD `orderType` enum('physical','digital') DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `productKind` enum('physical','digital') DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `currency` varchar(8) DEFAULT 'DZD' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalFileStorageKey` varchar(512);--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalFileUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalFileSize` int;--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalFileMimeType` varchar(160);--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalMaxDownloads` int;--> statement-breakpoint
ALTER TABLE `store_products` ADD `digitalLinkValidityHours` int;