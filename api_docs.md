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
    *   `packageType`: `enum`
    *   `productType`: `enum`
    *   `agricultural?`: `AgriculturalProductDto`
    *   `nonAgricultural?`: `NonAgriculturalProductDto`
    *   `gstBillUrl?`: `string`
    *   `transportDocUrls?`: `string[]`
*   **`BookingEstimateRequestDto`**:
    *   `pickupAddress`: `CreateBookingAddressDto`
    *   `dropAddress`: `CreateBookingAddressDto`
    *   `packageDetails`: `PackageDetailsDto`
*   **`BookingEstimateResponseDto`**:
    *   `distanceKm`: `number`
    *   `suggestedVehicleType`: `string`
    *   `vehicleOptions`: `VehicleOptionDto[]`
*   **`CreateBookingRequestDto`**:
    *   `pickupAddress`: `CreateBookingAddressDto`
    *   `dropAddress`: `CreateBookingAddressDto`
    *   `package`: `PackageDetailsDto`
    *   `selectedVehicleType`: `enum`
*   **`UpdateBookingAddressDto`**:
    *   *(Same fields as `CreateBookingAddressDto`, but all are optional)*
*   **`UpdatePackageDetailsDto`**:
    *   *(Same fields as `PackageDetailsDto`, but all are optional)*

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
    *   `vehicleBodyLength`: `number`
    *   `vehicleImageUrl`: `string` (URL)
    *   ... and other vehicle-specific fields.
*   **`UpdateDriverDocumentsDto`**:
    *   `licenseUrl?`: `string` (URL)
    *   `rcBookUrl?`: `string` (URL)
    *   ... and other document URLs.

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
| `POST` | `/bookings/customer/estimate` 🔒 | Computes a price estimate for a trip. | `BookingEstimateRequestDto` | `BookingEstimateResponseDto` |
| `POST` | `/bookings/customer` 🔒 | Creates a new booking. | `CreateBookingRequestDto` | `BookingResponseDto` |
| `GET` | `/bookings/customer/active` 🔒 | Lists customer's active bookings. | - | `BookingResponseDto[]` |
| `GET` | `/bookings/customer/history` 🔒 | Lists customer's past bookings. | - | `BookingResponseDto[]` |
| `GET` | `/bookings/customer/{id}` 🔒 | Gets a booking by its ID. | - | `BookingResponseDto` |
| `DELETE`| `/bookings/customer/{id}` 🔒 | Cancels a booking by its ID. | - | `SuccessResponseDto` |
| `PUT` | `/bookings/customer/pickup/{id}` 🔒 | Updates the pickup address for a booking. | `UpdateBookingAddressDto` | `SuccessResponseDto` |
| `PUT` | `/bookings/customer/drop/{id}` 🔒 | Updates the drop-off address for a booking. | `UpdateBookingAddressDto` | `SuccessResponseDto` |
| `PUT` | `/bookings/customer/package/{id}` 🔒| Updates the package details for a booking. | `UpdatePackageDetailsDto` | `SuccessResponseDto` |
| `GET` | `/bookings/customer/upload-url` 🔒 | Gets a signed URL for file uploads. | Query: `filePath`, `type` | `UploadUrlResponseDto` |

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