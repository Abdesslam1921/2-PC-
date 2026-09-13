CREATE TABLE `dashboard_color_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`primaryColor` varchar(32),
	`accentColor` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_color_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_color_settings_storeId_unique` UNIQUE(`storeId`)
);
--> statement-breakpoint
CREATE TABLE `storefront_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`actorId` int NOT NULL,
	`actorRole` varchar(32) NOT NULL,
	`isOverride` boolean NOT NULL DEFAULT false,
	`action` varchar(48) NOT NULL,
	`entityType` varchar(48),
	`entityId` int,
	`fromVersion` int,
	`toVersion` int,
	`ip` varchar(64),
	`userAgent` varchar(255),
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storefront_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storefront_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`configJson` text NOT NULL,
	`concurrencyVersion` int NOT NULL DEFAULT 1,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storefront_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `storefront_drafts_storeId_unique` UNIQUE(`storeId`)
);
--> statement-breakpoint
CREATE TABLE `storefront_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`snapshotJson` text NOT NULL,
	`sourceDraftVersion` int,
	`note` varchar(255),
	`publishedBy` int,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storefront_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `storefront_versions_store_version_unique` UNIQUE(`storeId`,`versionNumber`)
);
--> statement-breakpoint
CREATE INDEX `storefront_audit_logs_store_idx` ON `storefront_audit_logs` (`storeId`);--> statement-breakpoint
CREATE INDEX `storefront_audit_logs_action_idx` ON `storefront_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `storefront_versions_store_idx` ON `storefront_versions` (`storeId`);