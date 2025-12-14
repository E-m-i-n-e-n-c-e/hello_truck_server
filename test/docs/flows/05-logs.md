# 05 – Wallet & Transaction Logs

## Covered By
- `test/e2e/05-logs.e2e-spec.ts`

## Purpose
Verifies that wallet and transaction logs are correctly created after a completed booking with cash settlement.

---

## Preconditions
- Customer and Driver authenticated
- **Full booking completed in `beforeAll`**: Create booking → Assign → Accept → Pickup → Drop → Settle Cash → Finish
- This ensures logs exist before tests run

---

## Setup Flow (in beforeAll)

```
1. Login customer & driver
2. Create profiles, vehicle
3. Set driver VERIFIED + AVAILABLE
4. Create booking
5. Manually assign driver (via Prisma)
6. Accept assignment
7. Complete pickup flow (arrived → verify OTP)
8. Start trip
9. Complete drop flow (arrived → verify OTP)
10. Settle cash payment
11. Finish booking
```

---

## Test Cases

### Customer Logs (2 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| Get wallet logs | `GET /customer/profile/wallet-logs` | `200 OK`, returns array |
| Get transaction logs | `GET /customer/profile/transaction-logs` | `200 OK`, returns array |

### Driver Logs (3 tests)

| Test | Endpoint | Expected |
|------|----------|----------|
| Get wallet logs | `GET /driver/profile/wallet-logs` | `200 OK`, returns array |
| Get transaction logs | `GET /driver/profile/transaction-logs` | `200 OK`, returns array |
| Get ride summary | `GET /bookings/driver/ride-summary` | `200 OK`, returns summary data |

---

## Key Assertions

1. **Wallet Log Structure**: Each log contains `beforeBalance`, `afterBalance`, `amount`, `reason`.
2. **Transaction Log Structure**: Contains `type` (CREDIT/DEBIT), `category`, `bookingId` reference.
3. **Driver Earnings**: After cash settlement, driver wallet should show credit entry.
4. **Ride Summary**: Shows aggregated earnings for the day/period.

---

## Database Tables Verified
- `CustomerWalletLog` - Tracks customer wallet changes
- `DriverWalletLog` - Tracks driver wallet changes
- `Transaction` - Central ledger for all financial transactions
