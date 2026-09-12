ALTER TABLE `store_product_variants` ADD `showStockThreshold` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_products` ADD `showStockThreshold` int DEFAULT 0 NOT NULL;