ALTER TABLE `store_products` ADD `costAccountingMode` enum('per_item','stock_total') DEFAULT 'per_item' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `costQuantity` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `productCostTotal` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `packagingCostPerItem` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `packagingCostTotal` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `procurementDeliveryCostPerItem` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `procurementDeliveryCostTotal` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `returnCostPerOrder` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `returnDeliveryFree` boolean DEFAULT false NOT NULL;