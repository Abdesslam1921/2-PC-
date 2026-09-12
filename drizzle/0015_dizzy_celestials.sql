ALTER TABLE `delivery_settings` ADD `customerCarrierChoiceEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `store_orders` ADD `carrierConnectionId` int;