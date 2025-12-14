# 08 – Admin Flow

## Covered By
- `test/e2e/08-admin.e2e-spec.ts`

## Purpose
Tests admin authentication and the driver verification workflow, including both new driver verification and document re-verification.

---

## Preconditions
- Environment variables set (defaults in `jest-setup.ts`):
  - `ADMIN_USERNAME` (default: `admin`)
  - `ADMIN_PASSWORD` (default: `admin123`)
  - `ADMIN_JWT_SECRET` (default: `supersecretkey`)

---

## Setup (in beforeAll)

**Driver 1 - Pending Verification:**
```javascript
{
  phoneNumber: unique,
  verificationStatus: 'PENDING',
  documents: {
    licenseUrl, rcBookUrl, fcUrl, insuranceUrl, aadharUrl, panNumber, ebBillUrl
  }
}
```

**Driver 2 - Pending Documents (Re-upload):**
```javascript
{
  phoneNumber: unique,
  verificationStatus: 'VERIFIED',
  documents: {
    licenseStatus: 'PENDING',  // <-- This triggers "pending docs"
    fcStatus: 'VERIFIED',
    insuranceStatus: 'VERIFIED',
    // ... other fields
  }
}
```

---

## Test Cases

### Admin Authentication (2 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Login success | `POST /admin/auth/login` | `{ username, password }` | `201 Created`, returns `accessToken` |
| Login failure | `POST /admin/auth/login` | Invalid credentials | `401 Unauthorized` |

### Flow 1: New Driver Verification (3 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| List pending drivers | `GET /admin/drivers/pending-verification` | `200 OK`, array contains pending driver, includes `documents.licenseUrl` |
| Verify driver | `PATCH /admin/drivers/{id}/verification` | `200 OK`, driver `verificationStatus: "VERIFIED"`, document statuses updated |
| Removed from pending | `GET /admin/drivers/pending-verification` | `200 OK`, driver no longer in list |

**Verify Request Payload:**
```json
{
  "status": "VERIFIED",
  "licenseExpiry": "2025-12-14T...",
  "fcExpiry": "2025-12-14T...",
  "insuranceExpiry": "2025-12-14T..."
}
```

### Flow 2: Pending Documents Re-upload (3 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| List pending documents | `GET /admin/drivers/pending-documents` | `200 OK`, array contains driver with pending doc |
| Verify document | `PATCH /admin/drivers/{id}/verification` | `200 OK`, `licenseStatus: "VERIFIED"`, `licenseExpiry` updated |
| Removed from pending | `GET /admin/drivers/pending-documents` | `200 OK`, driver no longer in list |

---

## Admin Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/auth/login` | Authenticate admin |
| `GET` | `/admin/drivers/pending-verification` | List drivers with `verificationStatus: PENDING` |
| `GET` | `/admin/drivers/pending-documents` | List verified drivers with pending document status |
| `GET` | `/admin/drivers/{id}` | Get driver details |
| `PATCH` | `/admin/drivers/{id}/verification` | Update verification status and document expiry dates |

---

## Key Assertions

1. **JWT Authentication**: Admin endpoints require `Authorization: Bearer {token}`.
2. **Document Statuses**: When verifying, all document statuses (license, FC, insurance) are set to `VERIFIED`.
3. **Expiry Dates**: Verification sets `licenseExpiry`, `fcExpiry`, `insuranceExpiry` on documents.
4. **List Filtering**: `/pending-verification` and `/pending-documents` are mutually exclusive lists.

---

## Database Updates on Verification

```sql
-- Driver table
UPDATE Driver SET verificationStatus = 'VERIFIED' WHERE id = ?;

-- DriverDocuments table
UPDATE DriverDocuments SET 
  licenseStatus = 'VERIFIED',
  fcStatus = 'VERIFIED',
  insuranceStatus = 'VERIFIED',
  licenseExpiry = ?,
  fcExpiry = ?,
  insuranceExpiry = ?
WHERE driverId = ?;
```
