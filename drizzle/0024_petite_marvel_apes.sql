CREATE TABLE `order_clean_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`orderId` int,
	`productId` int,
	`phoneHash` varchar(128) NOT NULL,
	`verdict` enum('allowed','review','blocked') NOT NULL,
	`reason` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_clean_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_clean_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`duplicateWindowHours` int NOT NULL DEFAULT 24,
	`maxOrdersPerPhone` int NOT NULL DEFAULT 1,
	`action` enum('review','block') NOT NULL DEFAULT 'review',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_clean_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_clean_settings_ownerId_unique` UNIQUE(`ownerId`)
);
