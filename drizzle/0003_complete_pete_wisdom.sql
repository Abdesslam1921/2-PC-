CREATE TABLE `landing_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landingPageId` int NOT NULL,
	`landingSectionId` int,
	`kind` enum('original_product','isolated_product','generated_background','composition') NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`storageKey` varchar(512),
	`prompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `landing_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_generation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landingPageId` int NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`model` varchar(120),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_generation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`productId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(255) NOT NULL,
	`framework` enum('AIDA') NOT NULL DEFAULT 'AIDA',
	`pageLength` enum('short','medium','long') NOT NULL,
	`locale` varchar(32) NOT NULL DEFAULT 'dz-ar',
	`status` enum('generating','ready','failed','published') NOT NULL DEFAULT 'generating',
	`settingsJson` text NOT NULL,
	`productSnapshotJson` text NOT NULL,
	`designSystemJson` text,
	`generationError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `landing_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landingPageId` int NOT NULL,
	`position` int NOT NULL,
	`aidaStage` enum('attention','interest','desire','action') NOT NULL,
	`sectionType` varchar(80) NOT NULL,
	`eyebrow` varchar(160),
	`headline` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`bulletsJson` text NOT NULL,
	`ctaLabel` varchar(120),
	`visualBrief` text NOT NULL,
	`productImageUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `landing_sections_id` PRIMARY KEY(`id`)
);
