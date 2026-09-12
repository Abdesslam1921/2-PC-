ALTER TABLE `call_center_agents` ADD `notifyNewOrders` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `call_center_agents` ADD `notifyStatusChanges` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `call_center_agents` ADD `notifyFollowUp` boolean DEFAULT true NOT NULL;