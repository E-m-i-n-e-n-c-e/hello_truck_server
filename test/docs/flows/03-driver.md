# 03 – Driver Profile & Vehicle

## Covered By
- `test/e2e/03-driver.e2e-spec.ts`

## Purpose
Tests driver onboarding flow: profile creation, vehicle registration, document uploads, and address management.

---

## Preconditions
- Authenticated as Driver (via `loginAsDriver` helper)
- Driver record exists with `phoneNumber` only (created during OTP verification)

---

## Test Cases

### Profile (7 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Get profile before creation | `GET /driver/profile` | - | `200 OK`, `firstName: null` |
| Create profile | `POST /driver/profile` | `{ firstName, lastName, documents: {...} }` | `201 Created`, `{ success: true, message: "Profile created successfully" }` |
| Get profile after creation | `GET /driver/profile` | - | `200 OK`, returns `firstName`, `lastName`, `id` |
| Update profile | `PUT /driver/profile` | `{ firstName: "Updated Driver" }` | `200 OK`, `{ success: true }` |
| Verify update | `GET /driver/profile` | - | `200 OK`, `firstName: "Updated Driver"` |
| Update status | `PUT /driver/profile/status` | `{ status: "AVAILABLE" }` | `200 OK`, `{ success: true }` |
| Verify status | `GET /driver/profile` | - | `200 OK`, `driverStatus: "AVAILABLE"` |

### Vehicle (4 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Get vehicle models | `GET /driver/vehicle/models` | - | `200 OK`, returns array of available models |
| Add vehicle | `POST /driver/vehicle` | `{ vehicleNumber, vehicleType, vehicleModelName, vehicleBodyLength, vehicleBodyType, fuelType, vehicleImageUrl }` | `201 Created`, returns vehicle with `vehicleNumber` |
| Get vehicle | `GET /driver/vehicle` | - | `200 OK`, returns vehicle details |
| Update vehicle | `PUT /driver/vehicle` | `{ vehicleBodyType: "OPEN" }` | `200 OK`, reflects updated body type |

### Documents (3 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Get documents | `GET /driver/documents` | - | `200 OK`, returns all document URLs and `panNumber` |
| Update documents | `PUT /driver/documents` | `{ licenseUrl: "..." }` | `200 OK`, reflects updated URL |
| Get upload URL | `GET /driver/documents/upload-url` | Query: `filePath`, `type` | `200 OK`, returns `signedUrl` + `publicUrl` |

### Address (3 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Create address | `POST /driver/address` | `{ addressLine1, pincode, city, district, state }` | `201 Created`, returns address |
| Get address | `GET /driver/address` | - | `200 OK`, returns address details |
| Update address | `PUT /driver/address` | `{ city: "Secunderabad" }` | `200 OK`, reflects updated city |

---

## Key Assertions

1. **Profile Creation**: Requires `documents` object with all URLs (license, RC, FC, insurance, aadhar, panNumber, ebBill).
2. **Vehicle Models**: System has seeded vehicle models (e.g., "Tata Ace") with pricing data.
3. **Status Toggle**: Driver can switch between `AVAILABLE` and `UNAVAILABLE`.
4. **Upload URL**: Returns Firebase signed URL for direct client uploads.

---

## State Passed to Next Tests
- `testState.driverId` - Created driver ID
- `testState.driverToken` - Driver access token
