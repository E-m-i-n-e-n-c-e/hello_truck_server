# Hello Truck Admin Portal API Documentation

This document provides a detailed reference for the Hello Truck Admin Portal API. All routes require authentication with a bearer `access-token` in the Authorization header unless otherwise specified.

## Base URLs
- Admin API base: `/admin-api`
- External webhook: `/libredesk/webhook`

## Authentication Model
- Access token is returned in the response body and also set as an HTTP-only cookie.
- Refresh token is stored in an HTTP-only cookie and is also returned on login.
- `POST /admin-api/auth/refresh` accepts the refresh token from either request body or cookie.
- `POST /admin-api/auth/logout` requires an authenticated access token and clears both cookies.

---

## DTO Definitions

### Auth DTOs

**Request DTOs**
- `LoginRequestDto`
  - `email: string`
  - `password: string` (min 6)
- `RefreshTokenRequestDto`
  - `refreshToken?: string`
- `UpdateFcmTokenRequestDto`
  - `fcmToken: string`
- `LogoutRequestDto`
  - No body fields
- `PasswordRecoveryResetRequestDto`
  - `email: string`
  - `googleIdToken: string`
  - `newPassword: string` (min 8)

**Response DTOs**
- `AdminUserResponseDto`
  - `id: string`
  - `email: string`
  - `role: AdminRole`
  - `firstName: string`
  - `lastName: string`
  - `isActive: boolean`
  - `createdAt: Date`
  - `updatedAt: Date`
- `LoginResponseDto`
  - `message: string`
  - `user: AdminUserResponseDto`
  - `accessToken: string`
  - `refreshToken: string`
- `RefreshTokenResponseDto`
  - `message: string`
  - `accessToken: string`
- `CurrentUserResponseDto`
  - Same fields as `AdminUserResponseDto`
- `UpdateFcmTokenResponseDto`
  - `message: string`
- `LogoutResponseDto`
  - `message: string`
- `PasswordRecoveryResetResponseDto`
  - `message: string`

### User Management DTOs

**Request DTOs**
- `CreateUserRequestDto`
  - `email: string`
  - `password: string` (min 8)
  - `firstName: string`
  - `lastName: string`
  - `role: AdminRole`
- `UpdateUserRequestDto`
  - `password?: string`
  - `firstName?: string`
  - `lastName?: string`
  - `role?: AdminRole`
- `ListUsersRequestDto`
  - `role?: AdminRole`
  - `search?: string`
  - `isActive?: boolean`
  - `page?: number`
  - `limit?: number`

**Response DTOs**
- `PaginationResponseDto`
  - `page: number`
  - `limit: number`
  - `total: number`
  - `totalPages: number`
- `ListUsersResponseDto`
  - `users: AdminUserResponseDto[]`
  - `pagination: PaginationResponseDto`
- `GetUserResponseDto`
  - Same fields as `AdminUserResponseDto`
- `CreateUserResponseDto`
  - `message: string`
  - `user: AdminUserResponseDto`
- `UpdateUserResponseDto`
  - `message: string`
  - `user: AdminUserResponseDto`
- `DeactivateUserResponseDto`
  - `message: string`
- `ReactivateUserResponseDto`
  - `message: string`
  - `user: AdminUserResponseDto`

### Verification DTOs

**Request DTOs**
- `ListVerificationsRequestDto`
  - `status?: VerificationRequestStatus`
  - `verificationType?: DriverVerificationType`
  - `assignedToId?: string`
  - `driverId?: string`
  - `startDate?: string`
  - `endDate?: string`
  - `search?: string`
  - `driverVerificationStatus?: VerificationStatus`
  - `hasActiveRequest?: boolean`
  - `isAssigned?: boolean`
  - `hasPendingDocuments?: boolean`
  - `page?: number`
  - `limit?: number`
- `ListVerificationDriversRequestDto`
  - `search?: string`
  - `driverVerificationStatus?: VerificationStatus`
  - `requestStatus?: VerificationRequestStatus`
  - `verificationType?: DriverVerificationType`
  - `hasActiveRequest?: boolean`
  - `isAssigned?: boolean`
  - `hasPendingDocuments?: boolean`
  - `assignedToId?: string`
  - `page?: number`
  - `limit?: number`
- `CreateVerificationRequestDto`
  - `driverId: string`
