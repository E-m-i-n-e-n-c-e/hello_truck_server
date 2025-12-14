# 01 – Authentication Flow

## Covered By
- `test/e2e/01-auth.e2e-spec.ts`

## Purpose
Verifies the OTP-based authentication flow for both Customers and Drivers, including token management (lifecycle, refresh, logout).

---

## Preconditions
- Database is clean (or has existing users for login scenarios)
- `123456` is the hardcoded OTP in development/test mode

---

## Auth Rules

### 1. Send OTP
✅ Allowed
- Valid phone number (10 digits)
- Returns `201 Created`
- Triggers SMS (Mocked)

### 2. Verify OTP
✅ Allowed
- Valid phone + Correct OTP
- Returns `accessToken` & `refreshToken`
- Creates user if not exists (Auto-signup)

❌ Not Allowed
- Invalid OTP → `400 Bad Request`

### 3. Refresh Token
✅ Allowed
- Valid `refreshToken` in body
- Returns new `accessToken`

❌ Not Allowed
- Expired/Invalid token → `401 Unauthorized`

### 4. Logout
✅ Allowed
- Authenticated user
- Invalidates current tokens

---

## Side Effects
- `User` record created (if new)
- `RefreshToken` stored in DB (hashed)
- Access logs (optional)

---

## Notes
- Drivers and Customers use separate endpoints (`/auth/customer/*` vs `/auth/driver/*`) but share logic.
