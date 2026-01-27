# Refund and Support Flow Documentation

This document describes the admin-initiated refund workflow and customer support processes in the Hello Truck Admin Portal.

---

## Overview

The admin portal provides two types of refund mechanisms:
1. **Internal Refunds**: Automatic refunds when customers cancel bookings (handled by booking service)
2. **Admin Refunds**: Manual refunds initiated by support staff for special cases

This document focuses on **Admin Refunds** - the manual refund process with approval workflow, buffer window, and quality control.

### Key Features
- **Two-Level Approval**: Agent creates, Admin approves
- **Buffer Window**: 1-hour safety window before processing
- **Revert Mechanism**: Quality control through revert requests
- **Evidence Documentation**: Photo/document evidence required
- **Proportional Refund**: Handles wallet + Razorpay refunds with cancellation charges
- **Audit Trail**: Complete history of all refund actions

---

## Refund Types Comparison

### Internal Refunds (Automatic)
- **Trigger**: Customer cancels booking via app
- **Who**: System (automatic)
- **Approval**: Not required
- **Processing**: Immediate (after buffer if applicable)
- **Status**: Tracked in `RefundIntent` table
- `isApproved`: `true` (default)

### Admin Refunds (Manual)
- **Trigger**: Support staff creates refund request
- **Who**: AGENT, CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN
- **Approval**: Required (ADMIN or SUPER_ADMIN)
- **Processing**: After approval + 1-hour buffer
- **Status**: Tracked in `AdminRefundRequest` table
- `isApproved`: `false` until approved

---

## Admin Refund Lifecycle

### Status Flow

```
PENDING
   ↓
[Admin reviews request]
   ↓
APPROVED (Buffer starts - 1 hour)
   ↓
[Buffer window - revert possible]
   ↓
COMPLETED (Refund processed)
```

**Alternative Paths**:
- `PENDING` → `REJECTED` (Request denied)
- `APPROVED` → `REVERT_REQUESTED` → `REVERTED` → `PENDING` (Quality control)
- `APPROVED` → `REVERT_REQUESTED` → `APPROVED` (Revert rejected)

---

## Detailed Workflow

### Phase 1: Refund Request Creation

**Who Can Create**: AGENT, CUSTOMER_SUPPORT, ADMIN, SUPER_ADMIN

**When to Create**:
- Customer complaint about service quality
- Driver misconduct
- System errors causing overcharge
- Booking issues not covered by automatic refunds
- Goodwill gestures
- Compensation for delays or problems

**Required Information**:
- `bookingId`: Booking to refund
- `customerId`: Customer receiving refund
- `driverId`: Driver involved (optional)
- `amount`: Refund amount (must be ≤ booking total)
- `reason`: Detailed refund reason
- `phoneNumber`: Contact number for follow-up
- `notes`: Additional context (optional)
- `evidenceUrls`: Array of evidence file URLs (screenshots, photos, etc.)

**Endpoint**: `POST /admin-api/refunds`

**Validation**:
- Booking must exist and be completed/cancelled
- Amount must be positive and ≤ booking total
- Customer must match booking customer
- Evidence URLs must be valid
- Reason must be descriptive (min 10 characters)

**Status After Creation**: `PENDING`

---

### Phase 2: Review and Approval

**Who Can Approve**: ADMIN, SUPER_ADMIN only

**Review Process**:
1. Admin views refund request details
2. Reviews evidence (photos, screenshots, chat logs)
3. Verifies booking details and payment history
4. Checks customer history for patterns
5. Validates refund amount calculation
6. Makes decision: Approve or Reject

**Approval**:
- Endpoint: `POST /admin-api/refunds/:id/approve`
- Status changes to `APPROVED`
- Buffer window starts (1 hour)
- `bufferExpiresAt` timestamp set
- `approvedAt` timestamp set
- `approvedById` set to admin user ID

**Rejection**:
- Endpoint: `POST /admin-api/refunds/:id/reject`
- Required: `reason` (min 10 characters)
- Status changes to `REJECTED`
- Customer notified (if applicable)
- No further action

---

### Phase 3: Buffer Window (1 Hour)

**Purpose**: Quality control and error correction window

**Duration**: 60 minutes (configurable via `ADMIN_BUFFER_DURATION_MINUTES`)

**During Buffer**:
- Refund status: `APPROVED`
- RefundIntent: **Not yet created**
- Money: **Not yet refunded**
- Revert requests: **Allowed**

**Why Buffer?**:
- Allows time to catch approval errors
- Enables senior admin review
- Prevents immediate processing of potentially fraudulent refunds
- Provides window for additional investigation

**Important**: No actual refund processing happens during buffer

---

### Phase 4: Finalization and Processing

**When**: Buffer expires (after 1 hour)

**Process** (Automatic via Cron Job):

