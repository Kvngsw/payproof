-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "OtpCode_email_fkey";

-- AlterTable
ALTER TABLE "buyers" ADD COLUMN     "name" TEXT,
ADD COLUMN     "passwordHash" TEXT;
ALTER TABLE "buyers" RENAME CONSTRAINT "Buyer_pkey" TO "buyers_pkey";

-- AlterTable
ALTER TABLE "order_events" RENAME CONSTRAINT "OrderEvent_pkey" TO "order_events_pkey";

-- AlterTable
ALTER TABLE "orders" RENAME CONSTRAINT "Order_pkey" TO "orders_pkey";

-- AlterTable
ALTER TABLE "otp_codes" RENAME CONSTRAINT "OtpCode_pkey" TO "otp_codes_pkey";

-- AlterTable
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_pkey" TO "payments_pkey";

-- AlterTable
ALTER TABLE "payouts" RENAME CONSTRAINT "Payout_pkey" TO "payouts_pkey";

-- AlterTable
ALTER TABLE "products" RENAME CONSTRAINT "Product_pkey" TO "products_pkey";

-- AlterTable
ALTER TABLE "sellers" RENAME CONSTRAINT "Seller_pkey" TO "sellers_pkey";

-- AlterTable
ALTER TABLE "webhook_events" RENAME CONSTRAINT "WebhookEvent_pkey" TO "webhook_events_pkey";

-- RenameForeignKey
ALTER TABLE "order_events" RENAME CONSTRAINT "OrderEvent_orderId_fkey" TO "order_events_orderId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_buyerId_fkey" TO "orders_buyerId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_productId_fkey" TO "orders_productId_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "Order_sellerId_fkey" TO "orders_sellerId_fkey";

-- RenameForeignKey
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_orderId_fkey" TO "payments_orderId_fkey";

-- RenameForeignKey
ALTER TABLE "payouts" RENAME CONSTRAINT "Payout_orderId_fkey" TO "payouts_orderId_fkey";

-- RenameForeignKey
ALTER TABLE "products" RENAME CONSTRAINT "Product_sellerId_fkey" TO "products_sellerId_fkey";

-- RenameIndex
ALTER INDEX "Buyer_email_key" RENAME TO "buyers_email_key";

-- RenameIndex
ALTER INDEX "OrderEvent_orderId_idx" RENAME TO "order_events_orderId_idx";

-- RenameIndex
ALTER INDEX "OrderEvent_toStatus_idx" RENAME TO "order_events_toStatus_idx";

-- RenameIndex
ALTER INDEX "Order_buyerId_idx" RENAME TO "orders_buyerId_idx";

-- RenameIndex
ALTER INDEX "Order_sellerId_idx" RENAME TO "orders_sellerId_idx";

-- RenameIndex
ALTER INDEX "Order_sellerId_status_idx" RENAME TO "orders_sellerId_status_idx";

-- RenameIndex
ALTER INDEX "Order_status_idx" RENAME TO "orders_status_idx";

-- RenameIndex
ALTER INDEX "OtpCode_email_idx" RENAME TO "otp_codes_email_idx";

-- RenameIndex
ALTER INDEX "OtpCode_expiresAt_idx" RENAME TO "otp_codes_expiresAt_idx";

-- RenameIndex
ALTER INDEX "Payment_orderId_key" RENAME TO "payments_orderId_key";

-- RenameIndex
ALTER INDEX "Payment_reference_idx" RENAME TO "payments_reference_idx";

-- RenameIndex
ALTER INDEX "Payment_reference_key" RENAME TO "payments_reference_key";

-- RenameIndex
ALTER INDEX "Payout_orderId_idx" RENAME TO "payouts_orderId_idx";

-- RenameIndex
ALTER INDEX "Payout_transferRef_key" RENAME TO "payouts_transferRef_key";

-- RenameIndex
ALTER INDEX "Product_sellerId_idx" RENAME TO "products_sellerId_idx";

-- RenameIndex
ALTER INDEX "Seller_email_idx" RENAME TO "sellers_email_idx";

-- RenameIndex
ALTER INDEX "Seller_email_key" RENAME TO "sellers_email_key";

-- RenameIndex
ALTER INDEX "WebhookEvent_processed_idx" RENAME TO "webhook_events_processed_idx";
