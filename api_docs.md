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
    *   `walletApplied`: `number`
    *   `finalAmount`: `number` - Amount customer needs to pay
    *   `paymentLinkUrl`: `string | null` - Only in FINAL invoice
    *   `rzpOrderId`: `string | null`
    *   `rzpPaymentId`: `string | null`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`
*   **`BookingResponseDto`**: Complete booking details with invoices.
    *   `id`: `string`
    *   `bookingNumber`: `number`
    *   `status`: `enum` (PENDING, DRIVER_ASSIGNED, CONFIRMED, etc.)
    *   `pickupAddress`: `BookingAddressResponseDto`
    *   `dropAddress`: `BookingAddressResponseDto`
    *   `package`: `PackageDetailsResponseDto`
    *   `invoices`: `InvoiceResponseDto[]` - ESTIMATE and/or FINAL invoices
    *   `assignedDriver`: `DriverResponseDto | null`
    *   `createdAt`: `Date`
    *   `updatedAt`: `Date`

### Profile & Address DTOs
*   **`CreateProfileDto` / `UpdateProfileDto`**: For customer profile creation/updates.
    *   `firstName`: `string`
    *   `lastName?`: `string`
    *   `googleIdToken?`: `string`
    *   ... and other fields for initial setup.
*   **`CreateSavedAddressDto` / `UpdateSavedAddressDto`**: For customer's saved addresses.
    *   `name`: `string`
    *   `contactName`: `string`
    *   `contactPhone`: `string`
    *   `isDefault?`: `boolean`
    *   `address`: `CreateAddressDto` / `UpdateAddressDto`
*   **`CreateGstDetailsDto` / `UpdateGstDetailsDto`**:
    *   `gstNumber`: `string`
    *   `businessName`: `string`
    *   `businessAddress`: `string`

### Driver DTOs
*   **`CreateDriverProfileDto` / `UpdateDriverProfileDto`**:
    *   `firstName`: `string`
    *   `lastName?`: `string`
    *   `photo?`: `string` (URL)
    *   ... and nested DTOs for documents, vehicle, address, etc.
*   **`UpdateDriverStatusDto`**:
    *   `status`: `enum` (`AVAILABLE`, `UNAVAILABLE`)
*   **`CreateVehicleDto` / `UpdateVehicleDto`**:
    *   `vehicleNumber`: `string`
    *   `vehicleType`: `enum`
    *   `vehicleModelName`: `string` (e.g., "Tata Ace")
    *   `vehicleBodyLength`: `number`
    *   `vehicleImageUrl`: `string` (URL)
    *   ... and other vehicle-specific fields.
*   **`UpdateDriverDocumentsDto`**:
    *   `licenseUrl?`: `string` (URL)
    *   `rcBookUrl?`: `string` (URL)
    *   ... and other document URLs.
*   **`VehicleModelResponseDto`**:
    *   `name`: `string`
    *   `perKm`: `number`
    *   `baseKm`: `number`
    *   `baseFare`: `number`
    *   `maxWeightTons`: `number`

### Razorpay DTOs
*   **`CreateOrderDto`**:
    *   `amount`: `number` (in smallest currency unit, e.g., paise)
    *   `currency`: `string` (e.g., "INR")
    *   `receipt`: `string`
*   **`CreatePaymentLinkDto`**:
    *   `amount`: `number` (in smallest currency unit)
    *   `description`: `string`
    *   `customerName`: `string`
    *   `customerPhone`: `string`
    *   `customerEmail`: `string`
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
    *   `referalCode`: `string | null`
    *   `photo`: `string | null`
    *   `contactId`: `string | null`
    *   `fundAccountId`: `string | null`
    *   `score`: `number`
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
| `GET` | `/bookings/customer/{id}` 🔒 | Gets a booking by its ID with all invoices (ESTIMATE and FINAL if driver accepted). | - | `BookingResponseDto` |
| `DELETE`| `/bookings/customer/{id}` 🔒 | Cancels a PENDING booking. Cannot cancel after driver is assigned. | - | `SuccessResponseDto` |
| `GET` | `/bookings/customer/upload-url` 🔒 | Gets a signed URL for file uploads. | Query: `filePath`, `type` | `UploadUrlResponseDto` |
| `GET` | `/bookings/customer/driver-navigation/{bookingId}` 🔒 | SSE endpoint for real-time driver location updates. | - | Server-Sent Events stream |

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
| `POST` | `/bookings/driver/finish` 🔒 | Finishes the trip. | - | `SuccessResponseDto` |

### Customer Profile (`CustomerProfile`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/profile` 🔒 | Creates a new customer profile. | `CreateProfileDto` | `SuccessResponseDto` |
| `GET` | `/customer/profile` 🔒 | Retrieves the customer's profile. | - | `GetProfileResponseDto` |
| `PUT` | `/customer/profile` 🔒 | Updates the customer's profile. | `UpdateProfileDto` | `SuccessResponseDto` |
| `PUT` | `/customer/profile/fcm-token` 🔒 | Adds or updates a Firebase Cloud Messaging token. | `UsertFcmTokenDto` | `SuccessResponseDto` |

