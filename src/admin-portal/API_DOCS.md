# Hello Truck Admin Portal API Documentation

This document provides a detailed reference for the Hello Truck Admin Portal API. All routes require authentication with a bearer `access-token` in the Authorization header unless otherwise specified.

## Base URL
All admin portal routes are prefixed with `/admin-api`

## Authentication

Admin portal uses JWT-based authentication with HTTP-only cookies for enhanced security.

### Session Management
- **Access Token**: Short-lived (15 minutes), returned in response body
- **Refresh Token**: Long-lived (7-30 days), stored in **HTTP-only secure cookie**
- **Cookie Settings**: `httpOnly: true`, `secure: true` (production), `sameSite: 'strict'`
- **FCM Token**: Optional, for web push notifications

### Authentication Flow
1. Admin logs in with email/password
2. Server validates credentials
3. Server generates access + refresh tokens
4. Refresh token stored in HTTP-only cookie (automatic)
5. Access token returned in response body
6. Client uses access token in Authorization header: `Bearer <token>`
7. When access token expires, use refresh endpoint (cookie sent automatically)

### Token Types
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7-30 days), used to obtain new access tokens, stored in HTTP-only cookie

---

## DTO Definitions

### Auth DTOs

**`AdminLoginDto`**:
- `email`: `string` - Admin email address
- `password`: `string` - Admin password

**`AdminTokenResponseDto`**:
- `accessToken`: `string` - JWT access token
- `refreshToken`: `string` - JWT refresh token
- `user`: `AdminUserDto` - Admin user details

**`AdminRefreshTokenDto`**:
- `refreshToken`: `string` - Refresh token to exchange for new access token

**`AdminUserDto`**:
- `id`: `string`
- `email`: `string`
- `role`: `AdminRole` (SUPER_ADMIN, ADMIN, AGENT, FIELD_AGENT, CUSTOMER_SUPPORT)
- `firstName`: `string`
- `lastName`: `string`
- `isActive`: `boolean`

**`UpsertFcmTokenDto`**:
- `fcmToken`: `string` - Firebase Cloud Messaging token for web push notifications

### User Management DTOs

**`CreateUserDto`**:
- `email`: `string` - Admin email address
- `password`: `string` - Password (min 8 characters)
- `role`: `AdminRole`
- `firstName`: `string`
- `lastName`: `string`

**`UpdateUserDto`**:
- `email?`: `string` - Admin email address
- `password?`: `string` - New password (min 8 characters)
- `role?`: `AdminRole`
- `firstName?`: `string`
- `lastName?`: `string`

**`ListUsersDto`** (Query Parameters):
- `role?`: `AdminRole` - Filter by role
- `isActive?`: `boolean` - Filter by active status
- `search?`: `string` - Search by name or email
- `page?`: `number` - Default: 1
- `limit?`: `number` - Default: 20

### Verification DTOs

**`CreateVerificationDto`**:
- `driverId`: `string` - Driver ID
- `verificationType`: `DriverVerificationType` (NEW_DRIVER, EXISTING_DRIVER)
- `reVerificationReason?`: `string` - Required for EXISTING_DRIVER type

**`ListVerificationsDto`** (Query Parameters):
- `status?`: `VerificationRequestStatus`
- `verificationType?`: `DriverVerificationType`
- `assignedToId?`: `string` - Filter by assigned agent
- `driverId?`: `string` - **NEW** Filter by exact driver ID
- `startDate?`: `string` - ISO date string
- `endDate?`: `string` - ISO date string
- `search?`: `string` - Search by driver name, phone number, or ticket ID
- `page?`: `number` - Default: 1
- `limit?`: `number` - Default: 20

**`AssignVerificationDto`**:
- `assignedToId`: `string` - Agent ID to assign to

**`DocumentActionDto`**:
- `action`: `DocumentActionType` (APPROVED, REJECTED)
- `rejectionReason?`: `string` - Required if action is REJECTED (min 10 characters)

**`RejectVerificationDto`**:
- `reason`: `string` - Rejection reason (min 10 characters)

**`VerificationRevertRequestDto`**:
- `reason`: `string` - Revert reason (min 10 characters)

**`VerificationRevertDecisionDto`**:
- `approve`: `boolean` - true to approve revert, false to reject

