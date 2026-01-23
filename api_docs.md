# Hello Truck API Documentation

This document provides a detailed reference for the Hello Truck server API. All routes marked with 🔒 require a bearer `access-token` in the Authorization header.

## DTO Definitions

Common Data Transfer Objects (DTOs) used across the API.

### Auth DTOs
*   **`SendOtpDto`**:
    *   `phoneNumber`: `string`
*   **`VerifyOtpDto`**:
    *   `phoneNumber`: `string`
    *   `otp`: `string`
    *   `staleRefreshToken?`: `string`
    *   `fcmToken?`: `string`
*   **`TokenResponseDto`**:
    *   `accessToken`: `string`
    *   `refreshToken`: `string`
*   **`refreshTokenDto`**:
    *   `refreshToken`: `string`

### Common DTOs
*   **`SuccessResponseDto`**:
    *   `success`: `boolean`
    *   `message`: `string`
*   **`UploadUrlResponseDto`**:
    *   `signedUrl`: `string`
    *   `publicUrl`: `string`
    *   `token`: `string`
*   **`UsertFcmTokenDto`**:
    *   `fcmToken`: `string`

### Booking DTOs
*   **`CreateBookingAddressDto`**: Used for pickup and drop addresses.
    *   `addressName?`: `string`
    *   `contactName`: `string`
    *   `contactPhone`: `string`
    *   `noteToDriver?`: `string`
    *   `latitude`: `number`
    *   `longitude`: `number`
    *   `formattedAddress`: `string`
    *   `addressDetails?`: `string`
*   **`PackageDetailsDto`**: Describes the goods being transported.
    *   `productType`: `enum` (PERSONAL, AGRICULTURAL, NON_AGRICULTURAL)
    *   `approximateWeight`: `number` - **Required** for all product types
    *   `weightUnit`: `enum` (KG, QUINTAL) - Defaults to KG
    *   `personal?`: `PersonalProductDto` - Required if productType is PERSONAL
    *   `agricultural?`: `AgriculturalProductDto` - Required if productType is AGRICULTURAL
    *   `nonAgricultural?`: `NonAgriculturalProductDto` - Required if productType is NON_AGRICULTURAL
*   **`PersonalProductDto`**: For personal/household goods.
    *   `productName`: `string` - Name of the product
*   **`AgriculturalProductDto`**: For agricultural/farm products (commercial).
    *   `productName`: `string` - Name of the agricultural product
    *   `gstBillUrl`: `string` - **Required** GST bill URL
*   **`NonAgriculturalProductDto`**: For non-agricultural commercial products.
    *   `bundleWeight`: `number` - Weight of a single bundle/unit
    *   `numberOfProducts?`: `number` - Optional count of products
    *   `packageDimensions?`: `PackageDimensionsDto` - Optional dimensions
    *   `packageDescription?`: `string` - Optional description
    *   `gstBillUrl`: `string` - **Required** GST bill URL
*   **`PackageDimensionsDto`**: Package dimensions for non-agricultural products.
    *   `length`: `number`
    *   `width`: `number`
    *   `height`: `number`
    *   `unit`: `enum` (CM, INCH, FEET)
*   **`BookingEstimateRequestDto`**:
    *   `pickupAddress`: `CreateBookingAddressDto`
    *   `dropAddress`: `CreateBookingAddressDto`
    *   `packageDetails`: `PackageDetailsDto`
*   **`BookingEstimateResponseDto`**: Returns top 3 suitable vehicles sorted by price.
    *   `distanceKm`: `number`
    *   `idealVehicleModel`: `string` - Name of the cheapest suitable vehicle model
    *   `topVehicles`: `VehicleEstimateDto[]` - Top 3 vehicles with pricing
*   **`VehicleEstimateDto`**:
    *   `vehicleModelName`: `string` - e.g., "Tata Ace"
    *   `estimatedCost`: `number`
    *   `maxWeightTons`: `number`
    *   `breakdown`: `PricingBreakdownDto`
*   **`PricingBreakdownDto`**:
    *   `baseFare`: `number`
    *   `baseKm`: `number`
    *   `perKm`: `number`
    *   `distanceKm`: `number`
    *   `weightInTons`: `number`
    *   `effectiveBasePrice`: `number` - baseFare * min(1, weightInTons)
*   **`CreateBookingRequestDto`**: System automatically selects ideal vehicle model.
    *   `pickupAddress`: `CreateBookingAddressDto`
    *   `dropAddress`: `CreateBookingAddressDto`
    *   `package`: `PackageDetailsDto`
    *   `gstNumber?`: `string` - Optional GST number to waive platform fee (must belong to customer and be active)
