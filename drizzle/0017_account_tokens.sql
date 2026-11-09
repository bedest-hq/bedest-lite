CREATE TYPE "public"."user_token_type" AS ENUM('PASSWORD_RESET', 'INVITE', 'EMAIL_VERIFY');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INVITED');--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" "user_token_type" NOT NULL,
	"tokenHash" char(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "user_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_tokens_user" ON "user_tokens" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "idx_user_tokens_expires_at" ON "user_tokens" USING btree ("expiresAt");