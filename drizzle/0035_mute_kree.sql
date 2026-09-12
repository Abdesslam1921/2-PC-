ALTER TABLE `call_center_agents` ADD `compensationMode` enum('all_orders','completed_orders') DEFAULT 'all_orders' NOT NULL;--> statement-breakpoint
ALTER TABLE `call_center_agents` ADD `generalOrderRate` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `call_center_agents` ADD `completedOrderRate` decimal(12,2) DEFAULT '0.00' NOT NULL;