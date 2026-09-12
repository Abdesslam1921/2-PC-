CREATE TABLE `delivery_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`fixedOfficeEnabled` boolean NOT NULL DEFAULT false,
	`fixedOfficeFee` decimal(12,2),
	`fixedHomeEnabled` boolean NOT NULL DEFAULT false,
	`fixedHomeFee` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_settings_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `delivery_wilaya_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`wilayaCode` varchar(8) NOT NULL,
	`wilayaName` varchar(120) NOT NULL,
	`officeEnabled` boolean NOT NULL DEFAULT true,
	`officeFee` decimal(12,2),
	`homeEnabled` boolean NOT NULL DEFAULT true,
	`homeFee` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_wilaya_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_owner_wilaya_unique` UNIQUE(`ownerId`,`wilayaCode`)
);
