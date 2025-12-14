# 04 – Booking Lifecycle

## Covered By
- `test/e2e/04-booking.e2e-spec.ts`

## Purpose
The core marketplace flow: Estimate → Create → Assign → Execution → Payment.

---

## Preconditions
- Customer has Profile + Wallet
- Driver is Verified + Available + Within Range (for assignment)

---

## Flow Stages

### 1. Estimation
- **Input**: Pickup/Drop coordinates, cargo type.
- **Output**: Estimated cost, distance, recommended vehicle type.
- **Rules**:
    - Same pickup/drop → Error
    - Out of service area → Error

### 2. Creation
- **Action**: Customer confirms estimate.
- **Status**: `PENDING`
- **Financial**:
    - `Wallet` debited if applicable (partial/full).
    - `Invoice` created with `ESTIMATE` status.

### 3. Assignment
- **Mechanism**: System finds nearest driver (AssignmentService).
- **Status**: `DRIVER_ASSIGNED`
- **Visibility**: Driver sees booking; Customer does NOT see driver details yet.

### 4. Acceptance
- **Action**: Driver accepts booking.
- **Status**: `CONFIRMED`
- **Financial**:
    - Final Invoice generated.
    - Payment Link created (Razorpay Mock).
    - Customer wallet logs created.

### 5. Execution
- **Pickup**:
    - `PICKUP_ARRIVED`: Driver reaches location.
    - `PICKUP_VERIFIED`: Secure OTP exchange. Status → `IN_TRANSIT`.
- **Drop**:
    - `DROP_ARRIVED`: Driver reaches destination.
    - `DROP_VERIFIED`: Secure OTP exchange. Status → `COMPLETED`.

---

## Payment Rules
- **Online**: Payment link paid via webhook → Invoice `PAID`.
- **Cash**: Driver collects cash → "Settle Cash" API → Invoice `PAID`.
- **Wallet**: Automatically applied at creation.

---

## Side Effects
- `Booking` status transitions (1 of 11 states).
- `Transaction` records for Credit/Debit.
- `Assignment` records locked/released.