1. **Create RefundIntent**:
   - `walletRefundAmount`: Calculated based on wallet usage
   - `razorpayRefundAmount`: Calculated based on online payment
   - `cancellationCharge`: Deducted proportionally
   - `isApproved`: `true`
   - `status`: `PENDING`

2. **Process Refund** (Async):
   - Wallet refund: Immediate credit to customer wallet
   - Razorpay refund: API call to Razorpay (if applicable)
   - Transaction logs created
   - Customer wallet logs updated

3. **Update Status**:
   - AdminRefundRequest status: `COMPLETED`
   - `completedAt` timestamp set
   - `refundIntentId` linked

4. **Notify Customer**:
   - FCM notification sent
   - Refund details included

**Endpoint**: Automatic (cron job)

**Refund Calculation**:
```typescript
// Example: Booking total = ₹1000, Wallet = ₹300, Razorpay = ₹700, Cancellation = ₹100

totalPaid = walletApplied + razorpayPaid // ₹1000
walletShare = (cancellationCharge × walletApplied) / totalPaid // ₹30
razorpayShare = (cancellationCharge × razorpayPaid) / totalPaid // ₹70

walletRefund = walletApplied - walletShare // ₹270
razorpayRefund = razorpayPaid - razorpayShare // ₹630
```

---

## Revert Mechanism

### Purpose
Quality control mechanism to catch errors after approval but before processing

### Who Can Request Revert
- AGENT
- ADMIN
- SUPER_ADMIN

### When Revert is Possible
- Only during buffer window (`APPROVED` status)
- Before `bufferExpiresAt` timestamp

### Revert Request Process

1. **Request Revert**
   - Endpoint: `POST /admin-api/refunds/:id/revert-request`
   - Required: `reason` (min 10 characters)
   - Status changes to `REVERT_REQUESTED`
   - Buffer finalization is **paused**

2. **Admin Decision**
   - Who: ADMIN or SUPER_ADMIN only
   - Endpoint: `POST /admin-api/refunds/:id/revert-decision`
   - Options:
     - **Approve Revert**: Refund reverts to `PENDING`
     - **Reject Revert**: Refund returns to `APPROVED`

### Revert Approval Effects
- Refund status: `REVERTED` → `PENDING`
- Buffer expiry: Cleared
- Approval details: Cleared
- Must be re-reviewed and re-approved

### Revert Rejection Effects
- Refund status: Returns to `APPROVED`
- Buffer window: Does **not** resume (must re-approve)
- Revert details: Cleared

---

## Support Notes System

### Purpose
Document customer interactions, investigations, and decisions

### Who Can Add Notes
All admin roles (SUPER_ADMIN, ADMIN, AGENT, FIELD_AGENT, CUSTOMER_SUPPORT)

### When to Add Notes
- Customer calls/emails about booking
- Investigation findings
- Decision rationale
- Follow-up actions
- Resolution details

### Note Structure
- `bookingId`: Associated booking
- `agentId`: User who added note
- `agentName`: User's full name (denormalized)
- `note`: Note content
- `createdAt`: Timestamp

### Endpoints
- **Add Note**: `POST /admin-api/support/bookings/:bookingId/notes`
- **View Notes**: `GET /admin-api/support/bookings/:bookingId/notes`

### Best Practices
- Be detailed and specific
- Include timestamps for customer interactions
- Document evidence reviewed
- Note any promises made to customer
- Record follow-up requirements

---

## Refund Scenarios and Guidelines

### Scenario 1: Driver Misconduct
**Example**: Driver was rude, refused to load goods, demanded extra payment

**Process**:
1. Customer support receives complaint
2. Agent creates refund request with:
   - Full booking amount or partial based on severity
   - Evidence: Customer complaint, call recording
   - Reason: "Driver misconduct - [specific details]"
3. Admin reviews and approves
4. After buffer, refund processed
5. Driver may be flagged for review

**Refund Amount**: 50-100% of booking amount

---

### Scenario 2: Service Quality Issues
**Example**: Delayed pickup, rough handling of goods, wrong route

**Process**:
1. Customer complains about service
2. Agent investigates (checks GPS logs, timeline)
3. Creates refund request with:
   - Partial refund (10-30% of booking)
   - Evidence: GPS logs, timeline screenshots
   - Reason: "Service quality issue - [specific details]"
4. Admin approves
5. Refund processed after buffer

**Refund Amount**: 10-30% of booking amount

---

### Scenario 3: System Error
**Example**: Double charge, incorrect fare calculation, payment gateway issue

**Process**:
1. Customer reports payment issue
2. Agent verifies in transaction logs
3. Creates refund request with:
   - Exact overcharge amount
   - Evidence: Transaction logs, invoice screenshots
   - Reason: "System error - [specific details]"
