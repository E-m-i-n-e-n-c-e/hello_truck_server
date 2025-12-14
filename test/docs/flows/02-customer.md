# 02 – Customer Profile & Addresses

## Covered By
- `test/e2e/02-customer.e2e-spec.ts`

## Purpose
Manages the customer's personal information, FCM tokens for notifications, and saved locations (addresses).

---

## Preconditions
- Authenticated as Customer

---

## Rules

### 1. Profile Management
- **Create**: Required fields: `firstName`, `lastName`.
- **Get**: Returns profile + wallet balance.
- **Update**: Can update name, email.
- **FCM**: Can update device token for push notifications.

### 2. Address Book
- **Create**: Requires `formattedAddress`, `lat`, `lng`.
- **Default Address**: Setting `isDefault: true` on a new/existing address automatically unsets the previous default.
- **Delete**: Soft deletes or hard deletes depending on implementation (E2E verifies removal from list).

### 3. GST Details
- **Manage**: Add/Update GST number for tax invoicing.
- **Toggle**: Can deactivate/reactivate GST profiles.

---

## Side Effects
- `Customer` table updated.
- `Address` table rows created/updated.
- `CustomerGst` table rows managed.

---

## Notes
- Profile must exist before booking can be made.
