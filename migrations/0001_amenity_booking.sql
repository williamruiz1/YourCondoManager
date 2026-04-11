CREATE TYPE "public"."amenity_reservation_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"capacity" integer,
	"booking_window_days" integer DEFAULT 30 NOT NULL,
	"min_duration_minutes" integer DEFAULT 30 NOT NULL,
	"max_duration_minutes" integer DEFAULT 240 NOT NULL,
	"requires_approval" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenity_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amenity_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenity_reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amenity_id" varchar NOT NULL,
	"association_id" varchar NOT NULL,
	"person_id" varchar NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" "amenity_reservation_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_blocks" ADD CONSTRAINT "amenity_blocks_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_blocks" ADD CONSTRAINT "amenity_blocks_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_reservations" ADD CONSTRAINT "amenity_reservations_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_reservations" ADD CONSTRAINT "amenity_reservations_association_id_associations_id_fk" FOREIGN KEY ("association_id") REFERENCES "public"."associations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_reservations" ADD CONSTRAINT "amenity_reservations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_reservations" ADD CONSTRAINT "amenity_reservations_approved_by_persons_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;