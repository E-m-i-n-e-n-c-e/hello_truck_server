-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('THREE_WHEELER', 'FOUR_WHEELER');

-- CreateEnum
CREATE TYPE "public"."VehicleBodyType" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."FuelType" AS ENUM ('DIESEL', 'PETROL', 'EV', 'CNG');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('PERSONAL', 'AGRICULTURAL', 'NON_AGRICULTURAL');

-- CreateEnum
CREATE TYPE "public"."WeightUnit" AS ENUM ('KG', 'QUINTAL');

-- CreateEnum
CREATE TYPE "public"."DimensionUnit" AS ENUM ('CM', 'INCHES');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'DRIVER_ASSIGNED', 'CONFIRMED', 'PICKUP_ARRIVED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DROP_ARRIVED', 'DROP_VERIFIED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'AUTO_REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'ON_RIDE', 'RIDE_OFFERED');

-- CreateEnum
CREATE TYPE "public"."LifecycleEventType" AS ENUM ('PICKUP_ARRIVED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DROP_ARRIVED', 'DROP_VERIFIED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "public"."TransactionCategory" AS ENUM ('BOOKING_PAYMENT', 'BOOKING_REFUND', 'DRIVER_PAYOUT', 'DRIVER_PAYMENT');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."InvoiceType" AS ENUM ('ESTIMATE', 'FINAL');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "public"."PayoutMethodType" AS ENUM ('BANK_ACCOUNT', 'VPA');

-- CreateEnum
CREATE TYPE "public"."RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "addressDetails" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedAddress" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "noteToDriver" TEXT,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerGstDetails" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGstDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "oldToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fcmToken" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "alternatePhone" TEXT,
    "photo" TEXT,
    "contactId" TEXT,
    "fundAccountId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "driverStatus" "public"."DriverStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payoutMethod" "public"."PayoutMethodType",
    "referralCode" TEXT,
    "rideCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverDocuments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "licenseUrl" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "licenseStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rcBookUrl" TEXT NOT NULL,
    "fcUrl" TEXT NOT NULL,
    "fcExpiry" TIMESTAMP(3),
    "fcStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "insuranceUrl" TEXT NOT NULL,
    "insuranceExpiry" TIMESTAMP(3),
    "insuranceStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "aadharUrl" TEXT NOT NULL,
    "panNumber" TEXT NOT NULL,
    "ebBillUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rcBookExpiry" TIMESTAMP(3),
    "rcBookStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "selfieUrl" TEXT,
    "suggestedFcExpiry" TIMESTAMP(3),
    "suggestedInsuranceExpiry" TIMESTAMP(3),
    "suggestedLicenseExpiry" TIMESTAMP(3),
    "suggestedRcBookExpiry" TIMESTAMP(3),
    "aadharNumberEncrypted" TEXT NOT NULL DEFAULT 'RandomHash',
    "aadharNumberHash" TEXT NOT NULL DEFAULT 'RandomHash',

    CONSTRAINT "DriverDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverSession" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "oldToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fcmToken" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "DriverSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "vehicleBodyLength" DECIMAL(3,1) NOT NULL,
    "vehicleBodyType" "public"."VehicleBodyType" NOT NULL,
    "fuelType" "public"."FuelType" NOT NULL,
    "vehicleImageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleModelName" TEXT NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleModel" (
    "name" TEXT NOT NULL,
    "perKm" DECIMAL(10,2) NOT NULL,
    "baseKm" INTEGER NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "maxWeightTons" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "public"."VehicleOwner" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aadharUrl" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverAddress" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverStatusLog" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "public"."DriverStatus" NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Package" (
    "id" TEXT NOT NULL,
    "productType" "public"."ProductType" NOT NULL,
    "productName" TEXT,
    "approximateWeight" DECIMAL(10,2) NOT NULL,
    "weightUnit" "public"."WeightUnit" NOT NULL DEFAULT 'KG',
    "bundleWeight" DECIMAL(10,2),
    "numberOfProducts" INTEGER,
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "dimensionUnit" "public"."DimensionUnit" DEFAULT 'CM',
    "description" TEXT,
    "packageImageUrl" TEXT,
    "gstBillUrl" TEXT,
    "transportDocUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingAddress" (
    "id" TEXT NOT NULL,
    "addressName" TEXT,
    "noteToDriver" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "addressDetails" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" BIGSERIAL NOT NULL,
    "customerId" TEXT,
    "packageId" TEXT NOT NULL,
    "pickupAddressId" TEXT NOT NULL,
    "dropAddressId" TEXT NOT NULL,
    "pickupOtp" TEXT NOT NULL,
    "dropOtp" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "pickupArrivedAt" TIMESTAMP(3),
    "pickupVerifiedAt" TIMESTAMP(3),
    "dropArrivedAt" TIMESTAMP(3),
    "dropVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "assignedDriverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "gstNumber" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingAssignment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "commissionRate" DECIMAL(5,4),

    CONSTRAINT "BookingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingStatusLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "public"."InvoiceType" NOT NULL,
    "vehicleModelName" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "perKmPrice" DECIMAL(10,2) NOT NULL,
    "baseKm" INTEGER NOT NULL,
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "weightInTons" DECIMAL(10,2) NOT NULL,
    "effectiveBasePrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "walletApplied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "paymentLinkUrl" TEXT,
    "rzpPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "rzpPaymentLinkId" TEXT,
    "paymentMethod" "public"."PaymentMethod",
    "platformFee" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "gstNumber" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "driverId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "category" "public"."TransactionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "bookingId" TEXT,
    "payoutId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "refundIntentId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payout" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "razorpayPayoutId" TEXT,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverWalletLog" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "beforeBalance" DECIMAL(10,2) NOT NULL,
    "afterBalance" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverWalletLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverPaymentLink" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceId" TEXT NOT NULL,

    CONSTRAINT "DriverPaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWalletLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "beforeBalance" DECIMAL(10,2) NOT NULL,
    "afterBalance" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundIntentId" TEXT,

    CONSTRAINT "CustomerWalletLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefundIntent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "walletRefundAmount" DECIMAL(10,2) NOT NULL,
    "razorpayRefundAmount" DECIMAL(10,2) NOT NULL,
    "cancellationCharge" DECIMAL(10,2) NOT NULL,
    "rzpPaymentId" TEXT,
    "rzpRefundId" TEXT,
    "status" "public"."RefundStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "wasPaid" BOOLEAN NOT NULL,
    "refundFactor" DECIMAL(10,2),

    CONSTRAINT "RefundIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneNumber_key" ON "public"."Customer"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "public"."Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "public"."Customer"("isActive");

-- CreateIndex
CREATE INDEX "Customer_referralCode_idx" ON "public"."Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Address_latitude_longitude_idx" ON "public"."Address"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_addressId_key" ON "public"."SavedAddress"("addressId");

-- CreateIndex
CREATE INDEX "SavedAddress_customerId_idx" ON "public"."SavedAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_name_customerId_key" ON "public"."SavedAddress"("name", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGstDetails_gstNumber_key" ON "public"."CustomerGstDetails"("gstNumber");

-- CreateIndex
CREATE INDEX "CustomerGstDetails_customerId_isActive_idx" ON "public"."CustomerGstDetails"("customerId", "isActive");

-- CreateIndex
CREATE INDEX "CustomerGstDetails_createdAt_idx" ON "public"."CustomerGstDetails"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_token_key" ON "public"."CustomerSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_oldToken_key" ON "public"."CustomerSession"("oldToken");

-- CreateIndex
CREATE INDEX "CustomerSession_expiresAt_idx" ON "public"."CustomerSession"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "public"."CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSession_fcmToken_idx" ON "public"."CustomerSession"("fcmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phoneNumber_key" ON "public"."Driver"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_referralCode_key" ON "public"."Driver"("referralCode");

-- CreateIndex
CREATE INDEX "Driver_isActive_verificationStatus_idx" ON "public"."Driver"("isActive", "verificationStatus");

-- CreateIndex
CREATE INDEX "Driver_lastSeenAt_driverStatus_idx" ON "public"."Driver"("lastSeenAt", "driverStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocuments_driverId_key" ON "public"."DriverDocuments"("driverId");

-- CreateIndex
CREATE INDEX "DriverDocuments_licenseExpiry_idx" ON "public"."DriverDocuments"("licenseExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_rcBookExpiry_idx" ON "public"."DriverDocuments"("rcBookExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_fcExpiry_idx" ON "public"."DriverDocuments"("fcExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_insuranceExpiry_idx" ON "public"."DriverDocuments"("insuranceExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_aadharNumberHash_idx" ON "public"."DriverDocuments"("aadharNumberHash");

-- CreateIndex
CREATE INDEX "DriverDocuments_panNumber_idx" ON "public"."DriverDocuments"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSession_token_key" ON "public"."DriverSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DriverSession_oldToken_key" ON "public"."DriverSession"("oldToken");

-- CreateIndex
CREATE INDEX "DriverSession_expiresAt_idx" ON "public"."DriverSession"("expiresAt");

-- CreateIndex
CREATE INDEX "DriverSession_driverId_idx" ON "public"."DriverSession"("driverId");

-- CreateIndex
CREATE INDEX "DriverSession_fcmToken_idx" ON "public"."DriverSession"("fcmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_driverId_key" ON "public"."Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleNumber_idx" ON "public"."Vehicle"("vehicleNumber");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleModelName_idx" ON "public"."Vehicle"("vehicleModelName");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleType_idx" ON "public"."Vehicle"("vehicleType");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleOwner_vehicleId_key" ON "public"."VehicleOwner"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAddress_driverId_key" ON "public"."DriverAddress"("driverId");

-- CreateIndex
CREATE INDEX "DriverAddress_driverId_idx" ON "public"."DriverAddress"("driverId");

-- CreateIndex
CREATE INDEX "DriverStatusLog_driverId_status_idx" ON "public"."DriverStatusLog"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverStatusLog_statusChangedAt_idx" ON "public"."DriverStatusLog"("statusChangedAt");

-- CreateIndex
CREATE INDEX "BookingAddress_latitude_longitude_idx" ON "public"."BookingAddress"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "public"."Booking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_packageId_key" ON "public"."Booking"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_pickupAddressId_key" ON "public"."Booking"("pickupAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_dropAddressId_key" ON "public"."Booking"("dropAddressId");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "public"."Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_assignedDriverId_status_idx" ON "public"."Booking"("assignedDriverId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "public"."Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BookingAssignment_bookingId_status_idx" ON "public"."BookingAssignment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingAssignment_driverId_status_idx" ON "public"."BookingAssignment"("driverId", "status");

-- CreateIndex
CREATE INDEX "BookingAssignment_status_offeredAt_idx" ON "public"."BookingAssignment"("status", "offeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAssignment_bookingId_driverId_key" ON "public"."BookingAssignment"("bookingId", "driverId");

-- CreateIndex
CREATE INDEX "BookingStatusLog_bookingId_status_idx" ON "public"."BookingStatusLog"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingStatusLog_statusChangedAt_idx" ON "public"."BookingStatusLog"("statusChangedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_rzpPaymentLinkId_key" ON "public"."Invoice"("rzpPaymentLinkId");

-- CreateIndex
CREATE INDEX "Invoice_bookingId_idx" ON "public"."Invoice"("bookingId");

-- CreateIndex
CREATE INDEX "Invoice_gstNumber_idx" ON "public"."Invoice"("gstNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_type_key" ON "public"."Invoice"("bookingId", "type");

-- CreateIndex
CREATE INDEX "Transaction_customerId_createdAt_idx" ON "public"."Transaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_driverId_createdAt_idx" ON "public"."Transaction"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_bookingId_idx" ON "public"."Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Transaction_payoutId_idx" ON "public"."Transaction"("payoutId");

-- CreateIndex
CREATE INDEX "Transaction_category_createdAt_idx" ON "public"."Transaction"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_razorpayPayoutId_key" ON "public"."Payout"("razorpayPayoutId");

-- CreateIndex
CREATE INDEX "Payout_driverId_status_idx" ON "public"."Payout"("driverId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "public"."Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DriverWalletLog_driverId_createdAt_idx" ON "public"."DriverWalletLog"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverWalletLog_createdAt_idx" ON "public"."DriverWalletLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPaymentLink_referenceId_key" ON "public"."DriverPaymentLink"("referenceId");

-- CreateIndex
CREATE INDEX "CustomerWalletLog_customerId_createdAt_idx" ON "public"."CustomerWalletLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerWalletLog_createdAt_idx" ON "public"."CustomerWalletLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundIntent_bookingId_key" ON "public"."RefundIntent"("bookingId");

-- CreateIndex
CREATE INDEX "RefundIntent_status_idx" ON "public"."RefundIntent"("status");

-- CreateIndex
CREATE INDEX "RefundIntent_bookingId_idx" ON "public"."RefundIntent"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReferral_referredId_key" ON "public"."CustomerReferral"("referredId");

-- CreateIndex
CREATE INDEX "CustomerReferral_referrerId_idx" ON "public"."CustomerReferral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverReferral_referredId_key" ON "public"."DriverReferral"("referredId");

-- CreateIndex
CREATE INDEX "DriverReferral_referrerId_idx" ON "public"."DriverReferral"("referrerId");

-- AddForeignKey
ALTER TABLE "public"."SavedAddress" ADD CONSTRAINT "SavedAddress_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedAddress" ADD CONSTRAINT "SavedAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerGstDetails" ADD CONSTRAINT "CustomerGstDetails_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverDocuments" ADD CONSTRAINT "DriverDocuments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverSession" ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_vehicleModelName_fkey" FOREIGN KEY ("vehicleModelName") REFERENCES "public"."VehicleModel"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleOwner" ADD CONSTRAINT "VehicleOwner_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverAddress" ADD CONSTRAINT "DriverAddress_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverStatusLog" ADD CONSTRAINT "DriverStatusLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_dropAddressId_fkey" FOREIGN KEY ("dropAddressId") REFERENCES "public"."BookingAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "public"."BookingAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingStatusLog" ADD CONSTRAINT "BookingStatusLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_refundIntentId_fkey" FOREIGN KEY ("refundIntentId") REFERENCES "public"."RefundIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payout" ADD CONSTRAINT "Payout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverWalletLog" ADD CONSTRAINT "DriverWalletLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverWalletLog" ADD CONSTRAINT "DriverWalletLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverPaymentLink" ADD CONSTRAINT "DriverPaymentLink_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_refundIntentId_fkey" FOREIGN KEY ("refundIntentId") REFERENCES "public"."RefundIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
