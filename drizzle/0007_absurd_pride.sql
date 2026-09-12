CREATE TABLE `abandoned_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`productId` int NOT NULL,
	`landingPageId` int,
	`customerName` varchar(180),
	`customerPhone` varchar(40),
	`wilaya` varchar(120),
	`municipality` varchar(160),
	`quantity` int NOT NULL DEFAULT 1,
	`sessionId` varchar(128) NOT NULL,
	`status` enum('open','converted','archived') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abandoned_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `delivery_settings` MODIFY COLUMN `hiddenWilayaCodesJson` varchar(1000) NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `store_orders` MODIFY COLUMN `fulfillmentStatus` enum('new','confirmed','processing','shipped','delivered','cancelled','customer_unresponsive','phone_cancelled','fake') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `store_orders` ADD `municipality` varchar(160);