- `AssignVerificationRequestDto`
  - `email: string`
- `DocumentActionRequestDto`
  - `action: DocumentActionType`
  - `rejectionReason?: string`
  - `expiryDate?: string`
- `RejectVerificationRequestDto`
  - `reason: string`
- `VerificationRevertRequestDto`
  - `reason: string`
- `RevertDecisionRequestDto`
  - `approve: boolean`
- `RevertDocumentRejectionRequestDto`
  - `note?: string`
- `GetSignedUrlRequestDto`
  - `photoType: string`
  - `contentType: string`
  - `fileName: string`
- `UploadPhotosRequestDto`
  - `verificationId?: string`
  - `photos: PhotoDto[]`
  - `partialUpload?: boolean`
- `PhotoDto`
  - `type: string`
  - `url: string`

**Response DTOs**
- `AdminUserInfoDto`
  - `id: string`
  - `firstName: string`
  - `lastName: string`
  - `role: AdminRole`
  - `email?: string`
- `DriverBasicInfoDto`
  - `id: string`
  - `firstName: string | null`
  - `lastName: string | null`
  - `phoneNumber: string`
  - `verificationStatus: VerificationStatus`
- `DocumentActionDto`
  - `id: string`
  - `documentField: string`
  - `action: DocumentActionType`
  - `rejectionReason: string | null`
  - `actionAt: Date`
  - `actionBy: AdminUserInfoDto`
- `VerificationActionDto`
  - `id: string`
  - `verificationRequestId: string`
  - `actionType: string`
  - `reason: string | null`
  - `actionAt: Date`
  - `actionBy: AdminUserInfoDto`
- `FieldPhotoDto`
  - `id: string`
  - `verificationRequestId: string`
  - `photoType: string`
  - `url: string`
  - `uploadedById: string`
  - `uploadedBy?: AdminUserInfoDto`
  - `uploadedAt: Date`
- `VerificationEligibilityDto`
  - `hasActiveRequest: boolean`
  - `canCreateRequest: boolean`
  - `hasAllRequiredFieldPhotos: boolean`
  - `canVerify: boolean`
  - `canRejectDriver: boolean`
  - `canRevertRejectedDriver: boolean`
  - `canUploadFieldPhotos: boolean`
- `VerificationRequestDto`
  - `id: string`
  - `driverId: string`
  - `verificationType: DriverVerificationType`
  - `status: VerificationRequestStatus`
  - `ticketId: string | null`
  - `reVerificationReason: string | null`
  - `assignedToId: string | null`
  - `assignedTo?: AdminUserInfoDto | null`
  - `approvedById: string | null`
  - `approvedBy?: AdminUserInfoDto | null`
  - `approvedAt: Date | null`
  - `bufferExpiresAt: Date | null`
  - `revertReason: string | null`
  - `revertRequestedById: string | null`
  - `revertRequestedBy?: AdminUserInfoDto | null`
  - `revertRequestedAt: Date | null`
  - `createdAt: Date`
  - `updatedAt: Date`
  - `driver?: DriverBasicInfoDto`
  - `documentActions?: DocumentActionDto[]`
  - `verificationActions?: VerificationActionDto[]`
  - `fieldPhotos?: FieldPhotoDto[]`
- `PaginationDto`
  - `page: number`
  - `limit: number`
  - `total: number`
  - `totalPages: number`
- `DriverDocumentsDto`
  - Driver document URLs, verification statuses, expiry dates, suggested expiry dates, and identity fields from the driver documents record
- `VehicleOwnerDto`
  - Vehicle owner identity and address fields
- `VehicleDto`
  - Vehicle details plus nested `owner`
- `AddressDto`
  - Driver address details plus optional coordinates
- `DriverDetailDto`
  - Driver profile, `documents`, `vehicle`, `address`, `verificationRequests`
- `ListVerificationDriversResponseDto`
  - `drivers: DriverDetailDto[]`
  - `pagination: PaginationDto`
- `ListVerificationsResponseDto`
  - `verifications: VerificationRequestDto[]`
  - `pagination: PaginationDto`
- `GetDriverForVerificationResponseDto`
  - Same shape as `DriverDetailDto`
- `VerificationDetailResponseDto`
  - `DriverDetailDto` fields
  - `currentVerification: VerificationRequestDto | null`
  - `eligibility: VerificationEligibilityDto`
