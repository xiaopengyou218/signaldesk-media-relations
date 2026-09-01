ALTER TABLE `editors` ADD `x_activity_status` text DEFAULT '待核验' NOT NULL;
--> statement-breakpoint
ALTER TABLE `editors` ADD `x_last_observed_at` text;
--> statement-breakpoint
ALTER TABLE `editors` ADD `x_activity_note` text;
--> statement-breakpoint
ALTER TABLE `editors` ADD `x_verified_at` text;
--> statement-breakpoint
CREATE INDEX `idx_editors_x_activity_priority` ON `editors` (`x_activity_status`,`priority`);
--> statement-breakpoint
PRAGMA optimize;
