CREATE TABLE `shark_cod_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`settingsId` int NOT NULL,
	`eventType` enum('view','cta_click','discount_order') NOT NULL,
	`productId` int,
	`landingPageId` int,
	`orderId` int,
	`sessionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shark_cod_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shark_cod_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`title` varchar(180) NOT NULL DEFAULT 'قبل خروجك',
	`descriptionBefore` text NOT NULL,
	`descriptionAfter` text NOT NULL,
	`buttonText` varchar(180) NOT NULL,
	`discountPercent` int NOT NULL DEFAULT 10,
	`targetMode` enum('all','product','landing') NOT NULL DEFAULT 'all',
	`targetProductId` int,
	`targetLandingPageId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shark_cod_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `shark_cod_settings_ownerId_unique` UNIQUE(`ownerId`)
);