- `AssignVerificationResponseDto`
  - `id: string`
  - `driverId: string`
  - `verificationType: DriverVerificationType`
  - `status: VerificationRequestStatus`
  - `assignedToId: string | null`
  - `assignedTo: AdminUserInfoDto | null`
  - `updatedAt: Date`
- `DocumentActionResponseDto`
  - `success: boolean`
  - `message: string`
- `ApproveVerificationResponseDto`
  - `id: string`
  - `driverId: string`
  - `status: VerificationRequestStatus`
  - `approvedById: string | null`
  - `approvedAt: Date | null`
  - `bufferExpiresAt: Date | null`
  - `bufferDurationMinutes: number`
  - `updatedAt: Date`
- `RejectVerificationResponseDto`
  - `id: string`
  - `driverId: string`
  - `status: VerificationRequestStatus`
  - `revertReason: string | null`
  - `updatedAt: Date`
- `RevertRequestResponseDto`
  - `id: string`
  - `driverId: string`
  - `status: VerificationRequestStatus`
  - `revertReason: string | null`
  - `revertRequestedById: string | null`
  - `revertRequestedAt: Date | null`
  - `updatedAt: Date`
- `RevertDecisionResponseDto`
  - `success: boolean`
  - `message: string`
- `CreateVerificationResponseDto`
  - `created: boolean`
  - `message: string`
  - `request: VerificationRequestDto | null`
- `UploadPhotosResponseDto`
  - `success: boolean`
  - `photosUploaded: number`
- `GetSignedUrlResponseDto`
  - `signedUrl: string`
  - `publicUrl: string`
  - `token: string`
  - `filePath: string`
  - `expiresIn: number`

### Support and Refund DTOs

**Request DTOs**
- `SearchBookingsRequestDto`
  - `phoneNumber?: string`
  - `bookingId?: string`
  - `bookingNumber?: number`
  - `status?: BookingStatus`
  - `latestRefundStatus?: AdminRefundStatus`
  - `hasActiveRefundRequest?: boolean`
  - `startDate?: string`
  - `endDate?: string`
  - `page?: number`
  - `limit?: number`
- `CreateSupportNoteRequestDto`
  - `bookingId: string`
  - `content: string`
- `CreateSupportRefundRequestDto`
  - `bookingId: string`
  - `customerId?: string`
  - `amount: number`
  - `cancellationCharge?: number`
  - `reason: string`
  - `notes?: string`
  - `evidenceUrls?: string[]`
- `ListSupportRefundsRequestDto`
  - `status?: AdminRefundStatus`
  - `bookingStatus?: BookingStatus`
  - `hasActiveRequest?: boolean`
  - `bookingId?: string`
  - `customerId?: string`
  - `driverId?: string`
  - `createdById?: string`
  - `bookingNumber?: number`
  - `phoneNumber?: string`
  - `startDate?: string`
  - `endDate?: string`
  - `page?: number`
  - `limit?: number`
- `RejectSupportRefundRequestDto`
  - `reason: string`
- `SupportRefundRevertRequestDto`
  - `reason: string`
- `SupportRefundRevertDecisionRequestDto`
  - `approve: boolean`
- `AdminCancelBookingDto`
  - `reason: string`

**Response DTOs**
- `SupportPaginationResponseDto`
  - `page: number`
  - `limit: number`
  - `total: number`
  - `totalPages: number`
- `SupportAdminUserResponseDto`
  - `id: string`
  - `firstName: string`
  - `lastName: string`
  - `role: AdminRole`
  - `email?: string | null`
- `SupportCustomerResponseDto`
  - `id: string`
  - `firstName: string | null`
  - `lastName: string | null`
  - `phoneNumber: string`
  - `email?: string | null`
- `SupportDriverResponseDto`
  - `id: string`
  - `firstName: string | null`
  - `lastName: string | null`
  - `phoneNumber: string`
  - `email?: string | null`
  - `photo?: string | null`
  - `driverStatus?: string`
  - `score?: number`
  - `rideCount?: number`
- `SupportBookingStatusLogResponseDto`
  - `id: string`
  - `bookingId: string`
  - `status: BookingStatus`
  - `statusChangedAt: Date`
- `SupportBookingBasicResponseDto`
  - Core booking timeline fields including `bookingNumber`, `status`, timestamps, and cancellation fields
