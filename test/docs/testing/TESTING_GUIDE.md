# Testing Guide

This project follows a rigorous testing strategy comprising **End-to-End (E2E)**, **Integration**, and **Smoke** tests. This guide explains how to run, write, and debug tests.

## 1. Prerequisites

Ensure you have the following services running or configured:
- **Postgres Database:** Used for E2E tests (configured to use `hello_truck_test` by default).
- **Redis:** Required for Integration and Smoke tests (mocked in E2E).

## 2. Test Types

### A. End-to-End (E2E) Tests
**Location:** `test/e2e`
**Goal:** Verify the system flows from the user's perspective (HTTP requests), including database side-effects.
**Key Features:**
- **Mocked External Services:** Firebase, Razorpay, and Redis Pub/Sub are mocked to ensure stability and CI/CD compatibility.
- **Sequential Execution:** Tests share state (tokens, IDs) via `test/setup/shared-state.ts` to simulate a real usage journey (Auth -> Profile -> Booking).
- **Database Reset:** The database is cleaned before the suite starts.

**Running E2E Tests:**
```bash
# Run all E2E tests sequentially
npm run test:e2e

# Run specific suites
npm run test:e2e:auth       # Auth flow
npm run test:e2e:customer   # Customer profile/addresses
npm run test:e2e:driver     # Driver profile/vehicle/docs
npm run test:e2e:booking    # Full booking lifecycle
npm run test:e2e:cancel     # Cancellation scenarios
npm run test:e2e:realtime   # Socket/SSE flow (mocked)
```

### B. Integration Tests
**Location:** `test/integration`
**Goal:** Verify interaction with infrastructure dependencies that are difficult to mock perfectly (e.g., Redis).
**Status:** These tests run against REAL instances of infrastructure.

**Running Integration Tests:**
```bash
npm run test:integration:redis
```

### C. Smoke Tests
**Location:** `test/smoke`
**Goal:** Verify critical paths manually or in a staging environment against REAL third-party services.
**Warning:** These tests may incur costs (Razorpay) or send real notifications (Firebase).

**Running Smoke Tests:**
```bash
# Run all smoke tests sequentially
npm run test:smoke

# Run specific tests
npm run smoke:razorpay
npm run smoke:razorpayx
npm run smoke:realtime
```

## 3. Writing Tests

### Authenticating Users
Use the `auth-helper` to login quickly and get tokens.

```typescript
import { loginAsCustomer, loginAsDriver } from '../setup/auth-helper';

// Inside beforeAll
const { accessToken, userId } = await loginAsCustomer(app, '9988776655');
```

### Using Factories
Use factories to create database entities quickly without repetitive code.
**Location:** `test/factories/index.ts`

```typescript
import { createBookingRequestDto, createDriverDto } from '../factories';

// Create DTO for HTTP request
const bookingData = createBookingRequestDto();

// Create entity directly in DB (if prisma is available)
const driver = await prisma.driver.create({
  data: createDriverDto({ phone: '8877665544' })
});
```

### Sharing State
If you need to pass data (like a `bookingId` created in one test to a cancellation test), use `test/setup/shared-state.ts`.

```typescript
// Test A
import { testState } from '../setup/shared-state';
testState.bookingId = response.body.id;

// Test B
import { testState } from '../setup/shared-state';
const res = await request(app).get(`/bookings/${testState.bookingId}`);
```

## 4. Debugging

**Logs:**
The test app is configured to reduce noise. `InMemoryBus` and mocked services will log to console.

**Common Issues:**
- **"Connection is closed"**: Usually happens if a background job uses a real Redis connection while the test suite is tearing down. Ensure `AssignmentService` or other workers are properly mocked in `test/setup/test-app.ts`.
- **401 Unauthorized**: Check if your token is expired or if you are using the correct header: `.set('Authorization', \`Bearer ${token}\`)`.

## 5. Adding New Tests

1.  **Identify the Scope:**
    *   **Logic/Flow?** -> E2E
    *   **Infrastructure?** -> Integration
    *   **3rd Party API?** -> Smoke
2.  **Create File:** Follow the naming convention `test/e2e/XX-feature.e2e-spec.ts`.
3.  **Register Script:** Add a shortcut in `package.json` for easy execution.