### Customer Address (`CustomerAddress`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/customer/addresses` 🔒 | Creates a new saved address. | `CreateSavedAddressDto` | `AddressResponseDto` |
| `GET` | `/customer/addresses` 🔒 | Retrieves all saved addresses. | - | `AddressResponseDto[]` |
| `GET` | `/customer/addresses/default` 🔒 | Retrieves the default saved address. | - | `AddressResponseDto` |
| `GET` | `/customer/addresses/{id}` 🔒 | Retrieves a saved address by ID. | - | `AddressResponseDto` |
| `PUT` | `/customer/addresses/{id}` 🔒 | Updates a saved address. | `UpdateSavedAddressDto` | `AddressResponseDto` |
| `DELETE`| `/customer/addresses/{id}` 🔒 | Deletes a saved address. | - | `SuccessResponseDto` |

### Driver Profile (`DriverProfile`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/driver/profile` 🔒 | Creates a new driver profile. | `CreateDriverProfileDto` | `DriverProfileResponseDto` |
| `GET` | `/driver/profile` 🔒 | Retrieves the driver's profile. | - | `DriverProfileResponseDto` |
| `PUT` | `/driver/profile` 🔒 | Updates the driver's profile. | `UpdateDriverProfileDto` | `DriverProfileResponseDto` |
| `PUT` | `/driver/profile/status` 🔒 | Updates the driver's availability status. | `UpdateDriverStatusDto` | `SuccessResponseDto` |
| `PUT` | `/driver/profile/payout-details` 🔒 | Updates the driver's payout details. | `UpdatePayoutDetailsDto` | `SuccessResponseDto` |

### Driver Documents (`DriverDocuments`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/driver/documents` 🔒 | Retrieves driver's documents. | - | `DriverDocumentsResponseDto` |
| `PUT` | `/driver/documents` 🔒 | Updates driver's documents. | `UpdateDriverDocumentsDto` | `DriverDocumentsResponseDto` |
| `GET` | `/driver/documents/expiry-alerts` 🔒 | Gets alerts for expiring documents. | - | `ExpiryAlertsResponseDto` |
| `GET` | `/driver/documents/upload-url` 🔒 | Gets a signed URL for document uploads. | Query: `filePath`, `type` | `UploadUrlResponseDto` |

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

### Razorpay Payments (`Razorpay`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/razorpay/create-contact` 🔒 | Creates a new contact in Razorpay. | `CreateContactDto` | Razorpay Contact Object |
| `POST` | `/razorpay/create-fund-account` 🔒 | Creates a fund account for a contact. | `CreateFundAccountDto` | Razorpay Fund Account Object |
| `POST` | `/razorpay/create-order` 🔒 | Creates a Razorpay order. | `CreateOrderDto` | Razorpay Order Object |
| `POST` | `/razorpay/create-payment-link` 🔒 | Creates a Razorpay payment link. | `CreatePaymentLinkDto` | Razorpay Payment Link Object |

### Admin (`Admin`)
| Method | Path | Description | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/admin/auth/login` | Admin login with credentials. | `{ username: string, password: string }` | `{ accessToken: string }` |
| `GET` | `/admin/drivers/pending-verification` 🔒 | Lists drivers pending verification. | Query: `page`, `limit`, `search` | `AdminDriverListResponseDto` |
| `GET` | `/admin/drivers/pending-documents` 🔒 | Lists verified drivers with pending documents. | Query: `page`, `limit`, `search` | `AdminDriverListResponseDto` |
| `GET` | `/admin/drivers/{id}` 🔒 | Gets specific driver details. | - | `DriverResponseDto` |
| `PATCH` | `/admin/drivers/{id}/verification` 🔒 | Updates driver verification status and expiry dates. | `{ status: VerificationStatus, licenseExpiry?: string, fcExpiry?: string, insuranceExpiry?: string }` | `DriverResponseDto` |