ALTER TABLE `delivery_settings` ADD `hiddenWilayaCodesJson` varchar(1000) NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `store_orders` ADD `deliveryMethod` enum('office','home') DEFAULT 'home' NOT NULL;
