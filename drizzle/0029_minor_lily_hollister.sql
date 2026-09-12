CREATE TABLE `call_center_agent_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_center_agent_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_center_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `call_center_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_center_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_center_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_center_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