*   **`InvoiceResponseDto`**: Pricing and payment details for a booking.
    *   `id`: `string`
    *   `bookingId`: `string`
    *   `type`: `enum` (ESTIMATE, FINAL)
    *   `vehicleModelName`: `string`
    *   `basePrice`: `number`
    *   `perKmPrice`: `number`
    *   `baseKm`: `number`
    *   `distanceKm`: `number`
    *   `weightInTons`: `number`
    *   `effectiveBasePrice`: `number`
    *   `totalPrice`: `number`
    *   `platformFee`: `number` - Platform fee (₹20 for non-GST bookings, ₹0 for GST bookings)
    *   `gstNumber`: `string | null` - GST number if booking used GST details to waive platform fee
    *   `walletApplied`: `number`
    *   `finalAmount`: `number` - Amount customer needs to pay
    *   `paymentLinkUrl`: `string | null` - Only in FINAL invoice
    *   `rzpPaymentLinkId`: `string | null` - Razorpay payment link ID
    *   `rzpPaymentId`: `string | null` - Razorpay payment ID (set after payment)
    *   `isPaid`: `boolean` - Payment status
    *   `paidAt`: `Date | null` - Payment timestamp
    *   `paymentMethod`: `string | null` - ONLINE or CASH
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`BookingResponseDto`**: Complete booking details with invoices.
    *   `id`: `string`
    *   `bookingNumber`: `number`
    *   `status`: `enum` (PENDING, DRIVER_ASSIGNED, CONFIRMED, etc.)
    *   `pickupAddress`: `BookingAddressResponseDto`
    *   `dropAddress`: `BookingAddressResponseDto`
    *   `pickupOtp`: `string | null` - OTP for pickup verification (customers only, hidden from drivers)
    *   `dropOtp`: `string | null` - OTP for drop verification (customers only, hidden from drivers)
    *   `package`: `PackageDetailsResponseDto`
    *   `invoices`: `InvoiceResponseDto[]` - ESTIMATE and/or FINAL invoices
    *   `assignedDriver`: `DriverResponseDto | null`
    *   `cancelledAt`: `Date | null`
    *   `cancellationReason`: `string | null`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`RideSummaryDto`**: Driver's daily ride summary with completed assignments.
    *   `totalRides`: `number` - Number of completed rides
    *   `netEarnings`: `number` - Driver's net earnings after commission deduction
    *   `commissionRate`: `number` - Platform commission rate (e.g., 0.07 for 7%)
    *   `netCompensation`: `number` - Total cancellation compensation earned
    *   `totalCancelledRides`: `number` - Count of cancelled rides with compensation
    *   `date`: `string` - YYYY-MM-DD format (IST timezone)
    *   `assignments`: `BookingAssignmentResponseDto[]` - Array of completed assignments with full booking details for the day
    *   `cancelledAssignments`: `CancelledAssignmentResponseDto[]` - Array of cancelled assignments with compensation details
*   **`EarningsSummaryResponseDto`**: Driver's earnings summary for a date range.
    *   `totalRides`: `number` - Number of completed rides
    *   `netEarnings`: `number` - Driver's net earnings after commission deduction
    *   `commissionRate`: `number` - Platform commission rate (e.g., 0.07 for 7%)
    *   `netCompensation`: `number` - Total cancellation compensation earned
    *   `totalCancelledRides`: `number` - Count of cancelled rides with compensation
    *   `startDate`: `string` - YYYY-MM-DD format (IST timezone)
    *   `endDate`: `string` - YYYY-MM-DD format (IST timezone)
    *   `assignments`: `BookingAssignmentResponseDto[]` - Array of completed assignments with full booking details for the date range
    *   `cancelledAssignments`: `CancelledAssignmentResponseDto[]` - Array of cancelled assignments with compensation details
*   **`CancelledAssignmentResponseDto`**: Cancelled assignment with cancellation charge info.
    *   `bookingId`: `string`
    *   `bookingNumber`: `number`
    *   `cancelledAt`: `Date`
    *   `cancellationReason`: `string | null`
    *   `cancellationCharge`: `number` - Amount credited to driver from wallet log
    *   `pickupAddress`: `BookingAddressResponseDto`
    *   `dropAddress`: `BookingAddressResponseDto`
    *   `package`: `PackageDetailsResponseDto`
*   **`CancelBookingDto`**: Booking cancellation request.
    *   `reason`: `string` - Cancellation reason
*   **`CancellationConfigResponseDto`**: Configuration for cancellation charges.
    *   `minChargePercent`: `number` - Minimum charge percentage (e.g., 0.1 for 10%)
    *   `maxChargePercent`: `number` - Maximum charge percentage (e.g., 0.6 for 60%)
    *   `incrementPerMin`: `number` - Charge increase per minute after driver accepts (e.g., 0.05 for 5%)

