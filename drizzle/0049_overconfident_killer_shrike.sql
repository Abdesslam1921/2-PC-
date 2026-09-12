ALTER TABLE `contact_bar_settings` DROP INDEX `contact_bar_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `content_guard_settings` DROP INDEX `content_guard_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `delivery_carrier_connections` DROP INDEX `delivery_owner_provider_account_unique`;--> statement-breakpoint
ALTER TABLE `delivery_carrier_wilaya_rates` DROP INDEX `delivery_owner_carrier_wilaya_unique`;--> statement-breakpoint
ALTER TABLE `delivery_settings` DROP INDEX `delivery_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `delivery_wilaya_rates` DROP INDEX `delivery_owner_wilaya_unique`;--> statement-breakpoint
ALTER TABLE `meta_ad_accounts` DROP INDEX `meta_owner_external_account_unique`;--> statement-breakpoint
ALTER TABLE `order_clean_settings` DROP INDEX `order_clean_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `profitability_settings` DROP INDEX `profitability_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `shark_cod_settings` DROP INDEX `shark_cod_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `store_connecteurs` DROP INDEX `store_connecteurs_owner_kind_unique`;--> statement-breakpoint
ALTER TABLE `store_theme_settings` DROP INDEX `store_theme_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `thank_you_popup_settings` DROP INDEX `thank_you_popup_settings_ownerId_unique`;--> statement-breakpoint
ALTER TABLE `call_center_agents` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `contact_bar_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `content_guard_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `meta_ad_accounts` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `meta_campaign_audit_logs` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `meta_oauth_states` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `order_clean_events` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `order_clean_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `profitability_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `shark_cod_events` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `shark_cod_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `store_connecteurs` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `store_digital_downloads` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `thank_you_popup_settings` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `contact_bar_settings` ADD CONSTRAINT `contact_bar_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `content_guard_settings` ADD CONSTRAINT `content_guard_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `delivery_carrier_connections` ADD CONSTRAINT `delivery_owner_provider_account_unique` UNIQUE(`storeId`,`provider`,`accountName`);--> statement-breakpoint
ALTER TABLE `delivery_carrier_wilaya_rates` ADD CONSTRAINT `delivery_owner_carrier_wilaya_unique` UNIQUE(`storeId`,`carrierConnectionId`,`wilayaCode`);--> statement-breakpoint
ALTER TABLE `delivery_settings` ADD CONSTRAINT `delivery_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `delivery_wilaya_rates` ADD CONSTRAINT `delivery_owner_wilaya_unique` UNIQUE(`storeId`,`wilayaCode`);--> statement-breakpoint
ALTER TABLE `meta_ad_accounts` ADD CONSTRAINT `meta_owner_external_account_unique` UNIQUE(`storeId`,`externalAccountId`);--> statement-breakpoint
ALTER TABLE `order_clean_settings` ADD CONSTRAINT `order_clean_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `profitability_settings` ADD CONSTRAINT `profitability_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `shark_cod_settings` ADD CONSTRAINT `shark_cod_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `store_connecteurs` ADD CONSTRAINT `store_connecteurs_owner_kind_unique` UNIQUE(`storeId`,`kind`);--> statement-breakpoint
ALTER TABLE `store_theme_settings` ADD CONSTRAINT `store_theme_settings_storeId_unique` UNIQUE(`storeId`);--> statement-breakpoint
ALTER TABLE `thank_you_popup_settings` ADD CONSTRAINT `thank_you_popup_settings_storeId_unique` UNIQUE(`storeId`);