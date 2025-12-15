# QA Coverage Document

## Overview

This document provides a **comprehensive checklist** for Quality Assurance of the Hello Truck backend. It consolidates all E2E test flows, integration tests, and smoke tests into a single reference for manual verification and regression testing.

---

## Quick Reference

| Command | Purpose |
| --- | --- |
| `npm run test:all` | Run all E2E + Integration tests |
| `npm run test:e2e` | Run only E2E tests |
| `npm run test:integration` | Run only Integration tests |
| `npm run test:smoke` | Run Razorpay smoke tests |

---

## 1. Authentication (`01-auth.e2e-spec.ts`)

### Customer Auth

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Send OTP | `/auth/customer/send-otp` | POST | `200`, `{ success: true }` |
| 2 | Verify OTP (valid) | `/auth/customer/verify-otp` | POST | `200`, returns `accessToken`, `refreshToken` |
| 3 | Verify OTP (invalid `000000`) | `/auth/customer/verify-otp` | POST | `400 Bad Request` |
| 4 | Refresh Token | `/auth/customer/refresh-token` | POST | `200`, returns new `accessToken` |
| 5 | Logout | `/auth/customer/logout` | POST | `200 OK` |

### Driver Auth

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Send OTP | `/auth/driver/send-otp` | POST | `200`, `{ success: true }` |
| 2 | Verify OTP (valid) | `/auth/driver/verify-otp` | POST | `200`, returns `accessToken`, `refreshToken` |
| 3 | Verify OTP (invalid `000000`) | `/auth/driver/verify-otp` | POST | `400 Bad Request` |
| 4 | Logout | `/auth/driver/logout` | POST | `200 OK` |

**Key Validation:**

- [ ]  OTP `123456` works in test mode
- [ ]  New phone creates user automatically (auto-signup)
- [ ]  Refresh token returns NEW access token
- [ ]  After logout, refresh token is invalid

---

## 2. Customer Profile (`02-customer.e2e-spec.ts`)

### Profile

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Get profile (before create) | `/customer/profile` | GET | - | `200`, `firstName: null` |
| 2 | Create profile | `/customer/profile` | POST | `{ firstName, lastName }` | `201`, `{ success: true }` |
| 3 | Get profile (after create) | `/customer/profile` | GET | - | `200`, returns name |
| 4 | Update profile | `/customer/profile` | PUT | `{ firstName: "Updated" }` | `200` |

### Addresses

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Create address | `/customer/addresses` | POST | `{ name, contactName, contactPhone, address: {...} }` | `201`, returns `id` |
| 2 | Get all addresses | `/customer/addresses` | GET | - | `200`, array |
| 3 | Create default address | `/customer/addresses` | POST | Same + `isDefault: true` | `201`, `isDefault: true` |
| 4 | Update address | `/customer/addresses/{id}` | PUT | `{ name: "Updated" }` | `200` |
| 5 | Delete address | `/customer/addresses/{id}` | DELETE | - | `200` |

### GST Details

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Add GST | `/customer/gst` | POST | `{ gstNumber, businessName, businessAddress }` | `201` |
| 2 | Get all GST | `/customer/gst` | GET | - | `200`, array |
| 3 | Update GST | `/customer/gst/{id}` | PUT | `{ businessName: "Updated" }` | `200` |

**Key Validation:**

- [ ]  Setting `isDefault: true` unsets previous default
- [ ]  GST number format validated (e.g., `29ABCDE1234F1Z5`)
- [ ]  Profile must exist before booking

---

## 3. Driver Profile (`03-driver.e2e-spec.ts`)

### Profile

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Get profile (before create) | `/driver/profile` | GET | - | `200`, `firstName: null` |
| 2 | Create profile | `/driver/profile` | POST | `{ firstName, lastName, documents: {...} }` | `201` |
| 3 | Get profile | `/driver/profile` | GET | - | `200`, returns `id`, `firstName` |
| 4 | Update profile | `/driver/profile` | PUT | `{ firstName: "Updated" }` | `200` |
| 5 | Update status | `/driver/profile/status` | PUT | `{ status: "AVAILABLE" }` | `200` |
| 6 | Verify status change | `/driver/profile` | GET | - | `driverStatus: "AVAILABLE"` |