### Profile & Address DTOs
*   **`CreateProfileDto` / `UpdateProfileDto`**: For customer profile creation/updates.
    *   `firstName`: `string`
    *   `lastName?`: `string`
    *   `googleIdToken?`: `string`
    *   `appliedReferralCode?`: `string` - Optional referral code to apply during profile creation (format: CUS-XXXXXXXX). Applied asynchronously after profile creation.
    *   ... and other fields for initial setup.
*   **`GetProfileResponseDto`**: Customer profile response.
    *   `id`: `string`
    *   `firstName`: `string | null`
    *   `lastName`: `string | null`
    *   `email`: `string | null`
    *   `phoneNumber`: `string`
    *   `isBusiness`: `boolean`
    *   `referralCode`: `string | null` - Customer's unique referral code (format: CUS-XXXXXXXX, auto-generated on signup)
    *   `walletBalance`: `Decimal`
    *   `isActive`: `boolean`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`CreateSavedAddressDto` / `UpdateSavedAddressDto`**: For customer's saved addresses.
    *   `name`: `string`
    *   `contactName`: `string`
    *   `contactPhone`: `string`
    *   `isDefault?`: `boolean`
    *   `address`: `CreateAddressDto` / `UpdateAddressDto`
*   **`CreateGstDetailsDto` / `UpdateGstDetailsDto`**: For customer GST details.
    *   `gstNumber`: `string` - GST number (format: 22AAAAA0000A1Z5)
    *   `businessName`: `string`
    *   `businessAddress`: `string`
*   **`DeactivateGstDetailsDto`**: To deactivate a GST entry.
    *   `id`: `string` - GST details ID
*   **`ReactivateGstDetailsDto`**: To reactivate a GST entry.
    *   `gstNumber`: `string` - GST number to reactivate
*   **`GstDetailsResponseDto`**: GST details response.
    *   `id`: `string`
    *   `gstNumber`: `string`
    *   `businessName`: `string`
    *   `businessAddress`: `string`
    *   `isActive`: `boolean`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`CustomerWalletLogResponseDto`**: Customer wallet transaction log.
    *   `id`: `string`
    *   `beforeBalance`: `number`
    *   `afterBalance`: `number`
    *   `amount`: `number` - Transaction amount (+ for credit, - for debit)
    *   `reason`: `string` - Description of transaction
    *   `bookingId`: `string | null` - Related booking if applicable
    *   `refundIntentId`: `string | null` - Related refund intent if applicable
    *   `refundIntent`: `RefundIntentResponseDto | null` - Full refund intent details
    *   `createdAt`: `Date`
*   **`PendingRefundResponseDto`**: Pending or failed refund details.
    *   `id`: `string`
    *   `status`: `string` - PENDING or FAILED
    *   `walletRefundAmount`: `number`
    *   `razorpayRefundAmount`: `number`
    *   `cancellationCharge`: `number`
    *   `rzpRefundId`: `string | null`
    *   `booking`: `BookingResponseDto`
    *   `createdAt`: `Date`
    *   `processedAt`: `Date | null`
    *   `failureReason`: `string | null`
*   **`CustomerTransactionLogResponseDto`**: Customer transaction ledger entry with full booking details.
    *   `id`: `string`
    *   `customerId`: `string | null`
    *   `driverId`: `string | null`
    *   `amount`: `number`
    *   `type`: `enum` (CREDIT, DEBIT)
    *   `category`: `enum` (BOOKING_PAYMENT, BOOKING_REFUND, WALLET_CREDIT, etc.)
    *   `description`: `string`
    *   `bookingId`: `string | null`
    *   `booking`: `BookingResponseDto | null` - Full booking details including package, addresses, driver, invoices
    *   `payoutId`: `string | null`
    *   `paymentMethod`: `enum` (CASH, ONLINE, WALLET)
    *   `createdAt`: `Date`

### Driver DTOs
*   **`CreateDriverProfileDto` / `UpdateDriverProfileDto`**:
    *   `firstName`: `string`
    *   `lastName?`: `string`
    *   `photo?`: `string` (URL)
    *   `appliedReferralCode?`: `string` - Optional referral code to apply during profile creation (format: DRI-XXXXXXXX). Applied asynchronously after profile creation.
    *   ... and nested DTOs for documents, vehicle, address, etc.
*   **`ProfileResponseDto`**: Driver profile response.
    *   `id`: `string`
    *   `phoneNumber`: `string`
    *   `firstName`: `string | null`
    *   `lastName`: `string | null`
    *   `email`: `string | null`
    *   `alternatePhone`: `string | null`
    *   `referalCode`: `string | null` - Driver's unique referral code (format: DRI-XXXXXXXX, auto-generated on signup)
    *   `photo`: `string | null`
    *   `contactId`: `string | null`
    *   `fundAccountId`: `string | null`
    *   `score`: `number` - Driver rating score (default: 100)
    *   `rideCount`: `number` - Total completed rides (default: 0)
    *   `verificationStatus`: `VerificationStatus`
    *   `driverStatus`: `DriverStatus`
    *   `walletBalance`: `number`
    *   `isActive`: `boolean`
    *   `documents`: `DriverDocumentsResponseDto | null`
    *   `vehicle`: `VehicleResponseDto | null`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
    *   `lastSeenAt`: `Date | null`
