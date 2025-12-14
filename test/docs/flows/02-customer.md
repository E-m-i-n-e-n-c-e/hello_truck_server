# 02 – Customer Profile & Addresses

## Covered By
- `test/e2e/02-customer.e2e-spec.ts`

## Purpose
Tests customer profile management, saved addresses (address book), and GST details for business customers.

---

## Preconditions
- Authenticated as Customer (via `loginAsCustomer` helper)
- Customer record exists with `phoneNumber` only (created during OTP verification)

---

## Test Cases

### Profile (4 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Get profile before creation | `GET /customer/profile` | - | `200 OK`, `firstName: null` |
| Create profile | `POST /customer/profile` | `{ firstName, lastName }` | `201 Created`, `{ success: true }` |
| Get profile after creation | `GET /customer/profile` | - | `200 OK`, returns `firstName`, `lastName` |
| Update profile | `PUT /customer/profile` | `{ firstName: "Updated" }` | `200 OK`, `{ success: true }` |

### Saved Addresses (5 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Create address | `POST /customer/addresses` | `{ name, contactName, contactPhone, address: { formattedAddress, latitude, longitude } }` | `201 Created`, returns address with `id` |
| Get all addresses | `GET /customer/addresses` | - | `200 OK`, returns array, length > 0 |
| Create default address | `POST /customer/addresses` | Same + `isDefault: true` | `201 Created`, `isDefault: true` |
| Update address | `PUT /customer/addresses/{id}` | `{ name: "Home Updated" }` | `200 OK`, reflects updated name |
| Delete address | `DELETE /customer/addresses/{id}` | - | `200 OK` |

### GST Details (3 tests)

| Test | Endpoint | Payload | Expected |
|------|----------|---------|----------|
| Add GST | `POST /customer/gst` | `{ gstNumber, businessName, businessAddress }` | `201 Created`, `{ success: true }` |
| Get all GST | `GET /customer/gst` | - | `200 OK`, returns array with GST details |
| Update GST | `PUT /customer/gst/{id}` | `{ businessName: "Updated Company" }` | `200 OK`, `{ success: true }` |

---

## Key Assertions

1. **Profile State**: Before `POST /customer/profile`, the customer exists but `firstName` is `null`.
2. **Address Uniqueness**: Address names must be unique per customer (`unique_name_per_customer` constraint).
3. **Default Address Logic**: Setting `isDefault: true` on a new address unsets the previous default.
4. **GST Validation**: GST numbers must follow valid format (e.g., `29ABCDE1234F1Z5`).

---

## State Passed to Next Tests
- `testState.addressId` - Created address ID
- `testState.gstId` - Created GST details ID
