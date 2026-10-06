ALTER TABLE "order_slip" ADD COLUMN "amount_paid" numeric(16, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Paid slips were paid in full. Partial slips never recorded an amount, so
-- they start at 0 paid and get their real figure the next time they're edited.
UPDATE "order_slip" SET "amount_paid" = "total_amount" WHERE "status" = 'paid';--> statement-breakpoint
ALTER TABLE "order_slip" ADD CONSTRAINT "order_slip_amount_paid_ck" CHECK ("order_slip"."amount_paid" >= 0 and "order_slip"."amount_paid" <= "order_slip"."total_amount"
        and ("order_slip"."status" <> 'paid' or "order_slip"."amount_paid" = "order_slip"."total_amount")
        and ("order_slip"."status" <> 'unpaid' or "order_slip"."amount_paid" = 0));