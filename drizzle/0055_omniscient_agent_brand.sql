ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellProductId` int;--> statement-breakpoint
ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellPrice` decimal(12,2);--> statement-breakpoint
ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellDiscountAmount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `store_products` ADD COLUMN IF NOT EXISTS `upsellDiscountPercent` int;