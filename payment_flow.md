## Overview

This document details the complete financial lifecycle within the Hello Truck platform, covering how payments are calculated, processed, and settled. It explains the flow of money from **Customer → Platform → Driver**, including wallet operations, invoice generation, and automated daily payouts.

---

## 1. Core Concepts

### 1.1 Entities

- **Invoice**: Represents a demand for payment.
    - `ESTIMATE`: Created at booking request. Used for showing price.
    - `FINAL`: Created when a driver accepts. This is the **actable** invoice.
- **Transaction**: An immutable record of money movement (Credit/Debit) associated with a user.
- **Wallet**:
    - **Customer Wallet**: Can hold credits (refunds) or debits (cancellation charges).
    - **Driver Wallet**: Holds earnings. Net balance = `(Trip Earnings - Commission)`.
- **Payout**: A record of money transferred from Platform to Driver bank account.

### 1.2 Services

- `BookingInvoiceService`: Calculates prices, applies wallet rules, generates Invoices.
- `BookingPaymentService`: Handles payment success (webhooks), cash settlement, and refunds.
- `BookingDriverService`: Handles ride completion and driver earning calculations.
- `PayoutService`: (Cron) Automates daily transfers to drivers.

---

## 2. Customer Payment Lifecycle

The customer payment flow is tightly integrated with the [Booking Lifecycle](https://www.notion.so/booking_flow.md).

### Phase 1: Estimation & Booking Request

- **Trigger**: Customer requests a booking.
- **Action**: `BookingInvoiceService.createEstimateInvoice`
- **Logic**:
    1. Calculates `Ideal Price` based on distance & weight.
    2. Checks Customer Wallet:
        - **Positive Balance**: Deducts from estimate (shown as discount).
        - **Negative Balance**: Adds to estimate (shown as arrears).
    3. Creates `ESTIMATE` Invoice.

### Phase 2: Driver Acceptance (The Contract)

- **Trigger**: Driver accepts the booking request.
- **Action**: `BookingInvoiceService.createFinalInvoice`
- **Logic**:
    1. Re-calculates price using the **Driver's Actual Vehicle** pricing (may differ slightly from ideal).
    2. **Wallet Application (Locking)**:
        - The system typically "locks" or applies the wallet balance at this stage.
        - Customer wallet is updated (Debited/Credited) to reflect the application.
        - A `CustomerWalletLog` is created.
    3. **Payment Link Generation**:
        - If `finalAmount > 0`, a Razorpay Payment Link is generated.
        - Link is stored in the `FINAL` invoice.
    4. **Invoice Status**: Created as `isPaid: false` (unless fully covered by wallet).

### Phase 3: Payment

- **Scenario A: Online Payment**
    1. Customer pays via App/Link.
    2. Razorpay Webhook hits `BookingPaymentService.handlePaymentSuccess`.
    3. **Lookup**: Finds invoice using `rzpPaymentLinkId` (source of truth).
    4. **Verify**: Checks signature and amount.
    5. **Update**: Marks Invoice as `isPaid: true`.
    6. **Record**: Creates a `DEBIT` Transaction for the customer (Money Out).
    7. **Notify**: Sends success notification to Customer & Driver.
- **Scenario B: Cash Payment**
    1. Driver collects cash at drop-off.
    2. Driver clicks "Settle Cash" in app.
    3. **Action**: `BookingDriverService.settleWithCash` delegates to `PaymentService`.
    4. **Update**: Marks Invoice as `isPaid: true`, `paymentMethod: CASH`.
    5. **Record**: Creates a `DEBIT` Transaction (Money Out).
    6. **Cancel Payment Link**: If payment link exists, it's cancelled asynchronously.

---

## 3. Driver Earning & Payout Lifecycle

The driver flow involves commission deduction and delayed payout (T+1 or daily).

### Phase 1: Ride Completion

- **Trigger**: Driver completes the ride (`BookingDriverService.finishRide`).
- **Pre-requisite**: Invoice must be `PAID`.
- **Calculation**:
    - `Total Fare`: Invoice Amount.
    - `Commission`: `Total Fare * COMMISSION_RATE` (Configurable).
    - `Driver Earnings`: `Total Fare - Commission`.

### Phase 2: Wallet Update (Instant)

- **Scenario A: Online Payment (Platform holds money)**
    - **Logic**: Platform owes driver.
    - **Action**: `Driver Wallet += Driver Earnings`.
    - **Log**: "Earnings from Booking #123".
- **Scenario B: Cash Payment (Driver holds money)**
    - **Logic**: Driver owes Platform commission.
    - **Action**: `Driver Wallet -= Commission`.
    - **Log**: "Commission for cash payment #123".
    - *Note: This often results in a negative wallet balance if the driver hasn't done online rides.*

### Phase 3: Daily Settlement (Cron)

- **Trigger**: Daily scheduled job (`PayoutService.processDailyPayouts`).
- **Logic**:
    1. Finds all drivers with `Wallet Balance > 0`.
    2. Ignores negative balances (Driver owes platform - settled via future earnings).
    3. **RazorpayX API**: Creates a Payout Request (IMPS/UPI).
    4. **Transaction**:
        - Creates `CREDIT` transaction for Driver (Money In).
        - Sets `Driver Wallet = 0`.
    5. **Record**: Creates `Payout` entity with status `PROCESSING`.

---

## 4. Refund & Cancellation Flow

Handled by `BookingRefundService`.

### Rules

1.  **Pending/Driver Assigned**: 100% Refund (No Charges).
2.  **Confirmed/Pickup Arrived**: **Time-Based Cancellation Charge**.
    - **Min Charge**: `CANCELLATION_MIN_CHARGE_PERCENT` (e.g., 10%).
    - **Max Charge**: `CANCELLATION_MAX_CHARGE_PERCENT` (e.g., 50%).
    - **Growth**: Increases by `CANCELLATION_CHARGE_INCREMENT_PER_MINUTE` (e.g., 1%) every minute after driver acceptance.
    - *Example*: Cancelled 5 mins after acceptance = 10% base + (5 * 1%) = 15% charge.
3.  **In Transit/Completed**: No Refund allowed.

### Execution

1.  **Refund Intent**:
    - A `RefundIntent` record is created to track the process.
    - Stores `wasPaid` status to handle unpaid invoice cancellations properly.

2.  **Customer Handover**:
    - **Paid Booking**: Refund = `Total Paid - Cancellation Charge`.
        - Wallet portion returned to Wallet.
        - Online portion refunded via Razorpay.
    - **Unpaid Booking**:
        - `Cancellation Charge` is **deducted** from Customer Wallet (Debit).

3.  **Driver Compensation**:
    - If cancellation charge applies:
        - `Net Compensation` = `Cancellation Charge - Platform Commission` (e.g., charge - 7%).
        - `Driver Wallet += Net Compensation`.
    - Platform retains both the **commission on the charge** and the remaining **cancellation fee revenue**.

---

## 5. Database Schema Reference

### `Invoice`

| Field | Description |
| --- | --- |
| `type` | `ESTIMATE` or `FINAL` |
| `finalAmount` | The actual money to be paid (Net of wallet) |
| `walletApplied` | Amount covered by wallet balance |
| `rzpPaymentLinkId` | **Source of truth** for payment link lookups (unique identifier from Razorpay) |
| `paymentLinkUrl` | Customer-facing payment link URL |
| `rzpPaymentId` | Razorpay payment ID (set after successful payment) |

### `Transaction`

| Field | Description |
| --- | --- |
| `type` | `CREDIT` (Money in) or `DEBIT` (Money out) |
| `category` | `BOOKING_PAYMENT`, `DRIVER_PAYOUT`, `REFUND` |
| `amount` | Absolute value |

### `Payout`

| Field | Description |
| --- | --- |
| `status` | `PROCESSING`, `PROCESSED`, `FAILED` |
| `razorpayPayoutId` | Reference to RazorpayX ID |

### `RefundIntent`

| Field | Description |
| --- | --- |
| `wasPaid` | Snapshot of invoice payment status (`true`/`false`) at creation |
| `walletRefundAmount` | Amount to create back to wallet |
| `cancellationCharge` | Amount retained or deducted (if unpaid) |
| `status` | `PENDING`, `COMPLETED`, `FAILED`, `NOT_REQUIRED` |

![payment_state_machine_1765714415999.png](attachment:31a0dcef-cb8b-4204-b1a2-156bf6fdc917:payment_state_machine_1765714415999.png)