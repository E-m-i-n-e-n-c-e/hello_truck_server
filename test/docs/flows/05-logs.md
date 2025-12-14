# 05 – Financial & Activity Logs

## Covered By
- `test/e2e/05-logs.e2e-spec.ts`

## Purpose
Verifies the audit trail for wallets and payments for both Customers and Drivers.

---

## Preconditions
- A Booking has been completed (paid/settled).
- Customer wallet used (optional but tested).
- Driver earned commission.

---

## Log Types

### 1. Customer Logs
- **Wallet Logs**: Tracks credits/debits to the internal wallet.
    - Type: `DEBIT` (Booking payment/Penalty) or `CREDIT` (Refund/Top-up).
- **Transaction Logs**: Tracks external payment events.
    - Category: `BOOKING_PAYMENT`.

### 2. Driver Logs
- **Wallet Logs**: Tracks earnings.
    - Type: `CREDIT` (Ride earnings) or `DEBIT` (Commission/Penalty).
- **Transaction Logs**: Tracks cash settlements or online payouts.

---

## Rules
- Every successful booking MUST create:
    1.  Driver Credit (Wallet Log)
    2.  Customer Debit (Wallet Log - if wallet used)
    3.  Transaction Record linked to Booking

---

## Notes
- Logs are immutable.
- Used for "History" and "Passbook" screens in the apps.
