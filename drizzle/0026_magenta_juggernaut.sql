CREATE TABLE `thank_you_popup_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`message` text NOT NULL,
	`buttonText` varchar(180) NOT NULL,
	`buttonUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `thank_you_popup_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `thank_you_popup_settings_ownerId_unique` UNIQUE(`ownerId`)
);