- `SupportBookingDetailItemResponseDto`
  - Booking fields plus `customer`, `assignedDriver`, `package`, `pickupAddress`, `dropAddress`, `invoices`, `statusLogs`
- `SupportRefundRequestResponseDto`
  - Refund request fields including booking/customer/driver IDs, amounts, `cancellationCharge`, reason, notes, evidence, workflow status fields, `rejectionReason`, `isInBuffer`, `bufferRemainingMinutes`, and nested booking/customer/driver/admin references
- `SupportBookingListItemResponseDto`
  - Booking summary plus `latestRefundRequest`
- `SearchBookingsResponseDto`
  - `bookings: SupportBookingListItemResponseDto[]`
  - `pagination: SupportPaginationResponseDto`
- `SupportRefundIntentResponseDto`
  - Processed refund intent details
- `SupportNoteResponseDto`
  - `id: string`
  - `bookingId: string`
  - `agentId: string`
  - `agentName: string`
  - `note: string`
  - `createdAt: Date`
- `SupportRefundHistoryResponseDto`
  - `intents: SupportRefundIntentResponseDto[]`
  - `manual: SupportRefundRequestResponseDto[]`
  - `latestRequest: SupportRefundRequestResponseDto | null`
- `SupportBookingDetailResponseDto`
  - `booking: SupportBookingDetailItemResponseDto`
  - `refundHistory: SupportRefundHistoryResponseDto`
  - `notes: SupportNoteResponseDto[]`
- `ListSupportRefundsResponseDto`
  - `refunds: SupportRefundRequestResponseDto[]`
  - `pagination: SupportPaginationResponseDto`
- `SupportLiveTrackingResponseDto`
  - `driverId: string`
  - `bookingId: string | null`
  - `latitude: number | null`
  - `longitude: number | null`
  - `timeToPickup: number | null`
  - `timeToDrop: number | null`
  - `distanceToPickup: number | null`
  - `distanceToDrop: number | null`
  - `initialDistanceToPickup: number | null`
  - `kmTravelled: number | null`
  - `routePolyline: string | null`
  - `lastUpdated: string`
  - `isStale?: boolean`

### Audit Log DTOs

**Request DTOs**
- `ListLogsRequestDto`
  - `userId?: string`
  - `actionType?: string`
  - `module?: string`
  - `entityId?: string`
  - `entityType?: string`
  - `startDate?: string`
  - `endDate?: string`
  - `search?: string`
  - `userSearch?: string`
  - `page?: number`
  - `limit?: number`
- `TriggerAuditArchiveRequestDto`
  - `cutoffDate: string`

**Response DTOs**
- `AuditLogUserDto`
  - `id: string`
  - `email: string`
  - `firstName: string`
  - `lastName: string`
- `AuditLogDto`
  - `id: string`
  - `userId: string | null`
  - `role: AdminRole`
  - `actionType: string`
  - `module: string`
  - `description: string`
  - `ipAddress: string | null`
  - `userAgent: string | null`
  - `beforeSnapshot: any | null`
  - `afterSnapshot: any | null`
  - `entityId: string | null`
  - `entityType: string | null`
  - `timestamp: Date`
  - `user: AuditLogUserDto | null`
- `PaginationDto`
  - `page: number`
  - `limit: number`
  - `total: number`
  - `totalPages: number`
- `ListLogsResponseDto`
  - `logs: AuditLogDto[]`
  - `pagination: PaginationDto`
- `GetLogByIdResponseDto`
  - Same fields as `AuditLogDto`
- `ExportLogDto`
  - `id: string`
  - `timestamp: string`
  - `user: string`
  - `email: string`
  - `role: AdminRole`
  - `action: string`
  - `module: string`
  - `description: string`
  - `entityType: string`
  - `entityId: string`
  - `ipAddress: string`
- `ExportLogsResponseDto`
  - `logs: ExportLogDto[]`
- `ListArchivedFilesResponseDto`
  - `files: string[]`
- `GetArchivedLogsResponseDto`
  - `logs: any[] | null`
  - `count: number`
- `TriggerArchivalResponseDto`
  - `archived: number`
  - `filePath: string | null`
  - `fileUrl: string | null`
  - `deletedFrom: string | null`
  - `deletedTo: string | null`

### Notifications DTOs

