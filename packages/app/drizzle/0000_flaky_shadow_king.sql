CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gross_annual_income` text NOT NULL,
	`existing_monthly_debt` text NOT NULL,
	`target_savings_rate` text NOT NULL,
	`available_net_worth` text NOT NULL,
	`current_rent` text NOT NULL,
	`down_payment_cash` text NOT NULL,
	`reserve` text NOT NULL,
	`current_annual_savings` text NOT NULL,
	`target_annual_retirement_spend` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_scenario_name_per_profile` ON `scenarios` (`profile_id`,`name`);