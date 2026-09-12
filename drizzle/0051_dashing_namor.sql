CREATE TABLE `profitability_campaign_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int NOT NULL,
	`campaignExternalId` varchar(80) NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profitability_campaign_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `profitability_store_campaign_unique` UNIQUE(`storeId`,`campaignExternalId`)
);
