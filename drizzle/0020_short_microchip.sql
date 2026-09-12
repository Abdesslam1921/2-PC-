CREATE TABLE `store_connecteur_pixels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connecteurId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`pixelId` varchar(255) NOT NULL,
	`accessTokenEncrypted` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_connecteur_pixels_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_connecteur_pixel_unique` UNIQUE(`connecteurId`,`pixelId`)
);