**Request DTOs**
- `GetNotificationsRequestDto`
  - `page?: number`
  - `limit?: number`
  - `unreadOnly?: boolean`

**Response DTOs**
- `NotificationResponseDto`
  - `id: string`
  - `userId: string`
  - `title: string`
  - `message: string`
  - `entityId: string | null`
  - `entityType: string | null`
  - `driverId: string | null`
  - `actionUrl: string | null`
  - `isRead: boolean`
  - `createdAt: Date`
- `PaginationResponseDto`
  - `page: number`
  - `limit: number`
  - `total: number`
  - `totalPages: number`
- `GetNotificationsResponseDto`
  - `notifications: NotificationResponseDto[]`
  - `unreadCount: number`
  - `pagination: PaginationResponseDto`
- `GetUnreadCountResponseDto`
  - `count: number`
- `MarkAsReadResponseDto`
  - `success: boolean`
- `MarkAllAsReadResponseDto`
  - `success: boolean`
- `DashboardStatsDto`
  - Role-dependent counters such as `totalActive`, `unassigned`, `inReview`, `reverted`, `revertRequested`, `myAssignments`, `myActive`, `pendingRefundRequests`, `refundRevertRequests`, `revertedRefundRequests`
- `DashboardSummaryResponseDto`
  - `role: 'admin' | 'agent' | 'support'`
  - `stats: DashboardStatsDto`
  - `recentNotifications: NotificationResponseDto[]`
  - `unreadNotifications: number`

---

## API Routes

