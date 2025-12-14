# QA Strategy Document

## Overview

This document outlines the Quality Assurance (QA) strategy for the **Hello Truck** backend server. It details the implemented testing layers, coverage expectations, and the process for validating new features and releases.

## 1. Testing Pyramid

We adhere to a pragmatic testing pyramid:

1.  **E2E Tests (Base Layer - Highest Volume)**
    *   **Focus:** API Contracts, Business Logic Flows, Database Consistency, Error Handling.
    *   **Environment:** Verified in CI/CD chains using mocked external services.
    *   **Mocked Services:** Razorpay, Firebase, Redis (Pub/Sub).
2.  **Integration Tests (Middle Layer)**
    *   **Focus:** Correct integration with infrastructure (e.g., proper locking mechanisms in Redis).
    *   **Environment:** Running dependencies required.
3.  **Smoke Tests (Top Layer - Manual/Staging)**
    *   **Focus:** End-to-end verification with REAL external services.
    *   **Use Case:** Pre-release verification to ensure API keys and network connectivity are valid.

## 2. Test Coverage & Scenarios

### A. Authentication Module (`test/e2e/01-auth.e2e-spec.ts`)
| Scenario | Status | Notes |
| :--- | :--- | :--- |
| Customer OTP Request | ✅ Covered | |
| Customer Login/Verify | ✅ Covered | Returns Access & Refresh Tokens |
| Driver OTP Request | ✅ Covered | |
| Driver Login/Verify | ✅ Covered | |
| Token Refresh | ✅ Covered | Verifies rotation logic |
| Logout | ✅ Covered | Ensures token invalidation |
| Invalid OTP/Expired Token | ✅ Covered | Error handling check |

### B. Customer Module (`test/e2e/02-customer.e2e-spec.ts`)
| Scenario | Status | Notes |
| :--- | :--- | :--- |
| Create Profile | ✅ Covered | |
| Update Profile (Info/FCM) | ✅ Covered | |
| Manage Addresses (CRUD) | ✅ Covered | Default address logic tested |
| Manage GST Details | ✅ Covered | create, deactivate, reactivate |

### C. Driver Module (`test/e2e/03-driver.e2e-spec.ts`)
| Scenario | Status | Notes |
| :--- | :--- | :--- |
| Create Profile | ✅ Covered | |
| Vehicle Management | ✅ Covered | Models, Body Types, Capacity |
| **Document Upload** | ✅ Covered | Mocked Signed URL generation |
| **Verification Logic** | ✅ Covered | Driver status transitions (PENDING -> VERIFIED) |

### D. Booking Lifecycle (`test/e2e/04-booking.e2e-spec.ts`)
This is the **critical path** of the application.

| Stage | Scenario | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Estimation** | Get Estimates | ✅ Covered | Validates pricing logic, vehicle selection |
| **Creation** | Create Booking | ✅ Covered | Verifies PENDING status, Wallet handling |
| **Assignment** | Assign Driver | ✅ Covered | Manual assignment simulation for test stability |
| **Acceptance** | Driver Accept | ✅ Covered | Confirms Booking, Generates Payment Link (Mock) |
| **Execution** | Pickup Flow | ✅ Covered | Arrived -> Verified (OTP) -> In Transit |
| **Execution** | Drop Flow | ✅ Covered | Arrived -> Verified (OTP) -> Completed |
| **Payment** | Webhook | ✅ Covered | Simulates `payment_link.paid` event from Razorpay |

### E. Financials & Logs (`test/e2e/05-logs.e2e-spec.ts`)
| Scenario | Status | Notes |
| :--- | :--- | :--- |
| Customer Wallet Logs | ✅ Covered | Verifies debits for bookings |
| Driver Wallet Logs | ✅ Covered | Verifies credits (earnings) |
| Transaction Logs | ✅ Covered | Verifies audit trail of payments |

### F. Cancellation & Refunds (`test/e2e/06-cancellation.e2e-spec.ts`)
| Scenario | Rule | Status |
| :--- | :--- | :--- |
| Cancel @ PENDING | Full Refund | ✅ Covered |
| Cancel @ DRIVER_ASSIGNED | Full Refund | ✅ Covered |
| Cancel @ CONFIRMED | Partial Refund | ✅ Covered |
| Cancel @ PICKUP_ARRIVED | Partial Refund | ✅ Covered |
| Cancel @ PICKUP_VERIFIED | **Blocked** | ✅ Covered |
| Idempotency | Reject Duplicate | ✅ Covered |

### G. Realtime Updates (`test/e2e/07-realtime.e2e-spec.ts`)
| Scenario | Status | Notes |
| :--- | :--- | :--- |
| Driver Location Update | ✅ Covered | Uses `InMemoryBus` to check SSE emission |
| Customer Receives SSE | ✅ Covered | Verifies event payload structure |

---

## 3. QA Workflows

### Manual / Exploratory Testing
While automation covers happy paths and known edge cases, manual testing is recommended for:
1.  **UI/UX Flows:** Using the mobile app to verify animations and user feedback.
2.  **Notification Delivery:** Verifying push notifications actually reach the device (using Smoke scripts).
3.  **GPS Accuracy:** Real-world drive testing to verify distance calculations.

### Pre-Release Checklist
1.  [ ] Run full E2E Suite: `npm run test:e2e` (Must be Green)
2.  [ ] Run Redis Integration: `npm run test:integration:redis`
3.  [ ] **Staging Only:** Run Razorpay Smoke Test to verify API keys: `npm run smoke:razorpay`
4.  [ ] **Staging Only:** Run Realtime Smoke Test to verify Redis Pub/Sub: `npm run smoke:realtime`

## 4. Reporting Bugs

When reporting a bug found during manual QA that wasn't caught by automation:
1.  **Isolate the Scenario:** Can it be reproduced with `curl` or Postman?
2.  **Check Logs:** Look for server-side exceptions (using the `test:e2e:logs` approach).
3.  **Write a Repro Test:** Before fixing, write a failing E2E test case in the relevant file.
4.  **Fix & Verify:** Implement the fix and ensure the new test passes.