**`DriverVerificationResponseDto`**:
- `id`: `string`
- `driverId`: `string`
- `driver`: `DriverDetailsDto`
- `verificationType`: `DriverVerificationType`
- `status`: `VerificationRequestStatus`
- `ticketId`: `string | null` - LibreDesk ticket ID
- `assignedToId`: `string | null`
- `assignedTo`: `AdminUserDto | null`
- `reVerificationReason`: `string | null`
- `bufferExpiresAt`: `Date | null`
- `revertReason`: `string | null`
- `revertRequestedById`: `string | null`
- `revertRequestedAt`: `Date | null`
- `approvedAt`: `Date | null`
- `approvedById`: `string | null`
- `createdAt`: `Date`
- `updatedAt`: `Date`
- `fieldPhotos`: `FieldVerificationPhotoDto[]`
- `documentActions`: `VerificationDocumentActionDto[]`

**`DriverListResponseDto`**:
- `drivers`: `DriverDetailsDto[]`
- `pagination`: `PaginationDto`

**`PaginationDto`**:
- `page`: `number`
- `limit`: `number`
- `total`: `number`
- `totalPages`: `number`

### Refund DTOs

**`CreateRefundDto`**:
- `bookingId`: `string` - Booking ID
- `customerId`: `string` - Customer ID
- `driverId?`: `string` - Driver ID (if applicable)
- `amount`: `number` - Refund amount
- `reason`: `string` - Refund reason
- `phoneNumber`: `string` - Contact phone number
- `notes?`: `string` - Additional notes
- `evidenceUrls`: `string[]` - Array of evidence file URLs

**`ListRefundsDto`** (Query Parameters):
- `status?`: `AdminRefundStatus`
- `customerId?`: `string`
- `driverId?`: `string`
- `startDate?`: `string` - ISO date string
- `endDate?`: `string` - ISO date string
- `search?`: `string` - Search by booking number, customer name, phone
- `page?`: `number` - Default: 1
- `limit?`: `number` - Default: 20

**`RefundRevertRequestDto`**:
- `reason`: `string` - Revert reason (min 10 characters)

**`RefundRevertDecisionDto`**:
- `approve`: `boolean` - true to approve revert, false to reject

**`AdminRefundResponseDto`**:
- `id`: `string`
- `bookingId`: `string`
- `booking`: `BookingDetailsDto`
- `customerId`: `string`
- `customer`: `CustomerDetailsDto`
- `driverId`: `string | null`
- `driver`: `DriverDetailsDto | null`
- `amount`: `number`
- `reason`: `string`
- `phoneNumber`: `string`
- `notes`: `string | null`
- `evidenceUrls`: `string[]`
- `status`: `AdminRefundStatus`
- `createdById`: `string`
- `createdBy`: `AdminUserDto`
- `approvedById`: `string | null`
- `approvedBy`: `AdminUserDto | null`
- `approvedAt`: `Date | null`
- `bufferExpiresAt`: `Date | null`
- `revertReason`: `string | null`
- `revertRequestedById`: `string | null`
- `revertRequestedAt`: `Date | null`
- `completedAt`: `Date | null`
- `refundIntentId`: `string | null`
- `createdAt`: `Date`
- `updatedAt`: `Date`

### Support DTOs

**`SearchBookingDto`** (Query Parameters):
- `phoneNumber?`: `string` - Search by customer phone number
- `bookingId?`: `string` - Exact match by booking ID (UUID)
- `bookingNumber?`: `number` - **NEW** Exact match by booking number (auto-incremented)
- `status?`: `BookingStatus`
- `startDate?`: `string` - ISO date string
- `endDate?`: `string` - ISO date string
- `page?`: `number` - Default: 1
- `limit?`: `number` - Default: 20

**`CreateNoteDto`**:
- `bookingId`: `string` - Booking ID
- `content`: `string` - Support note content

**`SupportNoteResponseDto`**:
- `id`: `string`
- `bookingId`: `string`
- `agentId`: `string`
- `agentName`: `string`
- `note`: `string`
- `createdAt`: `Date`

### Field Verification DTOs

**`UploadPhotosDto`**:
- `photos`: `UploadFieldPhotoDto[]` - Array of photos to upload

