ALTER TABLE "import_rows" ADD COLUMN "committed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "import_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_committed_hash_uq" ON "import_rows" USING btree ("row_hash") WHERE "import_rows"."decision" <> 'skip' and "import_rows"."committed_at" is not null;