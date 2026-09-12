CREATE TABLE `carrier_status_map` (
	`id` int AUTO_INCREMENT NOT NULL,
	`carrier_id` int NOT NULL,
	`raw_label` varchar(255) NOT NULL,
	`maps_to` enum('in_transit','out_for_delivery','suspended','delivered','returned','other') NOT NULL,
	`is_final` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carrier_status_map_id` PRIMARY KEY(`id`),
	CONSTRAINT `carrier_status_map_carrier_raw_unique` UNIQUE(`carrier_id`,`raw_label`)
);
--> statement-breakpoint
CREATE TABLE `carriers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`platform_type` enum('ecotrack','yalidine','custom') NOT NULL,
	`supports_webhook` boolean NOT NULL DEFAULT false,
	`webhook_endpoint_path` varchar(500),
	`webhook_secret` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carriers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchant_carrier_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchant_id` int NOT NULL,
	`carrier_id` int NOT NULL,
	`api_base_url` varchar(500),
	`api_token` text,
	`webhook_registered` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchant_carrier_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchant_carrier_unique` UNIQUE(`merchant_id`,`carrier_id`)
);
--> statement-breakpoint
CREATE TABLE `order_profits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`merchant_id` int NOT NULL,
	`revenue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`cost_of_goods` decimal(12,2) NOT NULL DEFAULT '0.00',
	`delivery_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`net_profit` decimal(12,2) NOT NULL DEFAULT '0.00',
	`resolved_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_profits_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_profits_order_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `order_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`merchant_id` int NOT NULL,
	`return_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`stock_restocked` boolean NOT NULL DEFAULT false,
	`resolved_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_returns_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_returns_order_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `order_shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`merchant_id` int NOT NULL,
	`carrier_id` int NOT NULL,
	`tracking_number` varchar(160) NOT NULL,
	`external_status_label` varchar(255),
	`internal_status` enum('in_transit','out_for_delivery','suspended','delivered','returned','other'),
	`final_status` enum('delivered','returned'),
	`resolved_at` timestamp,
	`status_entered_at` timestamp,
	`next_check_at` timestamp,
	`last_checked_at` timestamp,
	`check_count` int NOT NULL DEFAULT 0,
	`status_history` text NOT NULL,
	`sync_method` enum('webhook','polling') NOT NULL DEFAULT 'polling',
	`review_flagged` boolean NOT NULL DEFAULT false,
	`fallback_reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_shipments_order_carrier_unique` UNIQUE(`order_id`,`carrier_id`)
);
--> statement-breakpoint
CREATE INDEX `order_shipments_carrier_tracking_idx` ON `order_shipments` (`carrier_id`,`tracking_number`);--> statement-breakpoint
CREATE INDEX `order_shipments_final_next_idx` ON `order_shipments` (`final_status`,`next_check_at`);