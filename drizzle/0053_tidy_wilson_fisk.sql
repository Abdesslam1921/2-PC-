CREATE TABLE `ai_settings` (
	`storeId` int NOT NULL,
	`provider` varchar(60) NOT NULL DEFAULT 'openai',
	`apiKey` varchar(255) NOT NULL,
	`apiUrl` varchar(255) NOT NULL DEFAULT 'https://api.openai.com/v1',
	`model` varchar(120) NOT NULL DEFAULT 'gpt-4o-mini',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_settings_storeId` PRIMARY KEY(`storeId`)
);