### Vehicle

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Get vehicle models | `/driver/vehicle/models` | GET | - | `200`, array of models |
| 2 | Add vehicle | `/driver/vehicle` | POST | `{ vehicleNumber, vehicleType, vehicleModelName, ... }` | `201` |
| 3 | Get vehicle | `/driver/vehicle` | GET | - | `200`, vehicle details |
| 4 | Update vehicle | `/driver/vehicle` | PUT | `{ vehicleBodyType: "OPEN" }` | `200` |

### Documents

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Get documents | `/driver/documents` | GET | - | `200`, all document URLs |
| 2 | Update documents | `/driver/documents` | PUT | `{ licenseUrl: "..." }` | `200` |
| 3 | Get upload URL | `/driver/documents/upload-url` | GET | Query: `filePath`, `type` | `200`, `signedUrl`, `publicUrl` |

### Address

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Create address | `/driver/address` | POST | `{ addressLine1, pincode, city, district, state }` | `201` |
| 2 | Get address | `/driver/address` | GET | - | `200` |
| 3 | Update address | `/driver/address` | PUT | `{ city: "Secunderabad" }` | `200` |

**Key Validation:**

- [ ]  Documents object required on profile creation
- [ ]  Vehicle models are seeded in database
- [ ]  Driver cannot go online until VERIFIED

---

## 4. Booking Lifecycle (`04-booking.e2e-spec.ts`)

### Estimates

| # | Test Case | Endpoint | Method | Payload | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | Calculate estimate | `/bookings/customer/estimate` | POST | `{ pickupAddress, dropAddress, packageDetails }` | `201`, `distanceKm > 0`, `topVehicles[]` |
| 2 | Same pickup/drop rejected | `/bookings/customer/estimate` | POST | Same lat/lng | `400 Bad Request` |

### Booking Creation

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Create booking | `/bookings/customer` | POST | `200/201`, `status: "PENDING"` |
| 2 | Get booking details | `/bookings/customer/{id}` | GET | `200`, booking object |
| 3 | Get active bookings | `/bookings/customer/active` | GET | `200`, array contains booking |
| 4 | Get upload URL | `/bookings/customer/upload-url` | GET | `200`, `signedUrl`, `publicUrl` |

### Driver Assignment & Execution Flow

| # | Test Case | Endpoint | Method | Expected | Status After |
| --- | --- | --- | --- | --- | --- |
| 1 | Get current assignment | `/bookings/driver/current-assignment` | GET | `200`, `status: "OFFERED"` | - |
| 2 | Accept assignment | `/bookings/driver/accept/{assignmentId}` | POST | `201` | `CONFIRMED` |
| 3 | Arrive at pickup | `/bookings/driver/pickup/arrived` | POST | `201` | `PICKUP_ARRIVED` |
| 4 | Verify pickup (OTP) | `/bookings/driver/pickup/verify` | POST | `201` | `PICKUP_VERIFIED` |
| 5 | Start trip | `/bookings/driver/start` | POST | `201` | `IN_TRANSIT` |
| 6 | Arrive at drop | `/bookings/driver/drop/arrived` | POST | `201` | `DROP_ARRIVED` |
| 7 | Verify drop (OTP) | `/bookings/driver/drop/verify` | POST | `201` | `DROP_VERIFIED` |
| 8 | Settle cash | `/bookings/driver/settle-cash` | POST | `201` | Invoice paid |
| 9 | Finish booking | `/bookings/driver/finish` | POST | `201` | `COMPLETED` |

### Online Payment Flow

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Razorpay webhook | `/bookings/webhook/razorpay` | POST | `201`, `{ status: "ok" }` |
| 2 | Invoice marked paid | DB Check | - | `isPaid: true`, `paymentMethod: "ONLINE"` |
| 3 | Finish after payment | `/bookings/driver/finish` | POST | `201`, `status: "COMPLETED"` |

