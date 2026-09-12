CREATE TABLE `meta_oauth_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`codeVerifierEncrypted` text NOT NULL,
	`redirectUri` varchar(512) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_oauth_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_oauth_states_stateHash_unique` UNIQUE(`stateHash`)
);