*   **`UpdateDriverStatusDto`**:
    *   `status`: `enum` (`AVAILABLE`, `UNAVAILABLE`)
*   **`CreateVehicleDto` / `UpdateVehicleDto`**:
    *   `vehicleNumber`: `string`
    *   `vehicleType`: `enum`
    *   `vehicleModelName`: `string` (e.g., "Tata Ace")
    *   `vehicleBodyLength`: `number`
    *   `vehicleImageUrl`: `string` (URL)
    *   ... and other vehicle-specific fields.
*   **`CreateDriverDocumentsDto`**:
    *   `licenseUrl`: `string` (URL)
    *   `rcBookUrl`: `string` (URL)
    *   `aadharNumber`: `string` - 12-digit Aadhaar number (encrypted and hashed for storage)
    *   `panNumber`: `string` - PAN number in format ABCDE1234F
    *   ... and other document URLs.
*   **`UpdateDriverDocumentsDto`**:
    *   `licenseUrl?`: `string` (URL)
    *   `rcBookUrl?`: `string` (URL)
    *   ... and other document URLs (Aadhaar and PAN cannot be updated after initial submission).
*   **`CreateDriverAddressDto` / `UpdateDriverAddressDto`**: Driver's permanent address.
    *   `addressLine1`: `string`
    *   `landmark?`: `string`
    *   `pincode`: `string` - 6-digit pincode
    *   `city`: `string`
    *   `district`: `string`
    *   `state`: `string`
    *   `latitude?`: `number`
    *   `longitude?`: `number`
*   **`DriverAddressResponseDto`**: Driver address response.
    *   `id`: `string`
    *   `addressLine1`: `string`
    *   `landmark`: `string | null`
    *   `pincode`: `string`
    *   `city`: `string`
    *   `district`: `string`
    *   `state`: `string`
    *   `latitude`: `number | null`
    *   `longitude`: `number | null`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`VehicleModelResponseDto`**:
    *   `name`: `string`
    *   `perKm`: `number`
    *   `baseKm`: `number`
    *   `baseFare`: `number`
    *   `maxWeightTons`: `number`
*   **`DriverWalletLogResponseDto`**: Driver wallet transaction log.
    *   `id`: `string`
    *   `beforeBalance`: `number`
    *   `afterBalance`: `number`
    *   `amount`: `number` - Transaction amount (+ for credit, - for debit)
    *   `reason`: `string` - Description of transaction
    *   `bookingId`: `string | null` - Related booking ID reference
    *   `createdAt`: `Date`
*   **`PayoutResponseDto`**: Payout details for driver transactions.
    *   `id`: `string`
    *   `driverId`: `string`
    *   `amount`: `number`
    *   `razorpayPayoutId`: `string | null`
    *   `status`: `enum` (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)
    *   `failureReason`: `string | null`
    *   `retryCount`: `number`
    *   `createdAt`: `Date`
    *   `processedAt`: `Date | null`
*   **`GeneratePaymentLinkDto`**: Request to generate driver wallet top-up payment link.
    *   `amount`: `number` - Amount to add to wallet (minimum ₹1)
*   **`WithdrawalRequestDto`**: Request to withdraw funds from driver wallet.
    *   `amount`: `number` - Amount to withdraw (minimum ₹100)
*   **`PaymentLinkResponseDto`**: Payment link details.
    *   `paymentLinkUrl`: `string` - URL for payment
    *   `paymentLinkId`: `string` - Razorpay payment link ID
    *   `amount`: `number` - Payment amount
    *   `expiresAt`: `number` - Expiry timestamp
*   **`DriverTransactionLogResponseDto`**: Driver transaction ledger entry with full booking and payout details.
    *   `id`: `string`
    *   `customerId`: `string | null`
    *   `driverId`: `string | null`
    *   `amount`: `number`
    *   `type`: `enum` (CREDIT, DEBIT)
    *   `category`: `enum` (BOOKING_PAYMENT, BOOKING_REFUND, DRIVER_PAYOUT)
    *   `description`: `string`
    *   `bookingId`: `string | null`
    *   `booking`: `BookingResponseDto | null` - Full booking details including package, addresses, invoices
    *   `payoutId`: `string | null`
    *   `payout`: `PayoutResponseDto | null` - Full payout details (amount, status, razorpayPayoutId, etc.)
    *   `paymentMethod`: `enum` (CASH, ONLINE, WALLET)
    *   `createdAt`: `Date`


