PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercises`("id", "name", "user_id", "created_at", "updated_at") SELECT "id", "name", "user_id", "created_at", "updated_at" FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_user_routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`created_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_routines`("id", "user_id", "exercise_id", "day_of_week", "created_at") SELECT "id", "user_id", "exercise_id", "day_of_week", "created_at" FROM `user_routines`;--> statement-breakpoint
DROP TABLE `user_routines`;--> statement-breakpoint
ALTER TABLE `__new_user_routines` RENAME TO `user_routines`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_routine_unique` ON `user_routines` (`user_id`,`exercise_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "created_at", "is_active") SELECT "id", "name", "created_at", "is_active" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);--> statement-breakpoint
CREATE TABLE `__new_workout_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`date` text NOT NULL,
	`sets` text NOT NULL,
	`created_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2026-06-15T21:01:33.719Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workout_logs`("id", "user_id", "exercise_id", "date", "sets", "created_at", "updated_at") SELECT "id", "user_id", "exercise_id", "date", "sets", "created_at", "updated_at" FROM `workout_logs`;--> statement-breakpoint
DROP TABLE `workout_logs`;--> statement-breakpoint
ALTER TABLE `__new_workout_logs` RENAME TO `workout_logs`;