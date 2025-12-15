# 04 – Booking Lifecycle

## Covered By
- `test/e2e/04-booking.e2e-spec.ts`

## Purpose
Tests the complete booking flow from estimate to completion, including both cash and online payment paths.

---

## Preconditions
- Customer has profile created
- Driver is `VERIFIED` and `AVAILABLE` (set via direct DB update in beforeAll)
- Driver has vehicle registered with valid model

---

## Test Cases

### Estimates (2 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Calculate estimate | `POST /bookings/customer/estimate` | `{ pickupAddress, dropAddress, packageDetails }` | `201 Created`, returns `distanceKm > 0`, `topVehicles[]` |
| Reject same pickup/drop | `POST /bookings/customer/estimate` | Same lat/lng for both | `400 Bad Request` |

### Booking Creation (4 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Create booking | `POST /bookings/customer` | Full booking DTO | `200/201`, `status: "PENDING"` |
| Get booking details | `GET /bookings/customer/{id}` | - | `200 OK`, returns booking with status |
| Get active bookings | `GET /bookings/customer/active` | - | `200 OK`, array contains new booking |
| Get upload URL | `GET /bookings/customer/upload-url` | Query: `filePath`, `type` | `200 OK`, returns `signedUrl` + `publicUrl` |

### Driver Assignment & Full Flow (9 tests)

**Setup**: Manually create `BookingAssignment` and set booking to `DRIVER_ASSIGNED`

| Test | Endpoint | Payload | Expected | Status After |
|------|----------|---------|----------|--------------|
| Receive assignment | `GET /bookings/driver/current-assignment` | - | `200 OK`, returns assignment with `status: "OFFERED"` | - |
| Accept assignment | `POST /bookings/driver/accept/{assignmentId}` | - | `201 Created` | `CONFIRMED` |
| Arrive at pickup | `POST /bookings/driver/pickup/arrived` | - | `201 Created` | `PICKUP_ARRIVED` |
| Verify pickup | `POST /bookings/driver/pickup/verify` | `{ otp: pickupOtp }` | `201 Created` | `PICKUP_VERIFIED` |
| Start trip | `POST /bookings/driver/start` | - | `201 Created` | `IN_TRANSIT` |
| Arrive at drop | `POST /bookings/driver/drop/arrived` | - | `201 Created` | `DROP_ARRIVED` |
| Verify drop | `POST /bookings/driver/drop/verify` | `{ otp: dropOtp }` | `201 Created` | `DROP_VERIFIED` |
| Settle cash | `POST /bookings/driver/settle-cash` | - | `201 Created` | Invoice `isPaid: true` |
| Finish booking | `POST /bookings/driver/finish` | - | `201 Created` | `COMPLETED` |

### Online Payment Flow (3 tests)

**Setup**: Create new booking, progress through all stages to `DROP_VERIFIED`

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Process Razorpay webhook | `POST /bookings/webhook/razorpay` | `{ event: "payment_link.paid", payload: {...} }` | `201 OK`, `{ status: "ok" }` |
| Verify invoice paid | DB Check | - | `Invoice.isPaid: true`, `paymentMethod: "ONLINE"` |
| Finish after online payment | `POST /bookings/driver/finish` | - | `201 Created`, `status: "COMPLETED"` |

### History (2 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| Customer history | `GET /bookings/customer/history` | `200 OK`, array contains completed booking |
| Driver history | `GET /bookings/driver/history` | `200 OK`, returns array of past assignments |

### Ride Summary (4 tests)

| Test | Endpoint | Query | Expected |
|------|----------|-------|----------|
| Get today's summary (default) | `GET /bookings/driver/ride-summary` | - | `200 OK`, returns `totalRides ≥ 2`, `netEarnings > 0`, `commissionRate`, `assignments[]` with full booking details, `date` = today (YYYY-MM-DD) |
| Get summary for specific date | `GET /bookings/driver/ride-summary` | `?date=YYYY-MM-DD` | `200 OK`, returns summary for specified date |
| Future date (no rides) | `GET /bookings/driver/ride-summary` | `?date=<tomorrow>` | `200 OK`, `totalRides: 0`, `netEarnings: 0`, `assignments: []` |
| Verify commission calculation | `GET /bookings/driver/ride-summary` | - | Validates: `netEarnings < totalAmount * totalRides` (commission deducted) |

**Key Validations:**
- Returns **net earnings** (after platform commission deduction)
- Includes **commission rate** (e.g., 0.07 for 7%)
- Returns array of **completed assignments** with full booking details (package, addresses, invoices)
- Date defaults to **today in IST timezone** (YYYY-MM-DD format)
- Each assignment includes FINAL invoice for earnings calculation


---

## Status Transition Flow
```
PENDING → DRIVER_ASSIGNED → CONFIRMED → PICKUP_ARRIVED →
PICKUP_VERIFIED → IN_TRANSIT → DROP_ARRIVED → DROP_VERIFIED → COMPLETED
```

---

## Key Assertions

1. **OTP Verification**: Both pickup and drop require correct OTP from booking record.
2. **Payment Before Finish**: `settle-cash` or webhook must complete before `finish`.
3. **Invoice Creation**: FINAL invoice created on driver acceptance with `paymentLinkUrl`.
4. **Webhook Signature**: `x-razorpay-signature` header verified (mocked in tests).

---

## State Passed to Next Tests
- `testState.bookingId` - Completed booking ID
- `testState.assignmentId` - Assignment ID