**`UploadFieldPhotoDto`**:
- `photoType`: `FieldPhotoType` (VEHICLE_FRONT, VEHICLE_BACK, VEHICLE_LEFT, VEHICLE_RIGHT, DRIVER_WITH_VEHICLE, CHASSIS_NUMBER)
- `url`: `string` - Photo URL (from signed upload)

**`GetSignedUrlDto`**:
- `photoType`: `string` - Type of photo being uploaded
- `contentType`: `string` - MIME type (e.g., 'image/jpeg')
- `fileName`: `string` - Original file name

**`SignedUrlResponseDto`**:
- `signedUrl`: `string` - URL to upload file to
- `publicUrl`: `string` - Public URL after upload
- `token`: `string` - Validation token
- `filePath`: `string` - File path in storage

**`FieldVerificationPhotoDto`**:
- `id`: `string`
- `verificationRequestId`: `string`
- `photoType`: `FieldPhotoType`
- `url`: `string`
- `uploadedById`: `string`
- `uploadedAt`: `Date`

### Audit DTOs

**`AuditLogDto`**:
- `id`: `string`
- `userId`: `string`
- `user`: `AdminUserDto`
- `role`: `AdminRole`
- `actionType`: `string` - APPROVED, REJECTED, CREATED, REVERTED, VIEWED, LOGIN, LOGOUT
- `module`: `string` - VERIFICATION, REFUND, SUPPORT, FIELD_VERIFICATION, AUTH, SYSTEM
- `description`: `string`
- `ipAddress`: `string | null`
- `userAgent`: `string | null`
- `beforeSnapshot`: `any | null`
- `afterSnapshot`: `any | null`
- `entityId`: `string | null`
- `entityType`: `string | null`
- `timestamp`: `Date`

---

## API Routes

### Authentication

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/admin-api/auth/login` | Admin login with email and password. Sets refresh token in HTTP-only cookie. | `AdminLoginDto` | `{ message: string, user: AdminUserDto }` | Public |
| `POST` | `/admin-api/auth/refresh` | Refresh access token using refresh token cookie | - (cookie automatic) | `{ message: string }` + sets new cookies | Public |
| `POST` | `/admin-api/auth/logout` | Logout and invalidate refresh token, clears cookies | - | `{ message: string }` | All |
| `GET` | `/admin-api/auth/me` | Get current admin user details | - | `AdminUserDto` | All |
| `PUT` | `/admin-api/auth/fcm-token` | Update FCM token for web push notifications | `UpsertFcmTokenDto` | `{ message: string }` | All |

### User Management

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/users` | List all admin users with filters | Query: `ListUsersDto` | `{ users: AdminUserDto[], pagination: PaginationDto }` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/users/:id` | Get admin user by ID | - | `AdminUserDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/users` | Create new admin user | `CreateUserDto` | `AdminUserDto` | SUPER_ADMIN, ADMIN |
| `PATCH` | `/admin-api/users/:id` | Update admin user | `UpdateUserDto` | `AdminUserDto` | SUPER_ADMIN, ADMIN |
| `DELETE` | `/admin-api/users/:id` | Deactivate admin user (soft delete) | - | `{ message: string }` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/users/:id/reactivate` | Reactivate a deactivated user | - | `AdminUserDto` | SUPER_ADMIN, ADMIN |

