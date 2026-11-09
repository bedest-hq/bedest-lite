CREATE TYPE "public"."roles" AS ENUM('SYSTEM', 'ADMIN', 'USER');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"userId" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"readAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"displayName" varchar(255) NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"tagline" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"workingHours" varchar(255),
	"copyright" varchar(255),
	"domain" varchar(255),
	"country" varchar(255),
	"city" varchar(255),
	"state" varchar(255),
	"zipCode" varchar(255),
	"taxId" varchar(255),
	"currency" varchar(3) DEFAULT 'USD',
	"timezone" varchar(255) DEFAULT 'UTC',
	"logoId" uuid,
	"links" jsonb
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"key" varchar(500) NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "storage_files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity" varchar(100) NOT NULL,
	"entityId" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "roles" NOT NULL,
	"avatarId" uuid,
	"password" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logoId_storage_files_id_fk" FOREIGN KEY ("logoId") REFERENCES "public"."storage_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatarId_storage_files_id_fk" FOREIGN KEY ("avatarId") REFERENCES "public"."storage_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("userId") WHERE "isDeleted" = false;--> statement-breakpoint
CREATE INDEX "idx_organizations_active" ON "organizations" USING btree ("id") WHERE "isDeleted" = false;--> statement-breakpoint
CREATE INDEX "sessions_userId_index" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_storage_active" ON "storage_files" USING btree ("id") WHERE "isDeleted" = false;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "system_audit_logs" USING btree ("entity","entityId");--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("id") WHERE "isDeleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email") WHERE "isDeleted" = false;