4. Admin fast-tracks approval
5. Refund processed after buffer

**Refund Amount**: Exact overcharge amount

---

### Scenario 4: Goodwill Gesture
**Example**: Long wait time, app issues, first-time user experience issue

**Process**:
1. Customer expresses dissatisfaction
2. Agent decides goodwill refund appropriate
3. Creates refund request with:
   - Small amount (₹50-₹200)
   - Evidence: Customer feedback, app logs
   - Reason: "Goodwill gesture - [specific details]"
4. Admin approves
5. Refund processed after buffer

**Refund Amount**: ₹50-₹200 (fixed amounts)

---

### Scenario 5: Booking Cancellation Issues
**Example**: Automatic refund failed, incorrect cancellation charge

**Process**:
1. Customer reports refund not received
2. Agent checks RefundIntent status
3. If failed or incorrect:
   - Creates admin refund request
   - Evidence: Failed refund logs, calculation screenshots
   - Reason: "Refund processing failure - [specific details]"
4. Admin approves
5. Refund processed after buffer

**Refund Amount**: Correct refund amount per policy

---

## Evidence Requirements

### Types of Evidence
1. **Screenshots**: App screens, error messages, payment confirmations
2. **Photos**: Damaged goods, vehicle condition, driver behavior
3. **Chat Logs**: Customer-driver conversations, support chats
4. **Call Recordings**: Customer service calls (with consent)
5. **System Logs**: Transaction logs, GPS logs, timeline data
6. **Invoices**: Payment receipts, booking invoices

### Evidence Guidelines
- Upload to Firebase Storage
- Get public URLs
- Include in `evidenceUrls` array
- Minimum 1 evidence file required
- Maximum 10 evidence files per request

### Evidence Storage
- Path: `admin-refunds/{refundId}/{filename}`
- Retention: Permanent (for audit)
- Access: Admin portal only

---

## Listing and Filtering

### Refunds List
**Endpoint**: `GET /admin-api/refunds`

**Filters**:
- `status`: Filter by refund status
- `customerId`: Filter by customer
- `driverId`: Filter by driver
- `startDate` / `endDate`: Date range
- `search`: Search by booking number, customer name, phone

**Sorting**: Most recent first

**Pagination**: 20 per page (default)

---

## Integration Points

### 1. Booking Service
- Validates booking exists
- Provides booking details
- Links refund to booking

### 2. Razorpay Service
- Processes online refunds
- Handles refund failures
- Provides refund status

### 3. Wallet Service
- Credits wallet refunds
- Creates wallet logs
- Updates customer balance

### 4. Firebase (FCM)
- Notifies customers of refund status
- Sends refund completion notifications

### 5. Cron Service
- Processes expired buffers
- Creates RefundIntents
- Triggers refund processing

---

## Best Practices

### For Agents/Customer Support
1. Always collect evidence before creating request
2. Be specific in refund reason
3. Calculate refund amount fairly
4. Document all customer interactions in support notes
5. Follow up with customer after refund

### For Admins
1. Review evidence thoroughly
2. Verify refund amount calculation
3. Check customer refund history for patterns
4. Use buffer window for additional investigation
5. Approve reverts only when necessary

### For All Roles
1. Add support notes for every interaction
2. Be professional in all communications
3. Follow refund guidelines consistently
4. Escalate unusual cases
5. Monitor refund metrics

---

## Troubleshooting

### Refund Not Processing
**Symptoms**: Refund stuck in APPROVED status past buffer time

**Solutions**:
1. Check cron job status
2. Check RefundIntent creation
3. Check Razorpay API status
4. Manually trigger processing (SUPER_ADMIN)

### Razorpay Refund Failed
**Symptoms**: RefundIntent status is FAILED

**Solutions**:
1. Check Razorpay dashboard
2. Verify payment ID is valid
3. Check refund amount ≤ payment amount
4. Retry refund (automatic after delay)
5. Contact Razorpay support if persistent

### Customer Not Receiving Refund
**Symptoms**: RefundIntent is COMPLETED but customer complains

**Solutions**:
1. Check wallet logs for credit
2. Check Razorpay refund status
3. Verify customer is checking correct wallet
4. Check FCM notification delivery
5. Provide refund reference number

---

## Metrics and Monitoring

### Key Metrics
- Total refunds processed (daily/weekly/monthly)
- Average refund amount
- Refund approval rate
- Refund rejection rate
- Revert request frequency
- Average processing time
- Refund by reason category

### Alerts
- High refund volume (> threshold)
- Large refund amount (> ₹5000)
- Multiple refunds for same customer
- Refund processing failures
- Buffer expiry failures

### Reports
- Daily refund summary
- Agent refund creation stats
- Admin approval/rejection stats
- Refund reason analysis
- Customer refund history
