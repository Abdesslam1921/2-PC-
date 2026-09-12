CREATE TABLE `store_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`title` varchar(255) NOT NULL,
	`variantLabel` varchar(255),
	`sku` varchar(128),
	`unitPrice` decimal(12,2) NOT NULL,
	`quantity` int NOT NULL,
	`lineTotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`orderNumber` varchar(48) NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`customerPhone` varchar(40) NOT NULL,
	`wilaya` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`notes` text,
	`paymentMethod` enum('cod') NOT NULL DEFAULT 'cod',
	`paymentStatus` enum('pending','paid') NOT NULL DEFAULT 'pending',
	`fulfillmentStatus` enum('new','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'new',
	`subtotal` decimal(12,2) NOT NULL,
	`deliveryFee` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