### Referral DTOs
*   **`ApplyCustomerReferralDto`**: Apply a customer referral code.
    *   `referralCode`: `string` - Customer referral code (format: CUS-XXXXXXXX)
*   **`ApplyDriverReferralDto`**: Apply a driver referral code.
    *   `referralCode`: `string` - Driver referral code (format: DRI-XXXXXXXX)
*   **`CustomerReferralStatsResponseDto`**: Customer referral statistics.
    *   `referralCode`: `string | null` - Customer's unique referral code
    *   `totalReferrals`: `number` - Number of successful referrals
    *   `remainingReferrals`: `number` - Remaining referral slots (max 5)
    *   `maxReferrals`: `number` - Maximum allowed referrals (5)
    *   `referrals`: `Array` - List of referred customers with details
        *   `id`: `string` - Referral record ID
        *   `referredCustomer`: `object` - Referred customer details (id, firstName, lastName, phoneNumber, createdAt)
        *   `createdAt`: `Date` - When referral was applied
*   **`DriverReferralStatsResponseDto`**: Driver referral statistics.
    *   `referralCode`: `string | null` - Driver's unique referral code
    *   `totalReferrals`: `number` - Number of successful referrals
    *   `remainingReferrals`: `number` - Remaining referral slots (max 5)
    *   `maxReferrals`: `number` - Maximum allowed referrals (5)
    *   `referrals`: `Array` - List of referred drivers with details
        *   `id`: `string` - Referral record ID
        *   `referredDriver`: `object` - Referred driver details (id, firstName, lastName, phoneNumber, createdAt)
        *   `createdAt`: `Date` - When referral was applied

### Razorpay DTOs
*   **`CreateContactDto`**:
    *   `name`: `string`
    *   `email`: `string`
    *   `contact`: `string` (phone number)
    *   `type`: `string` (e.g., "customer")
*   **`CreateFundAccountDto`**:
    *   `contactId`: `string`
    *   `accountType`: `string` (e.g., "bank_account")
    *   `bankAccount`:
        *   `name`: `string`
        *   `ifsc`: `string`
        *   `account_number`: `string`

### Admin DTOs
*   **`DriverResponseDto`**: Complete driver profile with all relations.
    *   `id`: `string`
    *   `phoneNumber`: `string`
    *   `firstName`: `string | null`
    *   `lastName`: `string | null`
    *   `email`: `string | null`
    *   `alternatePhone`: `string | null`
    *   `referalCode`: `string | null` - Driver's unique referral code (format: DRI-XXXXXXXX)
    *   `photo`: `string | null`
    *   `contactId`: `string | null`
    *   `fundAccountId`: `string | null`
    *   `score`: `number` - Driver rating score (default: 100)
    *   `rideCount`: `number` - Total completed rides (default: 0)
    *   `latitude`: `Decimal | null`
    *   `longitude`: `Decimal | null`
    *   `isActive`: `boolean`
    *   `verificationStatus`: `VerificationStatus` (PENDING, VERIFIED, REJECTED)
    *   `driverStatus`: `DriverStatus` (AVAILABLE, UNAVAILABLE, ON_RIDE, RIDE_OFFERED)
    *   `walletBalance`: `Decimal`
    *   `createdAt`: `Date`
    *   `lastSeenAt`: `Date | null`
    *   `updatedAt`: `Date`
    *   `documents`: `DriverDocumentsResponseDto | null`
    *   `vehicle`: `VehicleResponseDto | null`
    *   `address`: `DriverAddressResponseDto | null`
*   **`AdminDriverListResponseDto`**:
    *   `data`: `DriverResponseDto[]`
    *   `meta`: `{ total: number, page: number, limit: number, totalPages: number }`

---

## API Routes

### Customer Authentication (`CustomerAuth`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/customer/send-otp` | Sends a login OTP to the customer's phone. | `SendOtpDto` | `SuccessResponseDto` |
| `POST` | `/auth/customer/verify-otp` | Verifies OTP and issues auth tokens. | `VerifyOtpDto` | `TokenResponseDto` |
| `POST` | `/auth/customer/logout` | Invalidates the refresh token. | `refreshTokenDto` | `SuccessResponseDto` |
| `POST` | `/auth/customer/refresh-token` | Refreshes the access token. | `refreshTokenDto` | `TokenResponseDto` |

