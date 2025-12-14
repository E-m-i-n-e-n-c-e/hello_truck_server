# 01 – Authentication Flow

## Covered By
- `test/e2e/01-auth.e2e-spec.ts`

## Purpose
Verifies OTP-based authentication for both Customers and Drivers, including the complete token lifecycle.

---

## Preconditions
- Database is clean/seeded
- `123456` is the hardcoded OTP in test mode (`NODE_ENV=test`)

---

## Test Cases

### Customer Auth (5 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| Send OTP | `POST /auth/customer/send-otp` | `200 OK`, `{ success: true }` |
| Verify OTP | `POST /auth/customer/verify-otp` | `200 OK`, returns `accessToken` + `refreshToken` |
| Invalid OTP | `POST /auth/customer/verify-otp` with `000000` | `400 Bad Request` |
| Refresh Token | `POST /auth/customer/refresh-token` | `200 OK`, returns new `accessToken` |
| Logout | `POST /auth/customer/logout` | `200 OK`, invalidates session |

### Driver Auth (4 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| Send OTP | `POST /auth/driver/send-otp` | `200 OK`, `{ success: true }` |
| Verify OTP | `POST /auth/driver/verify-otp` | `200 OK`, returns `accessToken` + `refreshToken` |
| Invalid OTP | `POST /auth/driver/verify-otp` with `000000` | `400 Bad Request` |
| Logout | `POST /auth/driver/logout` | `200 OK`, invalidates session |

---

## Key Assertions

1. **Token Generation**: Both `accessToken` and `refreshToken` must be defined after successful OTP verification.
2. **Auto-Signup**: Verifying OTP for a new phone number automatically creates a User record.
3. **Token Refresh**: Using a valid `refreshToken` returns a new `accessToken`.
4. **Session Invalidation**: After logout, the refresh token is no longer valid.

---

## State Passed to Next Tests
- `testState.customerPhone` - Customer phone number
- `testState.customerToken` - Customer access token
- `testState.driverPhone` - Driver phone number
- `testState.driverToken` - Driver access token