### Driver Verification

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/verifications/pending-drivers` | List drivers with PENDING verification status (NEW drivers) | Query: `page`, `limit`, `search` | `DriverListResponseDto` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/verifications/pending-documents` | List VERIFIED drivers with PENDING documents (RE-VERIFICATION) | Query: `page`, `limit`, `search` | `DriverListResponseDto` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/verifications/my-assignments` | List verifications assigned to current agent | Query: `ListVerificationsDto` | `{ verifications: DriverVerificationResponseDto[], pagination: PaginationDto }` | AGENT, FIELD_AGENT |
| `GET` | `/admin-api/verifications` | List verification requests with filters | Query: `ListVerificationsDto` | `{ verifications: DriverVerificationResponseDto[], pagination: PaginationDto }` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/verifications/:id` | Get verification details by ID | - | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN, AGENT, FIELD_AGENT |
| `GET` | `/admin-api/verifications/drivers/:driverId/details` | Get driver details for verification (auto-creates request if needed) | - | `DriverDetailsDto` | SUPER_ADMIN, ADMIN, AGENT, FIELD_AGENT |
| `POST` | `/admin-api/verifications` | Create new verification request | `CreateVerificationDto` | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN |
| `PATCH` | `/admin-api/verifications/:id/assign` | Assign verification to an agent | `AssignVerificationDto` | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/verifications/:id/documents/:field/action` | Approve or reject a specific document (field: license, rcBook, fc, insurance, aadhar, selfie) | `DocumentActionDto` | `{ success: boolean, message: string }` | SUPER_ADMIN, ADMIN, AGENT |
| `POST` | `/admin-api/verifications/:id/approve` | Approve entire verification (starts 1-hour buffer) | - | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/verifications/:id/reject` | Reject entire verification | `RejectVerificationDto` | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/verifications/:id/revert-request` | Request revert (only within buffer window) | `VerificationRevertRequestDto` | `DriverVerificationResponseDto` | SUPER_ADMIN, ADMIN, AGENT |
| `POST` | `/admin-api/verifications/:id/revert-decision` | Approve or reject revert request | `VerificationRevertDecisionDto` | `{ success: boolean, message: string }` | SUPER_ADMIN, ADMIN |

### Admin Refunds

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/refunds` | List refund requests with filters | Query: `ListRefundsDto` | `{ refunds: AdminRefundResponseDto[], pagination: PaginationDto }` | SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT |
| `GET` | `/admin-api/refunds/:id` | Get refund details by ID | - | `AdminRefundResponseDto` | SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT |
| `POST` | `/admin-api/refunds` | Create new refund request | `CreateRefundDto` | `AdminRefundResponseDto` | SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT |
| `POST` | `/admin-api/refunds/:id/approve` | Approve refund (starts 1-hour buffer) | - | `AdminRefundResponseDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/refunds/:id/reject` | Reject refund request | `{ reason: string }` | `AdminRefundResponseDto` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/refunds/:id/revert` | Request revert (only within buffer window) | `RefundRevertRequestDto` | `AdminRefundResponseDto` | SUPER_ADMIN, ADMIN, CUSTOMER_SUPPORT |
| `POST` | `/admin-api/refunds/:id/revert-decision` | Approve or reject revert request | `RefundRevertDecisionDto` | `{ success: boolean, message: string }` | SUPER_ADMIN, ADMIN |

### Support

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/support/bookings` | Search bookings with filters (phone, bookingId, bookingNumber) | Query: `SearchBookingDto` | `{ bookings: BookingDetailsDto[], pagination: PaginationDto }` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/support/bookings/:id` | Get complete booking details | - | `BookingDetailsDto` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/support/customers/:identifier` | Get customer details by ID or phone number | - | `CustomerDetailsDto` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/support/drivers/:identifier` | Get driver details by ID or phone number | - | `DriverDetailsDto` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/support/drivers/:id/location` | Fetch live driver location (AUDIT LOGGED) | - | `{ driverId: string, latitude: number, longitude: number, lastUpdated: string }` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `POST` | `/admin-api/support/notes` | Create support note for a booking | `CreateNoteDto` | `SupportNoteResponseDto` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/support/notes/:bookingId` | Get notes for a booking | - | `SupportNoteResponseDto[]` | CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN |

### Field Verification

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/field-verification/assigned` | Get verifications assigned to current field agent | - | `DriverVerificationResponseDto[]` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/field-verification/:id` | Get verification details for field verification | - | `DriverVerificationResponseDto` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `GET` | `/admin-api/field-verification/:id/documents` | Get driver documents for field verification | - | `DriverDocumentsDto` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `POST` | `/admin-api/field-verification/:id/photos` | Upload field verification photos | `UploadPhotosDto` | `{ success: boolean }` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `POST` | `/admin-api/field-verification/:id/complete` | Complete field verification | `{ notes?: string }` | `{ success: boolean }` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `POST` | `/admin-api/field-verification/:id/revert` | Request revert for field verification | `{ reason: string }` | `{ success: boolean }` | FIELD_AGENT, ADMIN, SUPER_ADMIN |
| `POST` | `/admin-api/field-verification/:id/photos/signed-url` | Get signed URL for photo upload | `GetSignedUrlDto` | `SignedUrlResponseDto` | FIELD_AGENT, ADMIN, SUPER_ADMIN |

### Audit Logs

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/logs` | List audit logs with filters | Query: `ListLogsDto` | `{ logs: AuditLogDto[], pagination: PaginationDto }` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/logs/:id` | Get audit log details with snapshots | - | `AuditLogDto` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/logs/export` | Export logs (last 30 days, max 10000 records) | Query: `ListLogsDto` | `{ logs: AuditLogDto[] }` (CSV data) | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/logs/archive` | List archived log files in Firebase Storage | Query: `year`, `month` | `{ files: string[] }` | SUPER_ADMIN, ADMIN |
| `GET` | `/admin-api/logs/archive/:dateKey` | Get archived logs for a specific date (YYYY-MM-DD) | - | `{ logs: AuditLogDto[], count: number }` | SUPER_ADMIN, ADMIN |
| `POST` | `/admin-api/logs/archive/trigger` | Manually trigger log archival | - | `{ archivedCount: number }` | SUPER_ADMIN |

### Notifications

| Method | Path | Description | Request Body | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/notifications` | Get user's notifications with pagination | Query: `page`, `limit`, `unreadOnly` (boolean) | `{ notifications: AdminNotificationDto[], pagination: PaginationDto }` | All |
| `GET` | `/admin-api/notifications/unread-count` | Get unread notification count | - | `{ count: number }` | All |
| `POST` | `/admin-api/notifications/:id/read` | Mark notification as read | - | `{ success: boolean }` | All |
| `POST` | `/admin-api/notifications/read-all` | Mark all notifications as read | - | `{ success: boolean }` | All |

