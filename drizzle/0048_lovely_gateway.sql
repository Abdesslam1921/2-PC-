CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`language` varchar(16) NOT NULL DEFAULT 'dz-ar',
	`templateId` varchar(80),
	`aiStyleConfig` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `abandoned_orders` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `delivery_carrier_connections` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `delivery_carrier_wilaya_rates` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `delivery_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `delivery_wilaya_rates` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `store_orders` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `store_products` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `store_theme_settings` ADD `storeId` int;