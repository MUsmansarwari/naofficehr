CREATE TABLE `advance_installments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`advance_id` integer NOT NULL,
	`payroll_run_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`advance_id`) REFERENCES `advances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `advances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`given_on` text NOT NULL,
	`installment_amount` integer NOT NULL,
	`remaining_amount` integer NOT NULL,
	`start_month` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`check_in_at` text,
	`check_out_at` text,
	`source` text NOT NULL,
	`is_override` integer DEFAULT false NOT NULL,
	`time_entered_by_hand` integer DEFAULT false NOT NULL,
	`note` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_employee_date` ON `attendance` (`employee_id`,`date`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`note` text,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checkin_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`ip` text NOT NULL,
	`pin_hash` text NOT NULL,
	`success` integer NOT NULL,
	`employee_id` integer,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Karachi' NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL,
	`salary_divisor` integer DEFAULT 30 NOT NULL,
	`shift_start` text DEFAULT '20:00' NOT NULL,
	`shift_end` text DEFAULT '05:00' NOT NULL,
	`weekly_offs` text DEFAULT '[0,6]' NOT NULL,
	`default_probation_months` integer DEFAULT 3 NOT NULL,
	`default_leave_quota` integer DEFAULT 8 NOT NULL,
	`deduct_public_holidays_in_probation` integer DEFAULT false NOT NULL,
	`checkin_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`cnic` text,
	`designation` text,
	`join_date` text NOT NULL,
	`exit_date` text,
	`exit_type` text,
	`probation_months` integer DEFAULT 3 NOT NULL,
	`probation_end_date` text NOT NULL,
	`employment_stage` text DEFAULT 'probation' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`leave_quota_annual` integer,
	`checkin_pin` text,
	`bank_name` text,
	`account_number` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_company_code` ON `employees` (`company_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_company_pin` ON `employees` (`company_id`,`checkin_pin`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'custom' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_company_date` ON `holidays` (`company_id`,`date`);--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`divisor_used` integer NOT NULL,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`locked_at` text,
	`unlocked_at` text,
	`unlock_reason` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_company_month` ON `payroll_runs` (`company_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payroll_run_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`monthly_salary` integer NOT NULL,
	`per_day_rate` integer NOT NULL,
	`divisor` integer NOT NULL,
	`present_days` integer NOT NULL,
	`weekly_off_days` integer NOT NULL,
	`public_holiday_days` integer NOT NULL,
	`leave_paid_days` integer NOT NULL,
	`leave_unpaid_days` integer NOT NULL,
	`absent_days` integer NOT NULL,
	`payable_days` integer NOT NULL,
	`unpaid_days` integer NOT NULL,
	`base_amount` integer NOT NULL,
	`deduction_amount` integer NOT NULL,
	`advance_deduction` integer DEFAULT 0 NOT NULL,
	`other_additions` integer DEFAULT 0 NOT NULL,
	`other_additions_note` text,
	`other_deductions` integer DEFAULT 0 NOT NULL,
	`other_deductions_note` text,
	`net_payable` integer NOT NULL,
	`was_on_probation` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payslips_run_employee` ON `payslips` (`payroll_run_id`,`employee_id`);--> statement-breakpoint
CREATE TABLE `salary_structures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`monthly_salary` integer NOT NULL,
	`effective_from` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salary_employee_effective` ON `salary_structures` (`employee_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`last_backup_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
