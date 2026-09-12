CREATE TABLE `meta_ad_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`externalAccountId` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`accessTokenEncrypted` text NOT NULL,
	`status` enum('connected','error','disconnected') NOT NULL DEFAULT 'connected',
	`lastSyncedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_ad_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_owner_external_account_unique` UNIQUE(`ownerId`,`externalAccountId`)
);
--> statement-breakpoint
CREATE TABLE `meta_ad_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adAccountId` int NOT NULL,
	`campaignId` int,
	`adSetId` int,
	`adId` int,
	`externalObjectId` varchar(80) NOT NULL,
	`level` enum('account','campaign','adset','ad') NOT NULL,
	`dateStart` varchar(10) NOT NULL,
	`dateStop` varchar(10) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`spendOriginal` decimal(14,4) NOT NULL DEFAULT '0.00',
	`spendDzd` decimal(14,2) NOT NULL DEFAULT '0.00',
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`leads` int NOT NULL DEFAULT 0,
	`purchases` int NOT NULL DEFAULT 0,
	`rawJson` text,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_ad_insights_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_insight_window_unique` UNIQUE(`adAccountId`,`level`,`externalObjectId`,`dateStart`,`dateStop`)
);
--> statement-breakpoint
CREATE TABLE `meta_ad_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adAccountId` int NOT NULL,
	`campaignId` int,
	`externalId` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_ad_sets_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_adset_account_external_unique` UNIQUE(`adAccountId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `meta_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adAccountId` int NOT NULL,
	`campaignId` int,
	`adSetId` int,
	`externalId` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_ads_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_ad_account_external_unique` UNIQUE(`adAccountId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `meta_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adAccountId` int NOT NULL,
	`externalId` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(80),
	`objective` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_campaign_account_external_unique` UNIQUE(`adAccountId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `profitability_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`baseCurrency` varchar(8) NOT NULL DEFAULT 'DZD',
	`usdToDzdRate` decimal(12,4) NOT NULL DEFAULT '0.00',
	`attributionModel` enum('last_touch','first_touch','equal_split') NOT NULL DEFAULT 'last_touch',
	`includePendingOrders` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profitability_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `profitability_settings_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `store_orders` ADD `attributionSource` varchar(80);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `fbclid` varchar(255);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `utmSource` varchar(160);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `utmMedium` varchar(160);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `utmCampaign` varchar(255);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `utmContent` varchar(255);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `utmTerm` varchar(255);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `metaCampaignId` varchar(80);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `metaAdSetId` varchar(80);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `metaAdId` varchar(80);--> statement-breakpoint
ALTER TABLE `store_orders` ADD `adSpendAllocatedDzd` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_orders` ADD `attributionStatus` enum('unattributed','attributed','manual') DEFAULT 'unattributed' NOT NULL;