CREATE TABLE `store_connecteurs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`kind` enum('meta_capi','tiktok_capi','snapchat_capi','facebook_domain') NOT NULL,
	`label` varchar(160) NOT NULL,
	`identifier` varchar(255),
	`secretEncrypted` text,
	`domain` varchar(255),
	`verificationCode` text,
	`enabled` boolean NOT NULL DEFAULT false,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_connecteurs_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_connecteurs_owner_kind_unique` UNIQUE(`ownerId`,`kind`)
);
