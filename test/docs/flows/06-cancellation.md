# 06 – Cancellation Flow

## Covered By
- `test/e2e/06-cancellation.e2e-spec.ts`

## Purpose
Defines how a booking can be cancelled at different lifecycle stages and what side effects must occur (refunds, driver release, logs).

---

## Preconditions
- User is authenticated
- Booking exists
- Booking is paid (for partial refund cases)

---

## Cancellation Rules

### 1. PENDING
✅ Allowed
- **Outcome**: Booking status → `CANCELLED`
- **Refund**: Full refund to wallet.
- **Driver**: No driver involved.

### 2. DRIVER_ASSIGNED
✅ Allowed
- **Outcome**: Booking status → `CANCELLED`
- **Refund**: Full refund.
- **Driver**: Released back to `AVAILABLE` pool.

### 3. CONFIRMED
✅ Allowed
- **Outcome**: Booking status → `CANCELLED`
- **Refund**: Partial refund (Cancellation fee applied).
- **Driver**: Notified and paid compensation (if applicable).

### 4. PICKUP_VERIFIED
❌ Not Allowed
- **Outcome**: API returns `400 Bad Request`.
- **Reason**: Trip has already started physically.

---

## Side Effects
- `booking.cancelledAt` set.
- `admin_logs` entry created.
- Redis assignment key deleted.

---

## Failure Scenarios
- Cancelling someone else’s booking → `403`
- Cancelling non-existent booking → `404`

---

## Notes
- Cancellation policies are configurable in the backend (e.g., fee %).
- Logic validated by E2E tests + logic in `BookingCustomerService`.