### Authentication

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/admin-api/auth/login` | Login with email/password, set access and refresh cookies, and also return both tokens in the body. | `LoginRequestDto` | `LoginResponseDto` | Public |
| `POST` | `/admin-api/auth/refresh` | Refresh access token using `refreshToken` from request body or cookie. Also refreshes the access token cookie. | `RefreshTokenRequestDto` (optional body) | `RefreshTokenResponseDto` | Public |
| `GET` | `/admin-api/auth/me` | Return the current authenticated admin user. | - | `CurrentUserResponseDto` | All authenticated users |
| `PUT` | `/admin-api/auth/fcm-token` | Update the current session's FCM token using the refresh-token cookie to locate the session. | `UpdateFcmTokenRequestDto` | `UpdateFcmTokenResponseDto` | All authenticated users |
| `POST` | `/admin-api/auth/logout` | Delete the current session using the refresh-token cookie and clear auth cookies. Requires an access token. | - | `LogoutResponseDto` | All authenticated users |
| `POST` | `/admin-api/auth/password-recovery/reset` | Reset an admin password after Google ID token verification. | `PasswordRecoveryResetRequestDto` | `PasswordRecoveryResetResponseDto` | Public |

### User Management

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/users` | List admin users with role, search, active-status, and pagination filters. | Query: `ListUsersRequestDto` | `ListUsersResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/users/:id` | Get one admin user by ID. | - | `GetUserResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/users` | Create a new admin user. | `CreateUserRequestDto` | `CreateUserResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/admin-api/users/:id` | Update an admin user. Email is not part of the update DTO. | `UpdateUserRequestDto` | `UpdateUserResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `DELETE` | `/admin-api/users/:id` | Soft-deactivate an admin user. | - | `DeactivateUserResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/users/:id/reactivate` | Reactivate a deactivated admin user. | - | `ReactivateUserResponseDto` | `SUPER_ADMIN`, `ADMIN` |

### Verifications

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/verifications/drivers` | List drivers for verification search with filters on driver state and latest request state. | Query: `ListVerificationDriversRequestDto` | `ListVerificationDriversResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/verifications/drivers/:driverId/details` | Get admin verification detail for a driver, including current verification and eligibility. | - | `VerificationDetailResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/verifications/requests` | Ensure an active verification request exists for the driver. The operation is idempotent. | `CreateVerificationRequestDto` | `CreateVerificationResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/admin-api/verifications/requests/:id/assign` | Assign a verification request by assignee email. If the request is `PENDING`, assignment moves it to `IN_REVIEW`. | `AssignVerificationRequestDto` | `AssignVerificationResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/verifications/drivers/:driverId/revert-rejection` | Restore a rejected driver back to `PENDING` verification state and ensure an active verification request exists. | - | `CreateVerificationResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/verifications/requests/:id/revert-decision` | Approve or reject a verification revert request. | `RevertDecisionRequestDto` | `RevertDecisionResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/verifications/requests` | List verification requests. For `AGENT` and `FIELD_AGENT`, results are automatically scoped to the current user. | Query: `ListVerificationsRequestDto` | `ListVerificationsResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `GET` | `/admin-api/verifications/requests/:requestId/details` | Get verification details by request ID. Agents and field agents can only access requests assigned to them. | - | `VerificationDetailResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/documents/:field/action` | Approve or reject a single document field. Supports `license`, `rcBook`, `fc`, `insurance`, `aadhar`, `selfie`. Optional `expiryDate` can be saved on approved documents that support expiry. | `DocumentActionRequestDto` | `DocumentActionResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/documents/:field/revert` | Revert a previously reviewed document back to `PENDING` when the document type supports revert. | `RevertDocumentRejectionRequestDto` | `DocumentActionResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/approve` | Approve the verification, require all four core documents verified plus all six field photos, and start the approval buffer timer. | - | `ApproveVerificationResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/reject-driver` | Reject the whole driver verification and set the driver's verification status to `REJECTED`. | `RejectVerificationRequestDto` | `RejectVerificationResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/revert-request` | Request revert while the verification is still inside the approval buffer window. | `VerificationRevertRequestDto` | `RevertRequestResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `GET` | `/admin-api/verifications/requests/:id/photos/signed-url` | Get a signed upload URL for a field photo. Query parameters carry the request DTO. | Query: `GetSignedUrlRequestDto` | `GetSignedUrlResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |
| `POST` | `/admin-api/verifications/requests/:id/photos` | Upload or replace field photos for the verification request. Supports partial upload mode. | `UploadPhotosRequestDto` | `UploadPhotosResponseDto` | `SUPER_ADMIN`, `ADMIN`, `AGENT`, `FIELD_AGENT` |

### Support and Refunds

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/support/bookings` | Search bookings by phone, booking ID, booking number prefix, booking status, latest refund status, active refund flag, and date range. | Query: `SearchBookingsRequestDto` | `SearchBookingsResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/bookings/:id` | Get a booking with package, addresses, invoices, status history, refund history, and support notes. | - | `SupportBookingDetailResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/customers/:identifier` | Get customer details by customer ID or phone number. | - | Raw customer entity shape from service | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/drivers/:identifier` | Get driver details by driver ID or phone number. | - | Raw driver entity shape from service | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/bookings/:bookingId/tracking` | Get live tracking for the booking's assigned driver. Uses Redis navigation data when the driver is actively on that booking, otherwise falls back to last known geolocation and may return `isStale: true`. | - | `SupportLiveTrackingResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/notes` | Create an internal support note for a booking. | `CreateSupportNoteRequestDto` | `SupportNoteResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/notes/:bookingId` | Get all support notes for a booking. | - | `SupportNoteResponseDto[]` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/refunds` | Create a manual refund request. Requires a final invoice and rejects duplicates when an active manual refund or completed refund already exists. | `CreateSupportRefundRequestDto` | `SupportRefundRequestResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/refunds` | List refund requests with refund, booking, creator, phone, and date filters. Customer support users only see their own created refunds. | Query: `ListSupportRefundsRequestDto` | `ListSupportRefundsResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `GET` | `/admin-api/support/refunds/:id` | Get a refund request by ID. | - | `SupportRefundRequestResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/refunds/:id/revert` | Request revert for an approved refund during the active buffer window. | `SupportRefundRevertRequestDto` | `SupportRefundRequestResponseDto` | `CUSTOMER_SUPPORT`, `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/refunds/:id/approve` | Approve a refund request and start the refund buffer timer. | - | `SupportRefundRequestResponseDto` | `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/refunds/:id/reject` | Reject a refund request. | `RejectSupportRefundRequestDto` | `SupportRefundRequestResponseDto` | `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/refunds/:id/revert-decision` | Approve or reject a refund revert request. | `SupportRefundRevertDecisionRequestDto` | `SupportRefundRequestResponseDto` | `ADMIN`, `SUPER_ADMIN` |
| `POST` | `/admin-api/support/bookings/:id/cancel` | Force-cancel a non-final booking, mark assigned driver available again, update assignment state, create a booking status log, and cancel the Razorpay payment link when unpaid. | `AdminCancelBookingDto` | `{ message: string }` | `ADMIN`, `SUPER_ADMIN` |

