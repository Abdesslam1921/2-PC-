CREATE TABLE `content_guard_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`protectImages` boolean NOT NULL DEFAULT true,
	`blockRightClick` boolean NOT NULL DEFAULT true,
	`preventSelection` boolean NOT NULL DEFAULT true,
	`watermarkEnabled` boolean NOT NULL DEFAULT false,
	`watermarkText` varchar(120) NOT NULL DEFAULT 'Abdou Store',
	`blockHotlink` boolean NOT NULL DEFAULT false,
	`blockAdReferrers` boolean NOT NULL DEFAULT false,
	`blockMetaAdsLibrary` boolean NOT NULL DEFAULT false,
	`blockedMessage` varchar(255) NOT NULL DEFAULT 'هذا المحتوى غير متاح من هذا المصدر.',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_guard_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_guard_settings_ownerId_unique` UNIQUE(`ownerId`)
);
