CREATE TABLE `call_center_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`autoDistribute` boolean NOT NULL DEFAULT true,
	`distributionScope` enum('all','specific') NOT NULL DEFAULT 'all',
	`productIdsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `call_center_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_center_settings_storeId_unique` UNIQUE(`storeId`)
);
