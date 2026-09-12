CREATE TABLE `store_product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`altText` varchar(255),
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`color` varchar(120),
	`size` varchar(120),
	`sku` varchar(128),
	`price` decimal(12,2),
	`compareAtPrice` decimal(12,2),
	`stock` int NOT NULL DEFAULT 0,
	`lowStockThreshold` int NOT NULL DEFAULT 5,
	`imageId` int,
	`available` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`productType` varchar(160),
	`collectionName` varchar(160),
	`status` enum('draft','active') NOT NULL DEFAULT 'draft',
	`price` decimal(12,2),
	`compareAtPrice` decimal(12,2),
	`costPerItem` decimal(12,2),
	`sku` varchar(128),
	`inventory` int NOT NULL DEFAULT 0,
	`lowStockThreshold` int NOT NULL DEFAULT 5,
	`trackInventory` boolean NOT NULL DEFAULT true,
	`continueSelling` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_products_id` PRIMARY KEY(`id`)
);