---

## Enums

### AdminRole
- `SUPER_ADMIN` - Full system access, can manage admins
- `ADMIN` - Can approve/reject verifications and refunds, handle revert decisions
- `AGENT` - Can review documents, request reverts, create refunds
- `FIELD_AGENT` - Can upload field verification photos
- `CUSTOMER_SUPPORT` - Can view bookings, add support notes, create refunds

### DriverVerificationType
- `NEW_DRIVER` - First-time driver verification
- `EXISTING_DRIVER` - Re-verification of existing driver

### VerificationRequestStatus
- `PENDING` - Awaiting review
- `APPROVED` - Approved, in buffer window
- `REJECTED` - Rejected
- `REVERT_REQUESTED` - Revert requested during buffer
- `REVERTED` - Reverted back to pending
- `FINAL_APPROVED` - Buffer expired, driver now active

### DocumentActionType
- `APPROVED` - Document approved
- `REJECTED` - Document rejected

### AdminRefundStatus
- `PENDING` - Awaiting approval
- `APPROVED` - Approved, in buffer window
- `REJECTED` - Rejected
- `REVERT_REQUESTED` - Revert requested during buffer
- `REVERTED` - Reverted back to pending
- `COMPLETED` - Buffer expired, refund processed

### FieldPhotoType
- `VEHICLE_FRONT` - Vehicle front view
- `VEHICLE_BACK` - Vehicle back view
- `VEHICLE_LEFT` - Vehicle left side view
- `VEHICLE_RIGHT` - Vehicle right side view
- `DRIVER_WITH_VEHICLE` - Driver standing with vehicle
- `CHASSIS_NUMBER` - Chassis number close-up photo

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation error message",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Notes

### Buffer Window
- Verifications and refunds have a 1-hour buffer window after approval
- During buffer, status remains APPROVED but driver/refund is not yet active/processed
- Allows time for revert requests if mistakes are found
- After buffer expires, status changes to FINAL_APPROVED/COMPLETED

### Auto-Creation of Verification Requests
- Verification requests are automatically created when:
  1. Driver creates profile with documents (fire-and-forget)
  2. Driver updates documents (fire-and-forget)
  3. Admin views driver details (fallback if auto-creation failed)

### Audit Logging
- All critical actions are automatically logged
- Includes before/after snapshots for data changes
- Immutable - logs cannot be modified or deleted
- Accessible only to SUPER_ADMIN and ADMIN roles

### FCM Notifications
- Admin users receive real-time notifications via Firebase Cloud Messaging
- Notifications sent for: new verification requests, revert requests, refund approvals, etc.
- Web push notifications supported via FCM tokens in admin sessions
