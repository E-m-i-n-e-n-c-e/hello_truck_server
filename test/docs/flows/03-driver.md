# 03 – Driver Profile & Logistics

## Covered By
- `test/e2e/03-driver.e2e-spec.ts`

## Purpose
Manages driver onboarding, vehicle registration, document uploads, and verification status.

---

## Preconditions
- Authenticated as Driver

---

## Rules

### 1. Profile Management
- **Create**: Required fields: `firstName`, `lastName`.
- **Status**: Can toggle between `AVAILABLE` and `UNAVAILABLE`.
- **Payout Details**: Bank account/UPI details for earnings.

### 2. Vehicle Registration
- **Setup**: Driver must register a vehicle to accept bookings.
- **Details**: Model, Plate Number, Capacity, Body Type.
- **Ownership**: Can be Owner-Driver or purely Driver (Fleet).

### 3. Document Uploads
- **Process**:
    1.  Request Signed URL (`/driver/documents/upload-url`)
    2.  Upload file to Cloud Storage (Mocked in E2E)
    3.  Confirm upload to backend
- **Types**: License, RC, Insurance, Aadhaar/PAN.
- **Expiry**: System tracks expiry dates and alerts driver.

### 4. Verification Flow
- **Initial State**: `PENDING`
- **Action**: Admin reviews documents (Simulated in tests).
- **Verified State**: `VERIFIED` → Driver can go online.
- **Re-upload**: If verified driver re-uploads a doc, status might revert to `PENDING` for that doc, but overall driver status remains `VERIFIED` (unless critical doc expires).

---

## Side Effects
- `Driver` status changes.
- `Vehicle` records created.
- `DriverDocument` records update.

---

## Notes
- A driver **cannot** receive booking assignments until `VERIFIED` and `AVAILABLE`.
