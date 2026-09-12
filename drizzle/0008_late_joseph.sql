CREATE TABLE `delivery_carrier_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`provider` enum('yalidine','zr_express','noest','ecotrack') NOT NULL,
	`status` enum('connected','error','disconnected') NOT NULL DEFAULT 'disconnected',
	`userGuid` varchar(180),
	`apiTokenEncrypted` text,
	`pricingMode` enum('manual','carrier') NOT NULL DEFAULT 'manual',
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_carrier_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_owner_provider_unique` UNIQUE(`ownerId`,`provider`)
);
