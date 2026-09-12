ALTER TABLE `store_order_items` ADD `productCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `packagingCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `procurementDeliveryCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `returnCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `returnDeliveryFreeSnapshot` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `confirmationSource` enum('owner','call_center') DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `confirmationAgentId` int;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `normalConfirmationCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_order_items` ADD `deliveredConfirmationCostSnapshot` decimal(12,2) DEFAULT '0.00' NOT NULL;