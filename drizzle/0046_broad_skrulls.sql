CREATE TABLE `store_theme_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`templateKey` varchar(80) NOT NULL DEFAULT 'nordic-market',
	`customizationJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_theme_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_theme_settings_ownerId_unique` UNIQUE(`ownerId`)
);