### History

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Customer history | `/bookings/customer/history` | GET | `200`, array |
| 2 | Driver history | `/bookings/driver/history` | GET | `200`, array |

**Status Flow:**

```
PENDING → DRIVER_ASSIGNED → CONFIRMED → PICKUP_ARRIVED →
PICKUP_VERIFIED → IN_TRANSIT → DROP_ARRIVED → DROP_VERIFIED → COMPLETED

```

**Key Validation:**

- [ ]  OTP from pickup and drop MUST match
- [ ]  Payment (cash settle or webhook) MUST complete before finish
- [ ]  Invoice created on driver acceptance

---

## 5. Wallet & Transaction Logs (`05-logs.e2e-spec.ts`)

### Customer Logs

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Get wallet logs | `/customer/profile/wallet-logs` | GET | `200`, array |
| 2 | Get transaction logs | `/customer/profile/transaction-logs` | GET | `200`, array |

### Driver Logs

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Get wallet logs | `/driver/profile/wallet-logs` | GET | `200`, array |
| 2 | Get transaction logs | `/driver/profile/transaction-logs` | GET | `200`, array |
| 3 | Get ride summary (default/today) | `/bookings/driver/ride-summary` | GET | `200`, returns `totalRides`, `netEarnings`, `commissionRate`, `assignments[]` |
| 4 | Get ride summary for specific date | `/bookings/driver/ride-summary?date=YYYY-MM-DD` | GET | `200`, returns summary for date |
| 5 | Get ride summary for future date | `/bookings/driver/ride-summary?date=<tomorrow>` | GET | `200`, `totalRides: 0`, `netEarnings: 0`, `assignments: []` |
| 6 | Verify commission calculation | `/bookings/driver/ride-summary` | GET | `200`, validates `netEarnings < totalAmount * totalRides` |

**Key Validation:**

- [ ]  Completed booking creates wallet log entries
- [ ]  Driver earnings credited after settlement
- [ ]  Transaction linked to booking ID
- [ ]  Ride summary returns **net earnings** after commission deduction
- [ ]  Ride summary includes **commission rate** (e.g., 0.07 for 7%)
- [ ]  Ride summary returns completed **assignments** with full booking details
- [ ]  Date defaults to **today in IST timezone** (YYYY-MM-DD format)

---

## 6. Cancellation (`06-cancellation.e2e-spec.ts`)

### Cancellation by Status

| # | Status | Endpoint | Expected | Refund | Driver Released |
| --- | --- | --- | --- | --- | --- |
| 1 | `PENDING` | `/bookings/customer/cancel/{id}` | `201`, cancelled | Full | N/A |
| 2 | `DRIVER_ASSIGNED` | `/bookings/customer/cancel/{id}` | `201`, cancelled | Full | Yes → `AVAILABLE` |
| 3 | `CONFIRMED` | `/bookings/customer/cancel/{id}` | `201`, cancelled | Partial | Yes |
| 4 | `PICKUP_ARRIVED` | `/bookings/customer/cancel/{id}` | `201`, cancelled | Partial | Yes |
| 5 | `PICKUP_VERIFIED` | `/bookings/customer/cancel/{id}` | `400 Bad Request` | None | No |

### Edge Cases

| # | Test Case | Expected |
| --- | --- | --- |
| 1 | Double cancellation | `400`, "already cancelled" |
| 2 | Cancel other's booking | `400`, "only cancel your own" |
| 3 | Cancel non-existent | `404 Not Found` |

**Key Validation:**

- [ ]  Assignment status → `AUTO_REJECTED` on cancel
- [ ]  Driver status → `AVAILABLE` on cancel
- [ ]  Cancellation reason stored
- [ ]  Cannot cancel after pickup verified

---

## 7. Realtime (`07-realtime.e2e-spec.ts`)

### State Validation (E2E)

| # | Test Case | Assertion |
| --- | --- | --- |
| 1 | Booking confirmed | `booking.status === "CONFIRMED"` |
| 2 | Driver assigned | `booking.assignedDriverId === driverId` |