### Driver Authentication (`DriverAuth`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/driver/send-otp` | Sends a login OTP to the driver's phone. | `SendOtpDto` | `SuccessResponseDto` |
| `POST` | `/auth/driver/verify-otp` | Verifies OTP and issues auth tokens. | `VerifyOtpDto` | `TokenResponseDto` |
| `POST` | `/auth/driver/logout` | Invalidates the refresh token. | `refreshTokenDto` | `SuccessResponseDto` |
| `POST` | `/auth/driver/refresh-token` | Refreshes the access token. | `refreshTokenDto` | `TokenResponseDto` |

### Booking (Customer) (`BookingCustomer`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/bookings/customer/estimate` 🔒 | Computes price estimate with top 3 suitable vehicles. Returns ideal vehicle model and pricing breakdown. | `BookingEstimateRequestDto` | `BookingEstimateResponseDto` |
| `POST` | `/bookings/customer` 🔒 | Creates a new booking. System automatically selects the ideal (cheapest suitable) vehicle model. Creates ESTIMATE invoice with wallet applied. | `CreateBookingRequestDto` | `BookingResponseDto` |
| `GET` | `/bookings/customer/active` 🔒 | Lists customer's active bookings with invoices. | - | `BookingResponseDto[]` |
| `GET` | `/bookings/customer/history` 🔒 | Lists customer's past bookings with invoices. | - | `BookingResponseDto[]` |
| `GET` | `/bookings/customer/cancellation-config` 🔒 | Gets configuration for calculating cancellation charges client-side. | - | `CancellationConfigResponseDto` |
| `POST` | `/bookings/customer/cancel/{bookingId}` 🔒 | Cancels a booking with refund based on status. | `CancelBookingDto` | `SuccessResponseDto` |
| `GET` | `/bookings/customer/upload-url` 🔒 | Gets a signed URL for file uploads. | Query: `filePath`, `type` | `UploadUrlResponseDto` |
| `GET` | `/bookings/customer/driver-navigation/{bookingId}` 🔒 | SSE endpoint for real-time driver location updates. | - | Server-Sent Events stream |
| `GET` | `/bookings/customer/{bookingId}` 🔒 | Gets a booking by its ID | - | `BookingResponseDto` |

### Booking (Driver) (`BookingDriver`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/bookings/driver/current-assignment` 🔒 | Gets the driver's current assignment. | - | `BookingAssignmentResponseDto` |
| `GET` | `/bookings/driver/history` 🔒 | Retrieves the driver's assignment history. | - | `BookingAssignmentResponseDto[]` |
| `POST` | `/bookings/driver/accept/{assignmentId}` 🔒 | Accepts a booking assignment. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/reject/{assignmentId}` 🔒 | Rejects a booking assignment. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/pickup/arrived` 🔒 | Driver marks arrival at pickup. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/drop/arrived` 🔒 | Driver marks arrival at drop-off. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/pickup/verify` 🔒 | Verifies pickup with a code. | `VerifyCodeDto` | `SuccessResponseDto` |
| `POST` | `/bookings/driver/drop/verify` 🔒 | Verifies drop-off with a code. | `VerifyCodeDto` | `SuccessResponseDto` |
| `POST` | `/bookings/driver/start` 🔒 | Starts the trip. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/finish` 🔒 | Finishes the trip. **Increments driver's rideCount by 1.** Updates wallet with earnings after commission deduction. | - | `SuccessResponseDto` |
| `POST` | `/bookings/driver/settle-cash` 🔒 | Marks cash payment as settled (driver acknowledges receiving cash). | - | `SuccessResponseDto` |
| `GET` | `/bookings/driver/ride-summary` 🔒 | Gets daily ride summary with net earnings, commission rate, cancellation compensation, and completed/cancelled assignments. Defaults to today in IST timezone. | Query: `date?` (YYYY-MM-DD) | `RideSummaryDto` |
| `GET` | `/bookings/driver/earnings-summary` 🔒 | Gets earnings summary for a date range with net earnings, commission rate, cancellation compensation, and completed/cancelled assignments. Defaults to today if no dates provided. | Query: `startDate?` (YYYY-MM-DD), `endDate?` (YYYY-MM-DD) | `EarningsSummaryResponseDto` |

### Webhooks (`Webhook`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/webhook/razorpay` | **Unified webhook endpoint** for all Razorpay payment events. Routes to appropriate handler based on `paymentType` in notes. Handles both driver wallet top-ups and booking invoice payments. | `RazorpayWebhookPayload` | `{ status: string }` |

### Driver Payment (`DriverPayment`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/payment/link` 🔒 | Generates a payment link for driver wallet top-up. Reuses existing link if valid. | `GeneratePaymentLinkDto` | `PaymentLinkResponseDto` |
| `POST` | `/driver/payment/withdraw` 🔒 | Requests withdrawal from driver wallet. **Requirements**: Minimum 2 completed rides. | `WithdrawalRequestDto` | `{ message: string }` |
| `POST` | `/driver/payment/webhook` | Webhook endpoint for driver payment events (wallet top-ups). Verifies signature and processes payment. | `RazorpayWebhookPayload` | `{ status: string }` |

