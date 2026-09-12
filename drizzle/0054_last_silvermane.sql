CREATE TABLE `tracking_retarget_order_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`orderId` int NOT NULL,
	`lastStatusSent` varchar(255),
	`deliveredAt` timestamp,
	`retargetDueAt` timestamp,
	`retargetStatus` enum('none','pending','sent','skipped') NOT NULL DEFAULT 'none',
	`retargetAttempts` int NOT NULL DEFAULT 0,
	`retargetSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracking_retarget_order_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracking_retarget_order_state_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `tracking_retarget_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`orderId` int,
	`kind` enum('status','retarget','redeem') NOT NULL,
	`statusLabel` varchar(255),
	`toPhone` varchar(40),
	`message` text,
	`ok` boolean NOT NULL DEFAULT false,
	`error` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tracking_retarget_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracking_retarget_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`storeId` int,
	`enabled` boolean NOT NULL DEFAULT false,
	`whatsappPhoneId` varchar(80),
	`whatsappTokenEncrypted` text,
	`supportNumbersJson` varchar(5000) NOT NULL DEFAULT '[]',
	`trackTitle` varchar(180) NOT NULL DEFAULT 'تتبع طلبك عبر واتساب',
	`trackHint` varchar(500) NOT NULL DEFAULT 'أرسل رقم طلبك وسنرد عليك مباشرة بمتابعة طلبك لحظة بلحظة.',
	`trackCta` varchar(180) NOT NULL DEFAULT 'تتبع طلبك الآن',
	`trackMessage` varchar(500) NOT NULL DEFAULT 'مرحبًا، أريد تتبع طلبية رقم {orderNumber}',
	`statusEnabled` boolean NOT NULL DEFAULT true,
	`statusMessage` text NOT NULL,
	`retargetEnabled` boolean NOT NULL DEFAULT false,
	`retargetTargetType` enum('product','landing') NOT NULL DEFAULT 'product',
	`retargetProductId` int,
	`retargetLandingPageId` int,
	`retargetLandingUrl` varchar(2000),
	`retargetDiscountPercent` int NOT NULL DEFAULT 10,
	`retargetDelayDays` int NOT NULL DEFAULT 3,
	`retargetMessage` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracking_retarget_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracking_retarget_settings_storeId_unique` UNIQUE(`storeId`)
);
--> statement-breakpoint
CREATE INDEX `tracking_retarget_sends_store_idx` ON `tracking_retarget_sends` (`storeId`,`kind`);