### WebSocket Tests (Smoke - Requires Running Server)

| # | Test Case | Command |
| --- | --- | --- |
| 1 | Driver connects via [Socket.io](http://socket.io/) | `npm run smoke:realtime` |
| 2 | Customer receives SSE events | `npm run smoke:realtime` |

**Architecture:**

```
Driver (Socket.io) → Server → Redis Pub/Sub → Server → Customer (SSE)

```

---

## 8. Admin (`08-admin.e2e-spec.ts`)

### Authentication

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | Login success | `/admin/auth/login` | POST | `201`, returns `accessToken` |
| 2 | Login failure | `/admin/auth/login` | POST | `401 Unauthorized` |

### Flow 1: New Driver Verification

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | List pending drivers | `/admin/drivers/pending-verification` | GET | `200`, array contains pending driver |
| 2 | Verify driver | `/admin/drivers/{id}/verification` | PATCH | `200`, `status: "VERIFIED"` |
| 3 | Driver removed from list | `/admin/drivers/pending-verification` | GET | `200`, driver not in list |

### Flow 2: Pending Documents Re-upload

| # | Test Case | Endpoint | Method | Expected |
| --- | --- | --- | --- | --- |
| 1 | List pending documents | `/admin/drivers/pending-documents` | GET | `200`, array contains driver |
| 2 | Verify document | `/admin/drivers/{id}/verification` | PATCH | `200`, document status updated |
| 3 | Driver removed from list | `/admin/drivers/pending-documents` | GET | `200`, driver not in list |

**Key Validation:**

- [ ]  Admin JWT required for all `/admin/*` endpoints
- [ ]  Verification sets expiry dates (license, FC, insurance)
- [ ]  All document statuses set to `VERIFIED`

---

## 9. Integration Tests

### Redis (`test/integration/redis.spec.ts`)

| # | Test Case | Expected |
| --- | --- | --- |
| 1 | Acquire lock | Lock acquired successfully |
| 2 | Release lock | Lock released |
| 3 | Lock contention | Second attempt blocked |

**Command:** `npm run test:integration:redis`

---

## 10. Smoke Tests

### Razorpay (`test/smoke/razorpay.smoke.ts`)

| # | Test Case | Expected |
| --- | --- | --- |
| 1 | Create payment link | Returns `short_url` |
| 2 | Verify signature | Signature validation passes |

**Command:** `npm run smoke:razorpay`

### RazorpayX (`test/smoke/razorpayx.smoke.ts`)

| # | Test Case | Expected |
| --- | --- | --- |
| 1 | Create payout | Payout created successfully |

**Command:** `npm run smoke:razorpayx`

### Realtime (`test/smoke/realtime.smoke.ts`)

| # | Test Case | Expected |
| --- | --- | --- |
| 1 | Driver WebSocket connection | Connected |
| 2 | Customer SSE connection | Connected |
| 3 | Location update received | SSE receives driver location |

**Command:** `SMOKE_TESTS=true ts-node test/smoke/realtime.smoke.ts`

---

## Pre-Release Checklist

Before any release, verify:

- [ ]  `npm run test:all` - All tests pass (E2E + Integration)
- [ ]  `npm run test:smoke` - Razorpay API keys valid (staging only)
- [ ]  Manual: Create booking end-to-end on staging
- [ ]  Manual: Verify push notifications delivered
- [ ]  Manual: Verify driver location tracking on ma

---

## Coverage Summary

| Module | Test Count | Status |
| --- | --- | --- |
| Auth | 9 | ✅ Complete |
| Customer | 12 | ✅ Complete |
| Driver | 17 | ✅ Complete |
| Booking | 24 | ✅ Complete |
| Logs | 9 | ✅ Complete |
| Cancellation | 8 | ✅ Complete |
| Realtime | 2 (E2E) + 3 (Smoke) | ✅ Complete |
| Admin | 8 | ✅ Complete |
| Integration | 3 | ✅ Complete |
| **Total** | **92+** | ✅ |