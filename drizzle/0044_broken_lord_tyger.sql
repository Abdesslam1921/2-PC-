CREATE TABLE `meta_campaign_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`adAccountId` int,
	`action` varchar(80) NOT NULL,
	`status` enum('approved','started','succeeded','failed','rejected') NOT NULL,
	`requestJson` text,
	`responseJson` text,
	`externalCampaignId` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_campaign_audit_logs_id` PRIMARY KEY(`id`)
);
