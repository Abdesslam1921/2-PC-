CREATE TABLE `delivery_carrier_wilaya_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`carrierConnectionId` int NOT NULL,
	`wilayaCode` varchar(8) NOT NULL,
	`wilayaName` varchar(120) NOT NULL,
	`officeEnabled` boolean NOT NULL DEFAULT true,
	`officeFee` decimal(12,2),
	`homeEnabled` boolean NOT NULL DEFAULT true,
	`homeFee` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_carrier_wilaya_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_owner_carrier_wilaya_unique` UNIQUE(`ownerId`,`carrierConnectionId`,`wilayaCode`)
);