### Customer Profile (`CustomerProfile`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/profile` 🔒 | Creates a new customer profile. | `CreateProfileDto` | `SuccessResponseDto` |
| `GET` | `/customer/profile` 🔒 | Retrieves the customer's profile. | - | `GetProfileResponseDto` |
| `PUT` | `/customer/profile` 🔒 | Updates the customer's profile. | `UpdateProfileDto` | `SuccessResponseDto` |
| `PUT` | `/customer/profile/fcm-token` 🔒 | Adds or updates a Firebase Cloud Messaging token. | `UsertFcmTokenDto` | `SuccessResponseDto` |
| `GET` | `/customer/profile/wallet-logs` 🔒 | Retrieves customer's wallet transaction history (latest 50). | - | `CustomerWalletLogResponseDto[]` |
| `GET` | `/customer/profile/transaction-logs` 🔒 | Retrieves customer's transaction ledger (latest 50). | - | `CustomerTransactionLogResponseDto[]` |
| `GET` | `/customer/profile/pending-refunds` 🔒 | Retrieves customer's pending or failed refunds. | - | `PendingRefundResponseDto[]` |

### Customer Address (`CustomerAddress`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/addresses` 🔒 | Creates a new saved address. | `CreateSavedAddressDto` | `AddressResponseDto` |
| `GET` | `/customer/addresses` 🔒 | Retrieves all saved addresses. | - | `AddressResponseDto[]` |
| `GET` | `/customer/addresses/default` 🔒 | Retrieves the default saved address. | - | `AddressResponseDto` |
| `GET` | `/customer/addresses/{id}` 🔒 | Retrieves a saved address by ID. | - | `AddressResponseDto` |
| `PUT` | `/customer/addresses/{id}` 🔒 | Updates a saved address. | `UpdateSavedAddressDto` | `AddressResponseDto` |
| `DELETE`| `/customer/addresses/{id}` 🔒 | Deletes a saved address. | - | `SuccessResponseDto` |

### Customer GST Details (`CustomerGst`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/gst` 🔒 | Adds new GST details for the customer. | `CreateGstDetailsDto` | `SuccessResponseDto` |
| `GET` | `/customer/gst` 🔒 | Retrieves all GST details for the customer. | - | `GstDetailsResponseDto[]` |
| `GET` | `/customer/gst/{id}` 🔒 | Retrieves a specific GST detail by ID. | - | `GstDetailsResponseDto` |
| `PUT` | `/customer/gst/{id}` 🔒 | Updates GST details. | `UpdateGstDetailsDto` | `SuccessResponseDto` |
| `POST` | `/customer/gst/deactivate` 🔒 | Deactivates a GST entry. | `DeactivateGstDetailsDto` | `SuccessResponseDto` |
| `POST` | `/customer/gst/reactivate` 🔒 | Reactivates a previously deactivated GST entry. | `ReactivateGstDetailsDto` | `SuccessResponseDto` |

### Driver Profile (`DriverProfile`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/profile` 🔒 | Creates a new driver profile. | `CreateDriverProfileDto` | `DriverProfileResponseDto` |
| `GET` | `/driver/profile` 🔒 | Retrieves the driver's profile. | - | `DriverProfileResponseDto` |
| `PUT` | `/driver/profile` 🔒 | Updates the driver's profile. | `UpdateDriverProfileDto` | `DriverProfileResponseDto` |
| `PUT` | `/driver/profile/status` 🔒 | Updates the driver's availability status. | `UpdateDriverStatusDto` | `SuccessResponseDto` |
| `PUT` | `/driver/profile/fcm-token` 🔒 | Adds or updates a Firebase Cloud Messaging token. | `UsertFcmTokenDto` | `SuccessResponseDto` |
| `PUT` | `/driver/profile/payout-details` 🔒 | Updates the driver's payout details. | `UpdatePayoutDetailsDto` | `SuccessResponseDto` |
| `GET` | `/driver/profile/wallet-logs` 🔒 | Retrieves driver's wallet transaction history (latest 50). | - | `DriverWalletLogResponseDto[]` |
| `GET` | `/driver/profile/transaction-logs` 🔒 | Retrieves driver's transaction ledger (latest 50). | - | `DriverTransactionLogResponseDto[]` |