### Audit Logs

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/logs` | List audit logs with filters and pagination. | Query: `ListLogsRequestDto` | `ListLogsResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/logs/export` | Export matching audit logs as a CSV file download. | Query: `ListLogsRequestDto` | CSV binary response | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/logs/archive` | List archived audit-log file paths from Firebase Storage. | Query: `year?`, `month?` | `ListArchivedFilesResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/logs/archive/:dateKey` | Get archived logs for one `YYYY-MM-DD` key. | - | `GetArchivedLogsResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `POST` | `/admin-api/logs/archive/trigger` | Manually archive and delete audit logs older than the supplied cutoff date. | `TriggerAuditArchiveRequestDto` | `TriggerArchivalResponseDto` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/admin-api/logs/:id` | Get one audit log entry with snapshots. | - | `GetLogByIdResponseDto` | `SUPER_ADMIN`, `ADMIN` |

### Notifications

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-api/notifications/summary` | Return dashboard summary data. The `stats` payload changes by role and includes recent notifications plus unread count. | - | `DashboardSummaryResponseDto` | All authenticated users |
| `GET` | `/admin-api/notifications` | Get notifications for the current user with pagination and optional unread-only filter. | Query: `GetNotificationsRequestDto` | `GetNotificationsResponseDto` | All authenticated users |
| `GET` | `/admin-api/notifications/unread-count` | Get unread notification count for the current user. | - | `GetUnreadCountResponseDto` | All authenticated users |
| `POST` | `/admin-api/notifications/:id/read` | Mark one notification as read. | - | `MarkAsReadResponseDto` | All authenticated users |
| `POST` | `/admin-api/notifications/read-all` | Mark all current-user notifications as read. | - | `MarkAllAsReadResponseDto` | All authenticated users |

### External Webhook

| Method | Path | Description | Request | Success Response | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/libredesk/webhook` | Receive LibreDesk webhook events. Uses `x-libredesk-signature` header plus `LibredeskWebhookPayload` body. This route is outside the `/admin-api` prefix. | Header + webhook payload | Service-defined webhook response | External integration |

---

## Enums

### AdminRole
- `SUPER_ADMIN`
- `ADMIN`
- `AGENT`
- `FIELD_AGENT`
- `CUSTOMER_SUPPORT`

### DriverVerificationType
- `NEW_DRIVER`
- `EXISTING_DRIVER`

### VerificationRequestStatus
- `PENDING`
- `IN_REVIEW`
- `APPROVED`
- `REJECTED`
- `REVERT_REQUESTED`
- `REVERTED`
- `FINAL_APPROVED`

### VerificationStatus
- `PENDING`
- `VERIFIED`
- `REJECTED`

### DocumentActionType
- `APPROVED`
- `REJECTED`

### AdminRefundStatus
- `PENDING`
- `APPROVED`
- `REJECTED`
- `REVERT_REQUESTED`
- `REVERTED`
- `COMPLETED`

### FieldPhotoType
- `VEHICLE_FRONT`
- `VEHICLE_BACK`
- `VEHICLE_LEFT`
- `VEHICLE_RIGHT`
- `DRIVER_WITH_VEHICLE`
- `CHASSIS_NUMBER`

---

## Notes

### Verification Workflow Notes
- Verification admin routes use `/admin-api/verifications/drivers` and `/admin-api/verifications/requests`; there is no separate `/field-verification` controller.
- Assigning by email can transition a request from `PENDING` to `IN_REVIEW`.
- Driver approval requires all required documents verified and all six required field photos uploaded.
- Revert decisions for drivers are handled by admins on the request route, while document-decision reverts are handled on the document route.

### Refund Workflow Notes
- Refund routes live under `/admin-api/support/refunds`, not `/admin-api/refunds`.
- Creating a refund validates against booking/invoice state and blocks duplicate active or already-completed refunds.
- Refund approval and verification approval both use a buffer timer before finalization.

### Support Tracking Notes
- Live tracking is booking-based, not direct driver-location lookup by driver ID.
- Fallback tracking can return last-known coordinates with `isStale: true` when live navigation data is unavailable.

### Audit Archival Notes
- Manual archival requires a request body with `cutoffDate`.
- Export returns CSV content directly, not JSON-wrapped logs.
