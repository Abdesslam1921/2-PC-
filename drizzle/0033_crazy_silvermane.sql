ALTER TABLE `store_orders` MODIFY COLUMN `paymentMethod` enum('cod','online') NOT NULL DEFAULT 'cod';--> statement-breakpoint
ALTER TABLE `store_orders` ADD `customerEmail` varchar(320);