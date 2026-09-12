CREATE TABLE IF NOT EXISTS `message_order_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`title` varchar(180) NOT NULL DEFAULT 'الطلب عبر الرسالة',
	`welcomeMessage` text NOT NULL,
	`instructions` text NOT NULL,
	`buttonText` varchar(180) NOT NULL DEFAULT 'أرسل طلبك الآن',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_order_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_order_settings_storeId_unique` UNIQUE(`storeId`)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `message_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`customerName` varchar(180) NOT NULL,
	`customerPhone` varchar(40) NOT NULL,
	`wilaya` varchar(120) NOT NULL,
	`wilayaCode` varchar(3),
	`municipality` varchar(160),
	`address` text NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','review','converted','archived') NOT NULL DEFAULT 'new',
	`source` varchar(80) DEFAULT 'message_order',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_orders_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `store_connecteurs` MODIFY COLUMN `kind` enum('meta_capi','tiktok_capi','snapchat_capi','facebook_domain','cloudflare_turnstile','google_sheets','abandoned_orders','notifications','message_order') NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellViewType` enum('product','landing') DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellLandingPageId` int;
