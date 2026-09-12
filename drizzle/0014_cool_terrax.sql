ALTER TABLE `delivery_carrier_connections` DROP INDEX `delivery_owner_provider_unique`;--> statement-breakpoint
ALTER TABLE `delivery_carrier_connections` ADD `accountName` varchar(160) DEFAULT 'الحساب الرئيسي' NOT NULL;--> statement-breakpoint
ALTER TABLE `delivery_carrier_connections` ADD CONSTRAINT `delivery_owner_provider_account_unique` UNIQUE(`ownerId`,`provider`,`accountName`);