### Driver Documents (`DriverDocuments`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/driver/documents` 🔒 | Retrieves driver's documents with expiry dates. Expiry alerts are calculated client-side. | - | `DriverDocumentsResponseDto` |
| `PUT` | `/driver/documents` 🔒 | Updates driver's documents. Aadhaar and PAN cannot be updated after initial submission. | `UpdateDriverDocumentsDto` | `DriverDocumentsResponseDto` |
| `GET` | `/driver/documents/upload-url` 🔒 | Gets a signed URL for document uploads. | Query: `filePath`, `type` | `UploadUrlResponseDto` |
| `GET` | `/driver/documents/validate-aadhar` 🔒 | Validates if Aadhaar number is available (not already registered by another active verified driver). | Query: `aadharNumber` | `{ isAvailable: boolean }` |
| `GET` | `/driver/documents/validate-pan` 🔒 | Validates if PAN number is available (not already registered by another active verified driver). | Query: `panNumber` | `{ isAvailable: boolean }` |

### Driver Vehicle (`DriverVehicle`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/vehicle` 🔒 | Adds a vehicle to the driver's profile. | `CreateVehicleDto` | `VehicleResponseDto` |
| `GET` | `/driver/vehicle/models` 🔒 | Retrieves all available vehicle models. | - | `VehicleModelResponseDto[]` |
| `GET` | `/driver/vehicle` 🔒 | Retrieves the driver's vehicle details. | - | `VehicleResponseDto` |
| `PUT` | `/driver/vehicle` 🔒 | Updates the driver's vehicle details. | `UpdateVehicleDto` | `VehicleResponseDto` |
| `DELETE`| `/driver/vehicle` 🔒 | Deletes the driver's vehicle. | - | `SuccessResponseDto` |
| `POST` | `/driver/vehicle/owner` 🔒 | Adds vehicle owner details. | `CreateVehicleOwnerDto` | `VehicleOwnerResponseDto` |
| `PUT` | `/driver/vehicle/owner` 🔒 | Updates vehicle owner details. | `UpdateVehicleOwnerDto` | `VehicleOwnerResponseDto` |

### Driver Address (`DriverAddress`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/address` 🔒 | Creates driver's permanent address. | `CreateDriverAddressDto` | `DriverAddressResponseDto` |
| `GET` | `/driver/address` 🔒 | Retrieves driver's permanent address. | - | `DriverAddressResponseDto` |
| `PUT` | `/driver/address` 🔒 | Updates driver's permanent address. | `UpdateDriverAddressDto` | `DriverAddressResponseDto` |
| `DELETE`| `/driver/address` 🔒 | Deletes driver's permanent address. | - | `SuccessResponseDto` |

### Customer Referral (`CustomerReferral`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/referral/apply` 🔒 | Applies a referral code for the customer. Can only be used once. Maximum 5 referrals per referrer. | `{ referralCode: string }` (format: CUS-XXXXXXXX) | `{ message: string }` |
| `GET` | `/customer/referral/stats` 🔒 | Gets customer's referral statistics including their referral code, total referrals, and referral history. | - | `{ referralCode: string, totalReferrals: number, remainingReferrals: number, maxReferrals: number, referrals: Array }` |
| `GET` | `/customer/referral/validate` 🔒 | Validates a customer referral code before applying it. Checks if code exists, not self-referral, not already used, and referrer hasn't reached limit. | Query: `code` (string) | `{ isValid: boolean, reason?: string }` |

### Driver Referral (`DriverReferral`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/referral/apply` 🔒 | Applies a referral code for the driver. Can only be used once. Maximum 5 referrals per referrer. | `{ referralCode: string }` (format: DRI-XXXXXXXX) | `{ message: string }` |
| `GET` | `/driver/referral/stats` 🔒 | Gets driver's referral statistics including their referral code, total referrals, and referral history. | - | `{ referralCode: string, totalReferrals: number, remainingReferrals: number, maxReferrals: number, referrals: Array }` |
| `GET` | `/driver/referral/validate` 🔒 | Validates a driver referral code before applying it. Checks if code exists, not self-referral, not already used, and referrer hasn't reached limit. | Query: `code` (string) | `{ isValid: boolean, reason?: string }` |

### Admin (`Admin`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/admin/auth/login` | Admin login with credentials. | `{ username: string, password: string }` | `{ accessToken: string }` |
| `GET` | `/admin/drivers/pending-verification` 🔒 | Lists drivers pending verification. | Query: `page`, `limit`, `search` | `AdminDriverListResponseDto` |
| `GET` | `/admin/drivers/pending-documents` 🔒 | Lists verified drivers with pending documents. | Query: `page`, `limit`, `search` | `AdminDriverListResponseDto` |
| `GET` | `/admin/drivers/{id}` 🔒 | Gets specific driver details. | - | `DriverResponseDto` |
| `PATCH` | `/admin/drivers/{id}/verification` 🔒 | Updates driver verification status and expiry dates. | `{ status: VerificationStatus, licenseExpiry?: string, fcExpiry?: string, insuranceExpiry?: string, rcBookExpiry?: string }` | `DriverResponseDto` |