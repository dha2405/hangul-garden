CREATE TABLE `learning_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `class_owner_idx` ON `learning_classes` (`owner`);--> statement-breakpoint
CREATE TABLE `learning_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`student_id` text NOT NULL,
	`word` text NOT NULL,
	`mode` text NOT NULL,
	`kind` text NOT NULL,
	`round` text,
	`blank` integer,
	`chosen` text,
	`correct` integer,
	`created` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `learning_students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_key_idx` ON `learning_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `student_events_idx` ON `learning_events` (`student_id`,`created`);--> statement-breakpoint
CREATE TABLE `learning_join_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `learning_students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `learning_students` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`alias` text NOT NULL,
	`code` text NOT NULL,
	`created` integer NOT NULL,
	`last_active` integer,
	FOREIGN KEY (`class_id`) REFERENCES `learning_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_code_idx` ON `learning_students` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_alias_idx` ON `learning_students` (`class_id`,`alias`);