# 06 – Cancellation Flow

## Covered By
- `test/e2e/06-cancellation.e2e-spec.ts`

## Purpose
Tests booking cancellation at different lifecycle stages, verifying correct refund logic, driver release, and authorization checks.

---

## Preconditions
- Customer and Driver authenticated with profiles
- Driver is `VERIFIED` and `AVAILABLE`

---

## Test Cases

### Cancel at PENDING (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Cancel at PENDING | Create booking only | `POST /bookings/customer/cancel/{id}` | `201 Created`, `status: "CANCELLED"` |

### Cancel at DRIVER_ASSIGNED (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Cancel with driver release | Create booking + assign driver (not accepted) | `POST /bookings/customer/cancel/{id}` | `201 Created`, driver `status: "AVAILABLE"`, assignment `status: "AUTO_REJECTED"` |

### Cancel at CONFIRMED (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Cancel after acceptance | Create + assign + accept | `POST /bookings/customer/cancel/{id}` | `201 Created`, `status: "CANCELLED"` (partial refund) |

### Cancel at PICKUP_ARRIVED (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Cancel before OTP | Create → accept → pickup arrived | `POST /bookings/customer/cancel/{id}` | `201 Created`, `status: "CANCELLED"`, driver released |

### Cannot Cancel after PICKUP_VERIFIED (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Reject late cancellation | Create → accept → pickup arrived → pickup verified | `POST /bookings/customer/cancel/{id}` | `400 Bad Request` |

### Idempotent Cancellation (1 test)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Reject double cancel | Cancel once, try again | `POST /bookings/customer/cancel/{id}` | `400 Bad Request`, message contains "already cancelled" |

### Authorization Checks (2 tests)

| Test | Setup | Endpoint | Expected |
|------|-------|----------|----------|
| Wrong customer | Different customer tries to cancel | `POST /bookings/customer/cancel/{id}` | `400 Bad Request`, message contains "only cancel your own" |
| Non-existent booking | Fake UUID | `POST /bookings/customer/cancel/{id}` | `404 Not Found` |

---

## Cancellation Policy Matrix

| Status | Cancellation | Refund | Driver Release |
|--------|--------------|--------|----------------|
| `PENDING` | ✅ Allowed | Full | N/A |
| `DRIVER_ASSIGNED` | ✅ Allowed | Full | Yes → `AVAILABLE` |
| `CONFIRMED` | ✅ Allowed | Partial | Yes → `AVAILABLE` |
| `PICKUP_ARRIVED` | ✅ Allowed | Partial | Yes → `AVAILABLE` |
| `PICKUP_VERIFIED+` | ❌ Rejected | None | No |

---

## Key Assertions

1. **Booking Status**: After cancellation, `booking.status === "CANCELLED"`.
2. **Driver Status**: Released drivers return to `AVAILABLE`.
3. **Assignment Status**: Auto-rejected assignments have `status: "AUTO_REJECTED"`.
4. **Cancellation Reason**: Stored in `booking.cancellationReason`.
5. **Authorization**: Only the booking owner can cancel.

---

## Side Effects Verified
- `booking.cancelledAt` timestamp set
- `booking.cancellationReason` stored
- `BookingAssignment.status` updated to `AUTO_REJECTED`
- `Driver.driverStatus` updated to `AVAILABLE`
