CREATE TYPE "public"."client_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('individual', 'business');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('whatsapp', 'phone', 'email', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('web_order', 'order_created', 'order_status', 'payment', 'purchase', 'deletion');--> statement-breakpoint
CREATE TYPE "public"."order_event_kind" AS ENUM('requested', 'quoted', 'confirmed', 'purchasing', 'purchased', 'in_transit', 'arrived', 'ready_for_pickup', 'delivered', 'on_hold', 'cancelled', 'refunded', 'note', 'payment', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('whatsapp', 'phone', 'walk_in', 'facebook', 'referral');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('requested', 'quoted', 'confirmed', 'purchasing', 'purchased', 'in_transit', 'arrived', 'ready_for_pickup', 'delivered', 'on_hold', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method_kind" AS ENUM('cash', 'bank', 'mobile_wallet', 'card', 'hawala');--> statement-breakpoint
CREATE TYPE "public"."payment_method_use" AS ENUM('incoming', 'outgoing', 'both');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('advance', 'partial', 'final', 'refund');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('electronics', 'mobile', 'computers', 'beauty', 'health', 'baby', 'fashion', 'home', 'auto', 'other');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'placed', 'shipped_to_warehouse', 'received', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'manager', 'operator', 'accountant');--> statement-breakpoint
CREATE TYPE "public"."web_order_status" AS ENUM('new', 'converted', 'dismissed');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "client_type" DEFAULT 'individual' NOT NULL,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"city" text DEFAULT '' NOT NULL,
	"address" text,
	"preferred_contact" "contact_channel" DEFAULT 'phone' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profile" (
	"id" text PRIMARY KEY DEFAULT 'company' NOT NULL,
	"name" text NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"address_line1" text DEFAULT '' NOT NULL,
	"address_line2" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"order_prefix" text DEFAULT 'AS' NOT NULL,
	"invoice_footer" text DEFAULT '' NOT NULL,
	"terms_and_conditions" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"href" text,
	"read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "order_event_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"actor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"product_url" text,
	"image_url" text,
	"store_id" text NOT NULL,
	"category" "product_category" DEFAULT 'other' NOT NULL,
	"variant" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price_afn" integer DEFAULT 0 NOT NULL,
	"unit_cost_afn" integer DEFAULT 0 NOT NULL,
	"weight_grams" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"tracking_number" text NOT NULL,
	"client_id" text NOT NULL,
	"status" "order_status" DEFAULT 'requested' NOT NULL,
	"source" "order_source" DEFAULT 'whatsapp' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"service_fee_afn" integer DEFAULT 0 NOT NULL,
	"shipping_charged_afn" integer DEFAULT 0 NOT NULL,
	"freight_cost_afn" integer,
	"customs_duty_afn" integer,
	"discount_afn" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "payment_method_kind" NOT NULL,
	"account_ref" text,
	"used_for" "payment_method_use" DEFAULT 'both' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_no" text NOT NULL,
	"client_id" text NOT NULL,
	"order_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_afn" integer NOT NULL,
	"method_id" text NOT NULL,
	"type" "payment_type" DEFAULT 'partial' NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"purchase_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	CONSTRAINT "purchase_items_purchase_id_order_item_id_pk" PRIMARY KEY("purchase_id","order_item_id")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_no" text NOT NULL,
	"order_id" text NOT NULL,
	"store_id" text NOT NULL,
	"external_order_number" text DEFAULT '' NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purchased_by" text DEFAULT '' NOT NULL,
	"payment_method_id" text NOT NULL,
	"total_cost_afn" integer DEFAULT 0 NOT NULL,
	"invoice_ref" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" DEFAULT 'operator' NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "product_category" DEFAULT 'other' NOT NULL,
	"price_afn" integer DEFAULT 0 NOT NULL,
	"cost_afn" integer DEFAULT 0 NOT NULL,
	"store_id" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"lead_time_days" integer DEFAULT 14 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"web_order_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"price_afn" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_city" text DEFAULT '' NOT NULL,
	"customer_address" text,
	"note" text,
	"total_afn" integer DEFAULT 0 NOT NULL,
	"status" "web_order_status" DEFAULT 'new' NOT NULL,
	"converted_order_id" text
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_order_lines" ADD CONSTRAINT "web_order_lines_web_order_id_web_orders_id_fk" FOREIGN KEY ("web_order_id") REFERENCES "public"."web_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_order_lines" ADD CONSTRAINT "web_order_lines_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_orders" ADD CONSTRAINT "web_orders_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_code_unique" ON "clients" USING btree ("code");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "notifications_at_idx" ON "notifications" USING btree ("at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_no_unique" ON "orders" USING btree ("order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tracking_number_unique" ON "orders" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "orders_client_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_receipt_no_unique" ON "payments" USING btree ("receipt_no");--> statement-breakpoint
CREATE INDEX "payments_client_idx" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_purchase_no_unique" ON "purchases" USING btree ("purchase_no");--> statement-breakpoint
CREATE INDEX "purchases_order_idx" ON "purchases" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sessions_staff_idx" ON "sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_unique" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_slug_unique" ON "store_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "web_order_lines_order_idx" ON "web_order_lines" USING btree ("web_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "web_orders_reference_unique" ON "web_orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "web_orders_status_idx" ON "web_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "web_orders_phone_idx" ON "web_orders" USING btree ("customer_phone");