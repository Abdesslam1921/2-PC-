CREATE TABLE `contact_bar_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`phoneEnabled` boolean NOT NULL DEFAULT false,
	`phoneNumber` varchar(30) NOT NULL,
	`phoneSticky` boolean NOT NULL DEFAULT true,
	`whatsappEnabled` boolean NOT NULL DEFAULT false,
	`whatsappNumber` varchar(30) NOT NULL,
	`whatsappSticky` boolean NOT NULL DEFAULT true,
	`showOnStore` boolean NOT NULL DEFAULT true,
	`showOnProduct` boolean NOT NULL DEFAULT true,
	`showOnLanding` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_bar_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_bar_settings_ownerId_unique` UNIQUE(`ownerId`)
);
